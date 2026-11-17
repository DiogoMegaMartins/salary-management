import type { Allocation, Category, Month, Parcel, Settings, Transaction } from "./schema";

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

/* =========================================================== P1 =========== */

/**
 * SM-004 — Orçamento versus real.
 * Considera apenas transações do tipo `expense` (despesas), agrupadas por
 * categoria (texto livre `category` no lançamento, comparado por nome com a
 * categoria gerida). Retiradas/transferências/aportes não entram no real de
 * despesa de categoria.
 */
export type CategoryBudgetRow = {
  category: Category | null;
  categoryName: string;
  budget: number;
  real: number;
  desvioEUR: number;
  desvioPercentual: number;
  essential: boolean;
  overBudget: boolean;
  transactions: Transaction[];
};

export function budgetVsRealByCategory(
  txs: Transaction[],
  cats: Category[],
  alertThresholdPct = 10,
): CategoryBudgetRow[] {
  const expenseTxs = txs.filter((t) => t.type === "expense");
  const byName = new Map<string, Transaction[]>();
  for (const t of expenseTxs) {
    const key = (t.category || "(sem categoria)").trim();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(t);
  }
  const rows: CategoryBudgetRow[] = [];
  const seen = new Set<string>();

  for (const c of cats.filter((c) => c.active)) {
    const list = byName.get(c.name) ?? [];
    seen.add(c.name);
    const real = list.reduce((a, t) => a + t.value, 0);
    const budget = c.monthlyBudget;
    const desvioEUR = real - budget;
    const desvioPercentual = budget > 0 ? (desvioEUR / budget) * 100 : real > 0 ? 100 : 0;
    rows.push({
      category: c,
      categoryName: c.name,
      budget,
      real,
      desvioEUR,
      desvioPercentual,
      essential: !!c.essential,
      overBudget: budget > 0 && desvioPercentual >= alertThresholdPct,
      transactions: list,
    });
  }
  // categorias usadas em transacoes mas sem entrada gerida (texto livre)
  for (const name of Array.from(byName.keys())) {
    if (seen.has(name)) continue;
    const list = byName.get(name)!;
    const real = list.reduce((a: number, t: Transaction) => a + t.value, 0);
    rows.push({
      category: null,
      categoryName: name,
      budget: 0,
      real,
      desvioEUR: real,
      desvioPercentual: real > 0 ? 100 : 0,
      essential: false,
      overBudget: false,
      transactions: list,
    });
  }
  return rows.sort((a, b) => b.real - a.real);
}

/**
 * SM-005 — Projeção de final de ano.
 * Usa apenas meses concluídos (por defeito exclui o mes corrente).
 */
export type ProjectionMethod = "media_simples" | "media_3m" | "orcamento";

export type YearProjection = {
  method: ProjectionMethod;
  poupancaAcumulada: number;
  mediaMensalSelecionada: number;
  mesesRestantes: number;
  projecaoAnual: number;
  meta: number;
  diferenca: number;
  mesesConsiderados: number[];
};

export function projectYearEnd(
  monthsList: Month[],
  savedByMonthId: Record<number, number>,
  currentMonthId: number | null,
  year: number,
  goal: number,
  method: ProjectionMethod = "media_simples",
  excludeMonthIds: number[] = [],
  budgetedMonthly = 0,
): YearProjection {
  const yearMonths = sortMonths(monthsList.filter((m) => m.year === year));
  const completed = yearMonths.filter(
    (m) => m.id !== currentMonthId && !excludeMonthIds.includes(m.id),
  );
  const consideredIds = completed.map((m) => m.id);
  const poupancaAcumulada = yearMonths
    .filter((m) => m.id !== currentMonthId)
    .reduce((a, m) => a + (savedByMonthId[m.id] ?? 0), 0);

  let mediaMensalSelecionada = 0;
  if (method === "orcamento") {
    mediaMensalSelecionada = budgetedMonthly;
  } else if (method === "media_3m") {
    const last3 = completed.slice(-3);
    const vals = last3.map((m) => savedByMonthId[m.id] ?? 0);
    mediaMensalSelecionada = vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 0;
  } else {
    const vals = completed.map((m) => savedByMonthId[m.id] ?? 0);
    mediaMensalSelecionada = vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 0;
  }

  const mesesRestantes = 12 - completed.length - (currentMonthId != null ? 1 : 0);
  const projecaoAnual = poupancaAcumulada + mediaMensalSelecionada * Math.max(mesesRestantes, 0);
  const diferenca = projecaoAnual - goal;

  return {
    method,
    poupancaAcumulada,
    mediaMensalSelecionada,
    mesesRestantes: Math.max(mesesRestantes, 0),
    projecaoAnual,
    meta: goal,
    diferenca,
    mesesConsiderados: consideredIds,
  };
}

