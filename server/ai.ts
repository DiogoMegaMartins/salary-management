import { sqlite } from "./db";
import { AI_DAILY_LIMIT, AI_MAX_SENTENCE, buildAiRequest, parseAiReply, type AiModelKey, type Intent } from "@shared/ai-intent";
import { httpError } from "./db";

/**
 * Assistente com IA (frases livres). Só traduz uma frase em campos: nunca recebe nem grava dados financeiros.
 * Desligado até haver `ANTHROPIC_API_KEY` no servidor e a pessoa ligar a opção. A chave nunca sai daqui.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 15_000;

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;
let fetchImpl: FetchLike = (url, init) => fetch(url, init) as any;
/** Só para testes: troca o pedido ao serviço por um simulado. */
export function setAiFetch(f: FetchLike | null) { fetchImpl = f ?? ((url, init) => fetch(url, init) as any); }

export const aiConfigured = () => (process.env.ANTHROPIC_API_KEY ?? "").trim().length > 0;
const today = () => new Date().toISOString().slice(0, 10);

export function aiUsedToday(): number {
  const row = sqlite.prepare("SELECT count FROM ai_usage WHERE day = ?").get(today()) as { count: number } | undefined;
  return row?.count ?? 0;
}
function aiCount() {
  sqlite.prepare("INSERT INTO ai_usage (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1").run(today());
  sqlite.prepare("DELETE FROM ai_usage WHERE day < date(?, '-30 day')").run(today()); // só guarda um mês
}

export type AiStatus = { configured: boolean; enabled: boolean; model: AiModelKey; limit: number; used: number };
export function aiStatus(settings: { aiEnabled: number; aiModel: string }): AiStatus {
  return {
    configured: aiConfigured(),
    enabled: settings.aiEnabled === 1,
    model: settings.aiModel === "sonnet" ? "sonnet" : "haiku",
    limit: AI_DAILY_LIMIT,
    used: aiUsedToday(),
  };
}

/** Traduz uma frase. Falha com 503 (não configurada ou desligada), 400 (frase inválida), 429 (limite) ou 502 (serviço). */
export async function parseSentence(opts: { sentence: unknown; clientToday: unknown; categories: string[]; settings: { aiEnabled: number; aiModel: string } }): Promise<{ intent: Intent; remaining: number }> {
  const st = aiStatus(opts.settings);
  if (!st.configured) throw httpError(503, "A IA não está configurada neste servidor.");
  if (!st.enabled) throw httpError(503, "O assistente com IA está desligado.");
  const sentence = typeof opts.sentence === "string" ? opts.sentence.trim() : "";
  if (!sentence || sentence.length > AI_MAX_SENTENCE) throw httpError(400, `Escreve uma frase com até ${AI_MAX_SENTENCE} letras.`);
  const day = typeof opts.clientToday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(opts.clientToday) ? opts.clientToday : today();
  if (st.used >= st.limit) throw httpError(429, `Atingiste o limite de ${st.limit} pedidos de IA por hoje. Usa as perguntas do assistente ou volta amanhã.`);
  aiCount(); // conta antes de chamar o serviço: protege o custo mesmo se o serviço falhar

  const body = buildAiRequest(sentence, day, opts.categories, st.model);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": (process.env.ANTHROPIC_API_KEY ?? "").trim(), "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = Array.isArray(data?.content) ? data.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("") : "";
    return { intent: parseAiReply(text, day), remaining: Math.max(0, st.limit - (st.used + 1)) };
  } catch (e) {
    // o motivo vai para os registos sem a chave nem o corpo da resposta; o cliente só vê uma mensagem genérica
    console.warn("IA: o serviço não respondeu:", e instanceof Error ? e.message : "erro");
    throw httpError(502, "O serviço de IA não respondeu. Tenta outra vez ou usa as perguntas do assistente.");
  } finally {
    clearTimeout(timer);
  }
}
