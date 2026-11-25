import { test } from "node:test";
import assert from "node:assert/strict";
import { closingPlan } from "../shared/closing";

test("restante 0 (ou menos de 1 cêntimo): fecha sem escolher destino", () => {
  for (const r of [0, 0.004, -0.004]) {
    const p = closingPlan(r, true);
    assert.equal(p.kind, "zero");
    assert.equal(p.needsDestination, false);
    assert.equal(p.defaultDest, "manter");
  }
});

test("défice: nada a escolher, só manter", () => {
  const p = closingPlan(-50, true);
  assert.deepEqual([p.kind, p.needsDestination, p.defaultDest, p.canCarry], ["deficit", false, "manter", false]);
});

test("restante positivo com mês seguinte aberto: escolhe-se e transporta-se por defeito", () => {
  const p = closingPlan(120, true);
  assert.deepEqual([p.kind, p.needsDestination, p.defaultDest, p.canCarry], ["positive", true, "transportar", true]);
});

test("restante positivo sem mês seguinte aberto: não se pode transportar, fica 'manter' por defeito", () => {
  const p = closingPlan(120, false);
  assert.deepEqual([p.needsDestination, p.defaultDest, p.canCarry], [true, "manter", false]);
});
