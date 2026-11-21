/**
 * EVO-08: cálculos puros partilhados (cliente, servidor e testes).
 * Precisão: todos os montantes são tratados em cêntimos inteiros nas somas e comparações.
 */
import { allocationAmount, distribute, toCents } from "./calc";

export const cents = toCents;
export const euros = (c: number) => c / 100;
/** Soma em cêntimos para evitar deriva de vírgula flutuante. */
export const sumEuros = (xs: number[]) => euros(xs.reduce((a, x) => a + toCents(x), 0));
export const round2 = (n: number) => euros(toCents(n));

type Tx = { id: number; monthId: number; date: string; type: string; value: number; parcelId: number | null; targetParcelId: number | null; category: string; note?: string; recurrenceId?: number | null };
type Alloc = { id: number; monthId: number; parcelId: number; mode: string; value: number };
type Mon = { id: number; year: number; month: number; status?: string; carryIn?: number };

/* ----------------------------------------------------------------- 3. planeado / alocado / executado */

export type ExecutionView = {
  planeado: number; // distribuição planeada (alocações do mês)
  alocado: number; // alocado a parcelas (alocações + aportes)
  executado: number; // movimentos efetivamente registados (despesas + retiradas)
  transferenciasInternas: number; // não contam como despesa
  porExecutar: number; // planeado de parcelas de gastos ainda sem despesa registada
};

/**
 * Distingue planeado, alocado, executado e por executar de um mês.
 * - Transferências internas e aportes nunca contam como despesa.
 * - "Por executar" só se aplica a parcelas de tipo gastos; nunca é negativo.
 * - Registos antigos não ganham estado retroativo: o que já existe conta como executado (despesas) e alocado (alocações).
 */
export function executionOfMonth(
  available: number,
  allocations: Alloc[],
  txs: Tx[],
  spendingParcelIds: Set<number>,
): ExecutionView {
  const plannedByParcel = new Map<number, number>();
  for (const a of allocations) plannedByParcel.set(a.parcelId, (plannedByParcel.get(a.parcelId) ?? 0) + allocationAmount(a as any, available));
  const planeado = sumEuros(Array.from(plannedByParcel.values()));
  const aportes = sumEuros(txs.filter((t) => t.type === "contribution").map((t) => t.value));
  const executado = sumEuros(txs.filter((t) => t.type === "expense" || t.type === "withdrawal").map((t) => t.value));
  const transferenciasInternas = sumEuros(txs.filter((t) => t.type === "transfer").map((t) => t.value));
  let porExecutar = 0;
  for (const [pid, planned] of Array.from(plannedByParcel.entries())) {
    if (!spendingParcelIds.has(pid)) continue;
    const spent = sumEuros(txs.filter((t) => (t.type === "expense" || t.type === "withdrawal") && t.parcelId === pid).map((t) => t.value));
    porExecutar += Math.max(0, round2(planned - spent));
  }
  return { planeado, alocado: round2(planeado + aportes), executado, transferenciasInternas, porExecutar: round2(porExecutar) };
}

/* ----------------------------------------------------------------- 2. verificação de consistência */

export type Issue = { severity: "erro" | "aviso"; code: string; message: string; where: string; fix: string };

export type CheckInput = {
  months: Mon[];
  parcels: { id: number; name: string; archived?: boolean }[];
  allocations: Alloc[];
  transactions: Tx[];
  allocationPlatforms: { id: number; allocationId: number; platformId: number; mode: string; value: number }[];
  allocationAssets: { id: number; allocationId: number; platformId: number; name: string; percent: number }[];
  platforms: { id: number }[];
  subgoals: { id: number; parcelId: number }[];
  goalEntries: { id: number; parcelId: number; subgoalId: number | null }[];
  categories?: { name: string }[];
  availableByMonth: Record<number, number>;
};

