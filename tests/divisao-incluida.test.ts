import { test } from "node:test";
import assert from "node:assert/strict";
import { allocationAmount } from "../shared/calc";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";


test("parcela fora do mês conta 0, em € fixo e em %", () => {
  assert.equal(allocationAmount({ mode: "fixo", value: 300, included: 0 } as any, 1000), 0);
  assert.equal(allocationAmount({ mode: "percentagem", value: 20, included: 0 } as any, 1000), 0);
});

test("parcela dentro do mês (ou sem o campo, de dados antigos) conta o valor", () => {
  assert.equal(allocationAmount({ mode: "fixo", value: 300, included: 1 } as any, 1000), 300);
  assert.equal(allocationAmount({ mode: "percentagem", value: 20 } as any, 1000), 200);
});

// ---- API sobre base temporária isolada
const dir = mkdtempSync(join(tmpdir(), "sm-test-incl-"));
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
const p1 = storage.createParcel({ name: "Teste A", kind: "gastos", color: "#111", defaultMode: "fixo", defaultValue: 0 } as any);
const m = storage.createMonth({ year: 2026, month: 12, label: "Dez", base: 1000, taxaSs: 0, taxaIrsBase: 0 } as any);

test("API: tirar uma parcela do mês guarda o valor e põe included=0; voltar a pôr repõe", async () => {
  assert.equal((await call("PUT", "/api/allocations", { monthId: m.id, parcelId: p1.id, mode: "fixo", value: 250 })).json.included, 1);
  const off = await call("PUT", "/api/allocations", { monthId: m.id, parcelId: p1.id, mode: "fixo", value: 250, included: false });
  assert.equal(off.json.included, 0);
  assert.equal(off.json.value, 250); // o valor não se perde
  const on = await call("PUT", "/api/allocations", { monthId: m.id, parcelId: p1.id, mode: "fixo", value: 250, included: true });
  assert.equal(on.json.included, 1);
});

test("API: gravar o valor sem indicar included não muda se a parcela está fora", async () => {
  await call("PUT", "/api/allocations", { monthId: m.id, parcelId: p1.id, mode: "fixo", value: 250, included: false });
  const r = await call("PUT", "/api/allocations", { monthId: m.id, parcelId: p1.id, mode: "fixo", value: 300 });
  assert.equal(r.json.included, 0);
  assert.equal(r.json.value, 300);
});
