/** Leituras sobre o histórico: ritmo das metas, comparação com o ano anterior e despesas fora do padrão. */
import type { Month, Transaction } from "../schema";
import { MONTH_NAMES, type MonthComputed } from "./month";

/* ------------------------------------------------------------------ ritmo das metas */

export type GoalPaceStatus =
  | "sem_objetivo" // a meta não tem valor-alvo
  | "atingida" // acumulado já cobre o objetivo
  | "sem_prazo" // há objetivo mas não há data-alvo
  | "prazo_passado" // a data-alvo já passou e falta valor
  | "sem_ritmo" // não há aportes recentes: não é possível projetar
  | "no_ritmo" // ao ritmo atual, chega a tempo
  | "atrasada"; // ao ritmo atual, chega depois do prazo

export type GoalPace = {
  status: GoalPaceStatus;
  missing: number;
  /** meses até ao prazo (0 = no mês do prazo), ou null sem prazo válido */
  monthsToDeadline: number | null;
  /** meses necessários ao ritmo atual, ou null sem ritmo */
  monthsNeeded: number | null;
  /** quanto seria preciso poupar por mês para chegar ao prazo */
  requiredMonthly: number | null;
  /** meses de atraso face ao prazo (só em `atrasada`) */
  delayMonths: number | null;
  /** mês previsto para atingir o objetivo (AAAA-MM), ou null */
  projectedMonth: string | null;
};