/** Verifica consistência. Nunca altera dados: devolve erros bloqueantes e avisos informativos. */
export function checkConsistency(d: CheckInput): Issue[] {
  const out: Issue[] = [];
  const monthLabel = (id: number) => { const m = d.months.find((x) => x.id === id); return m ? `${String(m.month).padStart(2, "0")}/${m.year}` : `mês ${id}`; };
  const parcelIds = new Set(d.parcels.map((p) => p.id));
  const monthIds = new Set(d.months.map((m) => m.id));
  const allocIds = new Set(d.allocations.map((a) => a.id));
  const pName = (id: number) => d.parcels.find((p) => p.id === id)?.name ?? `parcela ${id}`;

  for (const m of d.months) {
    const avail = d.availableByMonth[m.id] ?? 0;
    const al = d.allocations.filter((a) => a.monthId === m.id);
    const total = sumEuros(al.map((a) => allocationAmount(a as any, avail)));
    const pct = al.filter((a) => a.mode === "percentagem").reduce((s, a) => s + a.value, 0);
    if (cents(total) > cents(avail)) out.push({ severity: "erro", code: "dist_excede", where: monthLabel(m.id), message: `A distribuição (${total.toFixed(2)} €) excede o valor disponível (${avail.toFixed(2)} €).`, fix: "Reduz alocações em Meses ou ajusta o rendimento." });
    else if (avail > 0 && cents(avail) - cents(total) >= 1) out.push({ severity: "aviso", code: "por_distribuir", where: monthLabel(m.id), message: `Por distribuir: ${round2(avail - total).toFixed(2)} €.`, fix: "Atribui o restante a uma parcela ou decide-o no fecho mensal." });
    if (pct > 100.0001) out.push({ severity: "erro", code: "pct_excede", where: monthLabel(m.id), message: `As percentagens somam ${pct.toFixed(2)} %.`, fix: "Reduz as percentagens para um máximo de 100 %." });
    for (const a of al) {
      if (a.mode === "percentagem" && (a.value < 0 || a.value > 100)) out.push({ severity: "erro", code: "pct_invalida", where: `${monthLabel(m.id)} / ${pName(a.parcelId)}`, message: `Percentagem inválida (${a.value}).`, fix: "Usa um valor entre 0 e 100." });
      if (a.value < 0) out.push({ severity: "erro", code: "valor_negativo", where: `${monthLabel(m.id)} / ${pName(a.parcelId)}`, message: "Alocação negativa.", fix: "Corrige o valor." });
    }
  }
  // a distribuição por plataformas tem de caber no total da parcela (baixar o rendimento pode deixá-la acima)
  for (const a of d.allocations) {
    const lines = d.allocationPlatforms.filter((p) => p.allocationId === a.id);
    if (!lines.length) continue;
    const r = distribute(allocationAmount(a as any, d.availableByMonth[a.monthId] ?? 0), lines.map((l) => ({ platformId: l.platformId, mode: l.mode as any, value: l.value })));
    if (!r.ok) out.push({ severity: "erro", code: "dist_plataformas", where: `${monthLabel(a.monthId)} / ${pName(a.parcelId)}`, message: r.error ?? "Distribuição por plataformas inválida.", fix: "Ajusta a distribuição por plataformas desta parcela." });
  }
  for (const a of d.allocations) {
    if (!monthIds.has(a.monthId) || !parcelIds.has(a.parcelId)) out.push({ severity: "erro", code: "ref_alocacao", where: `alocação ${a.id}`, message: "Alocação com mês ou parcela inexistente.", fix: "Elimina ou corrige o registo." });
  }
  for (const p of d.allocationPlatforms) {
    if (!allocIds.has(p.allocationId)) out.push({ severity: "erro", code: "ref_distribuicao", where: `distribuição ${p.id}`, message: "Distribuição por plataforma sem alocação.", fix: "Elimina o registo." });
    if (!d.platforms.some((x) => x.id === p.platformId)) out.push({ severity: "erro", code: "ref_plataforma", where: `distribuição ${p.id}`, message: "Plataforma inexistente.", fix: "Escolhe outra plataforma." });
  }
  const assetSum = new Map<string, number>();
  for (const x of d.allocationAssets) {
    if (x.percent <= 0 || x.percent > 100) out.push({ severity: "erro", code: "pct_ativo", where: `ativo ${x.name}`, message: `Percentagem de ativo inválida (${x.percent}).`, fix: "Usa um valor entre 0 e 100." });
    const k = `${x.allocationId}:${x.platformId}`;
    assetSum.set(k, (assetSum.get(k) ?? 0) + x.percent);
  }
  for (const [k, v] of Array.from(assetSum.entries())) if (v > 100.0001) out.push({ severity: "erro", code: "pct_ativos_excede", where: `alocação/plataforma ${k}`, message: `Ativos somam ${v.toFixed(2)} %.`, fix: "Reduz as percentagens dos ativos." });
  for (const t of d.transactions) {
    const w = `movimento ${t.id} (${t.date})`;
    if (!monthIds.has(t.monthId)) out.push({ severity: "erro", code: "ref_mes", where: w, message: "Mês inexistente.", fix: "Corrige o mês." });
    if (t.parcelId != null && !parcelIds.has(t.parcelId)) out.push({ severity: "erro", code: "ref_parcela", where: w, message: "Parcela inexistente.", fix: "Corrige a parcela." });
    if (t.targetParcelId != null && !parcelIds.has(t.targetParcelId)) out.push({ severity: "erro", code: "ref_destino", where: w, message: "Parcela de destino inexistente.", fix: "Corrige o destino." });
    if (t.type === "transfer" && (t.parcelId == null || t.targetParcelId == null || t.parcelId === t.targetParcelId)) out.push({ severity: "erro", code: "transferencia", where: w, message: "Transferência sem origem/destino distintos.", fix: "Define origem e destino diferentes." });
    if (!(t.value > 0)) out.push({ severity: "erro", code: "valor_mov", where: w, message: "Valor não positivo.", fix: "Corrige o valor." });
  }
  for (const s of d.subgoals) if (!parcelIds.has(s.parcelId)) out.push({ severity: "erro", code: "ref_submeta", where: `submeta ${s.id}`, message: "Submeta sem meta.", fix: "Elimina a submeta." });
  for (const e of d.goalEntries) {
    if (!parcelIds.has(e.parcelId)) out.push({ severity: "erro", code: "ref_ajuste", where: `ajuste ${e.id}`, message: "Ajuste sem parcela.", fix: "Elimina o ajuste." });
    if (e.subgoalId != null && !d.subgoals.some((s) => s.id === e.subgoalId)) out.push({ severity: "erro", code: "ref_ajuste_sub", where: `ajuste ${e.id}`, message: "Ajuste com submeta inexistente.", fix: "Elimina ou reatribui o ajuste." });
  }
  // duplicados prováveis: mesma data, valor, parcela e categoria (avisos informativos)
  const seen = new Map<string, number>();
  for (const t of d.transactions) {
    const k = [t.date.slice(0, 10), cents(t.value), t.type, t.parcelId, t.targetParcelId, (t.category ?? "").trim().toLowerCase()].join("|");
    if (seen.has(k)) out.push({ severity: "aviso", code: "duplicado", where: `movimentos ${seen.get(k)} e ${t.id}`, message: "Possível duplicado (mesma data, valor, tipo, parcela e categoria).", fix: "Se for repetido, elimina um dos registos." });
    else seen.set(k, t.id);
  }
  return out;
}

