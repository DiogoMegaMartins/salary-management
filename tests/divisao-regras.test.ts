import { test } from "node:test";
import assert from "node:assert/strict";
import { divisionStatus, splitLeftover, shareOf } from "../shared/division";

test("estado da divisão: livre, completo (±1 cêntimo) e excede", () => {
  assert.deepEqual(divisionStatus(1000, 800), { status: "livre", remaining: 200 });
  assert.equal(divisionStatus(1000, 1000).status, "completo");
  assert.equal(divisionStatus(1000, 999.996).status, "completo");
  assert.deepEqual(divisionStatus(1000, 1100), { status: "excede", remaining: -100 });
});

test("repartir o que sobra: a soma é exata e é proporcional", () => {
  const r = splitLeftover(10000, [{ id: 1, value: 600 }, { id: 2, value: 300 }, { id: 3, value: 100 }])!;
  assert.deepEqual(r, { 1: 6000, 2: 3000, 3: 1000 });
  const t = splitLeftover(100, [{ id: 1, value: 1 }, { id: 2, value: 1 }, { id: 3, value: 1 }])!;
  assert.equal(Object.values(t).reduce((a, b) => a + b, 0), 100); // 34 + 33 + 33
});

test("repartir o que sobra: sem sobra ou sem partes com valor não há repartição", () => {
  assert.equal(splitLeftover(0, [{ id: 1, value: 5 }]), null);
  assert.equal(splitLeftover(500, [{ id: 1, value: 0 }]), null);
  assert.equal(splitLeftover(-5, [{ id: 1, value: 5 }]), null);
});

test("percentagem de uma parcela: uma casa decimal e 0 sem disponível", () => {
  assert.equal(shareOf(600, 1255), 47.8);
  assert.equal(shareOf(100, 0), 0);
});

import { planLeftover } from "../shared/division";

const partes = [
  { id: 1, name: "A", amount: 600, fixed: true },
  { id: 2, name: "B", amount: 300, fixed: true },
  { id: 3, name: "C", amount: 100, fixed: false },
];
test("planear o que sobra: tudo para uma parcela (a escolhida ou a primeira)", () => {
  assert.deepEqual(planLeftover("uma", 100, partes, 2), [{ id: 2, amount: 400 }]);
  assert.deepEqual(planLeftover("uma", 100, partes), [{ id: 1, amount: 700 }]);
});
test("planear o que sobra: proporcional só pelas parcelas em € fixo, com soma exata", () => {
  const c = planLeftover("proporcional", 90, partes);
  assert.deepEqual(c, [{ id: 1, amount: 660 }, { id: 2, amount: 330 }]);
  assert.equal(c.reduce((a, x, i) => a + x.amount - partes[i].amount, 0), 90);
});
test("planear o que sobra: sem sobra ou sem parcelas em € fixo não há alterações", () => {
  assert.deepEqual(planLeftover("uma", 0, partes), []);
  assert.deepEqual(planLeftover("proporcional", 50, [{ id: 3, name: "C", amount: 100, fixed: false }]), []);
  assert.deepEqual(planLeftover("uma", 50, []), []);
});
