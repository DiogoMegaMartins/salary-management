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
