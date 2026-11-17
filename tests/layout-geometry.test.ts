import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSectionGeometry, shouldStackSections } from "../client/src/lib/layout-geometry";

const fallback = { x: 6, y: 12, w: 6, h: 11 };
test("layout preserves valid saved coordinates without mutating them", () => {
  const saved = { x: 3, y: 8, w: 9, h: 5 };
  assert.deepEqual(normalizeSectionGeometry(saved, fallback), saved);
  assert.deepEqual(saved, { x: 3, y: 8, w: 9, h: 5 });
});
test("layout clamps cards into twelve columns with usable minimum dimensions", () => {
  assert.deepEqual(normalizeSectionGeometry({ x: 10, y: -1, w: 6, h: 0 }, fallback), { x: 6, y: 0, w: 6, h: 4 });
  assert.deepEqual(normalizeSectionGeometry({ x: -4, w: 100 }, fallback), { x: 0, y: 12, w: 12, h: 11 });
  assert.equal(normalizeSectionGeometry({ w: 0 }, fallback).w, 3);
});
test("layout recovers missing and non-finite persisted values", () => {
  assert.deepEqual(normalizeSectionGeometry(undefined, fallback), fallback);
  assert.deepEqual(normalizeSectionGeometry(null, fallback), fallback);
  assert.deepEqual(normalizeSectionGeometry({ x: NaN, y: Infinity, w: NaN, h: -Infinity }, fallback), fallback);
});
test("compact cards depend on usable container width rather than viewport", () => {
  for (const width of [0, 288, 720, 740, 899]) assert.equal(shouldStackSections(width), true);
  for (const width of [900, 1156, 1636]) assert.equal(shouldStackSections(width), false);
});

test("cartões pequenos (KPIs) aceitam mínimos próprios; sem mínimos continua 3 × 4", async () => {
  const { normalizeSectionGeometry } = await import("../client/src/lib/layout-geometry");
  const fallback = { x: 0, y: 0, w: 4, h: 3 };
  assert.deepEqual(normalizeSectionGeometry({ w: 2, h: 2 }, fallback, { w: 2, h: 3 }), { x: 0, y: 0, w: 2, h: 3 });
  assert.deepEqual(normalizeSectionGeometry({ w: 2, h: 2 }, fallback), { x: 0, y: 0, w: 3, h: 4 });
  assert.deepEqual(normalizeSectionGeometry(undefined, fallback, { w: 3, h: 3 }), fallback);
});
