// EVO-08 — integração via HTTP real sobre base temporária isolada (nunca toca em data.db).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";

const dir = mkdtempSync(join(tmpdir(), "sm-test8-"));
process.chdir(dir);
const express = (await import("express")).default;
const { registerRoutes } = await import("../server/routes");
const { storage } = await import("../server/storage");

const app = express();
(await import("../server/middleware")).installBase(app);
const server = createServer(app);
await registerRoutes(server, app);
await new Promise<void>((r) => server.listen(0, r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
test.after(() => server.close());
const call = async (method: string, path: string, body?: unknown) => {
  const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", "x-sm-client": "1" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json };
};
const state = () => storage.getState();

// dados de teste sintéticos (sem dados pessoais)
const p1 = storage.createParcel({ name: "Teste Gastos", kind: "gastos", color: "#111", defaultMode: "fixo", defaultValue: 0 } as any);
const p2 = storage.createParcel({ name: "Teste Poupança", kind: "poupanca", color: "#222", defaultMode: "fixo", defaultValue: 0 } as any);
const mk = (year: number, month: number) => storage.createMonth({ year, month, label: `${month}/${year}`, base: 1000, taxaSs: 0, taxaIrsBase: 0 } as any);
const mDez = mk(2026, 12), mJan = mk(2027, 1), mFev = mk(2027, 2);
storage.setAllocation(mDez.id, p1.id, "fixo", 300);

test("versão e ambiente são expostos", async () => {
  const r = await call("GET", "/api/app-info");
  assert.equal(r.status, 200);
  assert.match(r.json.version, /^\d+\.\d+\.\d+$/);
  assert.equal(r.json.environment, "desenvolvimento");
  assert.equal(r.json.schemaVersion, 4);
});

test("migração: colunas e tabelas novas existem e os dados antigos têm valores por omissão", () => {
  const m = state().months.find((x) => x.id === mDez.id)!;
  assert.equal(m.status, "aberto");
  assert.equal(m.carryIn, 0);
  assert.ok(existsSync(join(dir, "data.db")));
});

test("verificar dados: erro de distribuição acima do disponível e aviso de por distribuir", async () => {
  storage.setAllocation(mFev.id, p1.id, "fixo", 5000);
  const v = (await call("GET", "/api/verify")).json;
  assert.ok(v.issues.some((i: any) => i.code === "dist_excede" && i.severity === "erro"));
  assert.ok(v.issues.some((i: any) => i.code === "por_distribuir" && i.severity === "aviso"));
  assert.ok(v.errors >= 1 && v.warnings >= 1);
  const snap = JSON.stringify(state().allocations);
  await call("GET", "/api/verify");
  assert.equal(JSON.stringify(state().allocations), snap); // não corrige nada sozinho
  storage.setAllocation(mFev.id, p1.id, "fixo", 0);
});

test("fecho: restante, transporte para o mês seguinte e transporte não é rendimento", async () => {
  const sum = (await call("GET", `/api/months/${mDez.id}/summary`)).json;
  assert.equal(sum.remainder, 700); // 1000 - 300
  const r = await call("POST", `/api/months/${mDez.id}/close`, { destination: "transportar" });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, "fechado");
  const jan = state().months.find((m) => m.id === mJan.id)!;
  assert.equal(jan.carryIn, 700); // transporte entre anos (dez -> jan)
  const janSum = (await call("GET", `/api/months/${mJan.id}/summary`)).json;
  assert.equal(janSum.available, 1000); // o transporte NÃO aumenta o rendimento disponível
  assert.equal(janSum.remainder, 1700); // mas entra no restante a decidir
});

test("regras de edição no backend: mês fechado recusa alterações financeiras (423)", async () => {
  const tx = await call("POST", "/api/transactions", { monthId: mDez.id, date: "2026-12-10", type: "expense", value: 5, parcelId: p1.id });
  assert.equal(tx.status, 423);
  assert.equal((await call("PUT", "/api/allocations", { monthId: mDez.id, parcelId: p1.id, mode: "fixo", value: 10 })).status, 423);
  assert.equal((await call("PATCH", `/api/months/${mDez.id}`, { base: 2000 })).status, 423);
  assert.equal((await call("DELETE", `/api/months/${mDez.id}`)).status, 423);
  assert.equal((await call("PATCH", `/api/months/${mDez.id}`, { status: "aberto" })).status, 423); // não se reabre por PATCH
  assert.equal((await call("POST", `/api/months/${mDez.id}/close`, { destination: "manter" })).status, 409); // já fechado
  assert.equal(state().transactions.length, 0);
});

test("reabertura exige motivo, desfaz o transporte e fica no histórico", async () => {
  assert.equal((await call("POST", `/api/months/${mDez.id}/reopen`, { note: "" })).status, 400);
  const r = await call("POST", `/api/months/${mDez.id}/reopen`, { note: "corrigir despesa" });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, "aberto");
  assert.equal(state().months.find((m) => m.id === mJan.id)!.carryIn, 0);
  const h = (await call("GET", `/api/closures?monthId=${mDez.id}`)).json;
  assert.deepEqual(h.map((c: any) => c.action), ["fecho", "reabertura"]);
  assert.equal(h[1].note, "corrigir despesa");
  assert.equal((await call("POST", "/api/transactions", { monthId: mDez.id, date: "2026-12-10", type: "expense", value: 5, parcelId: p1.id })).status, 200);
});

