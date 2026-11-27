// Cabeçalhos de confiança e segredo curto: fechar em vez de abrir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
process.chdir(mkdtempSync(join(tmpdir(), "sm-acc-")));
const express = (await import("express")).default;
const { registerRoutes } = await import("../server/routes");
const { installBase } = await import("../server/middleware");

async function arranque(env: Record<string, string | undefined>) {
  const antes: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) { antes[k] = process.env[k]; v === undefined ? delete process.env[k] : (process.env[k] = v); }
  const app = express();
  installBase(app);
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const fim = () => { server.close(); for (const [k, v] of Object.entries(antes)) v === undefined ? delete process.env[k] : (process.env[k] = v); };
  return { app, base, fim };
}

test("sem TRUST_PROXY, X-Forwarded-For forjado não escapa ao limite por IP", async () => {
  const { app, base, fim } = await arranque({ NODE_ENV: "production", TRUST_PROXY: undefined, ACCESS_CODE: "codigo-certo-123", ACCESS_CODE_FROM_SECRET: undefined });
  try {
    assert.equal(app.get("trust proxy"), false);
    let limitado = false;
    for (let i = 0; i < 12; i++) {
      const r = await fetch(`${base}/api/state`, { headers: { "x-codigo-acesso": `errado-${i}-xxxx`, "x-forwarded-for": `10.0.0.${i}` } });
      if (r.status === 429) limitado = true;
    }
    assert.ok(limitado, "o limite por IP tem de travar mesmo com X-Forwarded-For diferentes");
  } finally { fim(); }
});

test("com TRUST_PROXY=1 o proxy continua a ser respeitado", async () => {
  const { app, fim } = await arranque({ TRUST_PROXY: "1", ACCESS_CODE: undefined });
  try { assert.equal(app.get("trust proxy"), 1); } finally { fim(); }
});

test("Worker: um segredo ACCESS_CODE curto recusa a API (503) em vez de a deixar aberta", async () => {
  const { base, fim } = await arranque({ ACCESS_CODE_FROM_SECRET: "1", ACCESS_CODE: "abc1234", TRUST_PROXY: undefined });
  try {
    const r = await fetch(`${base}/api/state`, { headers: { "x-sm-client": "1" } });
    assert.equal(r.status, 503);
    assert.match((await r.json()).message, /ACCESS_CODE/);
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
  } finally { fim(); }
});
