import { supportsOffline, projectOffline, type OfflineOp } from "@shared/offline";

type Vault = { state: any; version: string; at: string; operations: OfflineOp[]; batchId: string; reads: Record<string, any> };
type Envelope = { salt: number[]; iv: number[]; bytes: number[] };
const CACHE = "particao-private-v1";
const vaultUrl = () => new URL("./__offline_vault__", document.baseURI).href;
let vault: Vault | null = null;
let key: CryptoKey | null = null;
let salt: Uint8Array;
let error = "";
let syncing = false;
let conflict = false;
let serial: Promise<any> = Promise.resolve();
let rawRequest: (method: string, url: string, data?: unknown) => Promise<Response>;
let invalidate: () => void = () => {};
const changed = () => window.dispatchEvent(new Event("sm:offline"));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
export function offlineInfo() { return { enabled: !!vault, count: vault?.operations.length ?? 0, at: vault?.at ?? "", error, syncing, conflict, online: navigator.onLine }; }
export function configureOffline(request: typeof rawRequest, refresh: () => void) { rawRequest = request; invalidate = refresh; }
async function derive(code: string, s: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: s as BufferSource, iterations: 310000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function write(next: Vault) {
  if (!key) throw new Error("Cópia offline bloqueada.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(next)));
  const cache = await caches.open(CACHE);
  await cache.put(vaultUrl(), new Response(JSON.stringify({ salt: Array.from(salt), iv: Array.from(iv), bytes: Array.from(new Uint8Array(bytes)) })));
  vault = next; error = ""; conflict = false; changed();
}
async function readWithKey() {
  const response = await (await caches.open(CACHE)).match(vaultUrl());
  if (!response || !key) throw new Error("Cópia offline não disponível.");
  const env: Envelope = await response.json();
  const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(env.iv) }, key, new Uint8Array(env.bytes));
  return JSON.parse(new TextDecoder().decode(bytes)) as Vault;
}
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = () => navigator.locks ? navigator.locks.request("particao-offline", fn) : fn();
  const next = serial.then(run, run);
  serial = next.catch(() => {});
  return next;
}
export async function hasOffline() {
  try { return !!await (await caches.open(CACHE)).match(vaultUrl()); } catch { return false; }
}
export async function unlockOffline(code: string) {
  try {
    const response = await (await caches.open(CACHE)).match(vaultUrl());
    if (!response) return false;
    const env: Envelope = await response.json();
    salt = new Uint8Array(env.salt);
    key = await derive(code, salt);
    vault = await readWithKey();
    changed(); return true;
  } catch { key = null; vault = null; return false; }
}
export function lockOffline() { key = null; vault = null; error = ""; conflict = false; changed(); }
export async function enableOffline(code: string) {
  if (code.length < 8) throw new Error("Define um código de acesso com pelo menos 8 caracteres em Segurança e volta a entrar antes de ativar offline.");
  if (!window.isSecureContext || !("serviceWorker" in navigator)) throw new Error("Instalação offline exige um endereço HTTPS próprio, fora da pré-visualização incorporada.");
  try { await caches.open(CACHE); } catch { throw new Error("Este navegador ou pré-visualização não permite guardar offline. Abre a aplicação num endereço próprio."); }
  if (await hasOffline()) {
    if (!await unlockOffline(code)) throw new Error("Já existe uma cópia cifrada neste dispositivo com outro código. Não foi substituída.");
    return;
  }
  const registration = await navigator.serviceWorker.register(new URL("./sw.js", document.baseURI));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("A instalação offline não ficou pronta. Verifica a ligação e tenta novamente.")), 20000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
  if (!registration.active) throw new Error("A instalação offline ainda não está pronta. Tenta novamente.");
  const res = await rawRequest("GET", "/api/state");
  const state = await res.json();
  const version = res.headers.get("X-State-Version");
  if (!version) throw new Error("Servidor sem suporte de sincronização.");
  state.settings.accessCode = "";
  salt = crypto.getRandomValues(new Uint8Array(16));
  key = await derive(code, salt);
  await exclusive(() => write({ state, version, at: new Date().toISOString(), operations: [], batchId: crypto.randomUUID(), reads: {} }));
  try { await navigator.storage?.persist(); } catch { /* browser may refuse persistent storage */ }
}
export async function forgetOffline() {
  await exclusive(async () => {
    if (key) vault = await readWithKey();
    if (vault?.operations.length) throw new Error("Existem alterações pendentes. Sincroniza ou exporta-as para revisão; não foram apagadas.");
    await caches.delete(CACHE);
    lockOffline();
  });
}
export function exportOffline() {
  if (!vault) return;
  const blob = new Blob([JSON.stringify({ ...vault, notice: "Cópia local e alterações pendentes. Contém informação financeira privada; não é um backup de servidor." }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `particao-offline-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function syncOffline() {
  if (!vault || syncing || !navigator.onLine) return;
  syncing = true; changed();
  try {
    await exclusive(async () => {
      const local = await readWithKey();
      if (!local.operations.length) {
        // Another tab may already have synchronized this encrypted queue.
        vault = local; error = ""; conflict = false; changed();
        return;
      }
      const res = await rawRequest("POST", "/api/offline/sync", { id: local.batchId, version: local.version, operations: local.operations });
      const result = await res.json();
      result.state.settings.accessCode = "";
      await write({ state: result.state, version: result.version, at: new Date().toISOString(), operations: [], batchId: crypto.randomUUID(), reads: {} });
    });
    invalidate();
  } catch (e: any) { error = e.message || "Sem ligação. Alterações preservadas."; conflict = e.status === 409 && e.message.startsWith("Conflito:"); }
  finally { syncing = false; changed(); }
}
export type ConflictReview = { state: any; version: string; batchId: string; operations: OfflineOp[] };
export async function reviewConflict(): Promise<ConflictReview> {
  if (!vault || !conflict) throw new Error("Não há um conflito confirmado para rever.");
  const res = await rawRequest("GET", "/api/state");
  const state = await res.json(); state.settings.accessCode = "";
  const version = res.headers.get("X-State-Version");
  if (!version) throw new Error("Versão do servidor indisponível.");
  return { state, version, batchId: vault.batchId, operations: clone(vault.operations) };
}
export async function applyReviewedConflict(review: ConflictReview) {
  await exclusive(async () => {
    const local = await readWithKey();
    if (local.batchId !== review.batchId || JSON.stringify(local.operations) !== JSON.stringify(review.operations))
      throw new Error("As alterações locais mudaram. Abre uma nova revisão.");
    const state = clone(review.state);
    for (const op of local.operations) projectOffline(state, op); // Closed months still block reapplication.
    await write({ ...local, state, version: review.version, batchId: crypto.randomUUID(), reads: {} });
  });
  invalidate();
  await syncOffline(); // Server rechecks the reviewed version atomically, never force-writes.
}
export async function offlineRequest(method: string, url: string, data?: any): Promise<Response> {
  if (vault && method !== "GET" && supportsOffline(method, url)) {
    let result: any;
    await exclusive(async () => {
      const local = await readWithKey();
      if (local.operations.length >= 500) throw new Error("Limite de 500 alterações offline. Sincroniza antes de continuar.");
      const op: OfflineOp = { method, url, data: clone(data), localId: -Date.now() };
      result = projectOffline(local.state, op);
      local.operations.push(op);
      await write(local); // No optimistic success before durable encrypted write.
    });
    if (navigator.onLine) void syncOffline();
    return Response.json(result);
  }
  if (vault?.operations.length && method !== "GET") throw new Error("Sincroniza primeiro as alterações pendentes. Esta operação exige ligação.");
  if (vault && method === "PATCH" && url === "/api/settings" && data && "accessCode" in data)
    throw new Error("Remove a cópia offline deste dispositivo antes de alterar o código de acesso.");
  if (vault && method === "GET" && vault.operations.length && url === "/api/state") return Response.json(vault.state);
  try {
    const res = await rawRequest(method, url, data);
    if (vault && method === "GET" && url === "/api/state") {
      const state = await res.clone().json();
      state.settings.accessCode = "";
      const version = res.headers.get("X-State-Version");
      if (version) await exclusive(async () => {
        const local = await readWithKey();
        if (!local.operations.length) await write({ ...local, state, version, at: new Date().toISOString() });
      });
    }
    return res;
  } catch (e: any) {
    // HTTP validation/auth/conflict errors are never presented as a successful offline read.
    if (e.status || !vault) throw e;
    if (method === "GET" && url === "/api/state") return Response.json(vault.state);
    throw new Error("Sem ligação. Esta operação não está disponível offline; os dados existentes foram preservados.");
  }
}
window.addEventListener("online", () => { changed(); void syncOffline(); });
window.addEventListener("offline", changed);
window.addEventListener("focus", () => { if (vault) void syncOffline(); });
