// Organizar: listas de categorias e plataformas, pesquisa e validação de nomes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryRows, parcelRows, platformRows, filterRows, checkName, usesText } from "../shared/organizar";

test("organizar: conta os movimentos de cada categoria, sem diferenças de maiúsculas ou espaços", () => {
  const rows = categoryRows([{ id: 1, name: "Casa", active: 1 }, { id: 2, name: "Café", active: 0 }], [{ category: "casa " }, { category: "CASA" }, { category: "Outra" }]);
  assert.deepEqual(rows, [{ id: 1, name: "Casa", archived: false, uses: 2 }, { id: 2, name: "Café", archived: true, uses: 0 }]);
});

test("organizar: conta as parcelas de cada plataforma", () => {
  const rows = platformRows([{ id: 1, name: "Banco", archived: 0 }, { id: 2, name: "Corretora", archived: 1 }], [{ platformId: 1 }, { platformId: 1 }]);
  assert.deepEqual(rows.map((r) => [r.uses, r.archived]), [[2, false], [0, true]]);
});

test("organizar: a pesquisa ignora acentos e maiúsculas; arquivadas só se pedidas e vão para o fim", () => {
  const rows = [{ id: 1, name: "Saúde", archived: false, uses: 0 }, { id: 2, name: "Alimentação", archived: true, uses: 0 }, { id: 3, name: "Casa", archived: false, uses: 0 }];
  assert.deepEqual(filterRows(rows, "", false).map((r) => r.name), ["Casa", "Saúde"]);
  assert.deepEqual(filterRows(rows, "saude", false).map((r) => r.name), ["Saúde"]);
  assert.deepEqual(filterRows(rows, "", true).map((r) => r.name), ["Casa", "Saúde", "Alimentação"]);
  assert.deepEqual(filterRows(rows, "ALIMENTACAO", false), []);
});

test("organizar: validação do nome", () => {
  const rows = [{ id: 1, name: "Casa", archived: false, uses: 0 }, { id: 2, name: "Café", archived: true, uses: 0 }];
  assert.deepEqual(checkName("  Lazer  extra ", rows), { ok: true, name: "Lazer extra" });
  assert.equal(checkName("   ", rows).ok, false);
  assert.equal(checkName("x".repeat(61), rows).ok, false);
  const dup = checkName("casa", rows);
  assert.equal(dup.ok, false);
  const arq = checkName("CAFÉ", rows);
  assert.ok(!arq.ok && /arquivada/.test(arq.error));
  assert.deepEqual(checkName("Casa", rows, 1), { ok: true, name: "Casa" }, "renomear para o mesmo nome não é duplicado");
});

test("organizar: texto de uso", () => {
  assert.equal(usesText(0, "movimento", "movimentos"), "sem uso");
  assert.equal(usesText(1, "movimento", "movimentos"), "1 movimento");
  assert.equal(usesText(12, "movimento", "movimentos"), "12 movimentos");
});

test("organizar: uma parcela conta movimentos (origem ou destino), recorrências e reservas", () => {
  const rows = parcelRows(
    [{ id: 1, name: "Férias", archived: 0 }, { id: 2, name: "Antiga", archived: 1 }],
    [{ parcelId: 1 }, { parcelId: 3, targetParcelId: 1 }, { parcelId: 3 }],
    [{ parcelId: 1 }],
    [{ parcelId: 1 }],
  );
  assert.deepEqual(rows, [{ id: 1, name: "Férias", archived: false, uses: 4 }, { id: 2, name: "Antiga", archived: true, uses: 0 }]);
});

import { filterMovements, selectionSummary, NO_CATEGORY } from "../shared/organizar";
const mov = (id: number, over: any = {}) => ({ id, monthId: 1, date: "2026-03-10", type: "expense", value: 10, parcelId: 1, targetParcelId: null, category: "Casa", note: "", ...over });

test("organizar: filtrar movimentos por mês, categoria, parcela, tipo e pesquisa; mais recentes primeiro", () => {
  const txs = [
    mov(1, { date: "2026-03-01", note: "Café da manhã" }),
    mov(2, { date: "2026-03-09", category: "", value: 7.5 }),
    mov(3, { monthId: 2, date: "2026-04-02", category: "casa ", parcelId: 2 }),
    mov(4, { type: "transfer", parcelId: 1, targetParcelId: 2, category: "" }),
  ];
  const todos = { monthId: null, category: "", parcelId: null, type: "", search: "" };
  assert.deepEqual(filterMovements(txs, todos).map((t) => t.id), [3, 4, 2, 1]);
  assert.deepEqual(filterMovements(txs, { ...todos, monthId: 1 }).map((t) => t.id), [4, 2, 1]);
  assert.deepEqual(filterMovements(txs, { ...todos, category: "CASA" }).map((t) => t.id), [3, 1]);
  assert.deepEqual(filterMovements(txs, { ...todos, category: NO_CATEGORY }).map((t) => t.id), [4, 2]);
  assert.deepEqual(filterMovements(txs, { ...todos, parcelId: 2 }).map((t) => t.id), [3, 4]);
  assert.deepEqual(filterMovements(txs, { ...todos, type: "transfer" }).map((t) => t.id), [4]);
  assert.deepEqual(filterMovements(txs, { ...todos, search: "cafe" }).map((t) => t.id), [1]);
  assert.deepEqual(filterMovements(txs, { ...todos, search: "7,5" }).map((t) => t.id), [2]);
});

test("organizar: resumo dos movimentos escolhidos", () => {
  const txs = [mov(1, { value: 10.1 }), mov(2, { value: 20.2 }), mov(3, { type: "contribution", value: 5 }), mov(4, { value: 99 })];
  assert.deepEqual(selectionSummary(txs, new Set([1, 2, 3])), { count: 3, out: 30.3, into: 5 });
  assert.deepEqual(selectionSummary(txs, new Set()), { count: 0, out: 0, into: 0 });
});
