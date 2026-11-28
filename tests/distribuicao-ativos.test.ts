import { test } from "node:test";
import assert from "node:assert/strict";
import { assetPercentsFromValues, assetValuesFromPercents, equalParts, distributeAssets } from "../shared/calc";

test("ativos: valores em euros passam a percentagens que somam exatamente 100 % quando enchem o montante", () => {
  assert.deepEqual(assetPercentsFromValues(60, [36, 18, 6]), [60, 30, 10]);
  const p = assetPercentsFromValues(100, [33.33, 33.33, 33.34]);
  assert.equal(Math.round(p.reduce((a, b) => a + b, 0) * 10000), 1_000_000);
  assert.deepEqual(assetPercentsFromValues(0, [1, 2]), [0, 0]);
});

test("ativos: ida e volta entre valor e percentagem mantém os cêntimos", () => {
  for (const [montante, valores] of [[60, [36, 18, 6]], [100, [33.33, 33.33, 33.34]], [1234.56, [500, 400.5, 334.06]]] as const) {
    const pct = assetPercentsFromValues(montante, [...valores]);
    assert.deepEqual(assetValuesFromPercents(montante, pct), [...valores]);
    const r = distributeAssets(montante, pct.map((percent, i) => ({ name: `A${i}`, percent })));
    assert.equal(r.ok, true);
    assert.equal(r.remainingCents, 0);
  }
});

test("partes iguais: a soma é exata, com o resto nas primeiras", () => {
  assert.deepEqual(equalParts(100, 3), [33.34, 33.33, 33.33]);
  assert.deepEqual(equalParts(150, 6), [25, 25, 25, 25, 25, 25]);
  assert.equal(equalParts(100, 3, 4).reduce((a, b) => a + Math.round(b * 10000), 0), 1_000_000);
  assert.deepEqual(equalParts(10, 0), []);
});
