// EVO-03 — distribuição de parcelas por plataforma. Base de dados temporária.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.chdir(mkdtempSync(join(tmpdir(), "sm-test3-")));
const { storage } = await import("../server/storage");
const { distribute, convertLines } = await import("../shared/calc");

const L = (platformId: number, value: number, mode: "fixo" | "percentagem" = "fixo") => ({ platformId, mode, value });
const status = (fn: () => unknown, s: number) => assert.throws(fn, (e: any) => e.status === s);

test("T05 sem linhas: valor integral na parcela", () => {
  const r = distribute(500, []);
  assert.equal(r.ok, true);
  assert.equal(r.remainingCents, 50000);
  assert.equal(r.distributedCents, 0);
});

test("T06 500 com 300 e 150: restante 50", () => {
  const r = distribute(500, [L(1, 300), L(2, 150)]);
  assert.equal(r.ok, true);
  assert.equal(r.remainingCents, 5000);
});

test("T07 550 para parcela de 500 é bloqueado", () => {
  const r = distribute(500, [L(1, 300), L(2, 250)]);
  assert.equal(r.ok, false);
});

test("T08 reduzir a parcela abaixo das linhas por valor exige correção; em % recalcula", () => {
  assert.equal(distribute(400, [L(1, 300), L(2, 150)]).ok, false);
  const pct = distribute(400, [L(1, 60, "percentagem"), L(2, 30, "percentagem")]);
  assert.equal(pct.ok, true);
  assert.deepEqual(pct.amountsCents, [24000, 12000]);
});

test("T23 arredondamento: distribuído + restante = total e nunca excede", () => {
  for (const total of [100, 33.33, 0.01, 1234.57, 999.99]) {
    const r = distribute(total, [L(1, 33.333, "percentagem"), L(2, 33.333, "percentagem"), L(3, 33.333, "percentagem")]);
    assert.equal(r.ok, true);
    assert.equal(r.distributedCents + r.remainingCents, r.totalCents);
    assert.ok(r.remainingCents >= 0);
  }
  const full = distribute(100, [L(1, 33.33, "percentagem"), L(2, 33.33, "percentagem"), L(3, 33.34, "percentagem")]);
  assert.equal(full.remainingCents, 0);
});

test("percentagens > 100, negativas, repetidas ou modos misturados são inválidas", () => {
  assert.equal(distribute(100, [L(1, 60, "percentagem"), L(2, 50, "percentagem")]).ok, false);
  assert.equal(distribute(100, [L(1, -1)]).ok, false);
  assert.equal(distribute(100, [L(1, 10), L(1, 10)]).ok, false);
  assert.equal(distribute(100, [L(1, 10), L(2, 10, "percentagem")]).ok, false);
});

test("conversão entre modos preserva montantes", () => {
  const pct = convertLines(500, [L(1, 300), L(2, 150)], "percentagem");
  assert.deepEqual(pct.map((l) => l.value), [60, 30]);
  const back = convertLines(500, pct, "fixo");
  assert.deepEqual(back.map((l) => l.value), [300, 150]);
});

// ---- persistência
const st = () => storage.getState();
const setup = () => {
  const m = st().months[0];
  const a = st().allocations.find((x) => x.monthId === m.id)!;
  return { m, a };
};

test("guardar distribuição por mês, validada no servidor, sem tocar em movimentos", () => {
  const { m, a } = setup();
  storage.setAllocation(m.id, a.parcelId, "fixo", 500);
  const p1 = storage.createPlatform({ name: "T-A" });
  const p2 = storage.createPlatform({ name: "T-B" });
  const txBefore = st().transactions.length;
  storage.setDistribution(m.id, a.parcelId, [L(p1.id, 300), L(p2.id, 150)]);
  assert.equal(storage.getDistribution(m.id, a.parcelId).length, 2);
  status(() => storage.setDistribution(m.id, a.parcelId, [L(p1.id, 300), L(p2.id, 250)]), 409);
  assert.equal(storage.getDistribution(m.id, a.parcelId).length, 2); // não foi substituída
  status(() => storage.setDistribution(m.id, a.parcelId, [L(99999, 10)]), 400);
  assert.equal(st().transactions.length, txBefore);
});

test("T08 servidor: reduzir a parcela abaixo da distribuição por valor é bloqueado", () => {
  const { m, a } = setup();
  status(() => storage.setAllocation(m.id, a.parcelId, "fixo", 400), 409);
  assert.equal(st().allocations.find((x) => x.id === a.id)!.value, 500);
  storage.setAllocation(m.id, a.parcelId, "fixo", 600); // aumentar é permitido
});

test("T09 outros meses não são afetados", () => {
  const { m, a } = setup();
  const other = st().months[1];
  const otherAlloc = st().allocations.find((x) => x.monthId === other.id && x.parcelId === a.parcelId);
  assert.ok(otherAlloc);
  assert.equal(storage.getDistribution(other.id, a.parcelId).length, 0);
  assert.equal(storage.getDistribution(m.id, a.parcelId).length, 2);
});

test("plataforma arquivada: mantém-se no histórico, não entra em novas linhas; em uso não elimina", () => {
  const { m, a } = setup();
  const lines = storage.getDistribution(m.id, a.parcelId);
  const used = lines[0].platformId;
  status(() => storage.deletePlatform(used), 409);
  storage.updatePlatform(used, { archived: 1 });
  storage.setDistribution(m.id, a.parcelId, lines.map((l) => ({ platformId: l.platformId, mode: l.mode as any, value: l.value })));
  const fresh = storage.createPlatform({ name: "Arq nova" });
  storage.updatePlatform(fresh.id, { archived: 1 });
  status(() => storage.setDistribution(m.id, a.parcelId, [L(fresh.id, 10)]), 400);
});

test("T24/T25 backup preserva distribuições; apagar mês remove-as", () => {
  const { m, a } = setup();
  const snap = JSON.parse(JSON.stringify(st()));
  storage.replaceAll(snap);
  assert.equal(st().allocationPlatforms.length, snap.allocationPlatforms.length);
  assert.equal(storage.getDistribution(m.id, a.parcelId).length, 2);
  const old = { ...snap, allocationPlatforms: undefined };
  storage.replaceAll(old); // backup antigo sem distribuições
  assert.equal(st().allocationPlatforms.length, 0);
  storage.replaceAll(snap);
  storage.deleteMonth(m.id);
  assert.ok(!st().allocationPlatforms.some((l) => snap.allocationPlatforms.some((x: any) => x.id === l.id)));
});

test("conversão € → % → € não perde cêntimos (200/300, 1/3, 0.07)", () => {
  for (const [total, vals] of [[300, [200, 75]], [100, [33.33, 33.33, 33.34]], [0.07, [0.03, 0.04]], [1234.57, [100.01, 999.99]]] as const) {
    const fixo = vals.map((v, i) => L(i + 1, v));
    const back = convertLines(total, convertLines(total, fixo, "percentagem"), "fixo");
    assert.deepEqual(back.map((l) => l.value), [...vals], `total ${total}`);
  }
});
