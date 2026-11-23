import { expect, test, type APIRequestContext } from "@playwright/test";
import { cabecalhosApi, entrar } from "./helpers";

const CHAVES = ["divisao", "movimentos", "parcelas", "plataformas", "irsJovem", "reconciliacao"];

/** Repõe tudo ligado, para os testes não se afetarem. */
async function ligarTudo(request: APIRequestContext) {
  const r = await request.patch("/api/settings", { headers: cabecalhosApi(), data: { features: "{}" } });
  expect(r.ok()).toBe(true);
}

test.describe("Funcionalidades ligáveis", () => {
  test.beforeEach(async ({ page, request }) => {
    await ligarTudo(request);
    await entrar(page);
  });
  test.afterEach(async ({ request }) => ligarTudo(request));

  test("Definições mostra os interruptores, todos ligados, e guarda a escolha", async ({ page }) => {
    await page.goto("/#/dados");
    await page.getByTestId("settings-tab-funcionalidades").click();
    for (const k of CHAVES) await expect(page.getByTestId(`feature-switch-${k}`)).toBeChecked();

    await page.getByTestId("feature-switch-parcelas").click();
    await expect(page.getByTestId("feature-switch-parcelas")).not.toBeChecked();
    await page.reload();
    await page.getByTestId("settings-tab-funcionalidades").click();
    await expect(page.getByTestId("feature-switch-parcelas")).not.toBeChecked();

    await page.getByTestId("feature-switch-parcelas").click();
    await expect(page.getByTestId("feature-switch-parcelas")).toBeChecked();
  });

  test("a reconciliação fica inativa quando os movimentos estão desligados", async ({ page }) => {
    await page.goto("/#/dados");
    await page.getByTestId("settings-tab-funcionalidades").click();
    await page.getByTestId("feature-switch-movimentos").click();
    await expect(page.getByTestId("feature-switch-reconciliacao")).toBeDisabled();
    await expect(page.getByText("Precisa de Movimentos")).toBeVisible();
  });
});
