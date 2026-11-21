// O limite de tentativas sobrevive a reinícios (o Worker descarta o objeto quando está inativo).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.chdir(mkdtempSync(join(tmpdir(), "sm-lim-")));
const { makeLimiter, setLimiterStore } = await import("../server/access");
const { sqliteLimiterStore } = await import("../server/limiter-store");

test("com o armazenamento na base de dados, um limitador novo vê as falhas do anterior", () => {
  setLimiterStore(sqliteLimiterStore);
  const antes = makeLimiter(3, 60_000, "teste");
  antes.fail("1.2.3.4");
  antes.fail("1.2.3.4");
  antes.fail("1.2.3.4");
  assert.ok(antes.retryAfterSeconds("1.2.3.4") > 0);
  // "reinício": novo limitador, mesma base de dados
  const depois = makeLimiter(3, 60_000, "teste");
  assert.ok(depois.retryAfterSeconds("1.2.3.4") > 0);
  assert.equal(depois.retryAfterSeconds("5.6.7.8"), 0);
  depois.reset("1.2.3.4");
  assert.equal(makeLimiter(3, 60_000, "teste").retryAfterSeconds("1.2.3.4"), 0);
});

test("as âncoras (scopes) são independentes e a janela expira", async () => {
  setLimiterStore(sqliteLimiterStore);
  const a = makeLimiter(1, 30, "a");
  const b = makeLimiter(1, 30, "b");
  a.fail("x");
  assert.ok(a.retryAfterSeconds("x") > 0);
  assert.equal(b.retryAfterSeconds("x"), 0);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(a.retryAfterSeconds("x"), 0);
});
