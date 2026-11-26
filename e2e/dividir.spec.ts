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

test("dividir: no Básico há os passos e só as ferramentas do dia a dia", async ({ page }) => {
  await modo(page, "basico");
  await entrar(page);
  await page.goto("/#/divisao");
  await expect(page.getByTestId("dividir-steps")).toBeVisible();
  await expect(page.getByTestId("tool-parcelas")).toBeVisible();
  await expect(page.getByTestId("tool-recorrencias")).toHaveCount(0);
  await expect(page.getByTestId("tool-simulador")).toHaveCount(0);
  await page.getByTestId("step-fechar").click();
  await expect(page.getByTestId("closing-checklist")).toBeVisible();
  await expect(page.getByText("Histórico de abertura e fecho")).toBeVisible();
});

test("dividir: clicar em Quanto entra mostra o total, o salário e o que foi transportado do mês anterior", async ({ page }) => {
  await entrar(page);
  await page.goto("/#/divisao");
  await page.getByTestId("step-salario").click();
  const info = page.getByTestId("dividir-salario");
  await expect(info).toBeVisible();
  await expect(info.getByTestId("salary-total")).toContainText("€");
  await expect(info.getByTestId("salary-income")).toContainText("€");
  await expect(info.getByTestId("salary-carry")).toContainText(/transportado do mês anterior/);
  await expect(info).toContainText("Meses");
});

test("dividir: no Básico as parcelas e metas abrem a partir das ferramentas", async ({ page }) => {
  await modo(page, "basico");
  await entrar(page);
  await page.goto("/#/divisao");
  await page.getByTestId("tool-parcelas").click();
  await expect(page.getByTestId("parcels-list")).toBeVisible();
});

test("dividir: no Detalhado há as ferramentas todas e o fecho tem lista de verificação, sem separadores dentro de separadores", async ({ page }) => {
  await entrar(page);
  await page.goto("/#/divisao");
  for (const k of ["gastos", "parcelas", "recorrencias", "simulador", "composicao"]) await expect(page.getByTestId(`tool-${k}`)).toBeVisible();
  await page.getByTestId("tool-parcelas").click();
  await expect(page.getByTestId("parcels-list")).toBeVisible();
  await page.getByTestId("step-fechar").click();
  await expect(page.getByTestId("closing-checklist")).toBeVisible();
  await expect(page.getByTestId("month-closing")).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await page.getByTestId("tool-recorrencias").click();
  await expect(page.getByTestId("dividir-view")).toHaveAttribute("data-view", "recorrencias");
});

test("dividir: as ligações antigas /parcelas e /fecho levam à ferramenta certa", async ({ page }) => {
  await entrar(page);
  await page.goto("/#/parcelas");
  await expect(page.getByRole("heading", { level: 1, name: "Plano do mês" })).toBeVisible();
  await expect(page.getByTestId("parcels-list")).toBeVisible();
  await expect(page).toHaveURL(/#\/divisao/);
  await page.goto("/#/fecho");
  await expect(page.getByTestId("month-closing")).toBeVisible();
});

test("dividir: Plano do mês continua no menu mesmo com Divisão e Movimentos desligados", async ({ page }, info) => {
  await page.request.patch("/api/settings", { data: { features: JSON.stringify({ divisao: false, movimentos: false, reconciliacao: false }) }, headers: cabecalhosApi() });
  try {
    await entrar(page);
    if (info.project.name !== "telemovel") await expect(page.locator("aside").getByRole("link", { name: "Plano do mês", exact: true })).toBeVisible();
    await page.goto("/#/divisao");
    await expect(page.getByTestId("step-fechar")).toBeVisible();
  } finally {
    await page.request.patch("/api/settings", { data: { features: "{}" }, headers: cabecalhosApi() });
  }
});
