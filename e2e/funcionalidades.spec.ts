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

async function desligar(request: APIRequestContext, ...chaves: string[]) {
  const off = Object.fromEntries(chaves.map((c) => [c, false]));
  const r = await request.patch("/api/settings", { headers: cabecalhosApi(), data: { features: JSON.stringify(off) } });
  expect(r.ok()).toBe(true);
}

test.describe("Menu, rotas e Painel", () => {
  test.beforeEach(async ({ request }) => ligarTudo(request));
  test.afterEach(async ({ request }) => ligarTudo(request));

  test("com parcelas desligadas: sem link, a rota volta ao Painel e o Painel perde as metas", async ({ page, request }) => {
    await desligar(request, "parcelas");
    await entrar(page);
    await expect(page.getByTestId("link-parcelas-e-metas")).toHaveCount(0);
    await page.goto("/#/parcelas");
    await expect(page.getByRole("heading", { level: 1, name: "Painel" })).toBeVisible();
    await expect(page.getByText("Parcelas no período", { exact: true })).toHaveCount(0);
  });

  test("com plataformas desligadas: sem Carteira no menu e a rota volta ao Painel", async ({ page, request }) => {
    await desligar(request, "plataformas");
    await entrar(page);
    await expect(page.getByTestId("link-carteira")).toHaveCount(0);
    await page.goto("/#/carteira");
    await expect(page.getByRole("heading", { level: 1, name: "Painel" })).toBeVisible();
  });

  test("com divisão desligada: o Painel perde a divisão por parcela", async ({ page, request }) => {
    await desligar(request, "divisao");
    await entrar(page);
    await expect(page.getByText("Divisão por parcela", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Parcelas no período", { exact: true })).toBeVisible();
  });
});
