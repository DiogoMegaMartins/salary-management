// Correções da auditoria: guarda de mês fechado pela data, eliminar parcela, categorias, projeção anual,
// divisão em cêntimos, categorias na comparação com ano fixo e datas locais.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { budgetVsRealByCategory, computeEssentialExpensesByMonth, projectYearEnd, suggestSurplusDistribution, yearOverYear, categoryYearOverYear } from "../shared/calc";
import { dateInMonth, localToday } from "../client/src/lib/utils";

const dir = mkdtempSync(join(tmpdir(), "sm-testcf-"));
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
const mk = (year: number, month: number) => storage.createMonth({ year, month, label: `${month}/${year}`, base: 1000, taxaSs: 0, taxaIrsBase: 0 } as any);

test("uma data num mês fechado não desloca o movimento para esse mês (423)", async () => {
  const p = storage.createParcel({ name: "Gastos CF", kind: "gastos", color: "#111", defaultMode: "fixo", defaultValue: 0 } as any);
  const out = mk(2031, 10), nov = mk(2031, 11);
  assert.equal((await call("POST", `/api/months/${out.id}/close`, { destination: "manter" })).status, 200);
  const novo = await call("POST", "/api/transactions", { monthId: nov.id, date: "2031-10-20", type: "expense", value: 250, parcelId: p.id });
  assert.equal(novo.status, 423);
  const ok = await call("POST", "/api/transactions", { monthId: nov.id, date: "2031-11-20", type: "expense", value: 10, parcelId: p.id });
  assert.ok(ok.status === 200 || ok.status === 201);
  const edit = await call("PATCH", `/api/transactions/${ok.json.id}`, { date: "2031-10-21" });
  assert.equal(edit.status, 423);
  assert.equal(storage.getState().transactions.filter((t) => t.monthId === out.id).length, 0);
});

test("eliminar parcela com alocação em mês fechado é recusado (409)", async () => {
  const p = storage.createParcel({ name: "Temp CF", kind: "gastos", color: "#222", defaultMode: "fixo", defaultValue: 0 } as any);
  const m = mk(2032, 1);
  storage.setAllocation(m.id, p.id, "fixo", 300);
  assert.equal((await call("POST", `/api/months/${m.id}/close`, { destination: "manter" })).status, 200);
  assert.equal((await call("DELETE", `/api/parcels/${p.id}`)).status, 409);
  assert.ok(storage.getState().parcels.some((x) => x.id === p.id));
});

const cat = (name: string, extra: any = {}) => ({ id: 1, name, active: true, monthlyBudget: 300, essential: true, ...extra }) as any;
const exp = (category: string, value: number, monthId = 1) => ({ id: Math.random(), type: "expense", category, value, monthId }) as any;

test("categorias comparam-se sem maiúsculas nem espaços nas pontas", () => {
  const rows = budgetVsRealByCategory([exp("supermercado", 100), exp(" Supermercado ", 50)], [cat("Supermercado")]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].real, 150);
  const ess = computeEssentialExpensesByMonth([exp("SUPERMERCADO", 80)], [cat("Supermercado")]);
  assert.equal(ess[1], 80);
});

test("projeção anual conta meses do calendário, não linhas de mês", () => {
  const ms = [3, 4, 5, 6, 7, 8, 9, 10, 11].map((month) => ({ id: month, year: 2026, month, sortOrder: month }) as any);
  const saved = Object.fromEntries(ms.map((m) => [m.id, 100]));
  const p = projectYearEnd(ms, saved, 11, 2026, 1200);
  assert.equal(p.mesesRestantes, 1); // só falta Dezembro
  assert.equal(p.projecaoAnual, 800 + 100 * 1);
  // sem mês corrente: depois do último mês registado
  assert.equal(projectYearEnd(ms, saved, null, 2026, 1200).mesesRestantes, 1);
});

test("a sugestão de excedente divide em cêntimos e fecha a zero", () => {
  const parcels = [1, 2, 3].map((id) => ({ id, name: `P${id}`, archived: false, kind: "poupanca" }) as any);
  const items = suggestSurplusDistribution(100, parcels, [], {}, 10);
  const total = items.reduce((a, i) => a + i.amount, 0);
  assert.equal(Math.round(total * 100), 10000);
  assert.deepEqual(items.map((i) => i.amount), [33.34, 33.33, 33.33]);
});

test("comparação com ano fixo: categorias e totais somam os mesmos meses de cada lado", () => {
  const m = (id: number, year: number) => ({ id, year, month: 1 }) as any;
  const c = (net: number) => ({ net, gross: net, descontos: 0, available: net, byKind: { gastos: 0, poupanca: 0, investimento: 0 }, byParcel: {} }) as any;
  const all = [m(1, 2024), m(2, 2025), m(3, 2026)];
  const allC = [c(1000), c(1100), c(1200)];
  const yoy = yearOverYear([all[1], all[2]], [allC[1], allC[2]], all, allC, 2024)!;
  assert.equal(yoy.current.net, 2300);
  assert.equal(yoy.previous.net, 2000); // janeiro de 2024 conta uma vez por par
  const txs = [
    { id: 1, type: "expense", category: "A", value: 10, monthId: 1 },
    { id: 2, type: "expense", category: "A", value: 20, monthId: 2 },
    { id: 3, type: "expense", category: "A", value: 30, monthId: 3 },
  ] as any;
  const [row] = categoryYearOverYear(txs, yoy);
  assert.equal(row.current, 50);
  assert.equal(row.previous, 20); // 10 € de janeiro de 2024, uma vez por par
});

