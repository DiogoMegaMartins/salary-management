import { test } from "node:test";
import assert from "node:assert/strict";
import { PALETTES, COLOR_MODES, DEFAULT_PALETTE, DEFAULT_COLOR_MODE, PALETTE_LABELS, parsePalette, parseColorMode, resolveDark } from "../shared/appearance";

test("aparência: valores válidos passam", () => {
  assert.equal(parsePalette("mare"), "mare");
  assert.equal(parseColorMode("escuro"), "escuro");
});

test("aparência: lixo cai no valor por defeito", () => {
  for (const v of ["roxo", undefined, null, 42, {}, ""]) assert.equal(parsePalette(v), "ceu", String(v));
  for (const v of ["noite", undefined, null, 1, ""]) assert.equal(parseColorMode(v), "auto", String(v));
  assert.equal(DEFAULT_PALETTE, "ceu");
  assert.equal(DEFAULT_COLOR_MODE, "auto");
});

test("aparência: modo automático segue o sistema, os outros ignoram-no", () => {
  assert.equal(resolveDark("auto", true), true);
  assert.equal(resolveDark("auto", false), false);
  assert.equal(resolveDark("claro", true), false);
  assert.equal(resolveDark("escuro", false), true);
});

test("aparência: todas as paletas e modos têm etiqueta", () => {
  assert.equal(PALETTES.length, 5);
  assert.equal(COLOR_MODES.length, 3);
  for (const p of PALETTES) assert.ok(PALETTE_LABELS[p].nome && PALETTE_LABELS[p].descricao, p);
});