/* ----------------------------------------------------------------- 4. fecho mensal */

/** Valor restante de um mês: disponível + transporte recebido - despesas - alocado. O transporte NÃO é rendimento. */
export function monthRemainder(available: number, carryIn: number, allocated: number, txs: Tx[]): number {
  const despesas = sumEuros(txs.filter((t) => t.type === "expense" || t.type === "withdrawal").map((t) => t.value));
  const aportes = sumEuros(txs.filter((t) => t.type === "contribution").map((t) => t.value));
  return round2(available + carryIn - despesas - allocated - aportes);
}

/** Mês seguinte (muda de ano em dezembro). */
export const nextMonthKey = (y: number, m: number) => (m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 });

/** Um mês fechado só aceita alterações financeiras depois de reaberto (regra aplicada no backend). */
export const isClosed = (m: { status?: string }) => m.status === "fechado";

/* ----------------------------------------------------------------- 6. recorrências e reservas */

export const ymOf = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;
export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

export type Rec = { id: number; name: string; value: number; category: string; parcelId: number | null; dayOfMonth: number; startMonth: string; endMonth: string | null; active: boolean };

/** Ocorrências esperadas de uma recorrência em AAAA-MM: o dia é ajustado ao último dia do mês (ex. 31 em fevereiro). */
export function occurrenceFor(r: Rec, year: number, month: number): { key: string; date: string } | null {
  const ym = ymOf(year, month);
  if (!r.active || ym < r.startMonth || (r.endMonth && ym > r.endMonth)) return null;
  const day = Math.min(Math.max(1, r.dayOfMonth), daysInMonth(year, month));
  return { key: `${r.id}:${ym}`, date: `${ym}-${String(day).padStart(2, "0")}` };
}

