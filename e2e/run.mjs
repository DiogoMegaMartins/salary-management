// Corre os projetos (desktop e telemóvel) em paralelo, cada um com o seu servidor, a sua base de dados
// temporária e a sua porta: os testes alteram dados, por isso nunca partilham o mesmo servidor.
// Uso: node e2e/run.mjs [argumentos do playwright]   (ex.: node e2e/run.mjs e2e/insights.spec.ts)
import { spawn } from "node:child_process";

const base = Number(process.env.E2E_PORT ?? 5055);
const extra = process.argv.slice(2);
const projects = ["desktop", "telemovel"];

const prefix = (name, stream, out) => {
  let rest = "";
  stream.on("data", (chunk) => {
    const lines = (rest + chunk).split("\n");
    rest = lines.pop() ?? "";
    for (const l of lines) out.write(`[${name}] ${l}\n`);
  });
  stream.on("end", () => rest && out.write(`[${name}] ${rest}\n`));
};

const runs = projects.map(
  (name, i) =>
    new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        ["node_modules/@playwright/test/cli.js", "test", `--project=${name}`, `--output=test-results/${name}`, ...extra],
        {
          env: { ...process.env, E2E_PORT: String(base + i), PLAYWRIGHT_HTML_OUTPUT_DIR: `playwright-report/${name}` },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      prefix(name, child.stdout, process.stdout);
      prefix(name, child.stderr, process.stderr);
      child.on("exit", (code) => resolve(code ?? 1));
    }),
);

const codes = await Promise.all(runs);
process.exit(codes.some((c) => c !== 0) ? 1 : 0);
