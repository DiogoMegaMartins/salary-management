/** Acumulados, saldos iniciais, ajustes, submetas e conversão de moeda (EVO-04). */
import { toCents } from "./distribution";

/* ------------------------------------------------ acumulados, ajustes e submetas (EVO-04) */

type GEntry = { id: number; parcelId: number; subgoalId: number | null; kind: string; amount: number; currency: string; date: string };
type GSub = { id: number; parcelId: number; name: string; currency: string; target: number | null; platformId?: number | null; deadline?: string | null };
type GLink = { transactionId: number; subgoalId: number; amount: number };
type GRate = { fromCurrency: string; toCurrency: string; rate: number; date: string };
type GTx = { id: number; parcelId: number | null; type: string; date: string; value: number };

export type GoalCtx = {
  /** fluxo mensal já existente (alocações) desta meta: chave = ano*12 + (mês-1) */
  monthly: { key: number; amount: number }[];
  entries: GEntry[];
  subgoals: GSub[];
  links: GLink[];
  rates: GRate[];
  transactions: GTx[];
  refCurrency: string;
};

export const monthKeyOf = (year: number, month: number) => year * 12 + (month - 1);
const dateKey = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return monthKeyOf(y, m);
};

/** Converte para a moeda de referência com taxa manual (direta ou inversa, a mais recente). null = falta taxa. */
export function convertAmount(amount: number, from: string, to: string, rates: GRate[]): number | null {
  if (from === to) return amount;
  const latest = (a: string, b: string) =>
    rates.filter((r) => r.fromCurrency === a && r.toCurrency === b && r.rate > 0).sort((x, y) => y.date.localeCompare(x.date))[0];
  const d = latest(from, to);
  if (d) return Math.round(amount * d.rate * 100) / 100;
  const inv = latest(to, from);
  if (inv) return Math.round((amount / inv.rate) * 100) / 100;
  return null;
}

export type SubBreakdown = {
  sub: GSub;
  opening: number;
  linked: number;
  adjustments: number;
  balance: number; // na moeda da submeta
  converted: number | null; // na moeda de referência da meta
  remaining: number | null;
  progress: number | null;
};
export type GoalBreakdown = {
  hasOpening: boolean;
  opening: number;
  flows: number;
  txNet: number;
  adjustments: number;
  unallocated: number;
  subs: SubBreakdown[];
  total: number;
  incomplete: boolean;
  missing: string[];
};

/**
 * Acumulado = saldo inicial + contribuições realizadas não incluídas no saldo inicial − levantamentos + ajustes.
 * Sem saldo inicial, o resultado é exatamente o histórico atual (alocações): saldos existentes não mudam.
 * Corte inclusivo: o mês da data de referência e seguintes contam como novos; meses anteriores já estão no saldo inicial.
 * Movimentos (aporte/retirada) só entram quando existe saldo inicial, e só com data ≥ data de referência.
 */
export function goalBreakdown(ctx: GoalCtx, parcelId: number): GoalBreakdown {
  const c = (n: number) => toCents(n);
  const entries = ctx.entries.filter((e) => e.parcelId === parcelId);
  const openingEntry = entries.find((e) => e.kind === "inicial" && e.subgoalId == null);
  const cut = openingEntry ? dateKey(openingEntry.date) : -Infinity;
  const cutDate = openingEntry?.date ?? "";

  const flows = ctx.monthly.filter((m) => m.key >= cut).reduce((a, m) => a + c(m.amount), 0);
  const txs = ctx.transactions.filter(
    (t) => t.parcelId === parcelId && (t.type === "contribution" || t.type === "withdrawal") && t.date.slice(0, 10) >= cutDate,
  );
  const sign = (t: GTx) => (t.type === "withdrawal" ? -1 : 1);
  const txAll = openingEntry ? txs.reduce((a, t) => a + sign(t) * c(t.value), 0) : 0;

  const mySubs = ctx.subgoals.filter((s) => s.parcelId === parcelId);
  const txOf = new Map(ctx.transactions.map((t) => [t.id, t] as const));
  const linkedTotalCents = ctx.links
    .filter((l) => mySubs.some((s) => s.id === l.subgoalId) && txOf.has(l.transactionId))
    .reduce((a, l) => a + sign(txOf.get(l.transactionId)!) * c(l.amount), 0);
  // a parte atribuída a submetas sai do saldo não distribuído (sem dupla contagem)
  // sem saldo inicial os aportes não contam, mas a parte atribuída a submetas sai na mesma do saldo por distribuir:
  // assim atribuir um aporte a uma submeta não aumenta o total da meta
  const txNet = openingEntry ? txAll - linkedTotalCents : -linkedTotalCents;

  const adjMain = entries.filter((e) => e.kind === "ajuste" && e.subgoalId == null).reduce((a, e) => a + c(e.amount), 0);
  const openingMain = openingEntry ? c(openingEntry.amount) : 0;
  const unallocatedCents = openingMain + flows + txNet + adjMain;

  const missing = new Set<string>();
  const subs: SubBreakdown[] = mySubs.map((sub) => {
    const se = entries.filter((e) => e.subgoalId === sub.id);
    const op = se.filter((e) => e.kind === "inicial").reduce((a, e) => a + c(e.amount), 0);
    const adj = se.filter((e) => e.kind === "ajuste").reduce((a, e) => a + c(e.amount), 0);
    const linked = ctx.links
      .filter((l) => l.subgoalId === sub.id && txOf.has(l.transactionId))
      .reduce((a, l) => a + sign(txOf.get(l.transactionId)!) * c(l.amount), 0);
    const balance = (op + adj + linked) / 100;
    const converted = convertAmount(balance, sub.currency, ctx.refCurrency, ctx.rates);
    if (converted == null) missing.add(`${sub.currency}→${ctx.refCurrency}`);
    return {
      sub,
      opening: op / 100,
      linked: linked / 100,
      adjustments: adj / 100,
      balance,
      converted,
      remaining: sub.target != null ? Math.max(0, sub.target - balance) : null,
      progress: sub.target ? Math.min(1, balance / sub.target) : null,
    };
  });
  const convertedCents = subs.reduce((a, s) => a + (s.converted != null ? c(s.converted) : 0), 0);
  return {
    hasOpening: !!openingEntry,
    opening: openingMain / 100,
    flows: flows / 100,
    txNet: txNet / 100,
    adjustments: adjMain / 100,
    unallocated: unallocatedCents / 100,
    subs,
    total: (unallocatedCents + convertedCents) / 100,
    incomplete: missing.size > 0,
    missing: Array.from(missing),
  };
}
