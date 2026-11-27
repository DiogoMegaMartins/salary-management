// Offline: uma despesa com data num mês inexistente ou fechado é recusada logo, em vez de bloquear a fila.
import { test } from "node:test";
import assert from "node:assert/strict";
import { projectOffline } from "../shared/offline";

const estado = () => ({
  months: [
    { id: 1, year: 2031, month: 4, status: "aberto" },
    { id: 2, year: 2031, month: 3, status: "fechado" },
    { id: 3, year: 2031, month: 5, status: "aberto" },
  ],
  parcels: [], allocations: [], allocationPlatforms: [], allocationAssets: [],
  transactions: [] as any[],
});
const despesa = (date: string, monthId = 1) => ({ method: "POST", url: "/api/transactions", localId: -1, data: { monthId, date, type: "expense", value: 5, category: "", note: "", parcelId: null } });

test("offline: data num mês que não existe é recusada e não entra na fila", () => {
  const s = estado();
  assert.throws(() => projectOffline(s, despesa("2031-12-02")), /Não existe o mês 12\/2031/);
  assert.equal(s.transactions.length, 0);
});

test("offline: data num mês fechado é recusada", () => {
  const s = estado();
  assert.throws(() => projectOffline(s, despesa("2031-03-10")), /fechado/);
  assert.equal(s.transactions.length, 0);
});

test("offline: data de outro mês aberto muda o movimento para esse mês, como no servidor", () => {
  const s = estado();
  const op = despesa("2031-05-10");
  projectOffline(s, op);
  assert.equal(s.transactions[0].monthId, 3);
  assert.equal(op.data.monthId, 3);
});

test("offline: data no próprio mês aberto fica como está", () => {
  const s = estado();
  projectOffline(s, despesa("2031-04-10"));
  assert.equal(s.transactions[0].monthId, 1);
});
