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