/** Aceita `AAAA-MM` ou `AAAA-MM-DD`. */
export function parseYearMonth(s: string | null | undefined): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(String(s ?? "").trim());
  if (!m) return null;
  const year = Number(m[1]), month = Number(m[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

/** `2026-12` → `dezembro de 2026` (ou o texto original se não for um mês válido). */
export function formatYearMonth(ym: string | null | undefined): string {
  const p = parseYearMonth(ym);
  return p ? `${MONTH_NAMES[p.month - 1].toLowerCase()} de ${p.year}` : String(ym ?? "");
}

const ymKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;
/** Chave `AAAA-MM` de um ano e mês. */
export const yearMonthKey = ymKey;
const addMonths = (year: number, month: number, n: number) => {
  const i = year * 12 + (month - 1) + n;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
};

/**
 * Compara o ritmo atual de uma meta com o seu prazo.
 * `pacePerMonth` é a média mensal recente (ex.: últimos 3 meses); `now` é o mês de referência.
 */
export function goalPace(i: {
  targetAmount: number | null | undefined;
  targetDate: string | null | undefined;
  accumulated: number;
  pacePerMonth: number;
  now: { year: number; month: number };
}): GoalPace {
  const empty = { monthsToDeadline: null, monthsNeeded: null, requiredMonthly: null, delayMonths: null, projectedMonth: null };
  const target = i.targetAmount ?? 0;
  if (!(target > 0)) return { status: "sem_objetivo", missing: 0, ...empty };
  const missing = Math.max(0, Math.round((target - i.accumulated) * 100) / 100);
  if (missing <= 0.005) return { status: "atingida", missing: 0, ...empty };

  const pace = i.pacePerMonth > 0 ? i.pacePerMonth : 0;
  const monthsNeeded = pace > 0 ? Math.ceil(missing / pace) : null;
  const projected = monthsNeeded != null ? addMonths(i.now.year, i.now.month, monthsNeeded) : null;
  const projectedMonth = projected ? ymKey(projected.year, projected.month) : null;

  const deadline = parseYearMonth(i.targetDate);
  if (!deadline) return { status: "sem_prazo", missing, monthsToDeadline: null, monthsNeeded, requiredMonthly: null, delayMonths: null, projectedMonth };

  const monthsToDeadline = deadline.year * 12 + deadline.month - (i.now.year * 12 + i.now.month);
  const requiredMonthly = Math.round((missing / Math.max(1, monthsToDeadline)) * 100) / 100;
  if (monthsToDeadline < 0) return { status: "prazo_passado", missing, monthsToDeadline, monthsNeeded, requiredMonthly, delayMonths: null, projectedMonth };
  if (monthsNeeded == null) return { status: "sem_ritmo", missing, monthsToDeadline, monthsNeeded, requiredMonthly, delayMonths: null, projectedMonth };
  if (monthsNeeded <= monthsToDeadline) return { status: "no_ritmo", missing, monthsToDeadline, monthsNeeded, requiredMonthly, delayMonths: null, projectedMonth };
  return { status: "atrasada", missing, monthsToDeadline, monthsNeeded, requiredMonthly, delayMonths: monthsNeeded - monthsToDeadline, projectedMonth };
}

/* ------------------------------------------------------------ comparação com o ano anterior */

export type YoYTotals = {
  net: number;
  gross: number;
  descontos: number;
  /** descontos ÷ bruto */
  taxRate: number;
  spent: number;
  saved: number;
  available: number;
  savingsRate: number;
  /** total alocado a cada parcela nos meses do lado */
  byParcel: Record<number, number>;
};

/** Um mês (ou os meses que partilham o mesmo ano e mês) e o seu par no ano de referência. */
export type YoYPair = { current: Month[]; previous: Month[] };

export type YearOverYear = {
  /** meses do período que têm par no ano de referência (um par por ano e mês) */
  pairs: YoYPair[];
  current: YoYTotals;
  previous: YoYTotals;
  /** variação relativa (null quando o valor anterior é 0 e o atual não) */
  delta: { net: number | null; gross: number | null; descontos: number | null; spent: number | null; saved: number | null };
  /** variação da taxa de poupança e da carga fiscal em pontos percentuais (0.02 = +2 p.p.) */
  savingsRateDeltaPP: number;
  taxRateDeltaPP: number;
  /** nº de meses de cada lado; só difere de 1 por lado na comparação livre entre meses (valores em média mensal quando os lados têm tamanhos diferentes) */
  divisor?: { current: number; previous: number };
  /** `livre` = dois grupos de meses à escolha (podem ser do mesmo ano) */
  kind?: "ano" | "livre";
};

const totalsOf = (cs: MonthComputed[]): YoYTotals => {
  const net = cs.reduce((a, x) => a + x.net, 0);
  const gross = cs.reduce((a, x) => a + x.gross, 0);
  const descontos = cs.reduce((a, x) => a + x.descontos, 0);
  const spent = cs.reduce((a, x) => a + x.byKind.gastos, 0);
  const saved = cs.reduce((a, x) => a + x.byKind.poupanca + x.byKind.investimento, 0);
  const available = cs.reduce((a, x) => a + x.available, 0);
  const byParcel: Record<number, number> = {};
  for (const c of cs) for (const [id, v] of Object.entries(c.byParcel)) byParcel[Number(id)] = (byParcel[Number(id)] ?? 0) + v;
  return { net, gross, descontos, taxRate: gross > 0 ? descontos / gross : 0, spent, saved, available, savingsRate: available > 0 ? saved / available : 0, byParcel };
};
const rel = (cur: number, prev: number) => (prev !== 0 ? cur / prev - 1 : cur !== 0 ? null : 0);

/**
 * Compara os meses indicados com os mesmos meses de outro ano: o ano anterior de cada mês (omissão) ou um
 * `refYear` fixo. Só entram os meses que existem nos dois lados, para a comparação ser justa. Se houver
 * vários meses com o mesmo ano e mês (ex.: dois meses de dezembro), somam-se de cada lado. Um mês nunca é
 * comparado com ele próprio (`refYear` igual ao seu ano). Devolve null se nenhum mês tiver par.
 */
export function yearOverYear(
  months: Month[],
  computed: MonthComputed[],
  allMonths: Month[],
  allComputed: MonthComputed[],
  refYear?: number | null,
): YearOverYear | null {
  const index = new Map<string, number[]>();
  allMonths.forEach((m, i) => {
    const k = ymKey(m.year, m.month);
    index.set(k, (index.get(k) ?? []).concat(i));
  });
  const groups = new Map<string, { months: Month[]; computed: MonthComputed[] }>();
  months.forEach((m, i) => {
    if (!computed[i]) return;
    const k = ymKey(m.year, m.month);
    const g = groups.get(k) ?? { months: [], computed: [] };
    g.months.push(m);
    g.computed.push(computed[i]);
    groups.set(k, g);
  });
  const pairs: YoYPair[] = [];
  const cur: MonthComputed[] = [];
  const prev: MonthComputed[] = [];
  for (const g of Array.from(groups.values())) {
    const m = g.months[0];
    const year = refYear ?? m.year - 1;
    if (year === m.year) continue;
    const idx = index.get(ymKey(year, m.month));
    if (!idx || idx.length === 0) continue;
    pairs.push({ current: g.months, previous: idx.map((i) => allMonths[i]) });
    cur.push(...g.computed);
    prev.push(...idx.map((i) => allComputed[i]));
  }
  if (pairs.length === 0) return null;
  const current = totalsOf(cur), previous = totalsOf(prev);
  return {
    pairs,
    current,
    previous,
    delta: {
      net: rel(current.net, previous.net),
      gross: rel(current.gross, previous.gross),
      descontos: rel(current.descontos, previous.descontos),
      spent: rel(current.spent, previous.spent),
      saved: rel(current.saved, previous.saved),
    },
    savingsRateDeltaPP: current.savingsRate - previous.savingsRate,
    taxRateDeltaPP: current.taxRate - previous.taxRate,
  };
}

const scaleTotals = (t: YoYTotals, n: number): YoYTotals => {
  const byParcel: Record<number, number> = {};
  for (const [id, v] of Object.entries(t.byParcel)) byParcel[Number(id)] = v / n;
  return { ...t, net: t.net / n, gross: t.gross / n, descontos: t.descontos / n, spent: t.spent / n, saved: t.saved / n, available: t.available / n, byParcel };
};

/**
 * Compara dois grupos de meses à escolha (podem ser do mesmo ano). Se os grupos tiverem tamanhos
 * diferentes, os valores comparam-se em média mensal; as taxas (poupança, carga fiscal) não mudam.
 * Devolve null se um dos grupos estiver vazio.
 */
export function compareMonthSets(a: Month[], aComputed: MonthComputed[], b: Month[], bComputed: MonthComputed[]): YearOverYear | null {
  if (a.length === 0 || b.length === 0 || aComputed.length === 0 || bComputed.length === 0) return null;
  const raw = [totalsOf(aComputed), totalsOf(bComputed)];
  const same = a.length === b.length;
  const current = same ? raw[0] : scaleTotals(raw[0], a.length);
  const previous = same ? raw[1] : scaleTotals(raw[1], b.length);
  return {
    pairs: [{ current: a, previous: b }],
    current,
    previous,
    delta: {
      net: rel(current.net, previous.net),
      gross: rel(current.gross, previous.gross),
      descontos: rel(current.descontos, previous.descontos),
      spent: rel(current.spent, previous.spent),
      saved: rel(current.saved, previous.saved),
    },
    savingsRateDeltaPP: current.savingsRate - previous.savingsRate,
    taxRateDeltaPP: current.taxRate - previous.taxRate,
    divisor: same ? undefined : { current: a.length, previous: b.length },
    kind: "livre",
  };
}

const idsOf = (ms: Month[]) => ms.map((m) => m.id);

/** Despesa (`expense`) por categoria nos meses indicados; a chave ignora maiúsculas e espaços nas pontas. */
export function expenseByCategory(txs: Transaction[], monthIds: Set<number>): Map<string, { name: string; total: number }> {
  const out = new Map<string, { name: string; total: number }>();
  for (const t of txs) {
    if (t.type !== "expense" || !monthIds.has(t.monthId)) continue;
    const name = (t.category ?? "").trim() || "Sem categoria";
    const key = name.toLowerCase();
    const row = out.get(key) ?? { name, total: 0 };
    row.total = Math.round((row.total + t.value) * 100) / 100;
    out.set(key, row);
  }
  return out;
}

export type CategoryYoYRow = { name: string; current: number; previous: number; delta: number; deltaPct: number | null };

/** Despesa por categoria no período face ao ano de referência (só meses com par). */
export function categoryYearOverYear(txs: Transaction[], yoy: YearOverYear): CategoryYoYRow[] {
  // por par: se o mesmo mês de referência emparelha com vários meses atuais, conta uma vez por par,
  // tal como os totais (assim categorias e totais somam os mesmos meses de cada lado)
  const cur = new Map<string, { name: string; total: number }>();
  const prev = new Map<string, { name: string; total: number }>();
  const add = (into: Map<string, { name: string; total: number }>, from: Map<string, { name: string; total: number }>) => {
    for (const [k, v] of Array.from(from.entries())) {
      const row = into.get(k) ?? { name: v.name, total: 0 };
      row.total = Math.round((row.total + v.total) * 100) / 100;
      into.set(k, row);
    }
  };
  for (const p of yoy.pairs) {
    add(cur, expenseByCategory(txs, new Set(idsOf(p.current))));
    add(prev, expenseByCategory(txs, new Set(idsOf(p.previous))));
  }
  const keys = Array.from(new Set(Array.from(cur.keys()).concat(Array.from(prev.keys()))));
  const rows: CategoryYoYRow[] = [];
  const dc = yoy.divisor?.current ?? 1, dp = yoy.divisor?.previous ?? 1;
  for (const k of keys) {
    const c = cur.get(k), p = prev.get(k);
    const current = Math.round(((c?.total ?? 0) / dc) * 100) / 100, previous = Math.round(((p?.total ?? 0) / dp) * 100) / 100;
    rows.push({ name: (c ?? p)!.name, current, previous, delta: Math.round((current - previous) * 100) / 100, deltaPct: previous > 0 ? current / previous - 1 : null });
  }
  return rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export type ParcelYoYRow = { id: number; name: string; color?: string; current: number; previous: number; delta: number; deltaPct: number | null };

/** Total alocado a cada parcela no período face ao ano de referência. Parcelas sem valor em nenhum dos lados ficam de fora. */
export function parcelYearOverYear(parcels: { id: number; name: string; color?: string }[], yoy: YearOverYear): ParcelYoYRow[] {
  const rows: ParcelYoYRow[] = [];
  for (const p of parcels) {
    const current = Math.round((yoy.current.byParcel[p.id] ?? 0) * 100) / 100;
    const previous = Math.round((yoy.previous.byParcel[p.id] ?? 0) * 100) / 100;
    if (current === 0 && previous === 0) continue;
    rows.push({ id: p.id, name: p.name, color: p.color, current, previous, delta: Math.round((current - previous) * 100) / 100, deltaPct: previous > 0 ? current / previous - 1 : null });
  }
  return rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/* ------------------------------------------------------------ despesas fora do padrão */

export type SpendAnomaly = {
  category: string;
  current: number;
  /** média e desvio-padrão dos meses anteriores considerados */
  mean: number;
  std: number;
  /** quanto passa da média */
  excess: number;
  ratio: number | null;
  kind: "acima_do_habitual" | "novo";
  baselineMonths: number;
};

export type AnomalyOptions = {
  /** meses anteriores com dados necessários para haver padrão (omissão 3) */
  minHistory?: number;
  /** janela máxima de meses anteriores (omissão 12) */
  window?: number;
  /** gasto mínimo para alertar, em euros (omissão 20) */
  minAmount?: number;
  /** quantos desvios-padrão acima da média (omissão 2) */
  sigma?: number;
  /** razão mínima face à média (omissão 1.5) */
  ratio?: number;
};

/**
 * Categorias cujo gasto no mês `targetMonthId` foge ao habitual: acima da média dos meses anteriores
 * em `sigma` desvios-padrão e pelo menos `ratio` vezes a média, e acima de `minAmount`. Uma categoria
 * sem histórico (média 0) com gasto de pelo menos o dobro de `minAmount` aparece como `novo`.
 * Sem `minHistory` meses anteriores com dados, devolve lista vazia (não há padrão a comparar).
 */
export function spendAnomalies(txs: Transaction[], allMonths: Month[], targetMonthId: number, o: AnomalyOptions = {}): SpendAnomaly[] {
  const { minHistory = 3, window = 12, minAmount = 20, sigma = 2, ratio = 1.5 } = o;
  const sorted = [...allMonths].sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));
  const at = sorted.findIndex((m) => m.id === targetMonthId);
  if (at < 0) return [];
  const history = sorted.slice(Math.max(0, at - window), at);
  if (history.length < minHistory) return [];

  const current = expenseByCategory(txs, new Set([targetMonthId]));
  const perMonth = history.map((m) => expenseByCategory(txs, new Set([m.id])));
  const out: SpendAnomaly[] = [];
  for (const [key, c] of Array.from(current.entries())) {
    if (c.total < minAmount) continue;
    const values = perMonth.map((pm) => pm.get(key)?.total ?? 0);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance);
    if (mean === 0) {
      if (c.total >= 2 * minAmount) out.push({ category: c.name, current: c.total, mean: 0, std: 0, excess: c.total, ratio: null, kind: "novo", baselineMonths: values.length });
      continue;
    }
    if (c.total > mean + sigma * std && c.total >= ratio * mean) {
      out.push({ category: c.name, current: c.total, mean, std, excess: Math.round((c.total - mean) * 100) / 100, ratio: c.total / mean, kind: "acima_do_habitual", baselineMonths: values.length });
    }
  }
  return out.sort((a, b) => b.excess - a.excess);
}
