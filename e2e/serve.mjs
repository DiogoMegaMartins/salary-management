// Arranca a app já compilada (dist/) com uma base de dados temporária e um código de acesso de teste.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "salary-e2e-"));
const child = spawn(process.execPath, ["dist/index.cjs"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: process.env.E2E_PORT ?? "5055",
    DATA_DIR: dataDir,
    ACCESS_CODE: process.env.E2E_ACCESS_CODE ?? "codigo-de-teste-1234",
    BACKUP_INTERVAL_HOURS: "0",
  },
});

const stop = (signal) => {
  child.kill(signal);
};
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));
child.on("exit", (code) => {
  rmSync(dataDir, { recursive: true, force: true });
  process.exit(code ?? 0);
});
