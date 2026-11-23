// Assistente com IA: desligado por defeito, limite diário, privacidade do pedido e erros (serviço simulado, sem chave real).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";

const dir = mkdtempSync(join(tmpdir(), "sm-test-ia-"));
process.chdir(dir);
delete process.env.ANTHROPIC_API_KEY;
const express = (await import("express")).default;
const { registerRoutes } = await import("../server/routes");
const { storage } = await import("../server/storage");
const { setAiFetch } = await import("../server/ai");
const app = express();
(await import("../server/middleware")).installBase(app);
const server = createServer(app);
await registerRoutes(server, app);
await new Promise<void>((r) => server.listen(0, r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
test.after(() => server.close());
const call = async (method: string, path: string, body?: unknown) => {
  const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", "x-sm-client": "1" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json };
};

storage.createCategory({ name: "Supermercado" } as any);
const KEY = "chave-falsa-de-teste-123";
let pedidos: any[] = [];
let resposta: any = { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: '{"task":"despesa","amount":40,"category":"Supermercado","date":"2026-11-22"}' }] }) };
setAiFetch(async (url, init) => { pedidos.push({ url, init }); return resposta; });

test("sem chave: não está configurada, nem pedidos se aceitam", async () => {
  const st = await call("GET", "/api/assistant/ai-status");
  assert.equal(st.json.configured, false);
  assert.equal(st.json.enabled, false);
  const r = await call("POST", "/api/assistant/parse", { sentence: "gastei 40" });
  assert.equal(r.status, 503);
  assert.equal(pedidos.length, 0);
});

test("com chave mas a opção desligada (por defeito): continua desativada", async () => {
  process.env.ANTHROPIC_API_KEY = KEY;
  const st = await call("GET", "/api/assistant/ai-status");
  assert.equal(st.json.configured, true);
  assert.equal(st.json.enabled, false);
  assert.equal((await call("POST", "/api/assistant/parse", { sentence: "gastei 40" })).status, 503);
  assert.equal(pedidos.length, 0);
});

test("ligada: traduz a frase; o pedido leva só frase, data e categorias; a chave não volta ao cliente", async () => {
  await call("PATCH", "/api/settings", { aiEnabled: true });
  const r = await call("POST", "/api/assistant/parse", { sentence: "gastei 40 no supermercado ontem", today: "2026-11-23" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.intent, { task: "despesa", amount: 40, category: "Supermercado", date: "2026-11-22" });
  assert.equal(r.json.remaining, 49);
  assert.equal(JSON.stringify(r.json).includes(KEY), false);
  const p = pedidos[0];
  assert.equal(p.url, "https://api.anthropic.com/v1/messages");
  assert.equal(p.init.headers["x-api-key"], KEY);
  const corpo = JSON.parse(p.init.body);
  assert.equal(corpo.model, "claude-haiku-5-5");
  const enviado = JSON.stringify(corpo.messages);
  assert.match(enviado, /gastei 40 no supermercado ontem/);
  assert.match(enviado, /Supermercado/);
  // nada de dados financeiros: nem vencimentos, nem saldos, nem parcelas
  for (const proibido of ["Gastos Mensais", "Poupanças", "1250", "base"]) assert.equal(enviado.includes(proibido) || JSON.stringify(corpo.system).includes(proibido), false, proibido);
});

test("o modelo escolhido nas definições vai no pedido", async () => {
  await call("PATCH", "/api/settings", { aiModel: "sonnet" });
  await call("POST", "/api/assistant/parse", { sentence: "como estou" });
  assert.equal(JSON.parse(pedidos[pedidos.length - 1].init.body).model, "claude-sonnet-5-5");
  await call("PATCH", "/api/settings", { aiModel: "haiku" });
  assert.equal((await call("PATCH", "/api/settings", { aiModel: "gpt" })).status, 400);
});

test("frases inválidas: vazia ou com mais de 300 letras", async () => {
  const antes = pedidos.length;
  assert.equal((await call("POST", "/api/assistant/parse", { sentence: "   " })).status, 400);
  assert.equal((await call("POST", "/api/assistant/parse", { sentence: "a".repeat(301) })).status, 400);
  assert.equal((await call("POST", "/api/assistant/parse", {})).status, 400);
  assert.equal(pedidos.length, antes);
});

test("erro do serviço: 502 genérico, sem detalhes nem chave", async () => {
  resposta = { ok: false, status: 401, json: async () => ({ error: { message: `chave inválida ${KEY}` } }) };
  const r = await call("POST", "/api/assistant/parse", { sentence: "gastei 5" });
  assert.equal(r.status, 502);
  assert.equal(JSON.stringify(r.json).includes(KEY), false);
  assert.equal(JSON.stringify(r.json).includes("401"), false);
});

test("resposta do modelo que não é JSON dá 'desconhecido'", async () => {
  resposta = { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "Não percebi, desculpa." }] }) };
  const r = await call("POST", "/api/assistant/parse", { sentence: "blá blá" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.intent, { task: "desconhecido" });
});

test("limite diário: ao 51.º pedido responde 429 e não chama o serviço", async () => {
  const usados = (await call("GET", "/api/assistant/ai-status")).json.used;
  resposta = { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: '{"task":"resumo"}' }] }) };
  for (let i = usados; i < 50; i++) assert.equal((await call("POST", "/api/assistant/parse", { sentence: "como estou" })).status, 200);
  const antes = pedidos.length;
  const r = await call("POST", "/api/assistant/parse", { sentence: "como estou" });
  assert.equal(r.status, 429);
  assert.match(r.json.message, /50 pedidos/);
  assert.equal(pedidos.length, antes);
  const st = await call("GET", "/api/assistant/ai-status");
  assert.equal(st.json.used, 50);
});