test("fecho com reforço de meta cria aporte e fecha; transporte exige mês seguinte existente", async () => {
  const mMar = mk(2027, 3), mAbr = mk(2027, 4);
  void mAbr;
  storage.setAllocation(mMar.id, p1.id, "fixo", 400);
  const r = await call("POST", `/api/months/${mMar.id}/close`, { destination: "reforcar", targetParcelId: p2.id });
  assert.equal(r.status, 200);
  const aporte = state().transactions.find((t) => t.monthId === mMar.id && t.type === "contribution")!;
  assert.equal(aporte.value, 600);
  assert.equal(aporte.parcelId, p2.id);
  const sem = storage.createMonth({ year: 2030, month: 5, label: "x", base: 100, taxaSs: 0, taxaIrsBase: 0 } as any);
  assert.equal((await call("POST", `/api/months/${sem.id}/close`, { destination: "transportar" })).status, 409);
  assert.equal(state().months.find((m) => m.id === sem.id)!.status, "aberto"); // rollback: nada mudou
});

test("manter como não atribuído fecha sem movimentos nem transporte", async () => {
  const before = state().transactions.length;
  const r = await call("POST", `/api/months/${mJan.id}/close`, { destination: "manter" });
  assert.equal(r.status, 200);
  assert.equal(state().transactions.length, before);
  assert.equal(state().months.find((m) => m.id === mFev.id)!.carryIn, 0);
});

test("recorrências: validação, pendentes, confirmar uma única vez, ignorar", async () => {
  assert.equal((await call("POST", "/api/recurring", { name: "", value: 10, startMonth: "2027-02" })).status, 400);
  assert.equal((await call("POST", "/api/recurring", { name: "R", value: 10, startMonth: "2027-02", dayOfMonth: 40 })).status, 400);
  const r = (await call("POST", "/api/recurring", { name: "Renda teste", value: 100, category: "Casa", parcelId: p1.id, dayOfMonth: 31, startMonth: "2027-02", endMonth: "2027-04" })).json;
  const pend = (await call("GET", "/api/recurring/pending")).json;
  const keys = pend.map((x: any) => x.key);
  assert.ok(keys.includes(`${r.id}:2027-02`));
  assert.ok(!keys.includes(`${r.id}:2027-01`)); // antes do início
  const fev = pend.find((x: any) => x.key === `${r.id}:2027-02`);
  assert.equal(fev.date, "2027-02-28"); // dia 31 em fevereiro
  assert.equal((await call("POST", "/api/recurring/confirm", { key: fev.key })).status, 200);
  assert.equal((await call("POST", "/api/recurring/confirm", { key: fev.key })).status, 409); // sem duplicar
  assert.equal(state().transactions.filter((t: any) => t.occurrenceKey === fev.key).length, 1);
  const abr = pend.find((x: any) => x.key === `${r.id}:2027-04`);
  assert.equal(abr.date, "2027-04-30");
  assert.equal((await call("POST", "/api/recurring/skip", { key: abr.key })).status, 200);
  assert.ok(!(await call("GET", "/api/recurring/pending")).json.some((x: any) => x.key === abr.key));
});

test("reservas: sugestão separada de despesas pagas; pagar cria a despesa só nesse momento", async () => {
  const before = state().transactions.length;
  const r = (await call("POST", "/api/reserves", { name: "Seguro teste", target: 600, dueMonth: "2027-12", reserved: 150, parcelId: p1.id })).json;
  assert.equal(state().transactions.length, before); // reservar não é gastar
  assert.equal((await call("POST", "/api/reserves", { name: "x", target: 0, dueMonth: "2027-12" })).status, 400);
  const pay = await call("POST", `/api/reserves/${r.id}/pay`, { monthId: mFev.id, date: "2027-02-10", category: "Seguros" });
  assert.equal(pay.status, 200);
  assert.equal(state().transactions.length, before + 1); // só agora há despesa
  const paid = (await call("GET", "/api/reserves")).json.find((x: any) => x.id === r.id);
  assert.equal(paid.status, "paga");
  assert.equal(paid.paidTransactionId, pay.json.id);
  assert.equal((await call("POST", `/api/reserves/${r.id}/pay`, { monthId: mFev.id, date: "2027-02-10" })).status, 409); // sem pagar duas vezes
});

test("histórico regista alterações financeiras relevantes", async () => {
  const log = (await call("GET", "/api/change-log")).json;
  assert.ok(log.length > 5);
  assert.ok(log.some((l: any) => l.action === "fechar"));
  assert.ok(log.some((l: any) => l.action === "reabrir"));
  assert.ok(log.some((l: any) => l.entity === "movimento" && l.action === "criar"));
});

