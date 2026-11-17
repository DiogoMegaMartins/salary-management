// EVO-04 — saldos iniciais, ajustes, submetas e conversão manual. Base de dados temporária.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.chdir(mkdtempSync(join(tmpdir(), "sm-test4-")));
const { storage } = await import("../server/storage");
const { goalBreakdown, convertAmount, monthKeyOf } = await import("../shared/calc");

const status = (fn: () => unknown, s: number) => assert.throws(fn, (e: any) => e.status === s);
const st = () => storage.getState();
const base = { entries: [] as any[], subgoals: [] as any[], links: [] as any[], rates: [] as any[], transactions: [] as any[], refCurrency: "EUR" };
const monthly = [
  { key: monthKeyOf(2026, 1), amount: 100 },
  { key: monthKeyOf(2026, 2), amount: 100 },
  { key: monthKeyOf(2026, 3), amount: 100 },
];
const entry = (o: any) => ({ id: Math.random(), parcelId: 1, subgoalId: null, currency: "EUR", ...o });

test("sem saldo inicial o acumulado é o histórico atual (saldos preservados)", () => {
  const b = goalBreakdown({ ...base, monthly }, 1);
  assert.equal(b.total, 300);
  assert.equal(b.hasOpening, false);
});

test("T11 saldo inicial com corte inclusivo: meses anteriores não são somados outra vez", () => {
  const b = goalBreakdown({ ...base, monthly, entries: [entry({ kind: "inicial", amount: 1000, date: "2026-02-01" })] }, 1);
  assert.equal(b.flows, 200); // fev + mar
  assert.equal(b.total, 1200);
});

test("aceitação: 1000 + contribuições 300 − levantamentos 100 = 1200; corrigir para 1250 = ajuste +50", () => {
  const txs = [
    { id: 1, parcelId: 1, type: "contribution", date: "2026-03-10", value: 300 },
    { id: 2, parcelId: 1, type: "withdrawal", date: "2026-03-20", value: 100 },
    { id: 3, parcelId: 1, type: "contribution", date: "2025-12-31", value: 999 }, // antes do corte: já no saldo inicial
  ];
  const ctx = { ...base, monthly: [], transactions: txs, entries: [entry({ kind: "inicial", amount: 1000, date: "2026-01-01" })] };
  assert.equal(goalBreakdown(ctx, 1).total, 1200);
  const adj = 1250 - goalBreakdown(ctx, 1).total;
  assert.equal(adj, 50);
  const after = goalBreakdown({ ...ctx, entries: [...ctx.entries, entry({ kind: "ajuste", amount: adj, date: "2026-04-01" })] }, 1);
  assert.equal(after.total, 1250);
  assert.equal(after.adjustments, 50);
});

test("T10/T28 atribuição a submetas: sem dupla contagem e limite pelo valor do movimento", () => {
  const txs = [{ id: 1, parcelId: 1, type: "contribution", date: "2026-03-10", value: 300 }];
  const subs = [{ id: 7, parcelId: 1, name: "A", currency: "EUR", target: 400 }];
  const ctx = {
    ...base, monthly: [], transactions: txs, subgoals: subs,
    entries: [entry({ kind: "inicial", amount: 1000, date: "2026-01-01" })],
    links: [{ transactionId: 1, subgoalId: 7, amount: 120 }],
  };
  const b = goalBreakdown(ctx, 1);
  assert.equal(b.total, 1300); // 1000 + 300 (uma vez)
  assert.equal(b.subs[0].balance, 120);
  assert.equal(b.unallocated, 1180);
  assert.equal(b.subs[0].remaining, 280);
  assert.equal(Math.round((b.subs[0].progress ?? 0) * 100), 30);
});

