import { expect, test, type Page } from "@playwright/test";
import { cabecalhosApi, clicar, entrar } from "./helpers";

const modo = (page: Page, uiMode: "basico" | "detalhado") => page.request.patch("/api/settings", { data: { uiMode }, headers: cabecalhosApi() });
const eur = (t: string | null) => Number((t ?? "").replace(/[^\d,\-−]/g, "").replace("−", "-").replace(",", "."));
test.afterEach(async ({ page }) => { await modo(page, "basico"); });

const abrirInicio = async (page: Page) => {
  await page.goto("/#/");
  await expect(page.getByTestId("inicio-summary")).toBeVisible();
};

test("início: título, resumo do mês e barra de progresso", async ({ page }) => {
  await entrar(page);
  await abrirInicio(page);
  await expect(page.getByRole("heading", { level: 1, name: "Início" })).toBeVisible();
  await expect(page.getByTestId("inicio-left")).toContainText("€");
  const bar = page.getByTestId("inicio-progress");
  const v = Number(await bar.getAttribute("aria-valuenow"));
  expect(v).toBeGreaterThanOrEqual(0);
  expect(v).toBeLessThanOrEqual(100);
});

test("início: no modo Básico só há o resumo, com as 3 maiores categorias", async ({ page }) => {
  await modo(page, "basico");
  await entrar(page);
  await abrirInicio(page);
  await expect(page.getByTestId("kpi-net")).toHaveCount(0);
  await expect(page.getByTestId("inicio-categories").getByRole("listitem")).not.toHaveCount(4);
  expect(await page.getByTestId("inicio-categories").getByRole("listitem").count()).toBeLessThanOrEqual(3);
});

test("início: no modo Detalhado o resumo vem seguido do painel de hoje", async ({ page }) => {
  await modo(page, "detalhado");
  await entrar(page);
  await abrirInicio(page);
  await expect(page.getByTestId("kpi-net")).toBeVisible();
});

test("início: registar uma despesa baixa o que ainda podes gastar", async ({ page }) => {
  await modo(page, "basico");
  await entrar(page);
  await abrirInicio(page);
  const antes = eur(await page.getByTestId("inicio-left").textContent());
  await clicar(page.getByTestId("register-button"));
  await page.getByTestId("register-value").fill("10");
  await page.getByTestId("register-save").click();
  await expect(page.getByTestId("register-dialog")).toBeHidden();
  await expect(async () => {
    const depois = eur(await page.getByTestId("inicio-left").textContent());
    expect(Math.round((antes - depois) * 100) / 100).toBe(10);
  }).toPass({ timeout: 8000 });
});

test("início: mudar de mês muda o título do resumo", async ({ page }) => {
  await entrar(page);
  await abrirInicio(page);
  const antes = await page.getByTestId("inicio-title").textContent();
  await page.getByTestId("inicio-month").click();
  await page.getByRole("option").last().click();
  await expect(page.getByTestId("inicio-title")).not.toHaveText(antes ?? "");
});
