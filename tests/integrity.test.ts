import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
process.chdir(mkdtempSync(join(tmpdir(), "sm-int-")));
const express = (await import("express")).default;
const { storage } = await import("../server/storage");
const { registerRoutes } = await import("../server/routes");
const { installBase } = await import("../server/middleware");
const app = express();
installBase(app);
const server = createServer(app);
await registerRoutes(server, app);
await new Promise<void>((r) => server.listen(0, r));
test.after(() => server.close());
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const call = async (method: string, path: string, body?: any) => {
  const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", "x-sm-client": "1" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json: any; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json };
};
const state = () => storage.getState();

test("meses: corpo validado (tipos, limites) e erros sempre em {message}", async () => {
  const id = state().months[0].id;
  for (const bad of [{ base: "abc" }, { base: -5 }, { taxaSs: 2 }, { month: 13 }, { descontosMode: "x" }, { label: "" }]) {
    const r = await call("PATCH", `/api/months/${id}`, bad);
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.equal(typeof r.json.message, "string");
  }
  assert.equal((await call("PATCH", `/api/months/${id}`, { base: 1234.5 })).status, 200);
  assert.equal((await call("POST", "/api/months", { year: 2090 })).status, 400);
  assert.equal((await call("POST", "/api/months", { year: 2090, month: 1, label: "Teste", status: "fechado", carryIn: 999 })).json.status, "aberto");
  assert.equal((await call("POST", "/api/months", { year: 2090, month: 1, label: "Teste" })).json.carryIn, 0);
});

test("parcelas: validação e eliminação protegida quando há movimentos", async () => {
  assert.equal((await call("POST", "/api/parcels", { name: "" })).status, 400);
  assert.equal((await call("POST", "/api/parcels", { name: "X", kind: "outro" })).status, 400);
  const p = (await call("POST", "/api/parcels", { name: "Temp", kind: "gastos" })).json;
  assert.equal((await call("PATCH", `/api/parcels/${p.id}`, { defaultValue: "muito" })).status, 400);
  assert.equal((await call("PATCH", `/api/parcels/999999`, { name: "n" })).status, 404);
  const m = state().months[0];
  const tx = await call("POST", "/api/transactions", { monthId: m.id, date: `${m.year}-${String(m.month).padStart(2, "0")}-10`, type: "expense", value: 5, parcelId: p.id });
  assert.equal(tx.status, 200);
  const del = await call("DELETE", `/api/parcels/${p.id}`);
  assert.equal(del.status, 409);
  assert.match(del.json.message, /Arquiva/);
  assert.ok(state().parcels.some((x) => x.id === p.id));
  await call("DELETE", `/api/transactions/${tx.json.id}`);
  assert.equal((await call("DELETE", `/api/parcels/${p.id}`)).status, 200);
});

test("duplicar um mês fechado dá um mês aberto, sem transporte, e falhas não deixam meses a meio", async () => {
  const src = (await call("POST", "/api/months", { year: 2091, month: 3, label: "Origem", base: 1000 })).json;
  assert.equal((await call("POST", `/api/months/${src.id}/close`, { destination: "manter" })).status, 200);
  const before = state().months.length;
  const dup = await call("POST", `/api/months/${src.id}/duplicate`, { year: 2091, month: 4, label: "Copia" });
  assert.equal(dup.status, 200);
  assert.equal(dup.json.status, "aberto");
  assert.equal(dup.json.carryIn, 0);
  assert.equal(state().months.length, before + 1);
  const bad = await call("POST", `/api/months/${src.id}/duplicate`, { year: 2091, month: 13, label: "Mau" });
  assert.equal(bad.status, 400);
  assert.equal(state().months.length, before + 1);
});

test("apagar um mês limpa o histórico de fechos associado; categorias exigem nome", async () => {
  const m = (await call("POST", "/api/months", { year: 2092, month: 1, label: "Fechar" })).json;
  await call("POST", `/api/months/${m.id}/close`, { destination: "manter" });
  assert.ok(state().monthClosures!.some((c: any) => c.monthId === m.id));
  await call("POST", `/api/months/${m.id}/reopen`, { note: "teste" });
  assert.equal((await call("DELETE", `/api/months/${m.id}`)).status, 200);
  assert.ok(!state().monthClosures!.some((c: any) => c.monthId === m.id));
  assert.equal((await call("POST", "/api/categories", { name: "  " })).status, 400);
  assert.equal((await call("PUT", "/api/allocations", { monthId: 1, parcelId: 1, mode: "xx", value: 1 })).status, 400);
});

