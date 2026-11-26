// Modo Básico / Detalhado nas páginas: o que cada modo mostra em Orçamento, Carteira e Definições.
import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleSections, visibleSettingsTabs } from "../shared/ui-mode";

const secs = (ids: string[]) => ids.map((id) => ({ id }));

test("modo: o Detalhado mostra todas as secções, na mesma ordem", () => {
  const todas = secs(["orc-projecao", "orc-reserva", "orc-categorias", "orc-ano-anterior"]);
  assert.deepEqual(visibleSections("orcamento", todas, "detalhado"), todas);
});

test("modo: o Básico do Orçamento mostra só o orçamento por categoria", () => {
  const r = visibleSections("orcamento", secs(["orc-projecao", "orc-reserva", "orc-categorias", "orc-ano-anterior"]), "basico");
  assert.deepEqual(r.map((s) => s.id), ["orc-categorias"]);
});

test("modo: o Básico da Carteira mostra só o valor atual por parcela", () => {
  const r = visibleSections("carteira", secs(["kpi-total", "evolucao-acumulado", "por-ano-parcela", "valor-carteira", "exposicao-plataforma"]), "basico");
  assert.deepEqual(r.map((s) => s.id), ["valor-carteira"]);
});

test("modo: se a secção do Básico não existir, não fica uma página vazia por engano", () => {
  const r = visibleSections("carteira", secs(["kpi-total", "evolucao-acumulado"]), "basico");
  assert.deepEqual(r, [], "sem a secção, nada para mostrar (a página mostra o seu aviso vazio)");
});

test("modo: separadores das Definições", () => {
  const todos = ["calculo", "funcionalidades", "aparencia", "catalogos", "backups", "seguranca", "historico"];
  assert.deepEqual(visibleSettingsTabs(todos, "detalhado"), todos);
  assert.deepEqual(visibleSettingsTabs(todos, "basico"), ["funcionalidades", "aparencia", "backups", "seguranca"]);
});
