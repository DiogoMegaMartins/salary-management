import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
process.chdir(mkdtempSync(join(tmpdir(), "sm-offline-")));
const express = (await import("express")).default;
const { storage } = await import("../server/storage");
const { registerRoutes } = await import("../server/routes");
const app = express(); (await import("../server/middleware")).installBase(app);
const server = createServer(app); await registerRoutes(server, app);
await new Promise<void>(r => server.listen(0, r));
test.after(() => server.close());
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const request = async (method: string, path: string, body?: any) => {
  const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", "x-sm-client": "1" }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json(), version: r.headers.get("X-State-Version") };
};
const month = storage.createMonth({ year: 2030, month: 1, label: "Offline teste", base: 1000 } as any);
test("open month updates editable salary; protected fields remain blocked", async () => {
  assert.equal((await request("PATCH", `/api/months/${month.id}`, { base: 1100 })).status, 200);
  assert.equal((await request("PATCH", `/api/months/${month.id}`, { status: "aberto" })).status, 400);
});
test("sync is atomic, idempotent, and detects concurrent changes", async () => {
  const initial = await request("GET", "/api/state");
  const operation = { method: "POST", url: "/api/transactions", data: { monthId: month.id, date: "2030-01-02", type: "expense", value: 5, note: "Offline", parcelId: null }, localId: -1 };
  const batch = { id: "test-batch", version: initial.version, operations: [operation] };
  const before = storage.getState().transactions.length;
  assert.equal((await request("POST", "/api/offline/sync", batch)).status, 200);
  assert.equal((await request("POST", "/api/offline/sync", batch)).json.replay, true);
  assert.equal(storage.getState().transactions.length, before + 1);
  assert.equal((await request("POST", "/api/offline/sync", { ...batch, id: "stale" })).status, 409);
  assert.equal(storage.getState().transactions.length, before + 1);
  const current = await request("GET", "/api/state");
  const bad = { id: "rollback", version: current.version, operations: [operation, { ...operation, url: "/api/settings" }] };
  assert.equal((await request("POST", "/api/offline/sync", bad)).status, 400);
  assert.equal(storage.getState().transactions.length, before + 1);
});
