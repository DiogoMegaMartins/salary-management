/** EVO-08: serviços de fecho mensal, histórico, recorrências, reservas, importação CSV e verificação. */
import { eq, and, desc } from "drizzle-orm";
import { db, storage, httpError } from "./storage";
import { months, allocations, transactions, monthClosures, changeLog, recurringExpenses, recurrenceSkips, reserves, importBatches, categories } from "@shared/schema";
import { availableOf, allocationAmount } from "@shared/calc";
import { checkConsistency, monthRemainder, nextMonthKey, isClosed, pendingOccurrences, ymOf, parseCsv, validateCsvRows, fingerprint, round2, sumEuros, type CsvMapping } from "@shared/evo08";

export const APP_VERSION = "1.11.0";
export const ENV_NAME = process.env.NODE_ENV === "production" ? "produção" : "desenvolvimento";

/** Máximo de entradas guardadas no histórico; as mais antigas saem quando é excedido. */
export const CHANGE_LOG_MAX = 20000;
export function logChange(entity: string, entityId: number | null, action: string, summary: string) {
  const row = db.insert(changeLog).values({ at: new Date().toISOString(), entity, entityId, action, summary: summary.slice(0, 300) }).returning().get();
  if (row.id % 500 === 0) (db as any).$client.prepare("DELETE FROM change_log WHERE id <= ?").run(row.id - CHANGE_LOG_MAX);
}
export const listChangeLog = (limit = 200) => db.select().from(changeLog).orderBy(desc(changeLog.id)).limit(limit).all();

/* ------------------------------------------------------------- guarda de fecho (aplicada no backend) */

/** Lança 423 se o mês estiver fechado. Todas as escritas financeiras de um mês passam por aqui. */
export function assertMonthOpen(monthId: number | null | undefined) {
  if (monthId == null) return;
  const m = db.select().from(months).where(eq(months.id, monthId)).get();
  if (m && isClosed(m)) throw httpError(423, "O mês está fechado. Reabre-o para alterar valores.");
}

/** Envolve uma escrita do storage com guarda de fecho e registo no histórico. */
function guarded(entity: string, action: string, monthOf: (...a: any[]) => number | null | undefined, fn: (...a: any[]) => any, summary: (r: any, ...a: any[]) => string) {
  return (...a: any[]): any => {
    assertMonthOpen(monthOf(...a));
    const r = fn(...a);
    logChange(entity, r?.id ?? null, action, summary(r, ...a));
    return r;
  };
}

const txMonth = (id: number) => db.select().from(transactions).where(eq(transactions.id, id)).get()?.monthId;

