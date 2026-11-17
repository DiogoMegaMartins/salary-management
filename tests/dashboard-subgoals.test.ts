import { test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardSubgoals, formatGoalMoney } from "../client/src/components/dashboard-subgoals";
import { goalBreakdown, type GoalCtx } from "../shared/calc";

function breakdown(target: number | null, balance: number, currency = "EUR") {
  const ctx: GoalCtx = {
    monthly: [{ key: 1, amount: 100 }],
    entries: [{ id: 1, parcelId: 1, subgoalId: 7, kind: "inicial", amount: balance, currency, date: "2026-01-01" }],
    subgoals: [{ id: 7, parcelId: 1, name: "Viagem", currency, target }],
    links: [], rates: [], transactions: [], refCurrency: "EUR",
  };
  return goalBreakdown(ctx, 1);
}
const render = (target: number | null, balance: number, currency = "EUR") =>
  renderToStaticMarkup(React.createElement(DashboardSubgoals, { subs: breakdown(target, balance, currency).subs }));

test("dashboard: shows balance, target, exact remaining cents and percentage", () => {
  const html = render(1000, 250.25);
  for (const text of ["Viagem", "Acumulado", "Objetivo", "250,25", new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, useGrouping: "always" }).format(1000), "Faltam 749,75", "25%", 'role="progressbar"']) {
    assert.ok(html.includes(text), text);
  }
});

test("dashboard: reached and exceeded targets never show a negative remaining amount", () => {
  for (const balance of [1000, 1200]) {
    const html = render(1000, balance);
    assert.ok(html.includes("Objetivo atingido"));
    assert.ok(html.includes("100%"));
    assert.ok(!html.includes("Faltam"));
  }
});

test("dashboard: absent or zero target keeps balance without progress", () => {
  for (const target of [null, 0]) {
    const html = render(target, 12.34);
    assert.ok(html.includes("12,34"));
    assert.ok(html.includes("Sem objetivo definido"));
    assert.ok(!html.includes("progressbar"));
    assert.ok(!html.includes("%"));
  }
});

test("dashboard: negative balance keeps its value and clamps only the bar", () => {
  const html = render(100, -25);
  assert.ok(html.includes("-25,00"));
  assert.ok(html.includes("Faltam 125,00"));
  assert.ok(html.includes("0%"));
});

test("dashboard: foreign currency works without a rate; parent remains incomplete", () => {
  const br = breakdown(1000, 250, "USD");
  assert.equal(br.total, 100);
  assert.equal(br.incomplete, true);
  assert.equal(br.subs[0].balance, 250);
  assert.ok(render(1000, 250, "USD").includes(formatGoalMoney(250, "USD")));
});

test("dashboard: uses shared totals once and emits nothing for no subgoals", () => {
  assert.equal(breakdown(1000, 250).total, 350);
  assert.equal(renderToStaticMarkup(React.createElement(DashboardSubgoals, { subs: [] })), "");
});

test("euros: milhares sempre agrupados, também com 4 dígitos", async () => {
  const { fmtEur } = await import("../shared/calc");
  assert.match(fmtEur(4850), /^4\s850,00\s€$/);
  assert.match(fmtEur(10375), /^10\s375,00\s€$/);
  assert.match(fmtEur(999.5), /^999,50\s€$/);
  assert.match(fmtEur(-1234.5), /^-1\s234,50\s€$/);
});
