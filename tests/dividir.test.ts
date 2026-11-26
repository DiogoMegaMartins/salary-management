// Plano do mês: os três passos (Quanto entra, Para onde vai, Fechar o mês) e qual está em curso.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dividirSteps } from "../shared/dividir";

/** O fmtEur usa espaço sem quebra antes do €: compara-se com espaços normais. */
const t = (x: string) => x.replace(/\s/g, " ");
const estados = (s: ReturnType<typeof dividirSteps>) => s.steps.map((x) => x.state);

test("dividir: salário feito, falta repartir", () => {
  const s = dividirSteps({ available: 1850, remaining: 380, closed: false });
  assert.deepEqual(estados(s), ["done", "now", "todo"]);
  assert.equal(s.current, "repartir");
  assert.equal(t(s.steps[0].text), "1 850,00 € definido");
  assert.equal(t(s.steps[1].text), "Faltam 380,00 € por distribuir");
});

test("dividir: tudo repartido, pronto para fechar", () => {
  const s = dividirSteps({ available: 1850, remaining: 0, closed: false });
  assert.deepEqual(estados(s), ["done", "done", "now"]);
  assert.equal(s.current, "fechar");
  assert.equal(s.steps[1].text, "Tudo repartido");
});

test("dividir: mês fechado, tudo feito", () => {
  const s = dividirSteps({ available: 1850, remaining: 0, closed: true });
  assert.deepEqual(estados(s), ["done", "done", "done"]);
  assert.equal(s.current, "fechar");
  assert.equal(s.steps[2].text, "Mês fechado");
});

test("dividir: sem salário no mês, o passo 1 está em curso e os outros esperam", () => {
  const s = dividirSteps({ available: 0, remaining: 0, closed: false });
  assert.deepEqual(estados(s), ["now", "todo", "todo"]);
  assert.equal(s.current, "salario");
  assert.match(s.steps[0].text, /salário/i);
});

test("dividir: a repartir mais do que o disponível mostra o excesso", () => {
  const s = dividirSteps({ available: 1000, remaining: -50, closed: false });
  assert.deepEqual(estados(s), ["done", "now", "todo"]);
  assert.equal(t(s.steps[1].text), "Excede 50,00 €");
});

test("dividir: arredondamentos de cêntimos contam como repartido", () => {
  assert.deepEqual(estados(dividirSteps({ available: 1850, remaining: 0.004, closed: false })), ["done", "done", "now"]);
});

test("dividir: os passos têm os nomes novos", () => {
  const s = dividirSteps({ available: 1000, remaining: 0, closed: false });
  assert.deepEqual(s.steps.map((x) => x.label), ["Quanto entra", "Para onde vai", "Fechar o mês"]);
});

test("dividir: o primeiro passo diz quanto foi transportado do mês anterior", () => {
  const com = dividirSteps({ available: 2100, remaining: 0, closed: false, carryIn: 1219.99 });
  assert.equal(t(com.steps[0].text), "2 100,00 € + 1 219,99 € transportados do mês anterior");
  const sem = dividirSteps({ available: 2100, remaining: 0, closed: false, carryIn: 0 });
  assert.equal(t(sem.steps[0].text), "2 100,00 € definido");
});
