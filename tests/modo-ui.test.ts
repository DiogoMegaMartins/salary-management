// Modo Básico / Detalhado: valores, escolha na conta e migração (instalações novas começam no Básico, quem já usa fica no Detalhado).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import Database from "better-sqlite3";
import { UI_MODES, DEFAULT_UI_MODE, parseUiMode } from "../shared/ui-mode";

const raiz = resolve(import.meta.dirname, "..");
const dir = mkdtempSync(join(tmpdir(), "sm-test-modo-"));
process.chdir(dir);
const express = (await import("express")).default;
const { registerRoutes } = await import("../server/routes");
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

test("modo: valores válidos passam e lixo cai no Detalhado", () => {
  assert.deepEqual([...UI_MODES], ["basico", "detalhado"]);
  assert.equal(DEFAULT_UI_MODE, "detalhado");
  assert.equal(parseUiMode("basico"), "basico");
  for (const v of ["", "simples", undefined, null, 1]) assert.equal(parseUiMode(v), "detalhado", String(v));
});

test("modo: instalação nova começa no Básico", async () => {
  assert.equal((await call("GET", "/api/state")).json.settings.uiMode, "basico");
});

test("modo: guarda e recusa valores inválidos", async () => {
  assert.equal((await call("PATCH", "/api/settings", { uiMode: "detalhado" })).status, 200);
  assert.equal((await call("GET", "/api/state")).json.settings.uiMode, "detalhado");
  assert.equal((await call("PATCH", "/api/settings", { uiMode: "simples" })).status, 400);
  assert.equal((await call("GET", "/api/state")).json.settings.uiMode, "detalhado");
});

test("modo: bases antigas ficam no Detalhado (já usam a app) e as sem uso no Básico", () => {
  const abrir = (d: string) =>
    execFileSync(join(raiz, "node_modules/.bin/tsx"), ["-e", `import(${JSON.stringify(join(raiz, "server/storage.ts"))}).then(({ storage }) => console.log(storage.getState().settings.uiMode));`], {
      cwd: raiz, encoding: "utf8", env: { ...process.env, DATA_DIR: d, DB_PATH: join(d, "data.db") },
    }).trim().split("\n").pop();
  const d = mkdtempSync(join(tmpdir(), "sm-modo-antiga-"));
  abrir(d);
  const db = new Database(join(d, "data.db"));
  db.exec("UPDATE settings SET onboarding_done = 1"); // quem já usa a app
  db.exec("ALTER TABLE settings DROP COLUMN ui_mode");
  db.close();
  assert.equal(abrir(d), "detalhado");
  const n = mkdtempSync(join(tmpdir(), "sm-modo-nova-"));
  abrir(n);
  const db2 = new Database(join(n, "data.db"));
  db2.exec("UPDATE settings SET onboarding_done = 0");
  db2.exec("ALTER TABLE settings DROP COLUMN ui_mode");
  db2.close();
  assert.equal(abrir(n), "basico");
});
