import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
process.chdir(mkdtempSync(join(tmpdir(), "sm-sec-")));
const express = (await import("express")).default;
const { storage } = await import("../server/storage");
const { registerRoutes } = await import("../server/routes");
const { installBase } = await import("../server/middleware");
const { isHashed, verifyCode } = await import("../server/access");
const app = express();
installBase(app);
const server = createServer(app);
await registerRoutes(server, app);
await new Promise<void>((r) => server.listen(0, r));
test.after(() => server.close());
const base = `http://127.0.0.1:${(server.address() as any).port}`;
let code = "";
const call = async (method: string, path: string, body?: any, opts: { client?: boolean; code?: string; raw?: string; ctype?: string } = {}) => {
  const headers: Record<string, string> = { "Content-Type": opts.ctype ?? "application/json" };
  if (opts.client !== false) headers["x-sm-client"] = "1";
  const c = opts.code ?? code;
  if (c) headers["x-codigo-acesso"] = c;
  const r = await fetch(base + path, { method, headers, body: opts.raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  const text = await r.text();
  let json: any; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json, text };
};

test("mutações exigem o cabeçalho de cliente (anti-CSRF) e não aceitam formulários", async () => {
  assert.equal((await call("PATCH", "/api/settings", { backupReminderDays: 10 }, { client: false })).status, 403);
  assert.equal((await call("POST", "/api/months", "year=2098&month=1&label=x", { ctype: "application/x-www-form-urlencoded", raw: "year=2098&month=1&label=x", client: false })).status, 403);
  assert.equal((await call("PATCH", "/api/settings", { backupReminderDays: 10 })).status, 200);
});

test("definições: valida tipos, recusa campos desconhecidos e layouts inválidos", async () => {
  for (const bad of [{ id: 9 }, { defaultTaxaSs: null }, { defaultTaxaSs: "x" }, { pageLayouts: "null" }, { pageLayouts: "[1]" }, { features: "null" }, { features: "[1]" }, { features: '{"nada":false}' }, { features: '{"parcelas":"não"}' }, { features: 5 }, { backupReminderDays: 0 }, { accessCode: "abc" }, { emergencyParcelIds: "1;drop" }])
    assert.equal((await call("PATCH", "/api/settings", bad)).status, 400, JSON.stringify(bad));
  assert.equal((await call("PATCH", "/api/settings", { includeMeal: true })).json.includeMeal, 1);
  assert.equal((await call("PATCH", "/api/settings", { features: '{"parcelas":false}' })).json.features, '{"parcelas":false}');
  assert.equal((await call("PATCH", "/api/settings", { features: "{}" })).json.features, "{}");
});

test("código de acesso: guardado com hash, nunca devolvido, nem no estado nem no backup", async () => {
  const set = await call("PATCH", "/api/settings", { accessCode: "segredo-forte-1" });
  assert.equal(set.status, 200);
  assert.equal(set.json.accessCode, "set");
  code = "segredo-forte-1";
  const stored = storage.getAccessCode();
  assert.ok(isHashed(stored) && !stored.includes("segredo"));
  assert.ok(verifyCode(stored, "segredo-forte-1") && !verifyCode(stored, "outro"));
  const state = await call("GET", "/api/state");
  assert.equal(state.json.settings.accessCode, "set");
  assert.ok(!state.text.includes("segredo-forte-1") && !state.text.includes("scrypt$"));
  const exp = await call("GET", "/api/export/json");
  assert.equal(exp.status, 200);
  assert.ok(!exp.text.includes("segredo-forte-1") && !exp.text.includes("scrypt$"));
  assert.equal((await call("GET", "/api/state", undefined, { code: "" })).status, 401);
});

test("importar um backup não altera nem remove o código de acesso", async () => {
  const exp = (await call("GET", "/api/export/json")).json;
  exp.settings.accessCode = "";
  const imp = await call("POST", "/api/import", exp);
  assert.equal(imp.status, 200);
  assert.ok(storage.getAccessCode().length > 0);
  assert.equal((await call("GET", "/api/state")).status, 200);
});

test("backups grandes (>100 kB) são aceites na importação, mas não noutras rotas", async () => {
  const exp = (await call("GET", "/api/export/json")).json;
  const m = exp.months[0], p = exp.parcels[0];
  exp.transactions = Array.from({ length: 2000 }, (_, i) => ({ id: i + 1, monthId: m.id, date: `${m.year}-${String(m.month).padStart(2, "0")}-10`, type: "expense", value: 1.5, parcelId: p.id, targetParcelId: null, category: "x", note: "n".repeat(40), createdAt: "" }));
  assert.ok(JSON.stringify(exp).length > 200_000);
  assert.equal((await call("POST", "/api/import/preview", exp)).status, 200);
  const huge = { note: "x".repeat(2_000_000) };
  assert.equal((await call("POST", "/api/transactions", huge)).status, 413);
});

test("mudar o código funciona com o código antigo; o novo passa a valer", async () => {
  assert.equal((await call("PATCH", "/api/settings", { accessCode: "outro-codigo-2" }, { code })).status, 200);
  assert.equal((await call("GET", "/api/state", undefined, { code })).status, 401);
  code = "outro-codigo-2";
  assert.equal((await call("GET", "/api/state")).status, 200);
});

test("tentativas erradas pelo cabeçalho são limitadas (429); o código certo já conhecido continua a passar", async () => {
  let blocked = 0;
  for (let i = 0; i < 8 && !blocked; i++) {
    const s = (await call("GET", "/api/state", undefined, { code: "errado" + i })).status;
    if (s === 429) blocked = i + 1; else assert.equal(s, 401);
  }
  assert.ok(blocked > 0 && blocked <= 6, "bloqueia ao fim de poucas tentativas");
  assert.equal((await call("GET", "/api/state", undefined, { code: "outro-errado" })).status, 429);
  // o dono (código já verificado antes) não fica trancado por tentativas alheias no mesmo IP
  assert.equal((await call("GET", "/api/state")).status, 200);
});

test("sem código, o corpo nem chega a ser lido: JSON inválido dá 401 e não 400", async () => {
  const r = await call("POST", "/api/import", undefined, { code: "", raw: "{isto não é json" });
  assert.equal(r.status, 401);
  const grande = await call("POST", "/api/import/preview", undefined, { code: "", raw: JSON.stringify({ x: "y".repeat(2_000_000) }) });
  assert.equal(grande.status, 401);
});

test("o limitador agrupa IPv6 por /64", async () => {
  const { ipKey } = await import("../server/access");
  assert.equal(ipKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd"), ipKey("2001:db8:1:2:1111:2222:3333:4444"));
  assert.notEqual(ipKey("2001:db8:1:3::1"), ipKey("2001:db8:1:2::1"));
  assert.equal(ipKey("203.0.113.7"), "203.0.113.7");
  assert.equal(ipKey("::ffff:203.0.113.7"), "::ffff:203.0.113.7");
});
