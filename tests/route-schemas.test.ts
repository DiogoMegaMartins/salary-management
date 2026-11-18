// Esquemas das rotas de catálogos, metas, recorrências e reservas: forma do pedido recusada com 400,
// pedidos válidos continuam a funcionar. Base temporária isolada (nunca toca em data.db).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";

const dir = mkdtempSync(join(tmpdir(), "sm-testschemas-"));
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

const meta = storage.createParcel({ name: "Meta teste", kind: "poupanca", color: "#222", defaultMode: "fixo", defaultValue: 0 } as any);

test("catálogos: campos desconhecidos e tipos errados são recusados", async () => {
  assert.equal((await call("POST", "/api/platforms", { name: "Banco A", id: 99 })).status, 400);
  assert.equal((await call("POST", "/api/platforms", { name: 123 })).status, 400);
  assert.match((await call("POST", "/api/parcel-types", { name: "Tipo A", baseKind: "outro" })).json.message, /Comportamento base inválido\./);
  assert.match((await call("POST", "/api/tx-types", { name: "Tipo B", nature: "outro" })).json.message, /Natureza inválida\./);
  assert.equal((await call("POST", "/api/tx-types", { name: "Tipo B", nature: "despesa", extra: 1 })).status, 400);
});

test("catálogos: pedidos válidos continuam a funcionar", async () => {
  const p = await call("POST", "/api/platforms", { name: "Banco A" });
  assert.equal(p.status, 200);
  assert.equal((await call("PATCH", `/api/platforms/${p.json.id}`, { archived: 1 })).json.archived, 1);
  assert.equal((await call("PATCH", `/api/platforms/${p.json.id}`, { archived: true })).json.archived, 1);
  assert.equal((await call("PATCH", `/api/platforms/${p.json.id}`, { id: 5 })).status, 400);
  assert.equal((await call("POST", "/api/platforms", { name: "banco a" })).status, 409); // regra de domínio mantida
  assert.equal((await call("POST", "/api/platforms", { name: "   " })).json.message, "O nome da plataforma é obrigatório.");
  const t = await call("POST", "/api/parcel-types", { name: "Tipo A", baseKind: "poupanca" });
  assert.equal(t.status, 200);
  assert.equal((await call("DELETE", `/api/parcel-types/${t.json.id}`)).status, 200);
});

test("identificadores de rota inválidos dão 400", async () => {
  for (const [m, p] of [["DELETE", "/api/platforms/abc"], ["PATCH", "/api/subgoals/0"], ["DELETE", "/api/goal-entries/-3"], ["DELETE", "/api/fx-rates/1.5"], ["POST", "/api/reserves/x/pay"], ["POST", "/api/months/abc/close"]] as const) {
    assert.equal((await call(m, p, m === "DELETE" ? undefined : {})).status, 400, `${m} ${p}`);
  }
});

test("saldos e ajustes: tipos e campos recusados; meios-cêntimos continuam a arredondar no armazenamento", async () => {
  const ok = { parcelId: meta.id, kind: "ajuste", amount: 10, date: "2026-02-03", note: "n" };
  assert.equal((await call("POST", "/api/goal-entries", { ...ok, amount: "10" })).status, 400);
  assert.equal((await call("POST", "/api/goal-entries", { ...ok, extra: 1 })).status, 400);
  assert.match((await call("POST", "/api/goal-entries", { ...ok, kind: "outro" })).json.message, /Tipo inválido\./);
  assert.equal((await call("POST", "/api/goal-entries", { ...ok, date: "03/02/2026" })).json.message, "Data inválida (AAAA-MM-DD).");
  const e = await call("POST", "/api/goal-entries", { ...ok, amount: -12.345 });
  assert.equal(e.status, 200);
  assert.equal(e.json.amount, -12.35);
  assert.equal((await call("PATCH", `/api/goal-entries/${e.json.id}`, { kind: "inicial" })).status, 400);
});

test("submetas, atribuições e taxas: forma validada, regras de domínio mantidas", async () => {
  assert.equal((await call("POST", "/api/subgoals", { parcelId: meta.id, name: "S", target: "100" })).status, 400);
  assert.equal((await call("POST", "/api/subgoals", { parcelId: meta.id, name: "S", target: -5 })).status, 400);
  assert.equal((await call("POST", "/api/subgoals", { parcelId: meta.id, name: "S", sortOrder: 1 })).status, 400);
  const s = await call("POST", "/api/subgoals", { parcelId: meta.id, name: "Fundo", platformId: null, currency: "EUR", target: null, deadline: "2027-12" });
  assert.equal(s.status, 200);
  assert.equal((await call("POST", "/api/subgoals", { parcelId: meta.id, name: "fundo" })).status, 409);
  assert.equal((await call("PATCH", `/api/subgoals/${s.json.id}`, { parcelId: 9 })).status, 400);
  assert.equal((await call("POST", "/api/contribution-links", { transactionId: 1, subgoalId: s.json.id, amount: "5" })).status, 400);
  assert.equal((await call("POST", "/api/contribution-links", { transactionId: 999, subgoalId: s.json.id, amount: 5 })).status, 404);
  assert.equal((await call("POST", "/api/fx-rates", { fromCurrency: "USD", toCurrency: "EUR", rate: "0.9", date: "2026-01-01" })).status, 400);
  assert.equal((await call("POST", "/api/fx-rates", { fromCurrency: "USD", toCurrency: "EUR", rate: 0.9, date: "2026-01-01", source: "x" })).status, 400);
  assert.equal((await call("POST", "/api/fx-rates", { fromCurrency: "USD", toCurrency: "USD", rate: 1, date: "2026-01-01" })).json.message, "Moedas inválidas.");
  assert.equal((await call("POST", "/api/fx-rates", { fromCurrency: "USD", toCurrency: "EUR", rate: 0.9, date: "2026-01-01" })).status, 200);
});

test("recorrências, reservas e fecho: campos desconhecidos e tipos recusados", async () => {
  const rec = { name: "Renda", value: 100, startMonth: "2027-02" };
  assert.equal((await call("POST", "/api/recurring", { ...rec, value: "100" })).status, 400);
  assert.equal((await call("POST", "/api/recurring", { ...rec, extra: true })).status, 400);
  assert.equal((await call("POST", "/api/recurring", { ...rec, active: "sim" })).status, 400);
  assert.equal((await call("POST", "/api/recurring", { ...rec, dayOfMonth: 40 })).status, 400);
  assert.equal((await call("POST", "/api/recurring", rec)).status, 200);
  assert.equal((await call("POST", "/api/recurring/confirm", { key: 5 })).status, 400);
  assert.equal((await call("POST", "/api/recurring/confirm", { key: "x", extra: 1 })).status, 400);
  const res = { name: "Seguro", target: 200, dueMonth: "2027-06" };
  assert.equal((await call("POST", "/api/reserves", { ...res, target: "200" })).status, 400);
  assert.equal((await call("POST", "/api/reserves", { ...res, status: "paga" })).status, 400);
  assert.equal((await call("POST", "/api/reserves", res)).status, 200);
  assert.equal((await call("POST", "/api/months/1/close", { destination: "outro" })).status, 400);
  assert.equal((await call("POST", "/api/months/1/reopen", { note: 5 })).status, 400);
});
