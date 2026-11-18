/** Orçamento versus real, projeção anual, runway e sugestão de excedente. */
import type { Allocation, Category, Month, Parcel, Settings, Transaction } from "../schema";
import { sortMonths } from "./month";

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

/** Chave de comparação de categorias. */
export const catKey = (s: string) => s.trim().toLowerCase();

export function budgetVsRealByCategory(
  txs: Transaction[],
  cats: Category[],
  alertThresholdPct = 10,
): CategoryBudgetRow[] {
  const expenseTxs = txs.filter((t) => t.type === "expense");
  // a categoria compara-se sem maiúsculas nem espaços nas pontas ("supermercado" = "Supermercado")
  const byName = new Map<string, Transaction[]>();
  const display = new Map<string, string>();
  for (const t of expenseTxs) {
    const label = (t.category || "(sem categoria)").trim();
    const key = catKey(label);
    if (!byName.has(key)) {
      byName.set(key, []);
      display.set(key, label);
    }
    byName.get(key)!.push(t);
  }
  const rows: CategoryBudgetRow[] = [];
  const seen = new Set<string>();

  for (const c of cats.filter((c) => c.active)) {
    const list = byName.get(catKey(c.name)) ?? [];
    seen.add(catKey(c.name));
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
  for (const key of Array.from(byName.keys())) {
    if (seen.has(key)) continue;
    const name = display.get(key) ?? key;
    const list = byName.get(key)!;
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

  // meses que faltam no calendário (não o nº de linhas de mês registadas): depois do mês corrente
  // ou, sem mês corrente neste ano, depois do último mês registado
  const current = yearMonths.find((m) => m.id === currentMonthId);
  const lastMonthNumber = current ? current.month : yearMonths.reduce((a, m) => Math.max(a, m.month), 0);
  const mesesRestantes = 12 - lastMonthNumber;
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
  const essentialNames = new Set(cats.filter((c) => c.essential).map((c) => catKey(c.name)));
  const out: Record<number, number> = {};
  for (const t of txs) {
    if (t.type !== "expense") continue;
    if (!essentialNames.has(catKey(t.category || ""))) continue;
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
    // divisão em cêntimos: o resto vai para as primeiras parcelas, para a soma fechar a zero
    const cents = Math.round(remaining * 100);
    const base = Math.floor(cents / otherParcels.length);
    const extra = cents - base * otherParcels.length;
    otherParcels.forEach((p, i) => {
      items.push({ parcelId: p.id, parcelName: p.name, amount: (base + (i < extra ? 1 : 0)) / 100, reason: "outra_parcela" });
    });
    remaining = 0;
  }

  // 4. saldo livre: o que restar
  if (remaining > 0.005) {
    items.push({ parcelId: null, parcelName: "Saldo livre", amount: remaining, reason: "saldo_livre" });
  }

  return items;
}