/** Instala a guarda e o histórico sobre as escritas financeiras existentes (sem duplicar lógica). */
export function installGuards() {
  const s: any = storage;
  if (s.__evo08) return;
  s.__evo08 = true;
  const origCreateTx = s.createTransaction.bind(s);
  s.createTransaction = guarded("movimento", "criar", (d: any) => d?.monthId, origCreateTx, (r: any) => `${r.type} ${r.value} € em ${r.date}`);
  const origUpdTx = s.updateTransaction.bind(s);
  s.updateTransaction = (id: number, patch: any) => {
    assertMonthOpen(txMonth(id));
    if (patch?.monthId != null) assertMonthOpen(patch.monthId);
    const r = origUpdTx(id, patch);
    logChange("movimento", id, "alterar", `${r.type} ${r.value} € em ${r.date}`);
    return r;
  };
  const origDelTx = s.deleteTransaction.bind(s);
  s.deleteTransaction = (id: number) => {
    assertMonthOpen(txMonth(id));
    const cur = db.select().from(transactions).where(eq(transactions.id, id)).get();
    const r = origDelTx(id);
    logChange("movimento", id, "eliminar", cur ? `${cur.type} ${cur.value} € em ${cur.date}` : "movimento");
    return r;
  };
  const origAlloc = s.setAllocation.bind(s);
  s.setAllocation = guarded("alocação", "alterar", (m: number) => m, origAlloc, (r: any, m: number, p: number, mode: string, v: number) => `mês ${m}, parcela ${p}: ${v}${mode === "percentagem" ? " %" : " €"}`);
  const origDist = s.setDistribution.bind(s);
  s.setDistribution = guarded("distribuição", "alterar", (m: number) => m, origDist, (_r: any, m: number, p: number) => `mês ${m}, parcela ${p}`);
  const origAssets = s.setAssets.bind(s);
  s.setAssets = guarded("ativos", "alterar", (m: number) => m, origAssets, (_r: any, m: number, p: number) => `mês ${m}, parcela ${p}`);
  const origUpdMonth = s.updateMonth.bind(s);
  s.updateMonth = (id: number, patch: any) => {
    // status/carryIn só mudam pelo fecho/reabertura; o resto exige mês aberto
    const keys = Object.keys(patch ?? {});
    if (keys.some((k) => k !== "notes" && k !== "deficitReason" && k !== "deficitNote")) assertMonthOpen(id);
    if ("status" in (patch ?? {}) || "carryIn" in (patch ?? {})) throw httpError(400, "Estado e transporte alteram-se apenas pelo fecho mensal.");
    const r = origUpdMonth(id, patch);
    logChange("mês", id, "alterar", `campos: ${keys.join(", ")}`);
    return r;
  };
  const origDelMonth = s.deleteMonth.bind(s);
  s.deleteMonth = (id: number) => { assertMonthOpen(id); const r = origDelMonth(id); logChange("mês", id, "eliminar", `mês ${id}`); return r; };
  for (const [fn, label] of [["createGoalEntry", "criar"], ["updateGoalEntry", "alterar"], ["deleteGoalEntry", "eliminar"], ["createSubgoal", "criar"], ["updateSubgoal", "alterar"], ["deleteSubgoal", "eliminar"]] as const) {
    const orig = s[fn].bind(s);
    s[fn] = (...a: any[]) => { const r = orig(...a); logChange(fn.includes("Entry") ? "saldo/ajuste" : "submeta", r?.id ?? (typeof a[0] === "number" ? a[0] : null), label, JSON.stringify(typeof a[0] === "object" ? { kind: a[0].kind, amount: a[0].amount, name: a[0].name } : {})); return r; };
  }
}

/* ------------------------------------------------------------- consistência */

export function verifyData() {
  const st = storage.getState();
  const availableByMonth: Record<number, number> = {};
  for (const m of st.months) availableByMonth[m.id] = availableOf(m, st.settings);
  const issues = checkConsistency({ ...(st as any), availableByMonth });
  return { issues, errors: issues.filter((i) => i.severity === "erro").length, warnings: issues.filter((i) => i.severity === "aviso").length, at: new Date().toISOString() };
}

/* ------------------------------------------------------------- fecho mensal */

export function monthSummary(monthId: number) {
  const st = storage.getState();
  const m = st.months.find((x) => x.id === monthId);
  if (!m) throw httpError(404, "Mês não encontrado.");
  const available = availableOf(m, st.settings);
  const allocated = sumEuros(st.allocations.filter((a) => a.monthId === monthId).map((a) => allocationAmount(a as any, available)));
  const txs = st.transactions.filter((t) => t.monthId === monthId);
  const remainder = monthRemainder(available, m.carryIn ?? 0, allocated, txs as any);
  return { month: m, available, carryIn: m.carryIn ?? 0, allocated, remainder, status: m.status, transactions: txs.length };
}

