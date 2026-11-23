import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount, parseDate, shiftDate, targetMonth, latestOpenMonth, monthOfDate } from "../shared/assistant";

test("valores: vírgula, ponto, milhares, espaços e euro", () => {
  assert.equal(parseAmount("1450"), 1450);
  assert.equal(parseAmount("1 450,50"), 1450.5);
  assert.equal(parseAmount("1.450,50"), 1450.5);
  assert.equal(parseAmount("1,450.50"), 1450.5);
  assert.equal(parseAmount("40,5"), 40.5);
  assert.equal(parseAmount("40.5"), 40.5);
  assert.equal(parseAmount("1.450"), 1450); // milhares
  assert.equal(parseAmount("40€"), 40);
  assert.equal(parseAmount("€ 12,99"), 12.99);
  assert.equal(parseAmount("10,005"), 10.01); // arredonda em cêntimos
});

test("valores: lixo, zero e negativos recusam-se", () => {
  for (const t of ["", "abc", "0", "-5", "1,2,3", "1.2.3", "12a", "--"]) assert.equal(parseAmount(t), null, t);
});

test("datas: hoje, ontem, dd/mm, dd/mm/aaaa e ISO; datas impossíveis recusam-se", () => {
  const hoje = "2026-11-23";
  assert.equal(parseDate("hoje", hoje), "2026-11-23");
  assert.equal(parseDate("Ontem", hoje), "2026-11-22");
  assert.equal(parseDate("22/11", hoje), "2026-11-22");
  assert.equal(parseDate("5-3-2025", hoje), "2025-03-05");
  assert.equal(parseDate("2026-02-28", hoje), "2026-02-28");
  for (const t of ["31/02", "32/01", "00/10", "ontem à noite", "2026-13-01", ""]) assert.equal(parseDate(t, hoje), null, t);
  assert.equal(parseDate("29/02/2028", hoje), "2028-02-29"); // bissexto
  assert.equal(parseDate("29/02/2027", hoje), null);
});

test("shiftDate atravessa mês e ano", () => {
  assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
});

const meses = [
  { id: 1, year: 2026, month: 10, base: 1500, status: "aberto" },
  { id: 2, year: 2026, month: 11, base: 0, status: "aberto" },
  { id: 3, year: 2026, month: 12, base: 0, status: "fechado" },
];
test("mês alvo: o primeiro aberto sem vencimento; senão o seguinte ao último; senão o de hoje", () => {
  assert.equal(targetMonth(meses, "2026-11-23").existing?.id, 2);
  const cheio = meses.map((m) => ({ ...m, base: 1000, status: "aberto" }));
  assert.deepEqual(targetMonth(cheio, "2026-11-23"), { existing: null, year: 2027, month: 1 });
  assert.deepEqual(targetMonth([], "2026-11-23"), { existing: null, year: 2026, month: 11 });
});

test("último mês aberto e mês de uma data", () => {
  assert.equal(latestOpenMonth(meses)?.id, 2);
  assert.equal(latestOpenMonth([{ ...meses[2] }]), null);
  assert.equal(monthOfDate(meses, "2026-10-15")?.id, 1);
  assert.equal(monthOfDate(meses, "2027-01-01"), null);
});
