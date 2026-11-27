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