const csv = "Data;Montante;Categoria;Nota\n05/03/2027;-1.234,50;Casa;renda\n05/03/2027;-1.234,50;Casa;renda\n06/03/2027;-7,25;Café;\n";
const mapping = { date: 0, amount: 1, category: 2, note: 3 };

test("CSV: pré-visualização com resumo, erros por linha e duplicado dentro do ficheiro", async () => {
  const bad = (await call("POST", "/api/import/csv/preview", { text: csv + "xx;abc;Z;\n", mapping })).json;
  assert.equal(bad.summary.erros, 1);
  assert.equal(bad.summary.duplicadas, 1);
  assert.equal(bad.results.at(-1).line, 5);
  assert.equal((await call("POST", "/api/import/csv/preview", { text: "", mapping })).status, 400);
});

test("CSV: importação transacional, sem duplicados, bloqueia reimportação e linhas com erro", async () => {
  const mMarId = state().months.find((m) => m.year === 2027 && m.month === 3)!.id;
  void mMarId;
  // março de 2027 está fechado (reforço): reabrir para importar
  const mar = state().months.find((m) => m.year === 2027 && m.month === 3)!;
  assert.equal((await call("POST", "/api/import/csv", { text: csv, mapping, parcelId: p1.id })).status, 423); // fechado
  await call("POST", `/api/months/${mar.id}/reopen`, { note: "importar" });
  const before = state().transactions.length;
  const rErr = await call("POST", "/api/import/csv", { text: csv + "xx;abc;Z;\n", mapping, parcelId: p1.id });
  assert.equal(rErr.status, 400);
  assert.equal(state().transactions.length, before); // rollback/sem efeitos
  const ok = await call("POST", "/api/import/csv", { text: csv, mapping, parcelId: p1.id, fileName: "teste.csv" });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.imported, 2); // duplicado do ficheiro ignorado
  assert.equal(state().transactions.length, before + 2);
  const again = await call("POST", "/api/import/csv", { text: csv, mapping, parcelId: p1.id });
  assert.equal(again.status, 409); // reimportação acidental
  assert.equal(state().transactions.length, before + 2);
  const t = state().transactions.find((x: any) => x.importBatchId != null && x.value === 1234.5);
  assert.ok(t);
});

test("CSV: rollback completo se uma linha falhar a meio (mês inexistente)", async () => {
  const before = state().transactions.length;
  const txt = "Data;Montante\n06/03/2027;-3,00\n06/03/2035;-3,00\n";
  const r = await call("POST", "/api/import/csv", { text: txt, mapping: { date: 0, amount: 1 }, parcelId: p1.id });
  assert.equal(r.status, 400);
  assert.equal(state().transactions.length, before);
});

test("backups: exportação inclui versão de formato e a importação valida antes do restauro", async () => {
  const exp = (await call("GET", "/api/export/json")).json;
  assert.equal(exp.schemaVersion, 4);
  assert.ok(Array.isArray(exp.months));
  const snap = JSON.stringify(state().months.map((m) => m.id));
  assert.equal((await call("POST", "/api/import", { ...exp, schemaVersion: 99 })).status, 400);
  assert.equal((await call("POST", "/api/import", { ...exp, months: [{ id: 1, year: 2026, month: 13 }] })).status, 400);
  assert.equal(JSON.stringify(state().months.map((m) => m.id)), snap);
});

test("backups antigos (sem campos EVO-08) restauram com valores por omissão, num ambiente isolado", async () => {
  const exp = (await call("GET", "/api/export/json")).json;
  const old = { ...exp, schemaVersion: 2, months: exp.months.map(({ status, carryIn, ...m }: any) => m), transactions: exp.transactions.map(({ recurrenceId, occurrenceKey, importBatchId, ...t }: any) => t) };
  const r = await call("POST", "/api/import", old);
  assert.equal(r.status, 200);
  assert.ok(state().months.every((m) => m.status === "aberto" && m.carryIn === 0));
  assert.equal(state().transactions.length, exp.transactions.length); // totais preservados
});

test("restauro: estado de fecho, recorrências, reservas e histórico fazem ida e volta", async () => {
  const exp = (await call("GET", "/api/export/json")).json;
  assert.ok(exp.recurringExpenses.length >= 1 && exp.reserves.length >= 1 && exp.changeLog.length > 0);
  const closed = state().months.filter((m) => m.status === "fechado").map((m) => m.id).sort();
  const r = await call("POST", "/api/import", exp);
  assert.equal(r.status, 200);
  assert.deepEqual(state().months.filter((m) => m.status === "fechado").map((m) => m.id).sort(), closed);
  assert.equal(state().recurringExpenses!.length, exp.recurringExpenses.length);
  assert.equal(state().reserves!.length, exp.reserves.length);
});
