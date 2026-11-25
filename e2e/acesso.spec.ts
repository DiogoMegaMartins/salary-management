import { expect, test } from "@playwright/test";
import { entrar } from "./helpers";

test.describe("Código de acesso", () => {
  test("a API recusa pedidos sem código", async ({ request }) => {
    const r = await request.get("/api/months");
    expect(r.status()).toBe(401);
  });

  test("a verificação de saúde é pública", async ({ request }) => {
    const r = await request.get("/api/health");
    expect(r.ok()).toBe(true);
    expect(await r.json()).toEqual({ ok: true });
  });

  test("mostra o ecrã de bloqueio e recusa um código errado", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Introduz o código de acesso")).toBeVisible();
    await page.getByPlaceholder("Código de acesso").fill("codigo-errado-0000");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Código incorreto")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Início" })).toHaveCount(0);
  });

  test("com o código certo abre o Painel", async ({ page }) => {
    await entrar(page);
  });
});
