/** Regras puras da divisão do salário (barra de relance, "por distribuir", repartir o que sobra). */
import { toCents } from "./calc/distribution";

export type DivisionStatus = "livre" | "completo" | "excede";

/** Estado da divisão: sobra, está completa (a menos de 1 cêntimo) ou excede o disponível. */
export function divisionStatus(available: number, allocated: number): { status: DivisionStatus; remaining: number } {
  const remaining = (toCents(available) - toCents(allocated)) / 100;
  return { status: Math.abs(remaining) < 0.005 ? "completo" : remaining > 0 ? "livre" : "excede", remaining };
}

/**
 * Reparte `leftoverCents` (cêntimos, >= 0) pelas partes, proporcionalmente ao valor de cada uma. A soma é exata:
 * o que sobra dos arredondamentos vai para os maiores restos. Sem partes com valor, devolve `null`.
 */
export function splitLeftover(leftoverCents: number, parts: { id: number; value: number }[]): Record<number, number> | null {
  const eligible = parts.filter((p) => p.value > 0);
  const total = eligible.reduce((a, p) => a + p.value, 0);
  if (leftoverCents <= 0 || total <= 0) return null;
  const raw = eligible.map((p) => ({ id: p.id, exact: (leftoverCents * p.value) / total }));
  const out: Record<number, number> = {};
  for (const r of raw) out[r.id] = Math.floor(r.exact);
  let rest = leftoverCents - Object.values(out).reduce((a, b) => a + b, 0);
  for (const r of [...raw].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)))) {
    if (rest <= 0) break;
    out[r.id] += 1;
    rest -= 1;
  }
  return out;
}

/** Valor e percentagem de uma parcela, para mostrar os dois lado a lado. */
export function shareOf(amount: number, available: number): number {
  return available > 0 ? Math.round((amount / available) * 1000) / 10 : 0;
}

export type LeftoverPart = { id: number; name: string; amount: number; fixed: boolean };
export type LeftoverChange = { id: number; amount: number };

/**
 * Novos valores em € fixo para repartir o que sobra: tudo para uma parcela (`uma`, a de `targetId` ou a primeira) ou
 * proporcional ao peso das parcelas em € fixo (`proporcional`). Lista vazia se não houver nada a alterar.
 */
export function planLeftover(kind: "uma" | "proporcional", remaining: number, parts: LeftoverPart[], targetId?: number): LeftoverChange[] {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  if (remaining <= 0.005) return [];
  if (kind === "uma") {
    const chosen = parts.find((p) => p.id === targetId) ?? parts[0];
    return chosen ? [{ id: chosen.id, amount: r2(chosen.amount + remaining) }] : [];
  }
  const split = splitLeftover(Math.round(remaining * 100), parts.filter((p) => p.fixed).map((p) => ({ id: p.id, value: p.amount })));
  if (!split) return [];
  return parts.filter((p) => split[p.id] != null).map((p) => ({ id: p.id, amount: r2(p.amount + split[p.id] / 100) }));
}
