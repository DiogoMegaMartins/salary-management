import { MutationCache, QueryClient, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { configureOffline, offlineRequest, lockOffline } from "./offline";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

/* Sessão de acesso: o código fica em memória e em sessionStorage (apagado ao fechar o separador),
   com expiração por inatividade. Cada pedido à API renova o prazo. */
const SESSION_KEY = "sm.session";
const SESSION_IDLE_MS = 30 * 60 * 1000;
let accessCode = "";
function persist(code: string) {
  try {
    if (code) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ c: code, t: Date.now() }));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* sem armazenamento disponível: fica só em memória */
  }
}
export function setAccessCode(code: string) {
  accessCode = code;
  persist(code);
}
/** Recupera a sessão guardada se ainda estiver dentro do prazo de inatividade */
export function restoreAccessCode(): string {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return "";
    const { c, t } = JSON.parse(raw);
    if (typeof c === "string" && c && Date.now() - Number(t) < SESSION_IDLE_MS) {
      accessCode = c;
      return c;
    }
  } catch {
    /* ignora */
  }
  persist("");
  return "";
}
/** Renova o prazo com atividade real do utilizador (no máximo uma escrita por 30 s) */
let lastTouch = 0;
if (typeof window !== "undefined") {
  const touch = () => {
    const now = Date.now();
    if (accessCode && now - lastTouch > 30_000) {
      lastTouch = now;
      persist(accessCode);
    }
  };
  ["pointerdown", "keydown", "touchstart", "scroll", "hashchange", "visibilitychange"].forEach((ev) =>
    window.addEventListener(ev, touch, { passive: true, capture: true }),
  );
}
export function getAccessCode() {
  return accessCode;
}
export function clearAccessCode() {
  accessCode = "";
  persist("");
  lockOffline();
}
function authHeaders(): Record<string, string> {
  if (accessCode) persist(accessCode); // renova o prazo de inatividade
  return accessCode ? { "x-sm-client": "1", "x-codigo-acesso": accessCode } : { "x-sm-client": "1" };
}
/** URL da API (o código de acesso vai sempre em cabeçalho, nunca no URL) */
export function withAccessCode(path: string) {
  return `${API_BASE}${path}`;
}

async function throwIfResNotOk(res: Response) {
  if (res.status === 401 && accessCode) window.dispatchEvent(new Event("sm:locked"));
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let message = text;
    try { message = JSON.parse(text).message ?? text; } catch { /* non-JSON server error */ }
    throw Object.assign(new Error(message), { status: res.status });
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  return offlineRequest(method, url, data);
}
async function rawRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: data
      ? { "Content-Type": "application/json", ...authHeaders() }
      : authHeaders(),
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let res: Response;
    try { res = await apiRequest("GET", queryKey.join("/")); }
    catch (e: any) { if (unauthorizedBehavior === "returnNull" && e.status === 401) return null; throw e; }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/** Mensagem útil de erros do tipo `409: {"message":"..."}`. */
function errorText(err: any): string {
  const raw = String(err?.message ?? "Erro inesperado");
  const i = raw.indexOf("{");
  if (i >= 0) {
    try {
      const j = JSON.parse(raw.slice(i));
      return j.message ?? j.error ?? raw;
    } catch { /* texto simples */ }
  }
  return raw.replace(/^\d{3}:\s*/, "");
}

export const queryClient = new QueryClient({
  // Uma ação que falha nunca fica em silêncio: as mutações com `onError` próprio tratam do aviso, as restantes mostram-no aqui.
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.options.onError) return;
      toast({ title: "Não foi possível concluir", description: errorText(error), variant: "destructive" });
    },
  }),
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
      networkMode: "always",
    },
    mutations: {
      retry: false,
      networkMode: "always",
    },
  },
});
configureOffline(rawRequest, () => { queryClient.invalidateQueries(); });
