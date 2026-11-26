// Início: "Sobra este mês" = disponível − despesas registadas, estado, dias que faltam e categorias.
import { test } from "node:test";
import assert from "node:assert/strict";
import { homeSummary, pickHomeMonth } from "../shared/home";

const gasto = (value: number, category = "") => ({ value, category });

test("início: sobra é disponível menos despesas, com categorias por ordem", () => {
  const s = homeSummary({
    month: { year: 2026, month: 11 }, available: 1850,
    expenses: [gasto(620, "Casa"), gasto(340, "Alimentação"), gasto(180, "Transportes"), gasto(140, "Lazer"), gasto(158), gasto(100, "Casa")],
    today: "2026-11-21",
  });
  assert.equal(s.spent, 1538);
  assert.equal(s.left, 312);
  assert.equal(s.pctSpent, 83);
  assert.equal(s.state, "ok");
  assert.equal(s.daysLeft, 9);
  assert.deepEqual(s.categories.map((c) => [c.name, c.value]), [["Casa", 720], ["Alimentação", 340], ["Transportes", 180], ["Sem categoria", 158], ["Lazer", 140]]);
  assert.equal(Math.round(s.categories[0].pct), 47);
});

test("início: estado muda a partir dos 90% e quando se gasta mais do que se tem", () => {
  const base = { month: { year: 2026, month: 11 }, available: 1000, today: "2026-11-01" };
  assert.equal(homeSummary({ ...base, expenses: [gasto(899)] }).state, "ok");
  assert.equal(homeSummary({ ...base, expenses: [gasto(900)] }).state, "atencao");
  const e = homeSummary({ ...base, expenses: [gasto(1200)] });
  assert.equal(e.state, "excedido");
  assert.equal(e.left, -200);
  assert.equal(e.pctSpent, 100);
});

test("início: dias que faltam só para o mês de hoje; sem disponível não divide por zero", () => {
  const h = { month: { year: 2026, month: 3 }, available: 0, expenses: [gasto(10)] };
  const s = homeSummary({ ...h, today: "2026-11-21" });
  assert.equal(s.daysLeft, null);
  assert.equal(s.pctSpent, 100);
  assert.equal(s.state, "excedido");
  assert.equal(homeSummary({ ...h, available: 0, expenses: [], today: "2026-03-31" }).daysLeft, 0);
  assert.equal(homeSummary({ ...h, available: 0, expenses: [], today: "2026-03-31" }).state, "ok");
});

test("início: mês escolhido é o de hoje se estiver aberto, senão o último aberto", () => {
  const ms = [
    { id: 1, year: 2026, month: 9, status: "fechado", base: 1 },
    { id: 2, year: 2026, month: 10, status: "aberto", base: 1 },
    { id: 3, year: 2026, month: 11, status: "fechado", base: 1 },
  ] as any[];
  assert.equal(pickHomeMonth(ms, "2026-11-20")?.id, 2); // o de hoje está fechado: último aberto
  assert.equal(pickHomeMonth(ms, "2026-10-05")?.id, 2);
  assert.equal(pickHomeMonth([ms[0]], "2026-11-20")?.id, 1); // sem meses abertos: o mais recente
  assert.equal(pickHomeMonth([], "2026-11-20"), null);
});
