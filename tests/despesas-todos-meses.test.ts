// Despesas: pesquisa em todos os meses (monthId = null).
import { test } from "node:test";
import assert from "node:assert/strict";
import { expenseView } from "../shared/calc/expenses";

const tx = (id: number, monthId: number, date: string, value: number, category: string, note: string, type = "expense") =>
  ({ id, monthId, date, type, value, parcelId: 1, category, note });
const txs = [
  tx(1, 1, "2026-01-10", 10, "Casa", "renda"),
  tx(2, 2, "2026-02-10", 20, "Casa", "renda"),
  tx(3, 2, "2026-02-11", 5, "Comida", "pão"),
  tx(4, 2, "2026-02-12", 100, "", "transferência", "transfer"),
];

test("com mês, só esse mês; com null, todo o histórico", () => {
  assert.equal(expenseView(txs, 2).monthTotal, 25);
  assert.equal(expenseView(txs, null).monthTotal, 35);
  assert.equal(expenseView(txs, null).count, 3);
});

test("a pesquisa em todos os meses encontra em qualquer mês e agrupa por dia", () => {
  const v = expenseView(txs, null, { search: "renda" });
  assert.equal(v.filteredCount, 2);
  assert.equal(v.filteredTotal, 30);
  assert.deepEqual(v.days.map((d) => d.date), ["2026-02-10", "2026-01-10"]);
});

test("transferências continuam fora do total", () => {
  assert.equal(expenseView(txs, null).excludedTransfers, 1);
});
