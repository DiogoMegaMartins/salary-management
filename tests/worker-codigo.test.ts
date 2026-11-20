// Código de acesso no Worker da Cloudflare: o segredo ACCESS_CODE compara-se em texto (sem scrypt).
import { test } from "node:test";
import assert from "node:assert/strict";
import { secretCode, publicSettings, verifyCode } from "../server/access";

function com(env: Record<string, string | undefined>, fn: () => void) {
  const antes = { c: process.env.ACCESS_CODE, f: process.env.ACCESS_CODE_FROM_SECRET };
  for (const [k, v] of Object.entries(env)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  try { fn(); } finally {
    antes.c === undefined ? delete process.env.ACCESS_CODE : (process.env.ACCESS_CODE = antes.c);
    antes.f === undefined ? delete process.env.ACCESS_CODE_FROM_SECRET : (process.env.ACCESS_CODE_FROM_SECRET = antes.f);
  }
}

test("secretCode só vale com ACCESS_CODE_FROM_SECRET=1 e um código com 8+ caracteres", () => {
  com({ ACCESS_CODE: "codigo-longo-1", ACCESS_CODE_FROM_SECRET: undefined }, () => assert.equal(secretCode(), ""));
  com({ ACCESS_CODE: "curto", ACCESS_CODE_FROM_SECRET: "1" }, () => assert.equal(secretCode(), ""));
  com({ ACCESS_CODE: "  codigo-longo-1 ", ACCESS_CODE_FROM_SECRET: "1" }, () => assert.equal(secretCode(), "codigo-longo-1"));
});

test("com o segredo, o estado público marca o código como definido e a comparação é em texto", () => {
  com({ ACCESS_CODE: "codigo-longo-1", ACCESS_CODE_FROM_SECRET: "1" }, () => {
    assert.equal(publicSettings({ accessCode: "" }).accessCode, "set");
    assert.equal(verifyCode(secretCode(), "codigo-longo-1"), true);
    assert.equal(verifyCode(secretCode(), "codigo-errado-1"), false);
  });
  com({ ACCESS_CODE: undefined, ACCESS_CODE_FROM_SECRET: undefined }, () => assert.equal(publicSettings({ accessCode: "" }).accessCode, ""));
});