/**
 * SM-006 — Reserva de emergência e runway.
 * `essentialExpensesByMonthId` deve conter apenas despesas de categorias
 * marcadas essenciais, somadas por mes (transacoes tipo expense).
 */
export type RunwayResult = {
  saldoReservaElegivel: number;
  mediaDespesasEssenciais: number;
  runwayMeses: number;
  metaMeses: number | null;
  metaEuros: number | null;
  janela: number;
};

export function computeEssentialExpensesByMonth(
  txs: Transaction[],
  cats: Category[],
): Record<number, number> {
  const essentialNames = new Set(cats.filter((c) => c.essential).map((c) => c.name));
  const out: Record<number, number> = {};
  for (const t of txs) {
    if (t.type !== "expense") continue;
    if (!essentialNames.has((t.category || "").trim())) continue;
    out[t.monthId] = (out[t.monthId] ?? 0) + t.value;
  }
  return out;
}

export function runwayOf(
  saldoReservaElegivel: number,
  essentialExpensesByMonthId: Record<number, number>,
  orderedMonthIds: number[],
  windowMonths: 3 | 6 | 12,
  metaMeses: number | null = null,
  metaEuros: number | null = null,
): RunwayResult {
  const recentIds = orderedMonthIds.slice(-windowMonths);
  const vals = recentIds.map((id) => essentialExpensesByMonthId[id] ?? 0);
  const mediaDespesasEssenciais = vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 0;
  const runwayMeses = mediaDespesasEssenciais > 0 ? saldoReservaElegivel / mediaDespesasEssenciais : 0;
  return {
    saldoReservaElegivel,
    mediaDespesasEssenciais,
    runwayMeses,
    metaMeses,
    metaEuros,
    janela: windowMonths,
  };
}

/**
 * SM-007 — Sugestão de distribuição do excedente.
 * Ordem padrão: reserva de emergência -> metas proximas -> outras parcelas -> saldo livre.
 * Não altera nada por si só; devolve uma proposta editável.
 */
export type SurplusSuggestionItem = {
  parcelId: number | null; // null = saldo livre (nao alocado)
  parcelName: string;
  amount: number;
  reason: "reserva" | "meta_proxima" | "outra_parcela" | "saldo_livre";
};

