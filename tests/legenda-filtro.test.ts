// Legendas clicáveis: esconder e mostrar séries, sem nunca esvaziar o gráfico.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toggleSeries } from "../shared/legend-filter";

const todas = ["Líquido", "Subsídio", "Taxa"];

test("legenda: clicar esconde a série e voltar a clicar mostra-a", () => {
  const a = toggleSeries([], "Subsídio", todas);
  assert.deepEqual(a, ["Subsídio"]);
  assert.deepEqual(toggleSeries(a, "Subsídio", todas), []);
});

test("legenda: pode esconder várias séries", () => {
  assert.deepEqual(toggleSeries(["Subsídio"], "Taxa", todas), ["Subsídio", "Taxa"]);
});

test("legenda: a última série visível não se esconde", () => {
  assert.deepEqual(toggleSeries(["Subsídio", "Taxa"], "Líquido", todas), ["Subsídio", "Taxa"]);
  assert.deepEqual(toggleSeries([], "A", ["A"]), []);
});

test("legenda: não altera a lista recebida", () => {
  const h = ["Subsídio"];
  toggleSeries(h, "Taxa", todas);
  assert.deepEqual(h, ["Subsídio"]);
});

import { visibleShares } from "../shared/legend-filter";
test("legendas: o peso de cada item entre os visíveis soma 100 % e os escondidos ficam sem peso", () => {
  const itens = [{ key: "A", value: 50 }, { key: "B", value: 30 }, { key: "C", value: 20 }];
  const todos = visibleShares(itens, () => false);
  assert.deepEqual(todos, { A: 0.5, B: 0.3, C: 0.2 });
  const semA = visibleShares(itens, (k) => k === "A");
  assert.deepEqual(semA, { A: null, B: 0.6, C: 0.4 });
  assert.equal(Object.values(semA).reduce<number>((a, v) => a + (v ?? 0), 0), 1);
  assert.deepEqual(visibleShares([{ key: "A", value: 0 }], () => false), { A: null });
});
