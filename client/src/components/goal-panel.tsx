import type { AppState } from "@/lib/app";
import { goalBreakdown, monthKeyOf } from "@shared/calc";
import type { Parcel } from "@shared/schema";

export function goalCtx(state: AppState, parcel: Parcel, monthly: { key: number; amount: number }[]) {
  return {
    monthly,
    entries: state.goalEntries ?? [],
    subgoals: state.subgoals ?? [],
    links: state.contributionLinks ?? [],
    rates: state.fxRates ?? [],
    transactions: state.transactions,
    refCurrency: parcel.currency || "EUR",
  } as any;
}

/** Acumulado de uma meta (histórico + saldo inicial + ajustes + submetas): fonte única para Painel, Parcelas e Orçamento. */
export function goalTotalOf(state: AppState, parcel: Parcel, allComputed: { month: { year: number; month: number }; byParcel: Record<number, number> }[]): number {
  const monthly = allComputed.map((x) => ({ key: monthKeyOf(x.month.year, x.month.month), amount: x.byParcel[parcel.id] ?? 0 }));
  return goalBreakdown(goalCtx(state, parcel, monthly), parcel.id).total;
}
