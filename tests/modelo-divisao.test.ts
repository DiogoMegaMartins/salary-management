// Divisão-modelo por parcela: guardar, aplicar e meses novos (base temporária isolada).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";

const dir = mkdtempSync(join(tmpdir(), "sm-test-modelo-"));
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
const st = () => storage.getState();

const poup = storage.createParcel({ name: "Poupança", kind: "poupanca", color: "#222", defaultMode: "fixo", defaultValue: 0 } as any);
const ferias = storage.createParcel({ name: "Férias", kind: "poupanca", color: "#333", defaultMode: "fixo", defaultValue: 0 } as any);
const xtb = storage.createPlatform({ name: "XTB" } as any);
const tr = storage.createPlatform({ name: "TR" } as any);
const mk = (month: number) => storage.createMonth({ year: 2026, month, label: `M${month}`, base: 1000, taxaSs: 0, taxaIrsBase: 0 } as any);
const m1 = mk(1);
storage.setAllocation(m1.id, poup.id, "fixo", 300);
storage.setAllocation(m1.id, ferias.id, "fixo", 100, 0); // fora deste mês, valor guardado
storage.setDistribution(m1.id, poup.id, [{ platformId: xtb.id, mode: "fixo", value: 200 }, { platformId: tr.id, mode: "fixo", value: 100 }] as any);
storage.setAssets(m1.id, poup.id, xtb.id, [{ name: "VWCE", percent: 60, note: "" }, { name: "SP500", percent: 40, note: "" }] as any);

test("guardar como modelo grava entra, valor, plataformas e ativos por parcela", async () => {
  assert.equal((await call("POST", `/api/months/${m1.id}/save-as-rules`)).status, 200);
  const p = st().parcels.find((x) => x.id === poup.id)!;
  assert.equal(p.defaultValue, 300);
  assert.equal(p.defaultIncluded, 1);
  assert.equal(st().parcels.find((x) => x.id === ferias.id)!.defaultIncluded, 0);
  assert.equal(st().rulePlatforms.filter((l) => l.parcelId === poup.id).length, 2);
  assert.equal(st().ruleAssets.filter((l) => l.parcelId === poup.id).length, 2);
});

test("mês novo nasce com o modelo aplicado (valor, fora do mês, plataformas e ativos)", async () => {
  const r = await call("POST", "/api/months", { year: 2026, month: 2, label: "Fev", base: 1000, taxaSs: 0, taxaIrsBase: 0 });
  assert.equal(r.status, 200);
  const as = st().allocations.filter((a) => a.monthId === r.json.id);
  const a = as.find((x) => x.parcelId === poup.id)!;
  assert.equal(a.value, 300);
  assert.equal(a.included, 1);
  const f = as.find((x) => x.parcelId === ferias.id)!;
  assert.equal(f.included, 0);
  assert.equal(f.value, 100); // o valor não se perde
  assert.equal(st().allocationPlatforms.filter((l) => l.allocationId === a.id).length, 2);
  assert.equal(st().allocationAssets.filter((l) => l.allocationId === a.id).length, 2);
});

test("aplicar o modelo substitui a divisão existente e devolve parcelas sem detalhe se não couber", async () => {
  const m = mk(3);
  storage.setAllocation(m.id, poup.id, "fixo", 50);
  // o detalhe do modelo soma 300 em € fixo; com 50 no mês não cabe... mas o modelo repõe 300, que cabe
  const ok = await call("POST", `/api/months/${m.id}/apply-rules`);
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.json.modelo.semDetalhe, []);
  assert.equal(st().allocations.find((a) => a.monthId === m.id && a.parcelId === poup.id)!.value, 300);
  // alterar o modelo para uma percentagem baixa: o detalhe em € fixo já não cabe
  storage.updateParcel(poup.id, { defaultMode: "percentagem", defaultValue: 5 });
  const m4 = mk(4);
  const r = await call("POST", `/api/months/${m4.id}/apply-rules`);
  assert.deepEqual(r.json.modelo.semDetalhe, [poup.id]);
  const a = st().allocations.find((x) => x.monthId === m4.id && x.parcelId === poup.id)!;
  assert.equal(st().allocationPlatforms.filter((l) => l.allocationId === a.id).length, 0);
});

test("restaurar um backup antigo (sem as novas tabelas nem campos) funciona e deixa tudo incluído", () => {
  const old = JSON.parse(JSON.stringify(st()));
  delete old.rulePlatforms; delete old.ruleAssets;
  for (const a of old.allocations) delete a.included;
  for (const p of old.parcels) delete p.defaultIncluded;
  storage.replaceAll(old);
  assert.ok(st().allocations.every((a) => a.included === 1));
  assert.equal(st().rulePlatforms.length, 0);
});
