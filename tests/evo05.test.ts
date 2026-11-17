// EVO-05 — despesas por mês e dia. Base de dados temporária.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.chdir(mkdtempSync(join(tmpdir(), "sm-test5-")));
const { storage } = await import("../server/storage");
const { expenseView, UNCLASSIFIED, despesasExtraOf } = await import("../shared/calc");

const status = (fn: () => unknown, s: number) => assert.throws(fn, (e: any) => e.status === s);
const st = () => storage.getState();
const ms = () => [...st().months].sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));
const mk = (monthId: number, date: string, over: any = {}) =>
  storage.createTransaction({ monthId, date, type: "expense", value: 10, category: "", note: "", ...over } as any);

test("agrupa por dia, totais diários e do mês excluem transferências e aportes", () => {
  const m = ms()[0];
  const y = `${m.year}-${String(m.month).padStart(2, "0")}`;
  const pid = st().parcels[0].id;
  mk(m.id, `${y}-05`, { value: 12.1, category: "Comida", note: "Café" });
  mk(m.id, `${y}-05`, { value: 0.2, category: "Comida", note: "Pão" });
  mk(m.id, `${y}-07`, { value: 30, note: "sem categoria" });
  mk(m.id, `${y}-07`, { value: 100, type: "transfer", parcelId: pid, targetParcelId: st().parcels[1].id });
  mk(m.id, `${y}-08`, { value: 50, type: "contribution", parcelId: pid });
  const v = expenseView(st().transactions, m.id);
  assert.equal(v.monthTotal, 42.3);
  assert.deepEqual(v.days.map((d) => d.date), [`${y}-07`, `${y}-05`]); // mais recente primeiro
  assert.equal(v.days[1].total, 12.3);
  assert.equal(v.excludedTransfers, 1);
  assert.equal(v.unclassifiedCount, 1);
  // coincide com o total usado nos Meses
  assert.equal(v.monthTotal, despesasExtraOf(st().transactions.filter((t) => t.monthId === m.id)));
});

test("filtros por categoria, sem categoria, parcela e pesquisa", () => {
  const m = ms()[0];
  const all = st().transactions;
  assert.equal(expenseView(all, m.id, { categoryKey: "Comida" }).filteredTotal, 12.3);
  assert.equal(expenseView(all, m.id, { categoryKey: UNCLASSIFIED }).filteredTotal, 30);
  assert.equal(expenseView(all, m.id, { search: "CAFÉ" }).filteredCount, 1);
  assert.equal(expenseView(all, m.id, { parcelIds: [] }).filteredCount, 0);
});

test("editar a data move o registo para o mês correto; mês inexistente é recusado", () => {
  const [a, b] = ms();
  const ya = `${a.year}-${String(a.month).padStart(2, "0")}`;
  const yb = `${b.year}-${String(b.month).padStart(2, "0")}`;
  const t = mk(a.id, `${ya}-10`, { value: 77, note: "mover" });
  const moved = storage.updateTransaction(t.id, { date: `${yb}-03` });
  assert.equal(moved.monthId, b.id);
  assert.equal(st().transactions.filter((x) => x.id === t.id).length, 1); // uma única vez nos dados
  assert.ok(expenseView(st().transactions, b.id).days.some((d) => d.date === `${yb}-03`));
  status(() => storage.updateTransaction(t.id, { date: "1999-01-15" }), 409);
  assert.equal(st().transactions.find((x) => x.id === t.id)!.date, `${yb}-03`); // nada mudou
});

test("validações: valor > 0, data real, parcela existente; sem efeito de fuso", () => {
  const m = ms()[0];
  const y = `${m.year}-${String(m.month).padStart(2, "0")}`;
  status(() => mk(m.id, `${y}-10`, { value: 0 }), 400);
  status(() => mk(m.id, "2026-1-5"), 400);
  status(() => mk(m.id, "2026-02-30"), 400);
  status(() => mk(m.id, `${y}-10`, { parcelId: 99999 }), 400);
  const edge = mk(m.id, `${y}-01`, { note: "limite" });
  assert.equal(edge.date, `${y}-01`);
  for (const tz of ["Pacific/Kiritimati", "America/Los_Angeles"]) {
    process.env.TZ = tz;
    assert.equal(expenseView(st().transactions, m.id).days.some((d) => d.date === `${y}-01`), true, tz);
  }
});

test("editar valor altera o total do mês; apagar remove", () => {
  const m = ms()[0];
  const before = expenseView(st().transactions, m.id).monthTotal;
  const t = st().transactions.find((x) => x.monthId === m.id && x.type === "expense")!;
  storage.updateTransaction(t.id, { value: t.value + 5 });
  assert.equal(Math.round((expenseView(st().transactions, m.id).monthTotal - before) * 100), 500);
  storage.deleteTransaction(t.id);
  assert.ok(!st().transactions.some((x) => x.id === t.id));
});
