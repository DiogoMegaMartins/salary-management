// F5: um só arredondamento. 2 parcelas a 50 % de 1000,01 € dão 500,005 € cada: a soma é 1000,01 €, sem défice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { allocatedTotal, computeMonth, toCents } from "../shared/calc";
import { divisionStatus } from "../shared/division";
import { checkConsistency, round2, monthRemainder } from "../shared/evo08";

const aloc = (id: number, parcelId: number, mode: string, value: number) => ({ id, monthId: 1, parcelId, mode, value }) as any;

test("total alocado: arredonda a soma uma só vez (2 × 50 % de 1000,01 = 1000,01)", () => {
  const al = [aloc(1, 1, "percentagem", 50), aloc(2, 2, "percentagem", 50)];
  assert.equal(allocatedTotal(al, 1000.01), 1000.01);
  assert.equal(allocatedTotal([aloc(1, 1, "fixo", 10.1), aloc(2, 2, "fixo", 20.2)], 0), 30.3);
});

test("o fecho e a verificação concordam: sem défice de 0,01 € nem erro «dist_excede»", () => {
  const al = [aloc(1, 1, "percentagem", 50), aloc(2, 2, "percentagem", 50)];
  const allocated = allocatedTotal(al, 1000.01);
  assert.equal(monthRemainder(1000.01, 0, allocated, []), 0);
  assert.equal(divisionStatus(1000.01, allocated).status, "completo");
  const issues = checkConsistency({
    months: [{ id: 1, label: "M", year: 2030, month: 1 }], parcels: [{ id: 1, name: "A" }, { id: 2, name: "B" }],
    allocations: al, transactions: [], allocationPlatforms: [], allocationAssets: [], platforms: [], subgoals: [], goalEntries: [], availableByMonth: { 1: 1000.01 },
  } as any);
  assert.equal(issues.some((i) => i.code === "dist_excede"), false);
});

test("o estado da divisão e o resto usam os mesmos cêntimos", () => {
  assert.equal(divisionStatus(100, 99.995).remaining, 0.01 * 0 + (toCents(100) - toCents(99.995)) / 100);
  assert.equal(divisionStatus(100.005, 100.005).status, "completo");
  assert.equal(divisionStatus(100, 100.01).status, "excede");
});

test("arredondar um valor em euros: meio cêntimo sobe sempre, como no resto do cálculo", () => {
  assert.equal(round2(2.135), 2.14);
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(-2.135), -2.13);
});
