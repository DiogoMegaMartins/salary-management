/**
 * Regras puras do Início: "Valor disponível" = gastos mensais planeados (parcelas do tipo "gastos" do mês)
 * menos as despesas registadas. Contam as despesas sem parcela e as ligadas a parcelas de gastos; as ligadas a
 * poupança ou investimento ficam de fora.
 */
export type InicioState = "ok" | "atencao" | "excedido" | "sem-plano";
export type InicioCategory = { name: string; value: number; pct: number };
export type InicioSummary = {
  planned: number;
  spent: number;
  left: number;
  /** 0 a 100, gasto sobre o planeado */
  pctSpent: number;
  state: InicioState;
  /** dias até ao fim do mês, só se for o mês de hoje */
  daysLeft: number | null;
  categories: InicioCategory[];
};

export const NO_CATEGORY = "Sem categoria";
const r2 = (n: number) => Math.round(n * 100) / 100;

export function inicioSummary(input: {
  month: { year: number; month: number };
  planned: number;
  expenses: { value: number; category: string; parcelKind: string | null }[];
  today: string;
}): InicioSummary {
  const { month, today } = input;
  const planned = r2(input.planned);
  const counted = input.expenses.filter((e) => e.parcelKind === null || e.parcelKind === "gastos");
  const spent = r2(counted.reduce((s, e) => s + e.value, 0));
  const left = r2(planned - spent);

  const sameMonth = Number(today.slice(0, 4)) === month.year && Number(today.slice(5, 7)) === month.month;
  const lastDay = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  const daysLeft = sameMonth ? lastDay - Number(today.slice(8, 10)) : null;

  const ratio = planned > 0 ? spent / planned : 0;
  const pctSpent = planned > 0 ? Math.min(100, Math.round(ratio * 100)) : 0;
  const state: InicioState =
    planned <= 0 ? "sem-plano" : left < 0 ? "excedido" : ratio >= 0.85 && (daysLeft === null || daysLeft > 5) ? "atencao" : "ok";

  const by = new Map<string, number>();
  for (const e of counted) {
    const name = e.category.trim() || NO_CATEGORY;
    by.set(name, r2((by.get(name) ?? 0) + e.value));
  }
  const categories = [...by.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"))
    .map(([name, value]) => ({ name, value, pct: spent > 0 ? (value / spent) * 100 : 0 }));

  return { planned, spent, left, pctSpent, state, daysLeft, categories };
}

/** Parcela de gastos que o Registar propõe: a não arquivada de menor id; sem ela, nenhuma. */
export function defaultExpenseParcel(parcels: { id: number; kind: string; archived?: number }[]): number | null {
  const ids = parcels.filter((p) => p.kind === "gastos" && !p.archived).map((p) => p.id);
  return ids.length ? Math.min(...ids) : null;
}

/** Título do número principal: muda quando já se gastou mais do que o planeado. */
export function inicioLabel(state: InicioState): string {
  return state === "excedido" ? "Gasto acima do planeado" : "Valor disponível";
}

/** Quanto se pode gastar por dia até ao fim do mês (hoje conta). Sem valor se não há saldo ou não é o mês de hoje. */
export function dailyAllowance(left: number, daysLeft: number | null): number | null {
  if (daysLeft == null || left <= 0.005) return null;
  return r2(left / Math.max(daysLeft, 1));
}

export type LatestExpense = { id: number; date: string; value: number; category: string; note: string };

/** As despesas mais recentes de um mês (data e depois id, da mais nova para a mais antiga). */
export function latestExpenses(
  transactions: { id: number; monthId: number; type: string; date: string; value: number; category: string; note: string }[],
  monthId: number,
  limit: number,
): LatestExpense[] {
  return transactions
    .filter((t) => t.monthId === monthId && t.type === "expense")
    .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1))
    .slice(0, limit)
    .map((t) => ({ id: t.id, date: t.date, value: t.value, category: t.category.trim() || NO_CATEGORY, note: t.note }));
}

/** "Hoje", "Ontem" ou "seg., 23 nov." para agrupar/mostrar a data de uma despesa. */
export function dayLabel(date: string, today: string): string {
  if (date === today) return "Hoje";
  const d = new Date(`${date}T12:00:00Z`);
  const t = new Date(`${today}T12:00:00Z`);
  if (Math.round((t.getTime() - d.getTime()) / 86400000) === 1) return "Ontem";
  return d.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