test("exportação XLSX devolve um ficheiro válido (zip) com a biblioteca atualizada", async () => {
  const r = await fetch(base + "/api/export/xlsx");
  assert.equal(r.status, 200);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.subarray(0, 2).toString(), "PK");
  assert.ok(buf.length > 1000);
});

test("o histórico de alterações não vai no estado do cliente mas vai no backup e tem rota própria", async () => {
  const m = state().months[0];
  await call("PATCH", `/api/months/${m.id}`, { notes: "para o histórico" });
  assert.equal("changeLog" in (await call("GET", "/api/state")).json, false);
  const exp = await fetch(base + "/api/export/json").then((r) => r.json());
  assert.ok(Array.isArray(exp.changeLog) && exp.changeLog.length > 0);
  const log = (await call("GET", "/api/change-log")).json;
  assert.ok(log.length > 0 && log[0].id > log[log.length - 1].id, "mais recentes primeiro");
});

test("cópias automáticas: cria ficheiros SQLite válidos e mantém só as mais recentes", async () => {
  const { runBackup } = await import("../server/backup");
  const { mkdtempSync, readdirSync, readFileSync } = await import("node:fs");
  const dir = mkdtempSync(join(tmpdir(), "sm-bk-"));
  for (let i = 0; i < 4; i++) { await runBackup(dir, 2); await new Promise((r) => setTimeout(r, 5)); }
  const files = readdirSync(dir).filter((n) => n.endsWith(".db"));
  assert.equal(files.length, 2);
  assert.equal(readFileSync(join(dir, files[0])).subarray(0, 15).toString(), "SQLite format 3");
});

test("euros guardados a cêntimos (sem restos de vírgula flutuante)", async () => {
  const m = state().months[0];
  const r = await call("PATCH", `/api/months/${m.id}`, { base: 1234.5678, mealDaily: 7.634 });
  assert.equal(r.json.base, 1234.57);
  assert.equal(r.json.mealDaily, 7.63);
  const p = state().parcels[0];
  const tx = await call("POST", "/api/transactions", { monthId: m.id, date: `${m.year}-${String(m.month).padStart(2, "0")}-05`, type: "expense", value: 0.1 + 0.2, parcelId: p.id });
  assert.equal(tx.json.value, 0.3);
  const al = await call("PUT", "/api/allocations", { monthId: m.id, parcelId: p.id, mode: "fixo", value: 10.005 });
  assert.equal(al.status, 200);
  assert.equal(al.json.value, 10.01);
});

test("/api/health responde sem autenticação e sem dados", async () => {
  const r = await fetch(base + "/api/health");
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
});

test("editar saldo inicial e ajuste: valor, data e nota; validações; tipo fica igual", async () => {
  const p = (await call("POST", "/api/parcels", { name: "Meta edição", kind: "poupanca" })).json;
  const ini = (await call("POST", "/api/goal-entries", { parcelId: p.id, kind: "inicial", amount: 100, date: "2026-01-01", note: "a" })).json;
  const aj = (await call("POST", "/api/goal-entries", { parcelId: p.id, kind: "ajuste", amount: -10, date: "2026-01-02", note: "b" })).json;
  const r = await call("PATCH", `/api/goal-entries/${aj.id}`, { amount: -12.345, date: "2026-02-03", note: "corrigido" });
  assert.equal(r.status, 200);
  assert.deepEqual([r.json.amount, r.json.date, r.json.note, r.json.kind], [-12.35, "2026-02-03", "corrigido", "ajuste"]);
  assert.equal((await call("PATCH", `/api/goal-entries/${ini.id}`, { amount: -5 })).status, 400); // saldo inicial não negativo
  assert.equal((await call("PATCH", `/api/goal-entries/${aj.id}`, { amount: 0 })).status, 400); // ajuste de 0 não altera nada
  assert.equal((await call("PATCH", `/api/goal-entries/${aj.id}`, { amount: "x" })).status, 400);
  assert.equal((await call("PATCH", `/api/goal-entries/${aj.id}`, { date: "03/02/2026" })).status, 400);
  assert.equal((await call("PATCH", `/api/goal-entries/999999`, { note: "x" })).status, 404);
  assert.equal(state().goalEntries.find((e) => e.id === aj.id)!.amount, -12.35);
  assert.ok(state().changeLog!.some((c: any) => c.entity === "saldo/ajuste" && c.action === "alterar"));
});

