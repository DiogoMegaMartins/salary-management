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
