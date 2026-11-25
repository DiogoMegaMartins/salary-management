import { latestOpenMonth, monthOfDate } from "./assistant";

/** Regras puras do Início: "Sobra este mês" = disponível do mês − despesas registadas. */

export type HomeState = "ok" | "atencao" | "excedido";
export type HomeCategory = { name: string; value: number; pct: number };
export type HomeSummary = {
  spent: number;
  left: number;
  /** 0 a 100, gasto sobre o disponível (100 se gastou algo sem ter disponível) */
  pctSpent: number;
  state: HomeState;
  /** dias até ao fim do mês, só se for o mês de hoje */
  daysLeft: number | null;
  categories: HomeCategory[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;
export const NO_CATEGORY = "Sem categoria";

export function homeSummary(input: {
  month: { year: number; month: number };
  available: number;
  expenses: { value: number; category: string }[];
  today: string;
}): HomeSummary {
  const { month, available, expenses, today } = input;
  const spent = r2(expenses.reduce((s, e) => s + e.value, 0));
  const left = r2(available - spent);
  const ratio = available > 0 ? spent / available : spent > 0 ? Infinity : 0;
  const state: HomeState = left < 0 ? "excedido" : ratio >= 0.9 ? "atencao" : "ok";
  const pctSpent = Math.min(100, Math.round(ratio * 100));

  const sameMonth = Number(today.slice(0, 4)) === month.year && Number(today.slice(5, 7)) === month.month;
  const lastDay = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  const daysLeft = sameMonth ? lastDay - Number(today.slice(8, 10)) : null;

  const by = new Map<string, number>();
  for (const e of expenses) {
    const name = e.category.trim() || NO_CATEGORY;
    by.set(name, r2((by.get(name) ?? 0) + e.value));
  }
  const categories = [...by.entries()]
    .map(([name, value]) => ({ name, value, pct: spent > 0 ? (value / spent) * 100 : 0 }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt"));

  return { spent, left, pctSpent, state, daysLeft, categories };
}

type MonthRef = { id: number; year: number; month: number; base: number; status?: string };

/** Mês que o Início mostra: o de hoje se estiver aberto, senão o último aberto, senão o mais recente. */
export function pickHomeMonth<T extends MonthRef>(months: T[], today: string): T | null {
  const doHoje = monthOfDate(months, today);
  if (doHoje && doHoje.status !== "fechado") return doHoje;
  const aberto = latestOpenMonth(months);
  if (aberto) return aberto;
  return [...months].sort((a, b) => a.year - b.year || a.month - b.month).pop() ?? null;
}