test("duplicar um mês mantém as parcelas excluídas excluídas", async () => {
  const p = (await call("POST", "/api/parcels", { name: "Férias dup", defaultMode: "fixo", defaultValue: 0 })).json;
  const src = (await call("POST", "/api/months", { year: 2093, month: 3, label: "Origem", base: 1000 })).json;
  await call("PUT", "/api/allocations", { monthId: src.id, parcelId: p.id, mode: "fixo", value: 200, included: false });
  const dup = (await call("POST", `/api/months/${src.id}/duplicate`, { year: 2093, month: 4, label: "Copia" })).json;
  const a = state().allocations.find((x) => x.monthId === dup.id && x.parcelId === p.id);
  assert.equal(a?.included, 0);
});

test("restaurar um backup mantém o modelo de divisão (plataformas e ativos por parcela)", async () => {
  const plat = (await call("POST", "/api/platforms", { name: "Plataforma modelo" })).json;
  const p = (await call("POST", "/api/parcels", { name: "Parcela modelo", defaultMode: "fixo", defaultValue: 100 })).json;
  const m = (await call("POST", "/api/months", { year: 2094, month: 1, label: "Modelo", base: 1000 })).json;
  await call("PUT", "/api/allocations", { monthId: m.id, parcelId: p.id, mode: "fixo", value: 100 });
  await call("PUT", `/api/months/${m.id}/parcels/${p.id}/distribution`, { lines: [{ platformId: plat.id, mode: "percentagem", value: 100 }] });
  await call("PUT", `/api/months/${m.id}/parcels/${p.id}/distribution/${plat.id}/assets`, { lines: [{ name: "Ativo X", percent: 100 }] });
  storage.saveAsModel(m.id);
  const before = state();
  assert.ok(before.rulePlatforms.length >= 1 && before.ruleAssets.length >= 1);
  const exp = JSON.parse(await (await fetch(base + "/api/export/json", { headers: { "x-sm-client": "1" } })).text());
  assert.equal((await call("POST", "/api/import", exp)).status, 200);
  assert.equal(state().rulePlatforms.length, before.rulePlatforms.length);
  assert.equal(state().ruleAssets.length, before.ruleAssets.length);
});

test("erros de ids e de base de dados: respostas iguais em todas as rotas, sem texto interno", async () => {
  const bad = await call("PUT", "/api/allocations", { monthId: "x", parcelId: null, mode: "fixo", value: 1 });
  assert.equal(bad.status, 400);
  assert.equal((await call("POST", "/api/months/abc/apply-rules")).status, 400);
  assert.equal((await call("POST", "/api/months/abc/save-as-rules")).status, 400);
  assert.equal((await call("DELETE", "/api/months/abc")).status, 400);
  const before = (state() as any).changeLog?.length ?? 0;
  assert.equal((await call("DELETE", "/api/months/abc")).status, 400);
  assert.equal(((state() as any).changeLog?.length ?? 0), before); // não regista «mês NaN»
});

test("histórico de metas e submetas guarda o que mudou, também ao alterar e eliminar", async () => {
  const p = (await call("POST", "/api/parcels", { name: "Meta hist", defaultMode: "fixo", defaultValue: 0 })).json;
  const sub = (await call("POST", "/api/subgoals", { parcelId: p.id, name: "Submeta hist", currency: "EUR" })).json;
  await call("PATCH", `/api/subgoals/${sub.id}`, { name: "Submeta renomeada" });
  await call("DELETE", `/api/subgoals/${sub.id}`);
  const log = ((await call("GET", "/api/change-log")).json as any[]).filter((l) => l.entity === "submeta");
  const forId = log.filter((l) => Number(l.entityId) === sub.id);
  assert.ok(forId.length >= 3, "criar, alterar e eliminar ficam registados");
  for (const l of forId) assert.match(l.summary, /Submeta|renomeada/, `resumo vazio: ${JSON.stringify(l)}`);
});

test("eliminar uma categoria com movimentos é recusado; sem movimentos elimina", async () => {
  const c = (await call("POST", "/api/categories", { name: "Cat uso" })).json;
  const m = (await call("POST", "/api/months", { year: 2095, month: 5, label: "Cats", base: 1000 })).json;
  const p = (await call("POST", "/api/parcels", { name: "Parcela cats", defaultMode: "fixo", defaultValue: 0 })).json;
  await call("POST", "/api/transactions", { monthId: m.id, date: "2095-05-10", type: "expense", value: 5, parcelId: p.id, category: "Cat uso" });
  const r = await call("DELETE", `/api/categories/${c.id}`);
  assert.equal(r.status, 409);
  assert.ok(state().categories.some((x) => x.id === c.id));
  const livre = (await call("POST", "/api/categories", { name: "Cat livre" })).json;
  assert.equal((await call("DELETE", `/api/categories/${livre.id}`)).status, 200);
});