export function closeMonth(monthId: number, d: { destination: string; targetParcelId?: number | null; note?: string }) {
  const sum = monthSummary(monthId);
  if (sum.status === "fechado") throw httpError(409, "O mês já está fechado.");
  const dest = ["transportar", "reforcar", "manter"].includes(d.destination) ? d.destination : "manter";
  const rem = sum.remainder;
  let carryToMonthId: number | null = null;
  const run = () => {
    if (rem > 0.004 && dest === "transportar") {
      const nk = nextMonthKey(sum.month.year, sum.month.month);
      const next = db.select().from(months).where(and(eq(months.year, nk.year), eq(months.month, nk.month))).get();
      if (!next) throw httpError(409, "Cria primeiro o mês seguinte para transportar o restante.");
      if (next.status === "fechado") throw httpError(409, "O mês seguinte está fechado.");
      carryToMonthId = next.id;
      db.update(months).set({ carryIn: round2((next.carryIn ?? 0) + rem) }).where(eq(months.id, next.id)).run();
    } else if (rem > 0.004 && dest === "reforcar") {
      if (d.targetParcelId == null) throw httpError(400, "Escolhe a parcela/meta a reforçar.");
      storage.createTransaction({ monthId, date: `${sum.month.year}-${String(sum.month.month).padStart(2, "0")}-${String(new Date(Date.UTC(sum.month.year, sum.month.month, 0)).getUTCDate()).padStart(2, "0")}`, type: "contribution", value: rem, parcelId: Number(d.targetParcelId), category: "", note: "Reforço do restante no fecho mensal" } as any);
    } else if (rem < -0.004 && dest !== "manter") throw httpError(409, "Não há restante positivo para transportar ou reforçar.");
    db.update(months).set({ status: "fechado" }).where(eq(months.id, monthId)).run();
    db.insert(monthClosures).values({ monthId, action: "fecho", remainder: rem, destination: dest, targetParcelId: d.targetParcelId ?? null, carryToMonthId, note: d.note ?? "", at: new Date().toISOString() }).run();
  };
  // o reforço grava um movimento: tem de acontecer antes de fechar (mês ainda aberto)
  (db as any).$client.transaction(run)();
  logChange("mês", monthId, "fechar", `restante ${rem} € → ${dest}`);
  return monthSummary(monthId);
}

export function reopenMonth(monthId: number, note: string) {
  const m = db.select().from(months).where(eq(months.id, monthId)).get();
  if (!m) throw httpError(404, "Mês não encontrado.");
  if (m.status !== "fechado") throw httpError(409, "O mês já está aberto.");
  if (!String(note ?? "").trim()) throw httpError(400, "Indica o motivo da reabertura.");
  const last = db.select().from(monthClosures).where(and(eq(monthClosures.monthId, monthId), eq(monthClosures.action, "fecho"))).all().slice(-1)[0];
  (db as any).$client.transaction(() => {
    if (last?.destination === "transportar" && last.carryToMonthId != null) {
      const next = db.select().from(months).where(eq(months.id, last.carryToMonthId)).get();
      if (next?.status === "fechado") throw httpError(409, "O mês seguinte está fechado: reabre-o primeiro.");
      if (next) db.update(months).set({ carryIn: round2(Math.max(0, (next.carryIn ?? 0) - last.remainder)) }).where(eq(months.id, next.id)).run();
    }
    db.update(months).set({ status: "aberto" }).where(eq(months.id, monthId)).run();
    db.insert(monthClosures).values({ monthId, action: "reabertura", remainder: last?.remainder ?? 0, destination: "manter", note, at: new Date().toISOString() }).run();
  })();
  logChange("mês", monthId, "reabrir", note.slice(0, 200));
  return monthSummary(monthId);
}
export const closureHistory = (monthId?: number) => db.select().from(monthClosures).all().filter((c) => monthId == null || c.monthId === monthId);

/* ------------------------------------------------------------- recorrências e reservas */

export const listRecurring = () => db.select().from(recurringExpenses).all();
export function saveRecurring(d: any, id?: number) {
  const name = String(d.name ?? "").trim();
  const value = Number(d.value);
  if (!name) throw httpError(400, "O nome é obrigatório.");
  if (!(value > 0)) throw httpError(400, "O valor tem de ser maior que zero.");
  if (!/^\d{4}-\d{2}$/.test(String(d.startMonth ?? ""))) throw httpError(400, "Mês de início inválido (AAAA-MM).");
  if (d.endMonth && !/^\d{4}-\d{2}$/.test(String(d.endMonth))) throw httpError(400, "Mês de fim inválido (AAAA-MM).");
  const day = Math.round(Number(d.dayOfMonth ?? 1));
  if (!(day >= 1 && day <= 31)) throw httpError(400, "Dia do mês inválido.");
  const row = { name, value, category: String(d.category ?? ""), parcelId: d.parcelId != null ? Number(d.parcelId) : null, dayOfMonth: day, startMonth: d.startMonth, endMonth: d.endMonth || null, active: d.active !== false };
  const r = id == null ? db.insert(recurringExpenses).values(row).returning().get() : db.update(recurringExpenses).set(row).where(eq(recurringExpenses.id, id)).returning().get();
  if (!r) throw httpError(404, "Recorrência não encontrada.");
  logChange("recorrência", r.id, id == null ? "criar" : "alterar", `${name} ${value} €`);
  return r;
}
export function deleteRecurring(id: number) { db.delete(recurringExpenses).where(eq(recurringExpenses.id, id)).run(); logChange("recorrência", id, "eliminar", `recorrência ${id}`); }

