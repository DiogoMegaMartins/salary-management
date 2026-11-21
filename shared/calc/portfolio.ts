/** Valor de mercado de uma parcela contra o que lá foi posto (ganho ou perda). Funções puras. */

export type ValuationLike = { id: number; parcelId: number; date: string; value: number; note?: string };
type MonthLike = { year: number; month: number };

const round2 = (n: number) => Math.round(n * 100 + 1e-9) / 100;

/** Dia (AAAA-MM-DD) -> chave comparável do mês (AAAAMM). */
const monthKey = (date: string) => Number(date.slice(0, 4)) * 100 + Number(date.slice(5, 7));

/** O que foi posto na parcela até ao mês da avaliação (inclusive): saldo de partida mais as alocações desses meses. */
export function contributedUntil(
  base: number,
  computed: { month: MonthLike; byParcel: Record<number, number> }[],
  parcelId: number,
  date: string,
): number {
  const limit = monthKey(date);
  let total = base;
  for (const c of computed) if (c.month.year * 100 + c.month.month <= limit) total += c.byParcel[parcelId] ?? 0;
  return round2(total);
}

export type ParcelReturn = {
  /** Avaliação mais recente, ou null se ainda não há. */
  latest: ValuationLike | null;
  /** Posto na parcela até ao mês dessa avaliação. */
  contributed: number;
  /** Valor da avaliação menos o posto; null sem avaliação. */
  gain: number | null;
  /** Ganho sobre o posto (0,05 = 5 %); null sem avaliação ou sem nada posto. */
  gainPct: number | null;
};

export function parcelReturn(
  base: number,
  computed: { month: MonthLike; byParcel: Record<number, number> }[],
  parcelId: number,
  valuations: ValuationLike[],
): ParcelReturn {
  const own = valuations.filter((v) => v.parcelId === parcelId);
  // a mais recente por data; em empate, a última registada
  const latest = own.reduce<ValuationLike | null>((best, v) => (!best || v.date > best.date || (v.date === best.date && v.id > best.id) ? v : best), null);
  if (!latest) return { latest: null, contributed: round2(computed.reduce((a, c) => a + (c.byParcel[parcelId] ?? 0), base)), gain: null, gainPct: null };
  const contributed = contributedUntil(base, computed, parcelId, latest.date);
  const gain = round2(latest.value - contributed);
  return { latest, contributed, gain, gainPct: contributed > 0 ? gain / contributed : null };
}
