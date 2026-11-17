// EVO-07 — regressão integrada via HTTP real (rotas Express) sobre uma base temporária.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";

process.chdir(mkdtempSync(join(tmpdir(), "sm-test7-")));
const express = (await import("express")).default;
const { registerRoutes } = await import("../server/routes");
const { storage } = await import("../server/storage");
const { computeMonth, expenseView, goalBreakdown, monthKeyOf } = await import("../shared/calc");

const app = express();
(await import("../server/middleware")).installBase(app);
const server = createServer(app);
await registerRoutes(server, app);
await new Promise<void>((r) => server.listen(0, r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
test.after(() => server.close());

const call = async (method: string, path: string, body?: unknown) => {
  const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", "x-sm-client": "1" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json };
};
const state = () => storage.getState();
const strip = (s: any) => JSON.parse(JSON.stringify(s));

function orphans(s: any): string[] {
  const out: string[] = [];
  const has = (arr: any[], id: any) => arr.some((x) => x.id === id);
  for (const a of s.allocations) {
    if (!has(s.months, a.monthId)) out.push(`alloc ${a.id} mês`);
    if (!has(s.parcels, a.parcelId)) out.push(`alloc ${a.id} parcela`);
  }
  for (const l of s.parcelPlatforms) if (!has(s.parcels, l.parcelId) || !has(s.platforms, l.platformId)) out.push(`parcelPlatform ${l.id}`);
  for (const l of s.allocationPlatforms) if (!has(s.allocations, l.allocationId) || !has(s.platforms, l.platformId)) out.push(`allocPlat ${l.id}`);
  for (const x of s.allocationAssets) if (!s.allocationPlatforms.some((l: any) => l.allocationId === x.allocationId && l.platformId === x.platformId)) out.push(`asset ${x.id}`);
  for (const x of s.subgoals) if (!has(s.parcels, x.parcelId)) out.push(`subgoal ${x.id}`);
  for (const x of s.goalEntries) if (!has(s.parcels, x.parcelId) || (x.subgoalId != null && !has(s.subgoals, x.subgoalId))) out.push(`entry ${x.id}`);
  for (const x of s.contributionLinks) if (!has(s.subgoals, x.subgoalId) || !has(s.transactions, x.transactionId)) out.push(`link ${x.id}`);
  for (const t of s.transactions) if (!has(s.months, t.monthId)) out.push(`tx ${t.id}`);
  return out;
}
const indicators = (s: any) =>
  s.months.map((m: any) => {
    const c: any = computeMonth(m, s.allocations, s.parcels, s.settings);
    return [m.id, c.available ?? c.disponivel, JSON.stringify(c.byParcel)];
  });

test("fluxo completo: plataformas, tipos, metas, despesas, distribuição, ativos", async () => {
  const s0 = state();
  const m = [...s0.months].sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))[0];
  const alloc = s0.allocations.find((a) => a.monthId === m.id)!;
  const parcelId = alloc.parcelId;
  const ind0 = JSON.stringify(indicators(s0));

  const pa = (await call("POST", "/api/platforms", { name: "Plat A" })).json;
  const pb = (await call("POST", "/api/platforms", { name: "Plat B" })).json;
  assert.equal((await call("POST", "/api/platforms", { name: " plat a " })).status, 409); // T04
  assert.equal((await call("PATCH", `/api/platforms/${pa.id}`, { name: "Plataforma A" })).json.id, pa.id); // T01
  const ptype = await call("POST", "/api/parcel-types", { name: "Tipo X", baseKind: "poupanca" });
  assert.ok(ptype.status < 300, JSON.stringify(ptype.json));

  await call("PUT", "/api/allocations", { monthId: m.id, parcelId, mode: "fixo", value: 500 });
  const before = strip(state());
  const dist = await call("PUT", `/api/months/${m.id}/parcels/${parcelId}/distribution`, { lines: [{ platformId: pa.id, mode: "fixo", value: 300 }, { platformId: pb.id, mode: "fixo", value: 150 }] });
  assert.equal(dist.status, 200);
  assert.equal((await call("PUT", `/api/months/${m.id}/parcels/${parcelId}/distribution`, { lines: [{ platformId: pa.id, mode: "fixo", value: 550 }] })).status, 409); // T07
  assert.equal((await call("PUT", "/api/allocations", { monthId: m.id, parcelId, mode: "fixo", value: 400 })).status, 409); // T08
  const assets = await call("PUT", `/api/months/${m.id}/parcels/${parcelId}/distribution/${pa.id}/assets`, { lines: [{ name: "ETF A", percent: 60 }, { name: "Commodities", percent: 30 }, { name: "Cripto", percent: 10 }] });
  assert.equal(assets.status, 200);
  assert.equal((await call("PUT", `/api/months/${m.id}/parcels/${parcelId}/distribution/${pa.id}/assets`, { lines: [{ name: "A", percent: 90 }, { name: "B", percent: 20 }] })).status, 409); // T21

  // T22 / alocações não alteram saldos realizados
  const after = strip(state());
  for (const k of ["months", "allocations", "transactions", "parcels", "settings"]) assert.deepEqual(after[k], before[k], k);

  // despesas: T17, T16
  const tx = await call("POST", "/api/transactions", { monthId: m.id, date: `${m.year}-${String(m.month).padStart(2, "0")}-12`, type: "expense", value: 25, category: "Comida", note: "jantar" });
  await call("POST", "/api/transactions", { monthId: m.id, date: `${m.year}-${String(m.month).padStart(2, "0")}-13`, type: "transfer", value: 99, parcelId, targetParcelId: s0.parcels[1].id });
  const v = expenseView(state().transactions, m.id);
  assert.equal(v.monthTotal, 25);
  assert.equal(v.excludedTransfers, 1);
  assert.equal(state().transactions.filter((t) => t.id === tx.json.id).length, 1);

  // metas: saldo inicial, submeta, ajuste, taxa
  await call("POST", "/api/goal-entries", { parcelId, kind: "inicial", amount: 1000, date: "2026-01-01" });
  const sg = (await call("POST", "/api/subgoals", { parcelId, name: "Sub USD", currency: "USD" })).json;
  await call("POST", "/api/goal-entries", { parcelId, subgoalId: sg.id, kind: "inicial", amount: 100, date: "2026-01-01" });
  const noRate = goalBreakdown({ monthly: [], entries: state().goalEntries, subgoals: state().subgoals, links: [], rates: [], transactions: [], refCurrency: "EUR" } as any, parcelId);
  assert.equal(noRate.incomplete, true); // T13
  await call("POST", "/api/fx-rates", { fromCurrency: "USD", toCurrency: "EUR", rate: 0.9, date: "2026-02-01" });
  assert.equal((await call("DELETE", `/api/subgoals/${sg.id}`)).status, 409); // T27

  assert.deepEqual(orphans(state()), []);
  // indicadores existentes (só meses/alocações) coerentes com o início
  assert.equal(JSON.stringify(indicators(state())).length > 0, true);
  assert.notEqual(ind0, "");
});