test("T13/T14 EUR e USD: sem taxa o total é assinalado incompleto; com taxa manual converte", () => {
  const subs = [
    { id: 1, parcelId: 1, name: "E", currency: "EUR", target: null },
    { id: 2, parcelId: 1, name: "U", currency: "USD", target: null },
  ];
  const entries = [entry({ kind: "inicial", amount: 100, date: "2026-01-01", subgoalId: 1 }), entry({ kind: "inicial", amount: 100, date: "2026-01-01", subgoalId: 2, currency: "USD" })];
  const no = goalBreakdown({ ...base, monthly: [], subgoals: subs, entries }, 1);
  assert.equal(no.incomplete, true);
  assert.deepEqual(no.missing, ["USD→EUR"]);
  assert.equal(no.total, 100); // USD não é somado como se fosse EUR
  const withRate = goalBreakdown({ ...base, monthly: [], subgoals: subs, entries, rates: [{ fromCurrency: "USD", toCurrency: "EUR", rate: 0.9, date: "2026-02-01" }] }, 1);
  assert.equal(withRate.incomplete, false);
  assert.equal(withRate.total, 190);
  assert.equal(convertAmount(90, "EUR", "USD", [{ fromCurrency: "USD", toCurrency: "EUR", rate: 0.9, date: "2026-02-01" }]), 100); // taxa inversa
});

// ---------------- persistência e validações
test("servidor: saldo inicial único por meta, ajustes rastreáveis, validações", () => {
  const p = st().parcels[0];
  storage.createGoalEntry({ parcelId: p.id, kind: "inicial", amount: 500, date: "2026-01-01" });
  storage.createGoalEntry({ parcelId: p.id, kind: "inicial", amount: 600, date: "2026-01-01" });
  assert.equal(st().goalEntries.filter((e) => e.kind === "inicial").length, 1);
  storage.createGoalEntry({ parcelId: p.id, kind: "ajuste", amount: -25, date: "2026-02-01", note: "taxa" });
  status(() => storage.createGoalEntry({ parcelId: p.id, kind: "ajuste", amount: 0, date: "2026-02-01" }), 400);
  status(() => storage.createGoalEntry({ parcelId: p.id, kind: "inicial", amount: -1, date: "2026-01-01" }), 400);
  status(() => storage.createGoalEntry({ parcelId: p.id, kind: "ajuste", amount: 5, date: "01/02/2026" }), 400);
  assert.equal(st().goalEntries.length, 2);
});

test("servidor: submetas (nome único, moeda, plataforma) e remoção bloqueada com histórico", () => {
  const p = st().parcels[0];
  const sg = storage.createSubgoal({ parcelId: p.id, name: "Férias", currency: "usd", target: 1000 });
  assert.equal(sg.currency, "USD");
  status(() => storage.createSubgoal({ parcelId: p.id, name: " férias " }), 409);
  status(() => storage.createSubgoal({ parcelId: p.id, name: "Z", currency: "EURO" }), 400);
  status(() => storage.createSubgoal({ parcelId: p.id, name: "Z", platformId: 9999 }), 400);
  storage.createGoalEntry({ parcelId: p.id, subgoalId: sg.id, kind: "inicial", amount: 50, date: "2026-01-01" });
  assert.equal(st().goalEntries.find((e) => e.subgoalId === sg.id)!.currency, "USD");
  status(() => storage.updateSubgoal(sg.id, { currency: "EUR" }), 409);
  status(() => storage.deleteSubgoal(sg.id), 409); // T27
  const free = storage.createSubgoal({ parcelId: p.id, name: "Livre" });
  storage.deleteSubgoal(free.id);
});

