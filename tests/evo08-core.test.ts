import { test } from "node:test";
import assert from "node:assert/strict";
import { sumEuros, round2, executionOfMonth, checkConsistency, monthRemainder, nextMonthKey, occurrenceFor, pendingOccurrences, suggestedContribution, monthsLeft, simulateGoal, parseAmount, parseDatePT, parseCsv, validateCsvRows, fingerprint, daysInMonth } from "../shared/evo08";
import { goalBreakdown, monthKeyOf } from "../shared/calc";

test("precisão: somas em cêntimos evitam deriva de vírgula flutuante", () => {
  assert.equal(0.1 + 0.2 === 0.3, false);
  assert.equal(sumEuros([0.1, 0.2]), 0.3);
  assert.equal(round2(1.005), 1.01);
  assert.equal(sumEuros(Array(10).fill(0.1)), 1);
});

const tx = (o: any) => ({ id: 1, monthId: 1, date: "2026-03-05", type: "expense", value: 10, parcelId: 1, targetParcelId: null, category: "x", ...o });

test("planeado/alocado/executado: transferências e aportes não são despesas", () => {
  const al = [{ id: 1, monthId: 1, parcelId: 1, mode: "fixo", value: 500 }, { id: 2, monthId: 1, parcelId: 2, mode: "fixo", value: 300 }];
  const v = executionOfMonth(1000, al, [tx({ value: 120 }), tx({ id: 2, type: "transfer", value: 200, parcelId: 1, targetParcelId: 2 }), tx({ id: 3, type: "contribution", value: 50, parcelId: 2 })], new Set([1]));
  assert.equal(v.planeado, 800);
  assert.equal(v.executado, 120);
  assert.equal(v.transferenciasInternas, 200);
  assert.equal(v.alocado, 850);
  assert.equal(v.porExecutar, 380); // 500 - 120, só parcela de gastos
});

test("por executar nunca é negativo (despesa acima do planeado)", () => {
  const v = executionOfMonth(1000, [{ id: 1, monthId: 1, parcelId: 1, mode: "fixo", value: 100 }], [tx({ value: 250 })], new Set([1]));
  assert.equal(v.porExecutar, 0);
});

const base: any = { months: [{ id: 1, year: 2026, month: 3 }], parcels: [{ id: 1, name: "A" }, { id: 2, name: "B" }], allocations: [], transactions: [], allocationPlatforms: [], allocationAssets: [], platforms: [{ id: 1 }], subgoals: [], goalEntries: [], availableByMonth: { 1: 1000 } };
const codes = (d: any) => checkConsistency(d).map((i) => `${i.severity}:${i.code}`);

test("verificação: distribuição acima do disponível e percentagens inválidas são erros", () => {
  const c = codes({ ...base, allocations: [{ id: 1, monthId: 1, parcelId: 1, mode: "fixo", value: 800 }, { id: 2, monthId: 1, parcelId: 2, mode: "fixo", value: 300 }] });
  assert.ok(c.includes("erro:dist_excede"));
  const p = codes({ ...base, allocations: [{ id: 1, monthId: 1, parcelId: 1, mode: "percentagem", value: 70 }, { id: 2, monthId: 1, parcelId: 2, mode: "percentagem", value: 40 }] });
  assert.ok(p.includes("erro:pct_excede"));
  assert.ok(codes({ ...base, allocations: [{ id: 1, monthId: 1, parcelId: 1, mode: "percentagem", value: 150 }] }).includes("erro:pct_invalida"));
});

test("verificação: por distribuir e duplicados são avisos; referências inválidas são erros", () => {
  const c = codes({ ...base, allocations: [{ id: 1, monthId: 1, parcelId: 1, mode: "fixo", value: 400 }], transactions: [tx({}), tx({ id: 2 }), tx({ id: 3, parcelId: 99, date: "2026-03-06" })] });
  assert.ok(c.includes("aviso:por_distribuir"));
  assert.ok(c.includes("aviso:duplicado"));
  assert.ok(c.includes("erro:ref_parcela"));
  assert.deepEqual(codes({ ...base, allocations: [{ id: 1, monthId: 1, parcelId: 1, mode: "fixo", value: 1000 }] }), []);
});

test("verificação não altera os dados recebidos", () => {
  const d = { ...base, allocations: [{ id: 1, monthId: 1, parcelId: 1, mode: "fixo", value: 5000 }] };
  const snap = JSON.stringify(d);
  checkConsistency(d);
  assert.equal(JSON.stringify(d), snap);
});

test("restante do mês: transporte recebido não conta como rendimento", () => {
  const r = monthRemainder(1000, 200, 700, [tx({ value: 100 })]);
  assert.equal(r, 400); // 1000 + 200 - 100 - 700
  assert.equal(monthRemainder(1000, 0, 700, [tx({ value: 100 })]), 200);
});

