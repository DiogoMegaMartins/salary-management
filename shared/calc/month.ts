/** Cálculo do mês: rendimentos, descontos, disponível, reconciliação, formatação e ordenação. */
import type { Allocation, Category, Month, Parcel, Settings, Transaction } from "../schema";

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const KINDS = [
  { value: "gastos", label: "Gastos" },
  { value: "poupanca", label: "Poupança" },
  { value: "investimento", label: "Investimento" },
] as const;

/** Rendimento bruto do mês (tudo o que entra antes de descontos). */
export function grossOf(m: Month): number {
  return m.base + m.extraordinaria + m.outrosIrsSs + m.outrosIrs + m.isentos;
}

/**
 * Descontos (SS + IRS).
 * Fórmula automática replica a folha de cálculo:
 *   (base × taxaSS) + (outrosIrsSs × taxaSS) + ((base + outrosIrs) × taxaIrsBase) + (outrosIrsSs × taxaIrsExtra)
 */
export function descontosOf(m: Month): number {
  if (m.descontosMode === "manual") return m.descontosManual;
  const ss = (m.base + m.outrosIrsSs) * m.taxaSs;
  const irs = (m.base + m.outrosIrs) * m.taxaIrsBase + m.outrosIrsSs * m.taxaIrsExtra;
  return ss + irs;
}

export function ssOf(m: Month): number {
  if (m.descontosMode === "manual") return 0;
  return (m.base + m.outrosIrsSs) * m.taxaSs;
}

export function irsOf(m: Month): number {
  if (m.descontosMode === "manual") return 0;
  return (m.base + m.outrosIrs) * m.taxaIrsBase + m.outrosIrsSs * m.taxaIrsExtra;
}

/** Vencimento líquido. */
export function netOf(m: Month, s: Settings): number {
  const adj = s.excludeOutrosIrsFromNet ? m.outrosIrs : 0;
  return grossOf(m) - descontosOf(m) - adj;
}

export function mealOf(m: Month): number {
  return m.mealDaily * m.mealDays;
}

/** Valor disponível para dividir em parcelas. */
export function availableOf(m: Month, s: Settings): number {
  return netOf(m, s) + (s.includeMeal ? mealOf(m) : 0);
}

export function allocationAmount(a: Allocation, available: number): number {
  return a.mode === "percentagem" ? (available * a.value) / 100 : a.value;
}

/**
 * Reconciliacao do mes (SM-001/SM-002). As `transactions` sao lancamentos
 * individuais a partir de agora; nao substituem `allocations`, somam-se a elas.
 *   despesasTotais = despesas (expense) + retiradas (withdrawal)
 *   alocacoesTotais = allocations (fixo/percentagem) + aportes (contribution)
 *   transferencias entre parcelas nao contam para nenhum dos dois totais
 */
export function transactionsOfMonth(monthId: number, txs: Transaction[]): Transaction[] {
  return txs.filter((t) => t.monthId === monthId);
}

export function despesasExtraOf(txs: Transaction[]): number {
  return txs
    .filter((t) => t.type === "expense" || t.type === "withdrawal")
    .reduce((a, t) => a + t.value, 0);
}

export function aportesExtraOf(txs: Transaction[]): number {
  return txs.filter((t) => t.type === "contribution").reduce((a, t) => a + t.value, 0);
}

export type Reconciliation = {
  available: number;
  despesas: number;
  alocacoes: number;
  porAlocar: number;
  estado: "zero" | "excedente" | "defice";
};

export function reconcileMonth(
  available: number,
  allocated: number,
  txs: Transaction[],
): Reconciliation {
  const despesas = despesasExtraOf(txs);
  const alocacoes = allocated + aportesExtraOf(txs);
  const porAlocar = available - despesas - alocacoes;
  const estado = Math.abs(porAlocar) < 0.005 ? "zero" : porAlocar > 0 ? "excedente" : "defice";
  return { available, despesas, alocacoes, porAlocar, estado };
}

export type MonthComputed = {
  month: Month;
  gross: number;
  ss: number;
  irs: number;
  descontos: number;
  net: number;
  meal: number;
  available: number;
  allocated: number;
  remaining: number;
  savingsRate: number;
  byParcel: Record<number, number>;
  byKind: Record<string, number>;
};

export function computeMonth(
  m: Month,
  allocations: Allocation[],
  parcels: Parcel[],
  s: Settings,
): MonthComputed {
  const available = availableOf(m, s);
  const byParcel: Record<number, number> = {};
  const byKind: Record<string, number> = { gastos: 0, poupanca: 0, investimento: 0 };
  let allocated = 0;
  for (const a of allocations.filter((x) => x.monthId === m.id)) {
    const amount = allocationAmount(a, available);
    byParcel[a.parcelId] = (byParcel[a.parcelId] ?? 0) + amount;
    const p = parcels.find((x) => x.id === a.parcelId);
    if (p) byKind[p.kind] = (byKind[p.kind] ?? 0) + amount;
    allocated += amount;
  }
  const saved = (byKind.poupanca ?? 0) + (byKind.investimento ?? 0);
  return {
    month: m,
    gross: grossOf(m),
    ss: ssOf(m),
    irs: irsOf(m),
    descontos: descontosOf(m),
    net: netOf(m, s),
    meal: mealOf(m),
    available,
    allocated,
    remaining: available - allocated,
    savingsRate: available > 0 ? saved / available : 0,
    byParcel,
    byKind,
  };
}

/** Evita "-0,00" no ecrã: valores negativos que arredondam para zero ficam positivos. */
function stripNegativeZero(n: number, digits: number): number {
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** digits;
  const rounded = Math.round(n * factor) / factor;
  return rounded === 0 ? 0 : rounded;
}

export function fmtEur(n: number, digits = 2): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: "always", // pt-PT só agrupa a partir de 5 dígitos: sem isto 4850,00 € e 10 375,00 € ficam inconsistentes
  }).format(stripNegativeZero(n, digits));
}

export function fmtPct(n: number, digits = 1): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(stripNegativeZero(n, digits + 2));
}

export function monthKey(m: Month): string {
  return `${m.year}-${String(m.month).padStart(2, "0")}`;
}

export function monthLabelShort(m: Month): string {
  const extra = m.label.match(/\(([^)]+)\)/);
  return `${MONTH_SHORT[m.month - 1]}${extra ? " " + extra[1] : ""}`;
}

export function sortMonths<T extends Month>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => a.year - b.year || a.month - b.month || a.sortOrder - b.sortOrder || a.id - b.id,
  );
}