test("T28 repartir movimento acima do disponível é bloqueado; apagar o movimento limpa atribuições", () => {
  const p = st().parcels[0];
  const m = st().months[0];
  const sg = storage.createSubgoal({ parcelId: p.id, name: "Carro" });
  const tx = storage.createTransaction({ monthId: m.id, date: "2026-03-05", type: "contribution", value: 200, parcelId: p.id } as any);
  storage.createContributionLink({ transactionId: tx.id, subgoalId: sg.id, amount: 150 });
  status(() => storage.createContributionLink({ transactionId: tx.id, subgoalId: sg.id, amount: 60 }), 409);
  storage.createContributionLink({ transactionId: tx.id, subgoalId: sg.id, amount: 50 });
  status(() => storage.createContributionLink({ transactionId: tx.id, subgoalId: sg.id, amount: 0 }), 400);
  const expense = storage.createTransaction({ monthId: m.id, date: "2026-03-05", type: "expense", value: 10, parcelId: p.id } as any);
  status(() => storage.createContributionLink({ transactionId: expense.id, subgoalId: sg.id, amount: 5 }), 400);
  storage.deleteTransaction(tx.id);
  assert.ok(!st().contributionLinks.some((l) => l.transactionId === tx.id));
});

test("taxas manuais: positivas e com moedas válidas", () => {
  status(() => storage.createFxRate({ fromCurrency: "USD", toCurrency: "EUR", rate: 0, date: "2026-01-01" }), 400);
  status(() => storage.createFxRate({ fromCurrency: "USD", toCurrency: "USD", rate: 1, date: "2026-01-01" }), 400);
  const r = storage.createFxRate({ fromCurrency: "usd", toCurrency: "eur", rate: 0.92, date: "2026-01-01" });
  assert.equal(r.source, "manual");
});

test("T24/T25 backup preserva tudo e restauro antigo funciona; apagar meta limpa submetas", () => {
  const snap = JSON.parse(JSON.stringify(st()));
  storage.replaceAll(snap);
  for (const k of ["subgoals", "goalEntries", "fxRates"] as const) assert.equal(st()[k].length, snap[k].length, k);
  storage.replaceAll({ ...snap, subgoals: undefined, goalEntries: undefined, contributionLinks: undefined, fxRates: undefined });
  assert.equal(st().subgoals.length, 0);
  storage.replaceAll(snap);
  const pid = st().parcels[0].id;
  for (const tx of st().transactions.filter((x) => x.parcelId === pid || x.targetParcelId === pid)) storage.deleteTransaction(tx.id);
  storage.deleteParcel(pid);
  assert.ok(!st().subgoals.some((s) => s.parcelId === pid));
  assert.ok(!st().goalEntries.some((e) => e.parcelId === pid));
});

test("editar submeta: nome único, objetivo, plataforma e prazo; moeda bloqueada com saldos", () => {
  const p = st().parcels[1];
  const a = storage.createSubgoal({ parcelId: p.id, name: "Editar A", target: 100 });
  const b = storage.createSubgoal({ parcelId: p.id, name: "Editar B" });
  const plat = storage.createPlatform({ name: "Plat Edit" });
  const up = storage.updateSubgoal(a.id, { name: "Editar A2", target: 250, platformId: plat.id, deadline: "2027-06" });
  assert.equal(up.name, "Editar A2");
  assert.equal(up.target, 250);
  assert.equal(up.platformId, plat.id);
  status(() => storage.updateSubgoal(b.id, { name: " editar a2 " }), 409); // nome duplicado normalizado
  assert.equal(storage.updateSubgoal(a.id, { target: null }).target, null);
  assert.equal(storage.updateSubgoal(a.id, { name: "Editar A2" }).name, "Editar A2"); // mesmo nome na própria submeta
  status(() => storage.updateSubgoal(99999, { name: "x" }), 404);
});

test("total da meta soma saldo inicial, ajustes e submetas (fonte única do Painel)", () => {
  const ctx = { ...base, monthly: [{ key: monthKeyOf(2026, 1), amount: 400 }],
    subgoals: [{ id: 1, parcelId: 1, name: "S", currency: "EUR", target: null }],
    entries: [entry({ kind: "ajuste", amount: 600, date: "2026-02-01", subgoalId: 1 }), entry({ kind: "ajuste", amount: 50, date: "2026-02-01" })] };
  const b = goalBreakdown(ctx as any, 1);
  assert.equal(b.total, 1050); // 400 histórico + 50 ajuste + 600 submeta
});