/** Ocorrências pendentes: esperadas, ainda sem movimento com a mesma chave e não ignoradas. */
export function pendingOccurrences(recs: Rec[], months: { year: number; month: number }[], existingKeys: Set<string>, skipped: Set<string>) {
  const out: { key: string; date: string; rec: Rec; year: number; month: number }[] = [];
  for (const r of recs) for (const m of months) {
    const o = occurrenceFor(r, m.year, m.month);
    if (o && !existingKeys.has(o.key) && !skipped.has(o.key)) out.push({ ...o, rec: r, year: m.year, month: m.month });
  }
  return out;
}

export type ReserveLike = { target: number; reserved: number; dueMonth: string; status: string };

/** Meses restantes até ao prazo (mínimo 1 no mês do prazo; 0 se já passou). */
export function monthsLeft(dueMonth: string, nowYm: string): number {
  const [dy, dm] = dueMonth.split("-").map(Number);
  const [ny, nm] = nowYm.split("-").map(Number);
  return Math.max(0, (dy - ny) * 12 + (dm - nm) + 1);
}

/** Contribuição mensal sugerida = (alvo - já reservado) / meses restantes, em cêntimos. */
export function suggestedContribution(r: ReserveLike, nowYm: string): { missing: number; monthsLeft: number; perMonth: number; overdue: boolean } {
  const missing = Math.max(0, round2(r.target - r.reserved));
  const left = monthsLeft(r.dueMonth, nowYm);
  if (left === 0) return { missing, monthsLeft: 0, perMonth: missing, overdue: missing > 0 };
  return { missing, monthsLeft: left, perMonth: euros(Math.ceil(cents(missing) / left)), overdue: false };
}

/* ----------------------------------------------------------------- 7. simulador de metas */

export type SimInput = {
  current: number; // acumulado atual
  target: number;
  monthlyContribution: number;
  extra?: { atMonth: number; amount: number }[]; // reforços pontuais (mês relativo 1..N)
  pause?: { from: number; months: number }; // pausa de contribuições
  deadlineMonths?: number | null; // prazo em meses a contar de agora
  horizon?: number; // limite da simulação (por omissão 600)
};
export type SimResult = { reachable: boolean; monthsToReach: number | null; finalAtDeadline: number | null; shortfallAtDeadline: number | null; requiredMonthly: number | null; assumptions: string[]; reason?: string };

/** Simulação linear: sem rentabilidade, sem inflação. Não altera dados. */
export function simulateGoal(i: SimInput): SimResult {
  const assumptions = ["Sem rentabilidade financeira nem inflação.", "Contribuição mensal constante, salvo pausa e reforços indicados.", "Valores em euros; não altera dados reais."];
  const H = i.horizon ?? 600;
  let acc = cents(i.current);
  const target = cents(i.target);
  let reach: number | null = acc >= target ? 0 : null;
  let atDeadline: number | null = i.deadlineMonths === 0 ? acc : null;
  const extras = i.extra ?? [];
  for (let m = 1; m <= H; m++) {
    const paused = i.pause && m >= i.pause.from && m < i.pause.from + i.pause.months;
    if (!paused) acc += cents(i.monthlyContribution);
    for (const e of extras) if (e.atMonth === m) acc += cents(e.amount);
    if (reach === null && acc >= target) reach = m;
    if (i.deadlineMonths != null && m === i.deadlineMonths) atDeadline = acc;
    if (reach !== null && (i.deadlineMonths == null || m >= i.deadlineMonths)) break;
  }
  const dl = i.deadlineMonths;
  const shortfall = dl != null && atDeadline != null ? Math.max(0, euros(target - atDeadline)) : null;
  let required: number | null = null;
  if (dl != null && dl > 0) {
    const fixed = cents(i.current) + extras.filter((e) => e.atMonth <= dl).reduce((s, e) => s + cents(e.amount), 0);
    const activeMonths = dl - (i.pause ? Math.max(0, Math.min(i.pause.months, dl - i.pause.from + 1)) : 0);
    required = activeMonths > 0 ? euros(Math.max(0, Math.ceil((target - fixed) / activeMonths))) : null;
  }
  const result: SimResult = { reachable: reach !== null, monthsToReach: reach, finalAtDeadline: atDeadline != null ? euros(atDeadline) : null, shortfallAtDeadline: shortfall, requiredMonthly: required, assumptions };
  if (reach === null) result.reason = i.monthlyContribution <= 0 ? "Sem contribuição mensal positiva, a meta não é atingível." : `Não é atingida em ${H} meses com os pressupostos indicados.`;
  else if (dl != null && reach > dl) result.reason = `Atingida em ${reach} meses, depois do prazo (${dl}).`;
  return result;
}