test("datas locais: dentro do mês indicado e sem passar por UTC", () => {
  const dia3dez = new Date(2026, 11, 3, 0, 30); // 00:30 locais
  assert.equal(localToday(dia3dez), "2026-12-03");
  assert.equal(dateInMonth(2026, 11, dia3dez), "2026-11-30");
  assert.equal(dateInMonth(2026, 12, dia3dez), "2026-12-03");
  assert.equal(dateInMonth(2028, 2, dia3dez), "2028-02-29");
});

test("sem saldo inicial, atribuir um aporte a uma submeta não aumenta o total da meta", async () => {
  const { goalBreakdown } = await import("../shared/calc");
  const base = { monthly: [{ key: 2026 * 12, amount: 500 }], entries: [], subgoals: [{ id: 1, parcelId: 1, name: "S", currency: "EUR", target: null }], rates: [], refCurrency: "EUR" } as any;
  const tx = [{ id: 1, parcelId: 1, type: "contribution", date: "2026-01-10", value: 300 }];
  const sem = goalBreakdown({ ...base, links: [], transactions: tx }, 1);
  const com = goalBreakdown({ ...base, links: [{ transactionId: 1, subgoalId: 1, amount: 300 }], transactions: tx }, 1);
  assert.equal(sem.total, 500);
  assert.equal(com.total, 500);
  assert.equal(com.unallocated, 200);
});

test("a distribuição por plataformas acima do total da parcela é um erro de consistência", async () => {
  const { checkConsistency } = await import("../shared/evo08");
  const d = {
    months: [{ id: 1, year: 2026, month: 1 }], parcels: [{ id: 1, name: "P" }], platforms: [{ id: 1 }, { id: 2 }], subgoals: [], goalEntries: [], transactions: [], allocationAssets: [],
    allocations: [{ id: 1, monthId: 1, parcelId: 1, mode: "fixo", value: 150 }],
    allocationPlatforms: [{ id: 1, allocationId: 1, platformId: 1, mode: "fixo", value: 100 }, { id: 2, allocationId: 1, platformId: 2, mode: "fixo", value: 100 }],
    availableByMonth: { 1: 1000 },
  } as any;
  assert.ok(checkConsistency(d).some((i) => i.code === "dist_plataformas"));
  d.allocationPlatforms[1].value = 50;
  assert.ok(!checkConsistency(d).some((i) => i.code === "dist_plataformas"));
});

test("editar um aporte não pode deixá-lo abaixo do que está atribuído a submetas (409)", async () => {
  const p = storage.createParcel({ name: "Meta CF", kind: "poupanca", color: "#333", defaultMode: "fixo", defaultValue: 0, currency: "EUR" } as any);
  const m = mk(2033, 3);
  const sg = storage.createSubgoal({ parcelId: p.id, name: "Sub", currency: "EUR" } as any);
  const t = storage.createTransaction({ monthId: m.id, date: "2033-03-05", type: "contribution", value: 300, parcelId: p.id } as any);
  storage.createContributionLink({ transactionId: t.id, subgoalId: sg.id, amount: 200 });
  assert.equal((await call("PATCH", `/api/transactions/${t.id}`, { value: 100 })).status, 409);
  assert.equal((await call("PATCH", `/api/transactions/${t.id}`, { type: "expense" })).status, 409);
  assert.equal((await call("PATCH", `/api/transactions/${t.id}`, { value: 250 })).status, 200);
});

test("aplicar regras é tudo ou nada", async () => {
  const pa = storage.createParcel({ name: "A CF", kind: "gastos", color: "#444", defaultMode: "fixo", defaultValue: 100 } as any);
  const pb = storage.createParcel({ name: "B CF", kind: "gastos", color: "#555", defaultMode: "fixo", defaultValue: 50 } as any);
  const m = mk(2034, 4);
  const plat = storage.createPlatform({ name: "Plat CF" });
  storage.setAllocation(m.id, pa.id, "fixo", 10); // a regra de A (100 €) mudaria este valor
  storage.setAllocation(m.id, pb.id, "fixo", 300);
  storage.setDistribution(m.id, pb.id, [{ platformId: plat.id, mode: "fixo", value: 300 }] as any);
  const r = await call("POST", `/api/months/${m.id}/apply-rules`); // a regra de B (50 €) ficaria abaixo da distribuição de 300 €
  assert.equal(r.status, 409);
  const aloc = storage.getState().allocations.filter((a) => a.monthId === m.id);
  assert.equal(aloc.find((a) => a.parcelId === pa.id)?.value, 10, "A não pode ter ficado alterada");
  assert.equal(aloc.find((a) => a.parcelId === pb.id)?.value, 300);
});

test("meses repetidos: a data escolhe o mês aberto e as recorrências vão para um mês aberto", async () => {
  const p = storage.createParcel({ name: "Rep CF", kind: "gastos", color: "#666", defaultMode: "fixo", defaultValue: 0 } as any);
  const fechado = mk(2035, 12), aberto = storage.createMonth({ year: 2035, month: 12, label: "Dezembro (subsídio)", base: 500, taxaSs: 0, taxaIrsBase: 0 } as any);
  assert.equal((await call("POST", `/api/months/${fechado.id}/close`, { destination: "manter" })).status, 200);
  const outro = mk(2035, 11);
  const t = await call("POST", "/api/transactions", { monthId: outro.id, date: "2035-12-10", type: "expense", value: 5, parcelId: p.id });
  assert.ok(t.status === 200 || t.status === 201, JSON.stringify(t.json));
  assert.equal(t.json.monthId, aberto.id);
});
