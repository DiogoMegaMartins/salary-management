import { expect, test, type APIRequestContext } from "@playwright/test";
import { ACCESS_CODE, cabecalhosApi, entrar } from "./helpers";

/** Entra sem esperar pelo título do Painel: com o arranque aberto, o resto da página fica inacessível (é um diálogo). */
async function entrarComArranque(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByPlaceholder("Código de acesso").fill(ACCESS_CODE);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByTestId("onboarding")).toBeVisible();
}

async function definir(request: APIRequestContext, data: Record<string, unknown>) {
  const r = await request.patch("/api/settings", { headers: cabecalhosApi(), data });
  expect(r.ok()).toBe(true);
}

test.describe("Arranque no primeiro uso", () => {
  test.beforeEach(async ({ request }) => definir(request, { features: "{}", onboardingDone: false }));
  test.afterEach(async ({ request }) => definir(request, { features: "{}", onboardingDone: true }));

  test("aparece na primeira vez, não se fecha com Esc, e 'Continuar' sem marcar deixa só o essencial", async ({ page }) => {
    await entrarComArranque(page);
    await expect(page.getByTestId("onboarding")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("onboarding")).toBeVisible();
    await page.getByTestId("onboarding-continue").click();
    await expect(page.getByTestId("onboarding")).toHaveCount(0);
    await page.goto("/#/dados");
    await page.getByTestId("settings-tab-funcionalidades").click();
    await expect(page.getByTestId("feature-switch-divisao")).toBeChecked();
    await expect(page.getByTestId("feature-switch-movimentos")).toBeChecked();
    for (const k of ["plataformas", "parcelas", "irsJovem", "reconciliacao"]) await expect(page.getByTestId(`feature-switch-${k}`)).not.toBeChecked();
    await page.reload();
    await expect(page.getByTestId("onboarding")).toHaveCount(0); // não volta
  });

  test("marcar 'Também invisto' liga só as plataformas", async ({ page }) => {
    await entrarComArranque(page);
    await page.getByTestId("onboarding-invest").click();
    await page.getByTestId("onboarding-continue").click();
    await expect(page.getByTestId("onboarding")).toHaveCount(0);
    await page.goto("/#/dados");
    await page.getByTestId("settings-tab-funcionalidades").click();
    await expect(page.getByTestId("feature-switch-plataformas")).toBeChecked();
    await expect(page.getByTestId("feature-switch-parcelas")).not.toBeChecked();
  });

  test("'Ligar tudo' deixa tudo ligado", async ({ page }) => {
    await entrarComArranque(page);
    await page.getByTestId("onboarding-all").click();
    await expect(page.getByTestId("onboarding")).toHaveCount(0);
    await page.goto("/#/dados");
    await page.getByTestId("settings-tab-funcionalidades").click();
    for (const k of ["divisao", "movimentos", "parcelas", "plataformas", "irsJovem", "reconciliacao"]) await expect(page.getByTestId(`feature-switch-${k}`)).toBeChecked();
  });

  test("repetir o arranque em Definições volta a perguntar, já com o que está ligado", async ({ page, request }) => {
    await definir(request, { features: '{"plataformas":false,"irsJovem":false,"reconciliacao":false}', onboardingDone: true });
    await entrar(page);
    await expect(page.getByTestId("onboarding")).toHaveCount(0);
    await page.goto("/#/dados");
    await page.getByTestId("settings-tab-funcionalidades").click();
    await page.getByTestId("button-repeat-onboarding").click();
    await expect(page.getByTestId("onboarding")).toBeVisible();
    await expect(page.getByTestId("onboarding-goals")).toBeChecked(); // parcelas estavam ligadas
    await expect(page.getByTestId("onboarding-invest")).not.toBeChecked();
    await page.getByTestId("onboarding-all").click();
  });
});
