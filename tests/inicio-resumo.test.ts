// Início: "Valor disponível" = gastos planeados − despesas registadas (sem parcela ou na de gastos), estado e categorias.
import { test } from "node:test";
import assert from "node:assert/strict";
import { inicioSummary, defaultExpenseParcel } from "../shared/inicio";

const gasto = (value: number, category = "", parcelKind: string | null = "gastos") => ({ value, category, parcelKind });
const base = { month: { year: 2026, month: 11 }, planned: 1400, today: "2026-11-20" };

test("início: valor disponível = planeado menos gasto, e só conta gastos e despesas sem parcela", () => {
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
  const ps = [{ id: 5, kind: "investimento", archived: 0 }, { id: 9, kind: "gastos", archived: 0 }, { id: 3, kind: "gastos", archived: 0 }, { id: 2, kind: "gastos", archived: 1 }] as any[];
  assert.equal(defaultExpenseParcel(ps), 3);
  assert.equal(defaultExpenseParcel([ps[0]]), null);
  assert.equal(defaultExpenseParcel([]), null);
});

test("início: o título é Valor disponível e muda quando se passa do planeado", async () => {
  const { inicioLabel } = await import("../shared/inicio");
  assert.equal(inicioLabel("ok"), "Valor disponível");
  assert.equal(inicioLabel("atencao"), "Valor disponível");
  assert.equal(inicioLabel("excedido"), "Gasto acima do planeado");
});

test("inicio: quanto se pode gastar por dia", async () => {
  const { dailyAllowance } = await import("../shared/inicio");
  assert.equal(dailyAllowance(1219.99, 4), 305);
  assert.equal(dailyAllowance(100, 0), 100, "no último dia conta o dia de hoje");
  assert.equal(dailyAllowance(0, 5), null);
  assert.equal(dailyAllowance(-20, 5), null);
  assert.equal(dailyAllowance(100, null), null, "fora do mês de hoje não há valor diário");
});

test("inicio: últimas despesas do mês, da mais recente para a mais antiga", async () => {
  const { latestExpenses } = await import("../shared/inicio");
  const t = (id: number, monthId: number, date: string, type = "expense", category = "Casa") => ({ id, monthId, type, date, value: id, category, note: "" });
  const r = latestExpenses([t(1, 1, "2026-11-20"), t(2, 1, "2026-11-25"), t(3, 1, "2026-11-25"), t(4, 2, "2026-12-01"), t(5, 1, "2026-11-26", "aporte"), t(6, 1, "2026-11-10", "expense", " ")], 1, 3);
  assert.deepEqual(r.map((x) => x.id), [3, 2, 1]);
  assert.equal(latestExpenses([t(6, 1, "2026-11-10", "expense", " ")], 1, 5)[0].category, "Sem categoria");
});

test("inicio: rótulo do dia", async () => {
  const { dayLabel } = await import("../shared/inicio");
  assert.equal(dayLabel("2026-11-26", "2026-11-26"), "Hoje");
  assert.equal(dayLabel("2026-11-25", "2026-11-26"), "Ontem");
  assert.match(dayLabel("2026-11-20", "2026-11-26"), /20/);
});
