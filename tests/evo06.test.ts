// EVO-06 — distribuição por ativos dentro de cada plataforma. Base de dados temporária.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.chdir(mkdtempSync(join(tmpdir(), "sm-test6-")));
const { storage } = await import("../server/storage");
const { distributeAssets } = await import("../shared/calc");

const status = (fn: () => unknown, s: number) => assert.throws(fn, (e: any) => e.status === s);
const A = (name: string, percent: number, note = "") => ({ name, percent, note });

test("exemplo do plano: 300 € → 60%=180, 30%=90, 10%=30", () => {
  const r = distributeAssets(300, [A("ETF A", 60), A("Commodities", 30), A("Cripto", 10)]);
  assert.deepEqual(r.amountsCents, [18000, 9000, 3000]);
  assert.equal(r.remainingCents, 0);
});

test("parcial: só ETF A 60% → restante 40% = 120 €", () => {
  const r = distributeAssets(300, [A("ETF A", 60)]);
  assert.equal(r.remainingPercent, 40);
  assert.equal(r.remainingCents, 12000);
});

test("sem linhas o montante fica na plataforma", () => {
  const r = distributeAssets(300, []);
  assert.equal(r.ok, true);
  assert.equal(r.remainingCents, 30000);
});

test("limite de 100%, negativas, zero, vazias e repetidas são bloqueadas", () => {
  assert.equal(distributeAssets(100, [A("A", 60), A("B", 40.01)]).ok, false);
  assert.equal(distributeAssets(100, [A("A", 101)]).ok, false);
  assert.equal(distributeAssets(100, [A("A", -5)]).ok, false);
  assert.equal(distributeAssets(100, [A("A", 0)]).ok, false);
  assert.equal(distributeAssets(100, [A("A", NaN)]).ok, false);
  assert.equal(distributeAssets(100, [A("  ", 10)]).ok, false);
  assert.equal(distributeAssets(100, [A("ETF", 10), A(" etf ", 10)]).ok, false);
  assert.equal(distributeAssets(100, [A("A", 60), A("B", 40)]).ok, true); // exatamente 100%
});

test("decimais e arredondamento: distribuído + restante = montante, nunca excede", () => {
  for (const total of [0.01, 0.07, 33.33, 100, 1234.57, 999.99]) {
    const r = distributeAssets(total, [A("A", 33.3333), A("B", 33.3333), A("C", 33.3333)]);
    assert.equal(r.ok, true);
    assert.equal(r.distributedCents + r.remainingCents, Math.round(total * 100));
    assert.ok(r.remainingCents >= 0);
  }
  const r = distributeAssets(100, [A("A", 33.33), A("B", 33.33), A("C", 33.34)]);
  assert.equal(r.remainingCents, 0);
});

test("alterar o montante da plataforma mantém % e recalcula valores", () => {
  const lines = [A("A", 60), A("B", 30)];
  assert.deepEqual(distributeAssets(300, lines).amountsCents, [18000, 9000]);
  assert.deepEqual(distributeAssets(500, lines).amountsCents, [30000, 15000]);
});

// ---------------- persistência
const st = () => storage.getState();
function setup() {
  const m = st().months[0];
  const a = st().allocations.find((x) => x.monthId === m.id)!;
  storage.setAllocation(m.id, a.parcelId, "fixo", 300);
  const pa = storage.createPlatform({ name: "P-A" });
  const pb = storage.createPlatform({ name: "P-B" });
  storage.setDistribution(m.id, a.parcelId, [{ platformId: pa.id, mode: "fixo", value: 200 }, { platformId: pb.id, mode: "fixo", value: 100 }]);
  return { m, parcelId: a.parcelId, allocId: a.id, pa, pb };
}

test("guardar ativos: validado no servidor, sem movimentos, só planeamento", () => {
  const { m, parcelId, pa } = setup();
  const tx = st().transactions.length;
  const out = storage.setAssets(m.id, parcelId, pa.id, [A("ETF A", 60, "nota"), A("Cripto", 10)]);
  assert.equal(out.length, 2);
  assert.equal(out[0].note, "nota");
  status(() => storage.setAssets(m.id, parcelId, pa.id, [A("A", 70), A("B", 40)]), 409);
  assert.equal(storage.getAssets(m.id, parcelId, pa.id).length, 2); // não foi substituído
  status(() => storage.setAssets(m.id, parcelId, 99999, [A("A", 10)]), 409); // plataforma fora da distribuição
  assert.equal(st().transactions.length, tx);
});

test("ativos sobrevivem a alterar valores da distribuição e saem com a plataforma removida", () => {
  const { m, parcelId, pa, pb } = setup2();
  storage.setDistribution(m.id, parcelId, [{ platformId: pa.id, mode: "fixo", value: 150 }, { platformId: pb.id, mode: "fixo", value: 100 }]);
  assert.equal(storage.getAssets(m.id, parcelId, pa.id).length, 2);
  storage.setDistribution(m.id, parcelId, [{ platformId: pb.id, mode: "fixo", value: 100 }]);
  assert.equal(storage.getAssets(m.id, parcelId, pa.id).length, 0);
});
function setup2() {
  const m = st().months[0];
  const pid = st().allocations.find((x) => x.monthId === m.id)!.parcelId;
  const lines = storage.getDistribution(m.id, pid);
  return { m, parcelId: pid, pa: { id: lines[0].platformId }, pb: { id: lines[1].platformId } };
}

test("backup preserva ativos; backup antigo restaura sem ativos; apagar mês limpa", () => {
  const m = st().months[0];
  const parcelId = st().allocations.find((x) => x.monthId === m.id)!.parcelId;
  const p1 = storage.createPlatform({ name: "P-C" });
  const p2 = storage.createPlatform({ name: "P-D" });
  storage.setDistribution(m.id, parcelId, [{ platformId: p1.id, mode: "fixo", value: 150 }, { platformId: p2.id, mode: "fixo", value: 100 }]);
  storage.setAssets(m.id, parcelId, p1.id, [A("X", 50)]);
  const snap = JSON.parse(JSON.stringify(st()));
  assert.ok(snap.allocationAssets.length > 0);
  storage.replaceAll(snap);
  assert.equal(st().allocationAssets.length, snap.allocationAssets.length);
  storage.replaceAll({ ...snap, allocationAssets: undefined });
  assert.equal(st().allocationAssets.length, 0);
  storage.replaceAll(snap);
  storage.deleteMonth(m.id);
  assert.equal(st().allocationAssets.length, 0);
});
