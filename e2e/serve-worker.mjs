// Arranca o Worker da Cloudflare em local (workerd) com dados temporários e um código de acesso de teste.
// Usa-se com E2E_TARGET=worker; a interface vem de dist/public (npm run build).
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "salary-e2e-worker-"));
const code = process.env.E2E_ACCESS_CODE ?? "codigo-de-teste-1234";
const child = spawn(
  process.execPath,
  ["node_modules/wrangler/bin/wrangler.js", "dev", "--local", "--port", process.env.E2E_PORT ?? "5055", "--persist-to", dataDir, "--var", `ACCESS_CODE:${code}`],
  { stdio: "inherit", env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" } },
);

const stop = (signal) => child.kill(signal);
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));
child.on("exit", (exitCode) => {
  rmSync(dataDir, { recursive: true, force: true });
  process.exit(exitCode ?? 0);
});
