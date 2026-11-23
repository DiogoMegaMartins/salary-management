import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAiRequest, parseAiReply, AI_MODELS } from "../shared/ai-intent";

const hoje = "2026-11-23";

test("o pedido leva só a frase, a data de hoje e as categorias, e o modelo escolhido", () => {
  const r = buildAiRequest("gastei 40 no supermercado ontem", hoje, ["Supermercado", "Transportes"], "haiku");
  assert.equal(r.model, AI_MODELS.haiku);
  const texto = JSON.stringify(r.messages);
  assert.match(texto, /gastei 40 no supermercado ontem/);
  assert.match(texto, /2026-11-23/);
  assert.match(texto, /Supermercado; Transportes/);
  assert.equal(buildAiRequest("x", hoje, [], "sonnet").model, AI_MODELS.sonnet);
  assert.ok(r.max_tokens <= 200);
});

test("resposta válida: despesa com valor, categoria e data", () => {
  const i = parseAiReply('{"task":"despesa","amount":40,"category":"Supermercado","date":"2026-11-22"}', hoje);
  assert.deepEqual(i, { task: "despesa", amount: 40, category: "Supermercado", date: "2026-11-22" });
});

test("resposta com texto à volta e campos nulos", () => {
  const i = parseAiReply('Claro! {"task":"resumo","amount":null,"category":null,"date":null} Espero ter ajudado.', hoje);
  assert.deepEqual(i, { task: "resumo" });
});

test("campos inválidos são deitados fora (valor negativo, data impossível, categoria enorme)", () => {
  const i = parseAiReply(JSON.stringify({ task: "despesa", amount: -5, category: "x".repeat(80), date: "2026-02-31" }), hoje);
  assert.deepEqual(i, { task: "despesa" });
  assert.deepEqual(parseAiReply('{"task":"despesa","amount":"40"}', hoje), { task: "despesa" }); // texto não é valor
  assert.equal(parseAiReply('{"task":"despesa","amount":1e12}', hoje).amount, undefined);
});

test("lixo, tarefa desconhecida ou instruções na resposta dão 'desconhecido'", () => {
  for (const t of ["", "não percebi", "{", '{"task":"apagar tudo"}', '{"task":"despesa"', "null", '["mes"]']) assert.deepEqual(parseAiReply(t, hoje), { task: "desconhecido" }, t);
});

test("arredonda o valor em cêntimos", () => {
  assert.equal(parseAiReply('{"task":"mes","amount":1450.456}', hoje).amount, 1450.46);
});
