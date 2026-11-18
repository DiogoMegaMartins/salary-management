// Ritmo das metas, comparação com o ano anterior e despesas fora do padrão (funções puras).
import { test } from "node:test";
import assert from "node:assert/strict";
import { goalPace, parseYearMonth, yearOverYear, categoryYearOverYear, spendAnomalies, expenseByCategory } from "../shared/calc";

const now = { year: 2026, month: 6 };

test("goalPace: estados sem objetivo, atingida e sem prazo", () => {
  assert.equal(goalPace({ targetAmount: null, targetDate: "2027-01", accumulated: 0, pacePerMonth: 10, now }).status, "sem_objetivo");
  assert.equal(goalPace({ targetAmount: 1000, targetDate: "2027-01", accumulated: 1000, pacePerMonth: 0, now }).status, "atingida");
  const sp = goalPace({ targetAmount: 1000, targetDate: null, accumulated: 400, pacePerMonth: 100, now });
  assert.equal(sp.status, "sem_prazo");
  assert.equal(sp.monthsNeeded, 6);
  assert.equal(sp.projectedMonth, "2026-12");
});

test("goalPace: no ritmo, atrasada, sem ritmo e prazo passado", () => {
  // faltam 600; ritmo 100/mês → 6 meses; prazo 2026-12 está a 6 meses de 2026-06
  const ok = goalPace({ targetAmount: 1000, targetDate: "2026-12", accumulated: 400, pacePerMonth: 100, now });
  assert.equal(ok.status, "no_ritmo");
  assert.equal(ok.monthsToDeadline, 6);
  assert.equal(ok.requiredMonthly, 100);
  // ritmo 50/mês → 12 meses; prazo a 6 → atraso de 6
  const late = goalPace({ targetAmount: 1000, targetDate: "2026-12", accumulated: 400, pacePerMonth: 50, now });
  assert.equal(late.status, "atrasada");
  assert.equal(late.delayMonths, 6);
  assert.equal(late.projectedMonth, "2027-06");
  assert.equal(goalPace({ targetAmount: 1000, targetDate: "2026-12", accumulated: 400, pacePerMonth: 0, now }).status, "sem_ritmo");
  const past = goalPace({ targetAmount: 1000, targetDate: "2026-03", accumulated: 400, pacePerMonth: 100, now });
  assert.equal(past.status, "prazo_passado");
  assert.equal(past.monthsToDeadline, -3);
});

test("goalPace: prazo no próprio mês e datas AAAA-MM-DD", () => {
  const same = goalPace({ targetAmount: 1000, targetDate: "2026-06-30", accumulated: 950, pacePerMonth: 100, now });
  assert.equal(same.monthsToDeadline, 0);
  assert.equal(same.status, "atrasada"); // 1 mês necessário, 0 disponíveis
  assert.equal(same.requiredMonthly, 50);
  assert.deepEqual(parseYearMonth("2027-02-10"), { year: 2027, month: 2 });
  assert.equal(parseYearMonth("2027-13"), null);
  assert.equal(parseYearMonth(""), null);
});

// ---- dados sintéticos para os testes de comparação e anomalias
const mk = (id: number, year: number, month: number) => ({ id, year, month, label: `${month}/${year}` }) as any;
const comp = (net: number, gastos: number, poupanca: number, investimento: number, available: number) =>
  ({ net, available, byKind: { gastos, poupanca, investimento } }) as any;
const tx = (id: number, monthId: number, value: number, category: string, type = "expense") => ({ id, monthId, value, category, type }) as any;

test("yearOverYear: só compara meses com par e calcula variações", () => {
  const allMonths = [mk(1, 2025, 5), mk(2, 2025, 6), mk(3, 2026, 5), mk(4, 2026, 6), mk(5, 2026, 7)];
  const allComputed = [comp(1000, 400, 100, 100, 800), comp(1000, 500, 100, 0, 800), comp(1100, 440, 150, 50, 900), comp(1000, 500, 200, 0, 900), comp(1000, 300, 0, 0, 900)];
  const months = [allMonths[2], allMonths[3], allMonths[4]]; // jul/2026 não tem par
  const computed = [allComputed[2], allComputed[3], allComputed[4]];
  const y = yearOverYear(months, computed, allMonths, allComputed)!;
  assert.equal(y.pairs.length, 2);
  assert.equal(y.current.net, 2100);
  assert.equal(y.previous.net, 2000);
  assert.equal(Math.round(y.delta.net! * 1000) / 1000, 0.05);
  assert.equal(y.current.spent, 940);
  assert.equal(y.previous.spent, 900);
  assert.equal(y.current.saved, 400);
  assert.equal(y.previous.saved, 300);
  assert.ok(Math.abs(y.savingsRateDeltaPP - (400 / 1800 - 300 / 1600)) < 1e-9);
});