/* ----------------------------------------------------------------- 8. importação CSV */

/** Interpreta um número em formato PT (1.234,56) ou ponto decimal (1234.56). Devolve null se inválido. */
export function parseAmount(raw: string): number | null {
  let s = String(raw ?? "").trim().replace(/\s|€|EUR/gi, "");
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); } else if (s.startsWith("+")) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = lastComma > lastDot ? "," : ".";
    const thou = dec === "," ? "." : ",";
    s = s.split(thou).join("").replace(dec, ".");
  } else if (lastComma >= 0) {
    if ((s.match(/,/g) ?? []).length > 1) s = s.split(",").join("");
    else s = /^\d{1,3},\d{3}$/.test(s) && false ? s.replace(",", "") : s.replace(",", ".");
  } else if (lastDot >= 0) {
    const parts = s.split(".");
    if (parts.length > 2) s = parts.join("");
    else if (/^\d{1,3}\.\d{3}$/.test(s)) s = parts.join(""); // 1.234 = milhar em PT
  }
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/** Interpreta datas AAAA-MM-DD ou DD/MM/AAAA (também com - ou .). Devolve ISO ou null. */
export function parseDatePT(raw: string): string | null {
  const s = String(raw ?? "").trim();
  let y: number, m: number, d: number;
  let r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (r) { y = +r[1]; m = +r[2]; d = +r[3]; }
  else if ((r = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(s))) { d = +r[1]; m = +r[2]; y = +r[3]; }
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Divide CSV com aspas, deteta separador (; , tab) e remove BOM. */
export function parseCsv(text: string): { delimiter: string; rows: string[][] } {
  const t = text.replace(/^\uFEFF/, "");
  const first = t.split(/\r?\n/)[0] ?? "";
  const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  let q = false;
  for (const ch of first) { if (ch === '"') q = !q; else if (!q && ch in counts) counts[ch]++; }
  const delimiter = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ";";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQ = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQ) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else inQ = false; } else cell += ch; }
    else if (ch === '"') inQ = true;
    else if (ch === delimiter) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((c) => c.trim() !== "")) rows.push(row); row = []; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); if (row.some((c) => c.trim() !== "")) rows.push(row); }
  return { delimiter, rows };
}

export type CsvMapping = { date: number; amount: number; category?: number; note?: number; parcel?: number };
export type CsvRowResult = { line: number; ok: boolean; errors: string[]; date?: string; value?: number; category?: string; note?: string; parcelName?: string; duplicate?: "existente" | "ficheiro" };