test("transporte entre meses passa de dezembro para janeiro do ano seguinte", () => {
  assert.deepEqual(nextMonthKey(2026, 12), { year: 2027, month: 1 });
  assert.deepEqual(nextMonthKey(2026, 5), { year: 2026, month: 6 });
});

const rec = { id: 7, name: "Renda", value: 400, category: "Casa", parcelId: 1, dayOfMonth: 31, startMonth: "2026-01", endMonth: "2026-12", active: true };

test("recorrências: dia 31 ajusta-se a meses curtos e a anos bissextos", () => {
  assert.equal(occurrenceFor(rec, 2026, 2)!.date, "2026-02-28");
  assert.equal(occurrenceFor({ ...rec, startMonth: "2024-01", endMonth: null }, 2024, 2)!.date, "2024-02-29");
  assert.equal(occurrenceFor(rec, 2026, 4)!.date, "2026-04-30");
  assert.equal(occurrenceFor(rec, 2027, 1), null); // depois do fim
  assert.equal(occurrenceFor(rec, 2025, 12), null); // antes do início
  assert.equal(daysInMonth(2026, 2), 28);
});

test("recorrências: ocorrência confirmada ou ignorada não volta a ficar pendente", () => {
  const months = [{ year: 2026, month: 2 }, { year: 2026, month: 3 }, { year: 2026, month: 4 }];
  assert.equal(pendingOccurrences([rec], months, new Set(), new Set()).length, 3);
  const p = pendingOccurrences([rec], months, new Set(["7:2026-02"]), new Set(["7:2026-04"]));
  assert.deepEqual(p.map((x) => x.key), ["7:2026-03"]);
});

test("reservas: sugestão considera o já reservado e o prazo restante", () => {
  assert.equal(monthsLeft("2026-12", "2026-07"), 6);
  const s = suggestedContribution({ target: 600, reserved: 150, dueMonth: "2026-12", status: "ativa" }, "2026-07");
  assert.equal(s.missing, 450);
  assert.equal(s.perMonth, 75);
  const o = suggestedContribution({ target: 600, reserved: 100, dueMonth: "2026-01", status: "ativa" }, "2026-07");
  assert.equal(o.overdue, true);
  assert.equal(suggestedContribution({ target: 100, reserved: 100, dueMonth: "2026-12", status: "ativa" }, "2026-07").perMonth, 0);
  assert.equal(suggestedContribution({ target: 100, reserved: 0, dueMonth: "2026-09", status: "ativa" }, "2026-07").perMonth, 33.34); // arredonda para cima ao cêntimo
});

test("simulador: contribuição, reforço, pausa e prazo, sem rentabilidade", () => {
  const a = simulateGoal({ current: 0, target: 1000, monthlyContribution: 100 });
  assert.equal(a.monthsToReach, 10);
  const b = simulateGoal({ current: 0, target: 1000, monthlyContribution: 100, extra: [{ atMonth: 2, amount: 300 }] });
  assert.equal(b.monthsToReach, 7);
  const c = simulateGoal({ current: 0, target: 1000, monthlyContribution: 100, pause: { from: 3, months: 2 } });
  assert.equal(c.monthsToReach, 12);
  const d = simulateGoal({ current: 200, target: 1000, monthlyContribution: 50, deadlineMonths: 6 });
  assert.equal(d.finalAtDeadline, 500);
  assert.equal(d.shortfallAtDeadline, 500);
  assert.equal(d.requiredMonthly, 133.34); // ceil(80000/6) cêntimos
  assert.ok(d.reason);
  assert.ok(d.assumptions.some((x) => /rentabilidade/.test(x)));
});

test("simulador: meta inatingível sem contribuição; já atingida; não altera entrada", () => {
  const e = simulateGoal({ current: 0, target: 100, monthlyContribution: 0 });
  assert.equal(e.reachable, false);
  assert.ok(e.reason);
  assert.equal(simulateGoal({ current: 100, target: 100, monthlyContribution: 0 }).monthsToReach, 0);
  const input = { current: 5, target: 50, monthlyContribution: 5 };
  const snap = JSON.stringify(input);
  simulateGoal(input);
  assert.equal(JSON.stringify(input), snap);
});

test("CSV: montantes em formato PT e internacional", () => {
  assert.equal(parseAmount("1.234,56"), 1234.56);
  assert.equal(parseAmount("-12,50 €"), -12.5);
  assert.equal(parseAmount("1234.56"), 1234.56);
  assert.equal(parseAmount("1,234.56"), 1234.56);
  assert.equal(parseAmount("(45,00)"), -45);
  assert.equal(parseAmount("12,5"), 12.5);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount(""), null);
});

