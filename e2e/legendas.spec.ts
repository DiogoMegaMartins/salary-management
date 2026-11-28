import { expect, test } from "@playwright/test";
import { entrar } from "./helpers";

test("legendas: carregar numa série do gráfico esconde-a e volta a mostrá-la", async ({ page }) => {
  await entrar(page);
  await page.goto("/#/");
  await expect(page.getByTestId("legend-Subsídio alimentação")).toBeVisible();
  const botao = page.getByTestId("legend-Subsídio alimentação");
  await expect(botao).toHaveAttribute("aria-pressed", "true");
  await botao.scrollIntoViewIfNeeded();
  await botao.click();
  await expect(botao).toHaveAttribute("aria-pressed", "false");
  await expect(botao).toHaveAttribute("data-hidden", "true");
  await botao.click();
  await expect(botao).toHaveAttribute("aria-pressed", "true");
});

test("legendas: a última série visível não se esconde", async ({ page }) => {
  await entrar(page);
  await page.goto("/#/");
  const a = page.getByTestId("legend-Descontos");
  const b = page.getByTestId("legend-Líquido").nth(1); // o 2.º gráfico com "Líquido" é Bruto vs. descontos
  await a.scrollIntoViewIfNeeded();
  await a.click();
  await expect(a).toHaveAttribute("data-hidden", "true");
  await b.click(); // esconderia a última visível: é ignorado
  await expect(b).toHaveAttribute("data-hidden", "false");
});

test("legendas: o gráfico de anel também filtra pela legenda", async ({ page }) => {
  await entrar(page);
  await page.goto("/#/");
  const itens = page.locator('.donut-legend [data-testid^="legend-"]');
  await expect(itens.first()).toBeVisible();
  const total = await itens.count();
  expect(total).toBeGreaterThan(1);
  await itens.first().scrollIntoViewIfNeeded();
  await itens.first().click();
  await expect(itens.first()).toHaveAttribute("data-hidden", "true");
  await itens.first().click();
  await expect(itens.first()).toHaveAttribute("data-hidden", "false");
});

test("legendas: depois de esconder uma parcela, as percentagens das que ficam somam 100 %", async ({ page }) => {
  await entrar(page);
  await page.goto("/#/");
  const pcts = page.locator('.donut-legend [data-testid^="legend-pct-"]');
  const soma = async () => (await pcts.allTextContents()).reduce((a, t) => a + (/\d/.test(t) ? parseFloat(t.replace("%", "").replace(",", ".")) : 0), 0);
  const itens = page.locator('.donut-legend [data-testid^="legend-"][aria-pressed]');
  await itens.first().scrollIntoViewIfNeeded();
  expect(Math.abs((await soma()) - 100)).toBeLessThan(0.6);
  await itens.first().click();
  await expect(itens.first()).toHaveAttribute("data-hidden", "true");
  await expect(pcts.first()).toHaveText("—");
  expect(Math.abs((await soma()) - 100)).toBeLessThan(0.6); // 100 % repartido pelas visíveis
  await itens.first().click();
});

test("legendas: na Carteira também", async ({ page }) => {
  await entrar(page);
  await page.goto("/#/carteira");
  const primeiro = page.locator('[data-testid^="legend-"]').first();
  await expect(primeiro).toBeVisible();
  await primeiro.scrollIntoViewIfNeeded();
  await primeiro.click();
  await expect(primeiro).toHaveAttribute("data-hidden", "true");
});