/** Valida linhas segundo o mapeamento. Importa despesas: valores negativos viram positivos; positivos são rejeitados salvo `allowPositive`. */
export function validateCsvRows(rows: string[][], map: CsvMapping, existing: { date: string; value: number; category: string }[], opts: { hasHeader: boolean; allowPositive?: boolean }): CsvRowResult[] {
  const start = opts.hasHeader ? 1 : 0;
  const exist = new Set(existing.map((e) => `${e.date.slice(0, 10)}|${cents(e.value)}|${(e.category ?? "").trim().toLowerCase()}`));
  const inFile = new Set<string>();
  const out: CsvRowResult[] = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const errors: string[] = [];
    const date = parseDatePT(r[map.date] ?? "");
    if (!date) errors.push(`Data inválida: "${r[map.date] ?? ""}"`);
    let amt = parseAmount(r[map.amount] ?? "");
    if (amt === null) errors.push(`Montante inválido: "${r[map.amount] ?? ""}"`);
    else {
      if (amt > 0 && !opts.allowPositive) errors.push("Montante positivo (esperada despesa com valor negativo ou ativa a opção de valores positivos).");
      amt = Math.abs(amt);
      if (amt === 0) errors.push("Montante zero.");
    }
    const category = (map.category != null ? r[map.category] ?? "" : "").trim();
    const res: CsvRowResult = { line: i + 1, ok: errors.length === 0, errors, date: date ?? undefined, value: amt ?? undefined, category, note: map.note != null ? (r[map.note] ?? "").trim() : "", parcelName: map.parcel != null ? (r[map.parcel] ?? "").trim() : "" };
    if (res.ok) {
      const k = `${date}|${cents(amt!)}|${category.toLowerCase()}`;
      if (inFile.has(k)) res.duplicate = "ficheiro"; else if (exist.has(k)) res.duplicate = "existente";
      inFile.add(k);
    }
    out.push(res);
  }
  return out;
}

/** Impressão digital estável do conteúdo (FNV-1a 32 bits, sem dependências). */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  const s = text.replace(/\r\n/g, "\n").trim();
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${s.length}-${h.toString(16)}`;
}

/* ----------------------------------------------------------------- 1. composição dos totais */

type CompositionLine = { label: string; amount: number; kind: "historico" | "inicial" | "movimentos" | "ajustes" | "submetas"; sources: { label: string; amount: number; date?: string }[] };
export type Composition = { parcelId: number; periodFlow: number; accumulated: number; lines: CompositionLine[]; check: number };

/**
 * Explica o acumulado de uma parcela e separa-o do fluxo do período.
 * Reutiliza goalBreakdown (fonte única) e lista os registos de origem. `check` deve ser 0.
 */
export function composeTotal(
  b: { hasOpening: boolean; opening: number; flows: number; txNet: number; adjustments: number; unallocated: number; subs: { sub: { name: string }; balance: number; converted: number | null }[]; total: number },
  monthly: { label: string; amount: number }[],
  periodKeys: Set<string>,
  entries: { kind: string; amount: number; date: string; subgoalId: number | null; note?: string }[],
  txs: { type: string; value: number; date: string; note?: string }[],
): Composition {
  const lines: CompositionLine[] = [];
  const flowSources = monthly.filter((m) => toCents(m.amount) !== 0).map((m) => ({ label: `Alocação ${m.label}`, amount: round2(m.amount) }));
  lines.push({ label: b.hasOpening ? "Alocações desde a data do saldo inicial" : "Histórico de alocações", amount: round2(b.flows), kind: "historico", sources: flowSources });
  if (b.hasOpening) lines.unshift({ label: "Saldo inicial", amount: round2(b.opening), kind: "inicial", sources: entries.filter((e) => e.kind === "inicial" && e.subgoalId == null).map((e) => ({ label: e.note || "Saldo inicial", amount: round2(e.amount), date: e.date })) });
  if (toCents(b.txNet) !== 0) lines.push({ label: "Aportes e retiradas", amount: round2(b.txNet), kind: "movimentos", sources: txs.filter((t) => t.type === "contribution" || t.type === "withdrawal").map((t) => ({ label: `${t.type === "withdrawal" ? "Retirada" : "Aporte"}${t.note ? ` ${t.note}` : ""}`, amount: round2(t.type === "withdrawal" ? -t.value : t.value), date: t.date })) });
  if (toCents(b.adjustments) !== 0) lines.push({ label: "Ajustes da meta", amount: round2(b.adjustments), kind: "ajustes", sources: entries.filter((e) => e.kind === "ajuste" && e.subgoalId == null).map((e) => ({ label: e.note || "Ajuste", amount: round2(e.amount), date: e.date })) });
  for (const s of b.subs) if (s.converted != null && toCents(s.converted) !== 0) lines.push({ label: `Submeta: ${s.sub.name}`, amount: round2(s.converted), kind: "submetas", sources: [] });
  const sum = sumEuros(lines.map((l) => l.amount));
  const periodFlow = sumEuros(monthly.filter((m) => periodKeys.has(m.label)).map((m) => m.amount));
  return { parcelId: 0, periodFlow, accumulated: round2(b.total), lines, check: round2(sum - b.total) };
}
