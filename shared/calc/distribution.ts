/** Distribuição de um total por plataformas (EVO-03) e por ativos (EVO-06), em cêntimos inteiros. */

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


/* ------------------------------------------ ativos: conversão entre valor e percentagem */

/**
 * Percentagens (até 0,0001 %) que correspondem a valores em euros dentro do montante da plataforma. Arredonda a soma
 * acumulada, não cada linha: se os valores somam o montante, as percentagens somam exatamente 100 %.
 */
export function assetPercentsFromValues(amountEuros: number, valuesEuros: number[]): number[] {
  const total = toCents(amountEuros);
  if (total <= 0) return valuesEuros.map(() => 0);
  let cum = 0;
  let prev = 0;
  return valuesEuros.map((v) => {
    cum += Math.max(0, toCents(v));
    const units = Math.round((cum * 1_000_000) / total);
    const d = units - prev;
    prev = units;
    return d / 10000;
  });
}

/** Montantes (em euros) de cada percentagem, com a mesma soma acumulada arredondada de `distributeAssets`. */
export function assetValuesFromPercents(amountEuros: number, percents: number[]): number[] {
  const total = toCents(amountEuros);
  let acc = 0;
  let prev = 0;
  return percents.map((p) => {
    acc += Math.round((Number.isFinite(p) && p > 0 ? p : 0) * 10000);
    const cum = Math.round((total * acc) / 1_000_000);
    const a = cum - prev;
    prev = cum;
    return a / 100;
  });
}

/** Reparte `n` partes iguais de `total` (euros ou %), com o resto nas primeiras: a soma é exata. */
export function equalParts(total: number, n: number, decimals = 2): number[] {
  if (n <= 0) return [];
  const f = 10 ** decimals;
  const t = Math.round(total * f);
  const base = Math.floor(t / n);
  const extra = t - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < extra ? 1 : 0)) / f);
}
