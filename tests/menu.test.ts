// Menu: três destinos principais, o resto em "Mais", e "Plano do mês" some quando as funcionalidades estão desligadas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAIN_NAV, MORE_NAV, visibleNav, isNavActive } from "../client/src/lib/nav";
import { parseFeatures } from "../shared/features";

test("menu: destinos principais e Mais", () => {
  assert.deepEqual(MAIN_NAV.map((n) => n.label), ["Início", "Plano do mês", "Meses"]);
  assert.deepEqual(MORE_NAV.map((n) => n.label), ["Organizar", "Despesas", "Carteira", "Orçamento", "Definições", "Ajuda e documentação"]);
  const hrefs = [...MAIN_NAV, ...MORE_NAV].map((n) => n.href);
  assert.equal(new Set(hrefs).size, hrefs.length, "nenhum destino repetido");
});

test("menu: Plano do mês está sempre à vista, porque também guarda as Parcelas e o Fecho", () => {
  const tem = (json: string) => visibleNav(MAIN_NAV, parseFeatures(json)).some((n) => n.label === "Plano do mês");
  assert.equal(tem("{}"), true);
  assert.equal(tem('{"divisao":false,"movimentos":false}'), true);
});

test("menu: itens ligados às funcionalidades de Mais", () => {
  const f = parseFeatures('{"plataformas":false}');
  const nomes = visibleNav(MORE_NAV, f).map((n) => n.label);
  assert.ok(!nomes.includes("Carteira"));
  assert.ok(nomes.includes("Despesas"));
});

test("menu: item ativo", () => {
  assert.equal(isNavActive("/", "/"), true);
  assert.equal(isNavActive("/", "/meses"), false);
  assert.equal(isNavActive("/meses", "/meses/x"), true);
});