test("restaurar: um backup com meses, parcelas ou movimentos fora dos limites é recusado e nada muda", async () => {
  const exp = JSON.parse(await (await fetch(base + "/api/export/json", { headers: { "x-sm-client": "1" } })).text());
  assert.ok(exp.months.length > 0 && exp.parcels.length > 0);
  const antes = state().months.length;
  const mau = (mut: (b: any) => void) => { const b = structuredClone(exp); mut(b); return b; };
  const casos: [string, any][] = [
    ["taxa de 700 %", mau((b) => { b.months[0].taxaSs = 7; })],
    ["base absurda", mau((b) => { b.months[0].base = 1e12; })],
    ["etiqueta vazia", mau((b) => { b.months[0].label = ""; })],
    ["tipo de parcela inválido", mau((b) => { b.parcels[0].kind = "lixo"; })],
    ["movimento negativo", mau((b) => { b.transactions = [{ id: 1, monthId: b.months[0].id, date: "2026-01-02", type: "expense", value: -50, parcelId: null, targetParcelId: null, category: "", note: "" }]; })],
    ["movimento a zero", mau((b) => { b.transactions = [{ id: 1, monthId: b.months[0].id, date: "2026-01-02", type: "expense", value: 0, parcelId: null, targetParcelId: null, category: "", note: "" }]; })],
  ];
  for (const [nome, b] of casos) assert.equal((await call("POST", "/api/import", b)).status, 400, nome);
  assert.equal(state().months.length, antes);
  assert.equal((await call("POST", "/api/import", exp)).status, 200); // o backup legítimo continua a restaurar
});

test("movimentos em lote: mudar categoria/parcela e eliminar, tudo ou nada", async () => {
  const m = (await call("POST", "/api/months", { year: 2096, month: 2, label: "Lote", base: 1000 })).json;
  const fechado = (await call("POST", "/api/months", { year: 2096, month: 1, label: "Lote fechado", base: 1000 })).json;
  const p1 = (await call("POST", "/api/parcels", { name: "Lote A", defaultMode: "fixo", defaultValue: 0 })).json;
  const p2 = (await call("POST", "/api/parcels", { name: "Lote B", defaultMode: "fixo", defaultValue: 0 })).json;
  const nova = async (monthId: number, date: string, category: string) =>
    (await call("POST", "/api/transactions", { monthId, date, type: "expense", value: 5, parcelId: p1.id, category, note: "lote" })).json;
  const t1 = await nova(m.id, "2096-02-03", "Velha");
  const t2 = await nova(m.id, "2096-02-04", "Velha");
  const t3 = await nova(fechado.id, "2096-01-05", "Velha");
  const get = (id: number) => state().transactions.find((t) => t.id === id);

  const ok = await call("POST", "/api/transactions/bulk", { ids: [t1.id, t2.id], action: "update", patch: { category: "  Nova  ", parcelId: p2.id } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.count, 2);
  assert.equal(get(t1.id)?.category, "Nova");
  assert.equal(get(t2.id)?.parcelId, p2.id);

  assert.equal((await call("POST", "/api/months/" + fechado.id + "/close", { destination: "manter" })).status, 200);
  const falha = await call("POST", "/api/transactions/bulk", { ids: [t1.id, t3.id], action: "update", patch: { category: "Outra" } });
  assert.ok(falha.status >= 400, "mês fechado recusa");
  assert.equal(get(t1.id)?.category, "Nova", "nada mudou");
  assert.equal(get(t3.id)?.category, "Velha");

  assert.equal((await call("POST", "/api/transactions/bulk", { ids: [t1.id, 987654], action: "delete" })).status, 404);
  assert.ok(get(t1.id), "nada foi eliminado");
  for (const mau of [{ ids: [], action: "delete" }, { ids: [t1.id], action: "update" }, { ids: [t1.id], action: "update", patch: {} }, { ids: [t1.id], action: "x" }, { ids: ["a"], action: "delete" }])
    assert.equal((await call("POST", "/api/transactions/bulk", mau)).status, 400, JSON.stringify(mau));

  assert.equal((await call("POST", "/api/transactions/bulk", { ids: [t1.id, t2.id], action: "delete" })).status, 200);
  assert.equal(get(t1.id), undefined);
  assert.equal(get(t2.id), undefined);
});
