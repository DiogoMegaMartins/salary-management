// Aparência: a cor e o modo ficam guardados na conta, com validação e migração de bases antigas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import Database from "better-sqlite3";

const raiz = resolve(import.meta.dirname, "..");
const dir = mkdtempSync(join(tmpdir(), "sm-test-aparencia-"));
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
const settings = async () => (await call("GET", "/api/state")).json.settings;

test("base nova: Céu e automático", async () => {
  const s = await settings();
  assert.equal(s.palette, "ceu");
  assert.equal(s.colorMode, "auto");
});

test("guarda a paleta e o modo", async () => {
  assert.equal((await call("PATCH", "/api/settings", { palette: "mare", colorMode: "escuro" })).status, 200);
  const s = await settings();
  assert.equal(s.palette, "mare");
  assert.equal(s.colorMode, "escuro");
});

test("paleta ou modo inválidos: recusados, sem gravar", async () => {
  assert.equal((await call("PATCH", "/api/settings", { palette: "roxo" })).status, 400);
  assert.equal((await call("PATCH", "/api/settings", { colorMode: "noite" })).status, 400);
  const s = await settings();
  assert.equal(s.palette, "mare");
  assert.equal(s.colorMode, "escuro");
});

test("base antiga sem as colunas: abre e assume Céu e automático", () => {
  const d = mkdtempSync(join(tmpdir(), "sm-aparencia-antiga-"));
  const abrir = () =>
    execFileSync(join(raiz, "node_modules/.bin/tsx"), ["-e", `import(${JSON.stringify(join(raiz, "server/storage.ts"))}).then(({ storage }) => { const s = storage.getState().settings; console.log(s.palette + "|" + s.colorMode); });`], {
      cwd: raiz, encoding: "utf8", env: { ...process.env, DATA_DIR: d, DB_PATH: join(d, "data.db") },
    }).trim().split("\n").pop();
  abrir();
  const db = new Database(join(d, "data.db"));
  db.exec("ALTER TABLE settings DROP COLUMN palette");
  db.exec("ALTER TABLE settings DROP COLUMN color_mode");
  db.close();
  assert.equal(abrir(), "ceu|auto");
});