export function suggestSurplusDistribution(
  porAlocar: number,
  parcelsList: Parcel[],
  emergencyParcelIds: number[],
  currentBalanceByParcel: Record<number, number>,
  threshold = 0,
): SurplusSuggestionItem[] {
  if (porAlocar <= threshold) return [];

  let remaining = porAlocar;
  const items: SurplusSuggestionItem[] = [];

  // 1. reserva de emergencia: preencher ate a meta, se definida
  const emergencyParcels = parcelsList.filter(
    (p) => emergencyParcelIds.includes(p.id) && !p.archived,
  );
  for (const p of emergencyParcels) {
    if (remaining <= 0) break;
    const bal = currentBalanceByParcel[p.id] ?? 0;
    const gap = p.targetAmount != null ? Math.max(p.targetAmount - bal, 0) : 0;
    const amount = Math.min(gap, remaining);
    if (amount > 0) {
      items.push({ parcelId: p.id, parcelName: p.name, amount, reason: "reserva" });
      remaining -= amount;
    }
  }

  // 2. metas proximas: parcelas com targetAmount e targetDate, ordenadas por data mais proxima
  const goalParcels = parcelsList
    .filter(
      (p) =>
        !emergencyParcelIds.includes(p.id) &&
        !p.archived &&
        p.targetAmount != null &&
        p.targetDate,
    )
    .sort((a, b) => (a.targetDate! < b.targetDate! ? -1 : 1));
  for (const p of goalParcels) {
    if (remaining <= 0) break;
    const bal = currentBalanceByParcel[p.id] ?? 0;
    const gap = Math.max((p.targetAmount ?? 0) - bal, 0);
    const amount = Math.min(gap, remaining);
    if (amount > 0) {
      items.push({ parcelId: p.id, parcelName: p.name, amount, reason: "meta_proxima" });
      remaining -= amount;
    }
  }

  // 3. outras parcelas ativas (nao emergencia, sem meta ja tratada): dividir igualmente o restante
  const otherParcels = parcelsList.filter(
    (p) =>
      !emergencyParcelIds.includes(p.id) &&
      !p.archived &&
      !goalParcels.some((g) => g.id === p.id),
  );
  if (remaining > 0 && otherParcels.length > 0) {
    const share = remaining / otherParcels.length;
    for (const p of otherParcels) {
      items.push({ parcelId: p.id, parcelName: p.name, amount: share, reason: "outra_parcela" });
    }
    remaining = 0;
  }

  // 4. saldo livre: o que restar
  if (remaining > 0.005) {
    items.push({ parcelId: null, parcelName: "Saldo livre", amount: remaining, reason: "saldo_livre" });
  }

  return items;
}


/* ------------------------------------------------ distribuição por plataformas (EVO-03) */

export type DistLine = { platformId: number; mode: "fixo" | "percentagem"; value: number };
export type DistResult = {
  ok: boolean;
  error?: string;
  /** montante de cada linha, em cêntimos inteiros */
  amountsCents: number[];
  distributedCents: number;
  remainingCents: number;
  totalCents: number;
  percentSum: number;
};

export const toCents = (euros: number) => Math.round((Number.isFinite(euros) ? euros : 0) * 100 + 1e-9);

/**
 * Calcula os montantes de cada linha sobre o total da parcela (em cêntimos, sem dinheiro em vírgula flutuante
 * a propagar-se). Em percentagem usa soma acumulada arredondada: distribuído + restante = total e a soma
 * das linhas nunca excede o total quando as percentagens somam ≤ 100.
 */
export function distribute(totalEuros: number, lines: DistLine[]): DistResult {
  const totalCents = Math.max(0, toCents(totalEuros));
  const base: DistResult = { ok: true, amountsCents: [], distributedCents: 0, remainingCents: totalCents, totalCents, percentSum: 0 };
  if (lines.length === 0) return base;
  const fail = (error: string): DistResult => ({ ...base, ok: false, error });
  if (new Set(lines.map((l) => l.platformId)).size !== lines.length) return fail("Plataforma repetida na distribuição.");
  if (new Set(lines.map((l) => l.mode)).size > 1) return fail("Usa um único modo (valor ou percentagem) em todas as linhas.");
  for (const l of lines) {
    if (!Number.isFinite(l.value) || l.value < 0) return fail("Valores inválidos ou negativos.");
  }
  let amounts: number[];
  let percentSum = 0;
  if (lines[0].mode === "percentagem") {
    percentSum = lines.reduce((a, l) => a + l.value, 0);
    if (percentSum > 100 + 1e-9) return { ...fail(`As percentagens somam ${percentSum.toFixed(2)}% (máximo 100%).`), percentSum };
    let cum = 0;
    let prev = 0;
    amounts = lines.map((l) => {
      cum += l.value;
      const upto = Math.round((totalCents * cum) / 100 + 1e-9);
      const a = upto - prev;
      prev = upto;
      return a;
    });
  } else {
    amounts = lines.map((l) => toCents(l.value));
  }
  const distributedCents = amounts.reduce((a, b) => a + b, 0);
  if (distributedCents > totalCents)
    return {
      ...fail(`A distribuição (${(distributedCents / 100).toFixed(2)} €) excede o total da parcela (${(totalCents / 100).toFixed(2)} €).`),
      amountsCents: amounts,
      distributedCents,
      remainingCents: totalCents - distributedCents,
      percentSum,
    };
  return { ok: true, amountsCents: amounts, distributedCents, remainingCents: totalCents - distributedCents, totalCents, percentSum };
}