export function pending() {
  const st = storage.getState();
  const recs = listRecurring();
  const keys = new Set(st.transactions.map((t: any) => t.occurrenceKey).filter(Boolean) as string[]);
  const skipped = new Set(db.select().from(recurrenceSkips).all().map((s) => s.occurrenceKey));
  const open = st.months.filter((m) => !isClosed(m));
  return pendingOccurrences(recs as any, open, keys, skipped).map((p) => ({ key: p.key, date: p.date, recurrenceId: p.rec.id, name: p.rec.name, value: p.rec.value, category: p.rec.category, parcelId: p.rec.parcelId, monthId: st.months.find((m) => m.year === p.year && m.month === p.month)!.id }));
}

/** Confirma uma ocorrência: cria o movimento uma única vez (chave única por recorrência+mês). */
export function confirmOccurrence(key: string) {
  const p = pending().find((x) => x.key === key);
  if (!p) throw httpError(409, "Ocorrência inexistente, já confirmada ou ignorada.");
  return (db as any).$client.transaction(() => {
    const dup = db.select().from(transactions).where(eq(transactions.occurrenceKey, key)).get();
    if (dup) throw httpError(409, "Ocorrência já confirmada.");
    const tx = storage.createTransaction({ monthId: p.monthId, date: p.date, type: "expense", value: p.value, parcelId: p.parcelId, category: p.category, note: p.name } as any);
    db.update(transactions).set({ recurrenceId: p.recurrenceId, occurrenceKey: key }).where(eq(transactions.id, tx.id)).run();
    return { ...tx, recurrenceId: p.recurrenceId, occurrenceKey: key };
  })();
}
export function skipOccurrence(key: string) {
  if (!pending().some((x) => x.key === key)) throw httpError(409, "Ocorrência inexistente, já confirmada ou ignorada.");
  db.insert(recurrenceSkips).values({ occurrenceKey: key }).run();
  logChange("recorrência", null, "alterar", `ocorrência ${key} ignorada`);
}

export const listReserves = () => db.select().from(reserves).all();
export function saveReserve(d: any, id?: number) {
  const name = String(d.name ?? "").trim();
  if (!name) throw httpError(400, "O nome é obrigatório.");
  if (!(Number(d.target) > 0)) throw httpError(400, "O valor-alvo tem de ser maior que zero.");
  if (!/^\d{4}-\d{2}$/.test(String(d.dueMonth ?? ""))) throw httpError(400, "Prazo inválido (AAAA-MM).");
  const reserved = Number(d.reserved ?? 0);
  if (!(reserved >= 0)) throw httpError(400, "O valor reservado não pode ser negativo.");
  const row = { name, target: Number(d.target), dueMonth: d.dueMonth, reserved, parcelId: d.parcelId != null ? Number(d.parcelId) : null };
  const r = id == null ? db.insert(reserves).values(row).returning().get() : db.update(reserves).set(row).where(eq(reserves.id, id)).returning().get();
  if (!r) throw httpError(404, "Reserva não encontrada.");
  logChange("reserva", r.id, id == null ? "criar" : "alterar", `${name} ${row.target} €`);
  return r;
}
export function deleteReserve(id: number) { db.delete(reserves).where(eq(reserves.id, id)).run(); logChange("reserva", id, "eliminar", `reserva ${id}`); }
/** Marca a reserva como paga: só então cria a despesa efetiva (reservas não são despesas pagas). */
export function payReserve(id: number, d: { monthId: number; date: string; category?: string }) {
  const r = db.select().from(reserves).where(eq(reserves.id, id)).get();
  if (!r) throw httpError(404, "Reserva não encontrada.");
  if (r.status !== "ativa") throw httpError(409, "A reserva não está ativa.");
  return (db as any).$client.transaction(() => {
    const tx = storage.createTransaction({ monthId: d.monthId, date: d.date, type: "expense", value: r.target, parcelId: r.parcelId, category: d.category ?? "", note: `Pagamento de reserva: ${r.name}` } as any);
    db.update(reserves).set({ status: "paga", paidTransactionId: tx.id, reserved: r.target }).where(eq(reserves.id, id)).run();
    logChange("reserva", id, "alterar", `paga (${r.target} €)`);
    return tx;
  })();
}

