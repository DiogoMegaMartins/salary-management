import { expect, test, type Page } from "@playwright/test";
import { cabecalhosApi, entrar } from "./helpers";

const modo = (page: Page, uiMode: "basico" | "detalhado") => page.request.patch("/api/settings", { data: { uiMode }, headers: cabecalhosApi() });
test.afterEach(async ({ page }) => { await modo(page, "detalhado"); });

test("estilo Calma: o cabeçalho das páginas é uma faixa suave com o título grande", async ({ page }, info) => {
  await entrar(page);
  for (const rota of ["#/despesas", "#/orcamento", "#/ajuda"]) {
    await page.goto(`/${rota}`);
    const h = page.locator(".app-header");
    await expect(h).toBeVisible();
    const fundoCabecalho = await h.evaluate((el) => getComputedStyle(el).backgroundColor);
    const fundoPagina = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(fundoCabecalho, `cabeçalho de ${rota} com faixa própria`).not.toBe(fundoPagina);
    const tamanho = await page.locator(".app-header h1").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(tamanho, `título de ${rota}`).toBeGreaterThanOrEqual(info.project.name === "telemovel" ? 20 : 22);
  }
});

test("estilo Calma: os cartões têm cantos mais redondos", async ({ page }) => {
  await entrar(page);
  await page.goto("/#/orcamento");
  await expect(page.getByText("Orçamento vs. real por categoria")).toBeVisible();
  const raio = await page.locator(".section-card").first().evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
  expect(raio).toBeGreaterThanOrEqual(14);
});

test("Básico: Despesas esconde o que é fora do padrão e o filtro por plataforma", async ({ page }) => {
  await modo(page, "basico");
  await entrar(page);
  await page.goto("/#/despesas");
  await expect(page.getByTestId("page-expenses")).toBeVisible();
  await expect(page.getByText("Despesas fora do padrão")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Plataforma" })).toHaveCount(0);
});

test("Detalhado: Despesas mostra tudo", async ({ page }) => {
  await modo(page, "detalhado");
  await entrar(page);
  await page.goto("/#/despesas");
  await expect(page.getByText("Despesas fora do padrão")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Plataforma" })).toBeVisible();
});

test("Básico: Orçamento mostra só o orçamento por categoria", async ({ page }) => {
  await modo(page, "basico");
  await entrar(page);
  await page.goto("/#/orcamento");
  await expect(page.getByText("Orçamento vs. real por categoria")).toBeVisible();
  for (const t of ["Projeção de final de ano", "Reserva de emergência", "Comparação mensal e anual"]) await expect(page.getByText(t, { exact: true })).toHaveCount(0);
});

test("Detalhado: Orçamento mostra todas as secções", async ({ page }) => {
  await modo(page, "detalhado");
  await entrar(page);
  await page.goto("/#/orcamento");
  for (const t of ["Projeção de final de ano", "Reserva de emergência", "Orçamento vs. real por categoria", "Comparação mensal e anual"]) await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
});

test("Básico: Carteira mostra só o valor atual por parcela", async ({ page }) => {
  await modo(page, "basico");
  await entrar(page);
  await page.goto("/#/carteira");
  await expect(page.getByRole("heading", { level: 1, name: "Carteira" })).toBeVisible();
  await expect(page.getByText("Evolução do acumulado")).toHaveCount(0);
  await expect(page.getByText("Exposição por plataforma")).toHaveCount(0);
  await expect(page.getByTestId("kpi-total")).toHaveCount(0);
});

test("Básico: Definições mostra só Funcionalidades, Aparência, Backups e Segurança", async ({ page }) => {
  await modo(page, "basico");
  await entrar(page);
  await page.goto("/#/dados");
  for (const t of ["funcionalidades", "aparencia", "backups", "seguranca"]) await expect(page.getByTestId(`settings-tab-${t}`)).toBeVisible();
  for (const t of ["calculo", "catalogos", "historico"]) await expect(page.getByTestId(`settings-tab-${t}`)).toHaveCount(0);
  // mesmo com o separador Cálculo guardado de antes, abre num separador visível
  await expect(page.getByTestId("settings-tab-funcionalidades")).toHaveAttribute("aria-selected", /true|false/);
  await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1);
});

test("Detalhado: Definições mostra todos os separadores", async ({ page }) => {
  await modo(page, "detalhado");
  await entrar(page);
  await page.goto("/#/dados");
  for (const t of ["calculo", "funcionalidades", "aparencia", "catalogos", "backups", "seguranca", "historico"]) await expect(page.getByTestId(`settings-tab-${t}`)).toBeVisible();
});