/** Converte linhas entre modos preservando os montantes atuais (percentagens com 4 casas decimais, para o montante em cêntimos não mudar). */
export function convertLines(totalEuros: number, lines: DistLine[], to: "fixo" | "percentagem"): DistLine[] {
  if (lines.length === 0 || lines[0].mode === to) return lines.map((l) => ({ ...l, mode: to }));
  const r = distribute(totalEuros, lines);
  const total = r.totalCents;
  return lines.map((l, i) => ({
    ...l,
    mode: to,
    value: to === "fixo" ? r.amountsCents[i] / 100 : total > 0 ? Math.round((r.amountsCents[i] / total) * 1000000) / 10000 : 0,
  }));
}


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
  const txNet = openingEntry ? txAll - linkedTotalCents : 0;

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


/* ------------------------------------------------ distribuição por ativos (EVO-06) */

export type AssetLine = { name: string; percent: number; note?: string };
export type AssetResult = {
  ok: boolean;
  error?: string;
  amountsCents: number[];
  distributedCents: number;
  remainingCents: number;
  percentSum: number;
  remainingPercent: number;
};

/**
 * Aplica percentagens (até 4 casas) ao montante da plataforma. Arredondamento determinístico por soma acumulada:
 * o montante da linha i = round(montante × soma_i / 100) − round(montante × soma_{i-1} / 100), logo
 * distribuído + restante = montante da plataforma e a soma nunca o excede.
 */
export function distributeAssets(platformAmountEuros: number, lines: AssetLine[]): AssetResult {
  const total = toCents(platformAmountEuros);
  const empty: AssetResult = { ok: true, amountsCents: [], distributedCents: 0, remainingCents: total, percentSum: 0, remainingPercent: 100 };
  const fail = (error: string): AssetResult => ({ ...empty, ok: false, error });
  const seen = new Set<string>();
  let sumUnits = 0; // 1 unidade = 0,0001 %
  const units: number[] = [];
  for (const l of lines) {
    const name = (l.name ?? "").trim();
    if (!name) return fail("Cada linha precisa de um nome.");
    const key = name.toLowerCase();
    if (seen.has(key)) return fail(`O ativo "${name}" está repetido.`);
    seen.add(key);
    if (!Number.isFinite(l.percent) || l.percent <= 0) return fail(`A percentagem de "${name}" tem de ser maior que 0.`);
    if (l.percent > 100) return fail(`A percentagem de "${name}" não pode exceder 100%.`);
    const u = Math.round(l.percent * 10000);
    units.push(u);
    sumUnits += u;
  }
  if (sumUnits > 1_000_000) return fail(`As percentagens somam ${sumUnits / 10000}%: não podem exceder 100%.`);
  let prev = 0;
  let acc = 0;
  const amounts = units.map((u) => {
    acc += u;
    const cum = Math.round((total * acc) / 1_000_000);
    const a = cum - prev;
    prev = cum;
    return a;
  });
  const distributed = amounts.reduce((a, b) => a + b, 0);
  return {
    ok: true,
    amountsCents: amounts,
    distributedCents: distributed,
    remainingCents: total - distributed,
    percentSum: sumUnits / 10000,
    remainingPercent: (1_000_000 - sumUnits) / 10000,
  };
}