test("CSV: datas PT e ISO, com validação de dias", () => {
  assert.equal(parseDatePT("05/03/2026"), "2026-03-05");
  assert.equal(parseDatePT("2026-03-05"), "2026-03-05");
  assert.equal(parseDatePT("5-3-2026"), "2026-03-05");
  assert.equal(parseDatePT("31/02/2026"), null);
  assert.equal(parseDatePT("29/02/2024"), "2024-02-29");
  assert.equal(parseDatePT("29/02/2026"), null);
  assert.equal(parseDatePT("xx"), null);
});

test("CSV: separador ; com aspas, BOM e linhas vazias", () => {
  const { delimiter, rows } = parseCsv('\uFEFFData;Montante;Nota\n05/03/2026;-12,50;"Café; bolo"\n\n06/03/2026;-3,00;"diz ""olá"""\n');
  assert.equal(delimiter, ";");
  assert.equal(rows.length, 3);
  assert.equal(rows[1][2], "Café; bolo");
  assert.equal(rows[2][2], 'diz "olá"');
});

test("CSV: erros por linha e duplicados (no ficheiro e existentes)", () => {
  const { rows } = parseCsv("Data;Montante;Categoria\n05/03/2026;-10,00;Café\n05/03/2026;-10,00;Café\n99/99/2026;-5;X\n06/03/2026;abc;X\n07/03/2026;20,00;X\n08/03/2026;-7,00;Mercado");
  const r = validateCsvRows(rows, { date: 0, amount: 1, category: 2 }, [{ date: "2026-03-08", value: 7, category: "Mercado" }], { hasHeader: true });
  assert.equal(r[0].ok, true);
  assert.equal(r[1].duplicate, "ficheiro");
  assert.equal(r[2].ok, false);
  assert.match(r[2].errors[0], /Data inválida/);
  assert.match(r[3].errors[0], /Montante inválido/);
  assert.equal(r[4].ok, false); // positivo
  assert.equal(r[5].duplicate, "existente");
  assert.equal(r[2].line, 4);
});

test("impressão digital: igual para o mesmo conteúdo, diferente para outro", () => {
  assert.equal(fingerprint("a;b\n1;2"), fingerprint("a;b\r\n1;2\n"));
  assert.notEqual(fingerprint("a;b\n1;2"), fingerprint("a;b\n1;3"));
});

test("sem dupla contagem: saldo inicial, ajustes (+/-) e submetas somam uma só vez", () => {
  const mk = (entries: any[]) => ({ monthly: [{ key: monthKeyOf(2026, 1), amount: 100 }, { key: monthKeyOf(2026, 2), amount: 100 }], entries, subgoals: [{ id: 1, parcelId: 1, name: "S", currency: "EUR", target: null }], links: [], rates: [], transactions: [], refCurrency: "EUR" } as any);
  const adj = (id: number, amount: number, subgoalId: number | null) => ({ id, parcelId: 1, subgoalId, kind: "ajuste", amount, date: "2026-02-01" });
  assert.equal(goalBreakdown(mk([adj(1, -30, null), adj(2, 50, 1)]), 1).total, 220); // 200 - 30 + 50
  // com saldo inicial em fevereiro: janeiro (já incluído) não volta a contar
  const open = { id: 9, parcelId: 1, subgoalId: null, kind: "inicial", amount: 500, date: "2026-02-01" };
  assert.equal(goalBreakdown(mk([open, adj(1, 20, null)]), 1).total, 620); // 500 + 100 (fev) + 20
});

import { composeTotal } from "../shared/evo08";
test("composição: as linhas somam o acumulado (check = 0) e o fluxo do período é separado", () => {
  const ctx: any = { monthly: [{ key: monthKeyOf(2026, 1), amount: 100.1 }, { key: monthKeyOf(2026, 2), amount: 100.2 }], entries: [{ id: 1, parcelId: 1, subgoalId: null, kind: "inicial", amount: 500.05, date: "2026-01-01" }, { id: 2, parcelId: 1, subgoalId: null, kind: "ajuste", amount: -20.15, date: "2026-02-10" }, { id: 3, parcelId: 1, subgoalId: 1, kind: "ajuste", amount: 40, date: "2026-02-10" }], subgoals: [{ id: 1, parcelId: 1, name: "Viagem", currency: "EUR", target: null }], links: [], rates: [], transactions: [], refCurrency: "EUR" };
  const b = goalBreakdown(ctx, 1);
  const c = composeTotal(b, [{ label: "01/2026", amount: 100.1 }, { label: "02/2026", amount: 100.2 }], new Set(["02/2026"]), ctx.entries, []);
  assert.equal(c.check, 0);
  assert.equal(c.accumulated, 720.2); // 500,05 + 100,10 + 100,20 - 20,15 + 40
  assert.equal(c.periodFlow, 100.2); // movimentos do período != acumulado
  assert.ok(c.lines.some((l) => l.kind === "submetas" && l.amount === 40));
  assert.ok(c.lines.find((l) => l.kind === "ajustes")!.sources.length === 1);
});