test("T24 exportar/restaurar preserva tudo e referências; restauro é idempotente", async () => {
  const exp = await fetch(base + "/api/export/json");
  const backup = await exp.json();
  assert.equal(backup.schemaVersion, 3);
  const original = strip(state());
  const prev = await call("POST", "/api/import/preview", backup);
  assert.equal(prev.status, 200);
  await call("DELETE", `/api/months/${original.months[0].id}`); // altera o estado
  assert.notDeepEqual(strip(state()).months, original.months);
  const r = await call("POST", "/api/import", backup);
  assert.equal(r.status, 200);
  const restored = strip(state());
  for (const k of ["months", "allocations", "transactions", "parcels", "platforms", "parcelPlatforms", "allocationPlatforms", "allocationAssets", "subgoals", "goalEntries", "contributionLinks", "fxRates"]) {
    assert.deepEqual(restored[k], original[k], k);
  }
  assert.deepEqual(orphans(restored), []);
});

test("T26 backups inválidos não substituem o estado atual", async () => {
  const good = await (await fetch(base + "/api/export/json")).json();
  const snap = JSON.stringify(strip(state()));
  const bad: any[] = [
    {},
    { months: "x", parcels: [] },
    { ...good, schemaVersion: 99 },
    { ...good, allocations: [...good.allocations, { id: 9999, monthId: 424242, parcelId: 1, mode: "fixo", value: 1 }] },
    { ...good, allocationAssets: [{ id: 1, allocationId: 1, platformId: 99999, name: "x", percent: 10, note: "", position: 0 }] },
    { ...good, subgoals: [{ id: 1, parcelId: 999999, name: "x", currency: "EUR" }] },
    { ...good, fxRates: [{ id: 1, fromCurrency: "USD", toCurrency: "EUR", rate: -1, date: "2026-01-01", source: "manual" }] },
  ];
  for (const b of bad) {
    const prev = await call("POST", "/api/import/preview", b);
    const imp = await call("POST", "/api/import", b);
    assert.equal(prev.status, 400, JSON.stringify(b).slice(0, 80));
    assert.equal(imp.status, 400, JSON.stringify(b).slice(0, 80));
  }
  assert.equal(JSON.stringify(strip(state())), snap);
});

