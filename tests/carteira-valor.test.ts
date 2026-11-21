// Valor atual das parcelas: ganho ou perda face ao que lá foi posto (cálculo puro e API).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { contributedUntil, parcelReturn } from "../shared/calc/portfolio";

const computed = [
  { month: { year: 2026, month: 1 }, byParcel: { 1: 100 } },
  { month: { year: 2026, month: 2 }, byParcel: { 1: 100 } },
  { month: { year: 2026, month: 3 }, byParcel: { 1: 100 } },
];

test("posto até um mês conta o saldo de partida e só as alocações até esse mês", () => {
  assert.equal(contributedUntil(50, computed, 1, "2026-02-15"), 250);
  assert.equal(contributedUntil(50, computed, 1, "2026-03-01"), 350);
  assert.equal(contributedUntil(0, computed, 1, "2025-12-31"), 0);
});

test("ganho e percentagem sobre o posto à data da avaliação mais recente", () => {
  const r = parcelReturn(0, computed, 1, [
    { id: 1, parcelId: 1, date: "2026-01-31", value: 90 },
    { id: 2, parcelId: 1, date: "2026-02-28", value: 230 },
    { id: 3, parcelId: 2, date: "2026-03-31", value: 999 },
  ]);
  assert.equal(r.latest?.id, 2);
  assert.equal(r.contributed, 200);
  assert.equal(r.gain, 30);
  assert.equal(r.gainPct, 0.15);
});

test("sem avaliação não há ganho; sem nada posto não há percentagem; perda é negativa", () => {
  const sem = parcelReturn(0, computed, 1, []);
  assert.equal(sem.latest, null);
  assert.equal(sem.gain, null);
  assert.equal(sem.contributed, 300);
  assert.equal(parcelReturn(0, computed, 9, [{ id: 1, parcelId: 9, date: "2026-03-01", value: 10 }]).gainPct, null);
  assert.equal(parcelReturn(0, computed, 1, [{ id: 1, parcelId: 1, date: "2026-03-31", value: 250 }]).gain, -50);
});

test("na mesma data conta o último registo", () => {
  const r = parcelReturn(0, computed, 1, [
    { id: 1, parcelId: 1, date: "2026-03-31", value: 100 },
    { id: 2, parcelId: 1, date: "2026-03-31", value: 400 },
  ]);
  assert.equal(r.latest?.value, 400);
});

// ---- API sobre base temporária
process.chdir(mkdtempSync(join(tmpdir(), "sm-val-")));
const express = (await import("express")).default;
const { registerRoutes } = await import("../server/routes");
const { storage } = await import("../server/storage");
const app = express();
(await import("../server/middleware")).installBase(app);
const server = createServer(app);
await registerRoutes(server, app);
await new Promise<void>((r) => server.listen(0, r));
test.after(() => server.close());
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const call = async (method: string, path: string, body?: unknown) => {
  const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", "x-sm-client": "1" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json };
};
const parcel = storage.createParcel({ name: "Teste ETF", kind: "investimento", color: "#123456", defaultMode: "fixo", defaultValue: 0 } as any);

test("registar e remover um valor; validações", async () => {
  const ok = await call("POST", "/api/valuations", { parcelId: parcel.id, date: "2026-03-31", value: 1234.5, note: " fim de março " });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.value, 1234.5);
  assert.equal(ok.json.note, "fim de março");
  assert.equal((await call("POST", "/api/valuations", { parcelId: 99999, date: "2026-03-31", value: 1 })).status, 404);
  assert.equal((await call("POST", "/api/valuations", { parcelId: parcel.id, date: "31/03/2026", value: 1 })).status, 400);
  assert.equal((await call("POST", "/api/valuations", { parcelId: parcel.id, date: "2026-03-31", value: -1 })).status, 400);
  assert.equal((await call("POST", "/api/valuations", { parcelId: parcel.id, date: "2026-03-31", value: 1, extra: true })).status, 400);
  assert.equal(storage.getState().valuations.length, 1);
  assert.equal((await call("DELETE", `/api/valuations/${ok.json.id}`)).status, 200);
  assert.equal(storage.getState().valuations.length, 0);
});

test("o backup leva os valores e o restauro repõe-nos; referências inválidas são recusadas", async () => {
  const v = await call("POST", "/api/valuations", { parcelId: parcel.id, date: "2026-04-30", value: 50 });
  const exp = JSON.parse((await (await fetch(base + "/api/export/json", { headers: { "x-sm-client": "1" } })).text()));
  assert.equal(exp.valuations.length, 1);
  await call("DELETE", `/api/valuations/${v.json.id}`);
  assert.equal(storage.getState().valuations.length, 0);
  const prev = await call("POST", "/api/import/preview", exp);
  assert.equal(prev.json.resumo.valoresCarteira, 1);
  assert.equal((await call("POST", "/api/import", exp)).status, 200);
  assert.equal(storage.getState().valuations.length, 1);
  const bad = { ...exp, valuations: [{ ...exp.valuations[0], parcelId: 424242 }] };
  assert.equal((await call("POST", "/api/import", bad)).status, 400);
  // backups antigos, sem a coleção, continuam a importar
  const { valuations: _omit, ...velho } = exp;
  assert.equal((await call("POST", "/api/import", { ...velho, schemaVersion: 3, version: 3 })).status, 200);
  assert.equal(storage.getState().valuations.length, 0);
});

test("eliminar a parcela elimina os seus valores", async () => {
  const p = storage.createParcel({ name: "Teste temporária", kind: "poupanca", color: "#654321", defaultMode: "fixo", defaultValue: 0 } as any);
  await call("POST", "/api/valuations", { parcelId: p.id, date: "2026-05-01", value: 10 });
  assert.equal(storage.getState().valuations.filter((x) => x.parcelId === p.id).length, 1);
  assert.equal((await call("DELETE", `/api/parcels/${p.id}`)).status, 200);
  assert.equal(storage.getState().valuations.filter((x) => x.parcelId === p.id).length, 0);
});
