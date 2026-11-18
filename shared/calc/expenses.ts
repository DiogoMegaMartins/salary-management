/** Despesas por mês e dia (EVO-05). */
import { toCents } from "./distribution";

/* ------------------------------------------------ despesas por mês e dia (EVO-05) */

export type ExpenseFilter = { categoryKey?: string; parcelId?: number; parcelIds?: number[]; search?: string };
export const UNCLASSIFIED = "__sem_categoria__";

/** Despesas = tipos expense e withdrawal (a mesma regra de despesasExtraOf usada nos Meses). Transferências e aportes ficam de fora. */
export const isExpenseLike = (t: { type: string }) => t.type === "expense" || t.type === "withdrawal";

export function expenseView<T extends { monthId: number; date: string; type: string; value: number; parcelId: number | null; category: string; note: string; id: number }>(
  txs: T[],
  monthId: number,
  f: ExpenseFilter = {},
) {
  const inMonth = txs.filter((t) => t.monthId === monthId);
  const expenses = inMonth.filter(isExpenseLike);
  const q = (f.search ?? "").trim().toLowerCase();
  const filtered = expenses.filter((t) => {
    if (f.categoryKey === UNCLASSIFIED && t.category.trim() !== "") return false;
    if (f.categoryKey && f.categoryKey !== UNCLASSIFIED && t.category.trim() !== f.categoryKey) return false;
    if (f.parcelId != null && t.parcelId !== f.parcelId) return false;
    if (f.parcelIds && (t.parcelId == null || !f.parcelIds.includes(t.parcelId))) return false;
    if (q && !`${t.note} ${t.category}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const sum = (a: T[]) => a.reduce((s, t) => s + toCents(t.value), 0) / 100;
  const byDay = new Map<string, T[]>();
  for (const t of filtered) {
    const k = t.date.slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), t]);
  }
  const days = Array.from(byDay.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items: items.sort((a, b) => b.id - a.id), total: sum(items) }));
  const unclassified = expenses.filter((t) => t.category.trim() === "");
  const others = inMonth.filter((t) => !isExpenseLike(t));
  return {
    monthTotal: sum(expenses),
    filteredTotal: sum(filtered),
    count: expenses.length,
    filteredCount: filtered.length,
    days,
    unclassifiedCount: unclassified.length,
    unclassifiedTotal: sum(unclassified),
    excludedTransfers: inMonth.filter((t) => t.type === "transfer").length,
    excludedOthers: others.length,
  };
}
