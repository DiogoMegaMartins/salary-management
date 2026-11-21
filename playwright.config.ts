import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "5055";

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    // no CI só grava o rasto na repetição de um teste que falhou: gravar todos custa cerca de um terço do CPU
    trace: process.env.CI ? "on-first-retry" : "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // No CI usa-se o Google Chrome que já vem no runner do GitHub: sem descarregar o Chromium nem instalar
  // pacotes do sistema (apt), que chegou a demorar 5 minutos. Localmente usa-se o Chromium do Playwright.
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...(process.env.CI ? { channel: "chrome" } : {}) } },
    { name: "telemovel", use: { ...devices["Pixel 7"], ...(process.env.CI ? { channel: "chrome" } : {}) } },
  ],
  // A app tem de estar compilada (npm run build) antes de correr os testes.
  webServer: {
    command: process.env.E2E_TARGET === "worker" ? "node e2e/serve-worker.mjs" : "node e2e/serve.mjs",
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
