// Início: "Ainda podes gastar" = gastos planeados − despesas registadas (sem parcela ou na de gastos), estado e categorias.
import { test } from "node:test";
import assert from "node:assert/strict";
import { inicioSummary, defaultExpenseParcel } from "../shared/inicio";

const gasto = (value: number, category = "", parcelKind: string | null = "gastos") => ({ value, category, parcelKind });
const base = { month: { year: 2026, month: 11 }, planned: 1400, today: "2026-11-20" };

test("início: ainda podes gastar = planeado menos gasto, e só conta gastos e despesas sem parcela", () => {
  const s = inicioSummary({
    ...base,
    expenses: [gasto(620, "Casa"), gasto(340, "Alimentação"), gasto(100, "Casa"), gasto(50, "", null), gasto(500, "Bolsa", "investimento"), gasto(200, "Fundo", "poupanca")],
  });
  assert.equal(s.spent, 1110);
  assert.equal(s.left, 290);
  assert.equal(s.pctSpent, 79);
  assert.equal(s.state, "ok");
  assert.equal(s.daysLeft, 10);
  assert.deepEqual(s.categories.map((c) => [c.name, c.value]), [["Casa", 720], ["Alimentação", 340], ["Sem categoria", 50]]);
});

test("início: atenção a partir de 85%, só se faltarem mais de 5 dias; excedido quando passa do planeado", () => {
  const e = (v: number) => [gasto(v, "Casa")];
  assert.equal(inicioSummary({ ...base, expenses: e(1189) }).state, "ok"); // 84,9%
  assert.equal(inicioSummary({ ...base, expenses: e(1190) }).state, "atencao");
  assert.equal(inicioSummary({ ...base, today: "2026-11-26", expenses: e(1300) }).state, "ok"); // faltam 4 dias
  assert.equal(inicioSummary({ ...base, today: "2026-10-01", expenses: e(1300) }).state, "atencao"); // não é o mês de hoje
  const x = inicioSummary({ ...base, expenses: e(1500) });
  assert.equal(x.state, "excedido");
  assert.equal(x.left, -100);
  assert.equal(x.pctSpent, 100);
});

test("início: sem plano de gastos não há número", () => {
  const s = inicioSummary({ ...base, planned: 0, expenses: [gasto(50, "Casa")] });
  assert.equal(s.state, "sem-plano");
  const v = inicioSummary({ ...base, planned: 0, expenses: [] });
  assert.equal(v.state, "sem-plano");
  assert.equal(v.categories.length, 0);
});

test("início: dias que faltam só no mês de hoje", () => {
  assert.equal(inicioSummary({ ...base, today: "2026-11-30", expenses: [] }).daysLeft, 0);
  assert.equal(inicioSummary({ ...base, today: "2026-12-01", expenses: [] }).daysLeft, null);
});

test("início: parcela predefinida é a de gastos de menor id; sem ela, nenhuma", () => {
  const ps = [{ id: 5, kind: "investimento", active: 1 }, { id: 9, kind: "gastos", active: 1 }, { id: 3, kind: "gastos", active: 1 }, { id: 2, kind: "gastos", active: 0 }] as any[];
  assert.equal(defaultExpenseParcel(ps), 3);
  assert.equal(defaultExpenseParcel([ps[0]]), null);
  assert.equal(defaultExpenseParcel([]), null);
});