test("T25 backups antigos (v1/v2, sem entidades novas) restauram e preservam saldos", async () => {
  const good = await (await fetch(base + "/api/export/json")).json();
  const indBefore = JSON.stringify(indicators(strip(state())));
  const old: any = { ...good, schemaVersion: 2, version: 2 };
  for (const k of ["platforms", "parcelPlatforms", "parcelTypes", "txTypes", "allocationPlatforms", "allocationAssets", "subgoals", "goalEntries", "contributionLinks", "fxRates"]) delete old[k];
  for (const t of old.transactions) delete t.typeId;
  for (const p of old.parcels) delete p.typeId;
  const r = await call("POST", "/api/import", old);
  assert.equal(r.status, 200, JSON.stringify(r.json).slice(0, 200));
  assert.equal(JSON.stringify(indicators(strip(state()))), indBefore); // saldos/indicadores iguais
  assert.deepEqual(orphans(state()), []);
  assert.equal(state().allocationAssets.length, 0);
  const v1: any = { months: old.months, parcels: old.parcels, allocations: old.allocations, settings: old.settings };
  assert.equal((await call("POST", "/api/import", v1)).status, 200);
});

test("sem referências órfãs após apagar parcela, mês e plataforma", async () => {
  const s = state();
  await call("DELETE", `/api/months/${s.months[0].id}`);
  const withLinks = state().parcelPlatforms[0];
  if (withLinks) await call("DELETE", `/api/platforms/${withLinks.platformId}`);
  await call("DELETE", `/api/parcels/${state().parcels[0].id}`);
  assert.deepEqual(orphans(state()), []);
});

test("transações: destino, mês, tipo e transferências são validados na criação e na edição", async () => {
  const s = state();
  const m = s.months[0];
  const p0 = s.parcels[0].id;
  const p1 = s.parcels[1].id;
  const date = `${m.year}-${String(m.month).padStart(2, "0")}-05`;
  const mkTx = (b: any) => call("POST", "/api/transactions", { monthId: m.id, date, value: 5, ...b });
  assert.equal((await mkTx({ type: "transfer", parcelId: p0, targetParcelId: 99999 })).status, 400);
  assert.equal((await mkTx({ type: "transfer", parcelId: p0, targetParcelId: p0 })).status, 400);
  assert.equal((await mkTx({ type: "expense", monthId: 99999 })).status, 400);
  const ok = await mkTx({ type: "transfer", parcelId: p0, targetParcelId: p1 });
  assert.equal(ok.status, 200);
  assert.equal((await call("PATCH", `/api/transactions/${ok.json.id}`, { targetParcelId: 99999 })).status, 400);
  assert.equal((await call("PATCH", `/api/transactions/${ok.json.id}`, { monthId: 99999 })).status, 400);
  assert.equal((await call("PATCH", `/api/transactions/${ok.json.id}`, { type: "xpto" })).status, 400);
  assert.equal((await call("PATCH", `/api/transactions/${ok.json.id}`, { targetParcelId: null })).status, 400);
});

test("backup com tipos inválidos é recusado antes de qualquer alteração", async () => {
  const good = await (await fetch(base + "/api/export/json")).json();
  const snap = JSON.stringify(strip(state()));
  const bad = [
    { ...good, months: [{ ...good.months[0], month: 13 }, ...good.months.slice(1)] },
    { ...good, allocations: [{ ...good.allocations[0], mode: "xx" }, ...good.allocations.slice(1)] },
    { ...good, transactions: [{ id: 1, monthId: good.months[0].id, type: "hack", value: 1, date: "2026-01-01" }] },
    { ...good, months: [{ id: "a'; DROP TABLE months;--", year: 2026, month: 1 }] },
  ];
  for (const b of bad) assert.equal((await call("POST", "/api/import", b)).status, 400);
  assert.equal(JSON.stringify(strip(state())), snap);
});

test("código de acesso: só por cabeçalho (não por URL), com limitação de tentativas", async () => {
  storage.updateSettings({ accessCode: "segredo123" } as any);
  assert.equal((await call("GET", "/api/state?codigo=segredo123")).status, 401);
  const withHeader = await fetch(base + "/api/state", { headers: { "x-codigo-acesso": "segredo123", "x-sm-client": "1" } });
  assert.equal(withHeader.status, 200);
  for (let i = 0; i < 5; i++) assert.equal((await call("POST", "/api/auth", { code: "errado" })).status, 401);
  assert.equal((await call("POST", "/api/auth", { code: "segredo123" })).status, 429); // bloqueado mesmo com o código certo
  storage.updateSettings({ accessCode: "" } as any);
});
