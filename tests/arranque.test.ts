// Arranque no primeiro uso: base nova = por fazer; base que já tem meses = feito; validação da API.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";

const raiz = resolve(import.meta.dirname, "..");
/** Arranca o servidor numa pasta de dados e devolve onboardingDone, em processo à parte (a migração corre ao importar). */
const estado = (dir: string) =>
  Number(
    execFileSync(join(raiz, "node_modules/.bin/tsx"), ["-e", `import(${JSON.stringify(join(raiz, "server/storage.ts"))}).then(({ storage }) => console.log(storage.getState().settings.onboardingDone));`], {
      cwd: raiz, encoding: "utf8", env: { ...process.env, DATA_DIR: dir, DB_PATH: join(dir, "data.db") },
    }).trim().split("\n").pop(),
  );

test("base nova: o arranque fica por fazer, mesmo com os dados de exemplo", () => {
  const dir = mkdtempSync(join(tmpdir(), "sm-arranque-nova-"));
  assert.equal(estado(dir), 0);
  assert.equal(estado(dir), 0); // arrancar outra vez não o dá como feito
});

test("base de quem já usa a app (tem meses, sem a coluna): fica como feito ao migrar", () => {
  const dir = mkdtempSync(join(tmpdir(), "sm-arranque-antiga-"));
  estado(dir); // cria o esquema com os dados de exemplo
  const db = new Database(join(dir, "data.db"));
  db.exec("ALTER TABLE settings DROP COLUMN onboarding_done"); // como estava antes desta versão
  db.close();
  assert.equal(estado(dir), 1);
});