test("yearOverYear: sem par devolve null; base zero dá variação nula", () => {
  const allMonths = [mk(1, 2026, 1), mk(2, 2026, 2)];
  const allComputed = [comp(1000, 0, 0, 0, 800), comp(1000, 0, 0, 0, 800)];
  assert.equal(yearOverYear(allMonths, allComputed, allMonths, allComputed), null);
  const m2 = [mk(1, 2025, 1), mk(2, 2026, 1)];
  const c2 = [comp(0, 0, 0, 0, 0), comp(500, 100, 0, 0, 500)];
  const y = yearOverYear([m2[1]], [c2[1]], m2, c2)!;
  assert.equal(y.delta.net, null);
});

test("categoryYearOverYear: ordena pelo maior desvio e ignora tipos que não são despesa", () => {
  const months = [mk(1, 2025, 6), mk(2, 2026, 6)];
  const computed = [comp(1, 0, 0, 0, 1), comp(1, 0, 0, 0, 1)];
  const txs = [tx(1, 1, 100, "Casa"), tx(2, 2, 150, "casa "), tx(3, 1, 50, "Lazer"), tx(4, 2, 20, "Lazer"), tx(5, 2, 999, "Casa", "contribution")];
  const y = yearOverYear([months[1]], [computed[1]], months, computed)!;
  const rows = categoryYearOverYear(txs, y);
  assert.deepEqual(rows.map((r) => [r.name.toLowerCase(), r.current, r.previous, r.delta]), [["casa", 150, 100, 50], ["lazer", 20, 50, -30]]);
  assert.equal(rows[0].delta, 50);
  assert.equal(Math.round(rows[1].deltaPct! * 100), -60);
});

test("spendAnomalies: marca gasto muito acima do habitual e ignora ruído", () => {
  const months = [1, 2, 3, 4, 5].map((i) => mk(i, 2026, i));
  const base = [1, 2, 3, 4].flatMap((m) => [tx(m * 10, m, 100, "Casa"), tx(m * 10 + 1, m, 40 + (m % 2) * 4, "Lazer")]);
  const txs = [...base, tx(100, 5, 400, "Casa"), tx(101, 5, 44, "Lazer"), tx(102, 5, 15, "Café")];
  const a = spendAnomalies(txs, months, 5);
  assert.equal(a.length, 1);
  assert.equal(a[0].category, "Casa");
  assert.equal(a[0].kind, "acima_do_habitual");
  assert.equal(a[0].current, 400);
  assert.equal(a[0].mean, 100);
  assert.equal(a[0].excess, 300);
  assert.equal(a[0].baselineMonths, 4);
});

test("spendAnomalies: sem histórico suficiente não há alertas; categoria nova só acima do dobro do mínimo", () => {
  const months = [1, 2, 3, 4].map((i) => mk(i, 2026, i));
  const few = [tx(1, 1, 100, "Casa"), tx(2, 2, 100, "Casa"), tx(3, 3, 900, "Casa")];
  assert.deepEqual(spendAnomalies(few, months, 3), []); // só 2 meses anteriores
  const hist = [tx(1, 1, 10, "Casa"), tx(2, 2, 10, "Casa"), tx(3, 3, 10, "Casa")];
  const novo = spendAnomalies([...hist, tx(4, 4, 45, "Viagem"), tx(5, 4, 30, "Livros")], months, 4);
  assert.deepEqual(novo.map((x) => [x.category, x.kind]), [["Viagem", "novo"]]); // 30 < 2×20
  assert.equal(spendAnomalies(hist, months, 999).length, 0);
});

test("expenseByCategory: junta maiúsculas/minúsculas e usa 'Sem categoria'", () => {
  const m = expenseByCategory([tx(1, 1, 1.1, "Casa"), tx(2, 1, 2.2, " casa"), tx(3, 1, 5, ""), tx(4, 2, 9, "Casa")], new Set([1]));
  assert.equal(m.get("casa")!.total, 3.3);
  assert.equal(m.get("sem categoria")!.total, 5);
  assert.equal(m.size, 2);
});
