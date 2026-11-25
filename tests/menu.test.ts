// Menu: três destinos principais, o resto em "Mais", e "Dividir" some quando as funcionalidades estão desligadas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAIN_NAV, MORE_NAV, visibleNav, isNavActive } from "../client/src/lib/nav";
import { parseFeatures } from "../shared/features";

test("menu: destinos principais e Mais", () => {
  assert.deepEqual(MAIN_NAV.map((n) => n.label), ["Início", "Dividir", "Meses"]);
  assert.deepEqual(MORE_NAV.map((n) => n.label), ["Despesas", "Fecho e planeamento", "Parcelas e metas", "Carteira", "Orçamento", "Definições", "Ajuda e documentação"]);
  const hrefs = [...MAIN_NAV, ...MORE_NAV].map((n) => n.href);
  assert.equal(new Set(hrefs).size, hrefs.length, "nenhum destino repetido");
});

test("menu: Dividir desaparece só se divisão e movimentos estiverem desligados", () => {
  const tem = (json: string) => visibleNav(MAIN_NAV, parseFeatures(json)).some((n) => n.label === "Dividir");
  assert.equal(tem("{}"), true);
  assert.equal(tem('{"divisao":false}'), true);
  assert.equal(tem('{"movimentos":false}'), true);
  assert.equal(tem('{"divisao":false,"movimentos":false}'), false);
});

test("menu: itens ligados às funcionalidades de Mais", () => {
  const f = parseFeatures('{"parcelas":false,"plataformas":false}');
  const nomes = visibleNav(MORE_NAV, f).map((n) => n.label);
  assert.ok(!nomes.includes("Parcelas e metas"));
  assert.ok(!nomes.includes("Carteira"));
  assert.ok(nomes.includes("Despesas"));
});

test("menu: item ativo", () => {
  assert.equal(isNavActive("/", "/"), true);
  assert.equal(isNavActive("/", "/meses"), false);
  assert.equal(isNavActive("/meses", "/meses/x"), true);
});
