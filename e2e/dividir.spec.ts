import { expect, test, type Page } from "@playwright/test";
import { cabecalhosApi, entrar } from "./helpers";

const modo = (page: Page, uiMode: "basico" | "detalhado") => page.request.patch("/api/settings", { data: { uiMode }, headers: cabecalhosApi() });
test.afterEach(async ({ page }) => { await modo(page, "detalhado"); });

test("dividir: o cartão mostra os 3 passos e um está em curso", async ({ page }) => {
  await entrar(page);
  await page.goto("/#/divisao");
  const passos = page.getByTestId("dividir-steps");
  await expect(passos).toBeVisible();
  for (const k of ["salario", "repartir", "fechar"]) await expect(page.getByTestId(`step-${k}`)).toBeVisible();
  await expect(passos.locator('[data-state="now"]')).toHaveCount(1);
});

test("dividir: no Básico só se vê o passo em curso, sem separadores", async ({ page }) => {
  await modo(page, "basico");
  await entrar(page);
  await page.goto("/#/divisao");
  await expect(page.getByTestId("dividir-basico")).toBeVisible();
  await expect(page.getByTestId("division-tabs")).toHaveCount(0);
  await page.getByTestId("step-fechar").click();
  await expect(page.getByText("Histórico de abertura e fecho")).toBeVisible();
  await page.getByTestId("step-salario").click();
  await expect(page.getByTestId("dividir-salario")).toContainText("Meses");
});

test("dividir: no Básico as parcelas e metas estão a uma ligação de distância", async ({ page }) => {
  await modo(page, "basico");
  await entrar(page);
  await page.goto("/#/divisao");
  await page.getByTestId("dividir-ver-parcelas").click();
  await expect(page.getByTestId("parcels-list")).toBeVisible();
});

test("dividir: no Detalhado há Divisão, Parcelas e metas e Fechar o mês", async ({ page }) => {
  await entrar(page);
  await page.goto("/#/divisao");
  await expect(page.getByTestId("division-tab-divisao")).toBeVisible();
  await page.getByTestId("division-tab-parcelas").click();
  await expect(page.getByTestId("parcels-list")).toBeVisible();
  await page.getByTestId("division-tab-fecho").click();
  await expect(page.getByTestId("page-closing")).toBeVisible();
});

test("dividir: as ligações antigas /parcelas e /fecho levam ao separador certo", async ({ page }) => {
  await entrar(page);
  await page.goto("/#/parcelas");
  await expect(page.getByRole("heading", { level: 1, name: "Plano do mês" })).toBeVisible();
  await expect(page.getByTestId("parcels-list")).toBeVisible();
  await expect(page).toHaveURL(/#\/divisao/);
  await page.goto("/#/fecho");
  await expect(page.getByTestId("page-closing")).toBeVisible();
});

test("dividir: Plano do mês continua no menu mesmo com Divisão e Movimentos desligados", async ({ page }, info) => {
  await page.request.patch("/api/settings", { data: { features: JSON.stringify({ divisao: false, movimentos: false, reconciliacao: false }) }, headers: cabecalhosApi() });
  try {
    await entrar(page);
    if (info.project.name !== "telemovel") await expect(page.locator("aside").getByRole("link", { name: "Plano do mês", exact: true })).toBeVisible();
    await page.goto("/#/divisao");
    await expect(page.getByTestId("division-tab-fecho")).toBeVisible();
  } finally {
    await page.request.patch("/api/settings", { data: { features: "{}" }, headers: cabecalhosApi() });
  }
});