/* ------------------------------------------------------------- importação CSV */

export function csvPreview(d: { text: string; mapping: CsvMapping; hasHeader?: boolean; allowPositive?: boolean }) {
  const { delimiter, rows } = parseCsv(String(d.text ?? ""));
  if (rows.length === 0) throw httpError(400, "O ficheiro está vazio.");
  if (rows.length > 20000) throw httpError(400, "Ficheiro demasiado grande (máximo 20 000 linhas).");
  const existing = db.select().from(transactions).all().map((t) => ({ date: t.date, value: t.value, category: t.category }));
  const hasHeader = d.hasHeader !== false;
  const fp = fingerprint(d.text);
  const already = db.select().from(importBatches).where(eq(importBatches.fingerprint, fp)).get();
  const results = validateCsvRows(rows, d.mapping, existing, { hasHeader, allowPositive: !!d.allowPositive });
  const summary = { total: results.length, validas: results.filter((r) => r.ok && !r.duplicate).length, erros: results.filter((r) => !r.ok).length, duplicadas: results.filter((r) => r.duplicate).length };
  return { delimiter, header: hasHeader ? rows[0] : rows[0].map((_, i) => `Coluna ${i + 1}`), sample: rows.slice(hasHeader ? 1 : 0, 6), results, summary, fingerprint: fp, alreadyImported: !!already };
}

/** Importa só as linhas válidas e não duplicadas, numa única transação; recusa reimportação do mesmo ficheiro. */
export function csvImport(d: { text: string; mapping: CsvMapping; hasHeader?: boolean; allowPositive?: boolean; parcelId: number; includeDuplicates?: boolean; force?: boolean; fileName?: string }) {
  const pv = csvPreview(d);
  if (pv.alreadyImported && !d.force) throw httpError(409, "Este ficheiro já foi importado. Confirma explicitamente para o importar de novo.");
  if (pv.summary.erros > 0) throw httpError(400, `Corrige primeiro as ${pv.summary.erros} linhas com erro.`);
  const st = storage.getState();
  if (!st.parcels.some((p) => p.id === Number(d.parcelId))) throw httpError(400, "Parcela inexistente.");
  const rows = pv.results.filter((r) => r.ok && (d.includeDuplicates || !r.duplicate));
  if (rows.length === 0) throw httpError(400, "Não há linhas novas para importar.");
  const monthFor = (date: string) => st.months.find((m) => m.year === +date.slice(0, 4) && m.month === +date.slice(5, 7));
  for (const r of rows) {
    const m = monthFor(r.date!);
    if (!m) throw httpError(400, `Linha ${r.line}: não existe o mês ${r.date!.slice(0, 7)}. Cria-o primeiro.`);
    if (isClosed(m)) throw httpError(423, `Linha ${r.line}: o mês ${r.date!.slice(0, 7)} está fechado.`);
  }
  return (db as any).$client.transaction(() => {
    const batch = db.insert(importBatches).values({ fingerprint: pv.fingerprint, fileName: d.fileName ?? "", rows: rows.length, at: new Date().toISOString() }).returning().get();
    const known = new Set(db.select().from(categories).all().map((c) => c.name.toLowerCase()));
    for (const r of rows) {
      const m = monthFor(r.date!)!;
      const tx = storage.createTransaction({ monthId: m.id, date: r.date, type: "expense", value: r.value, parcelId: Number(d.parcelId), category: r.category ?? "", note: r.note ?? "" } as any);
      db.update(transactions).set({ importBatchId: batch.id }).where(eq(transactions.id, tx.id)).run();
      void known;
    }
    logChange("importação", batch.id, "importar", `${rows.length} movimentos (${d.fileName ?? "CSV"})`);
    return { imported: rows.length, batchId: batch.id, skipped: pv.results.length - rows.length };
  })();
}
