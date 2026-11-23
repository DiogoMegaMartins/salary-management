import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Intent, AiModelKey } from "@shared/ai-intent";

export type AiStatus = { configured: boolean; enabled: boolean; model: AiModelKey; limit: number; used: number };
export const AI_STATUS_KEY = ["/api/assistant/ai-status"];

/** Estado do assistente com IA. Sem chave no servidor, `configured` é false e nada da IA aparece. */
export function useAiStatus() {
  return useQuery<AiStatus>({ queryKey: AI_STATUS_KEY, staleTime: 30_000, retry: false });
}

/** A frase só é usada se a IA estiver configurada **e** ligada. */
export const aiReady = (s: AiStatus | undefined) => !!s && s.configured && s.enabled && s.used < s.limit;

export async function parseSentence(sentence: string, today: string): Promise<{ intent: Intent; remaining: number }> {
  return (await apiRequest("POST", "/api/assistant/parse", { sentence, today })).json();
}
