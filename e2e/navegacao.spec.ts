import { expect, test } from "@playwright/test";
import { SCREENS, entrar, recolherErros } from "./helpers";

test("todos os ecrãs abrem sem erros", async ({ page }) => {
  const erros = recolherErros(page);
  await entrar(page);
  for (const { route, title } of SCREENS) {
    await page.goto(`/${route}`);
    await expect(page.getByRole("heading", { level: 1, name: title }).first(), `ecrã ${route}`).toBeVisible();
  }
  expect(erros).toEqual([]);
});

test("os ecrãs não têm deslocação horizontal da página", async ({ page }) => {
  await entrar(page);
  for (const { route, title } of SCREENS) {
    await page.goto(`/${route}`);
    await expect(page.getByRole("heading", { level: 1, name: title }).first()).toBeVisible();
    const excesso = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(excesso, `excesso horizontal em ${route}`).toBeLessThanOrEqual(1);
  }
});
