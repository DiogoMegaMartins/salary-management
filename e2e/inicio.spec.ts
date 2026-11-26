import { expect, test, type Page } from "@playwright/test";
import { cabecalhosApi, clicar, entrar, guardarTransacoes } from "./helpers";

const modo = (page: Page, uiMode: "basico" | "detalhado") => page.request.patch("/api/settings", { data: { uiMode }, headers: cabecalhosApi() });
let limpar: () => Promise<void> = async () => {};
test.beforeEach(async ({ page }) => { limpar = await guardarTransacoes(page); });
test.afterEach(async ({ page }) => { await limpar(); await modo(page, "detalhado"); });

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

test("início: no modo Básico há o resumo, para onde vai o dinheiro, três números e as últimas despesas", async ({ page }) => {
  await modo(page, "basico");
  await entrar(page);
  await abrirInicio(page);
  await expect(page.getByTestId("inicio-basico")).toBeVisible();
  await expect(page.getByTestId("kpi-net")).toHaveCount(0);
  for (const id of ["inicio-mini-gasto", "inicio-mini-dia", "inicio-mini-ultima", "inicio-ultimas"]) await expect(page.getByTestId(id)).toBeVisible();
  await expect(page.getByTestId("inicio-categories")).toBeVisible();
  expect(await page.getByTestId("inicio-categories").getByRole("listitem").count()).toBeLessThanOrEqual(6); // 5 maiores + Outras
  await expect(page.getByTestId("inicio-ver-despesas")).toBeVisible();
});

test("início Básico: uma despesa nova aparece nas últimas despesas e na última despesa", async ({ page }, info) => {
  const nota = `inicio-ultimas-${info.project.name}-${Date.now()}`;
  await modo(page, "basico");
  await entrar(page);
  await abrirInicio(page);
  await clicar(page.getByTestId("register-button"));
  await page.getByTestId("register-value").fill("7,77");
  await page.getByTestId("register-note").fill(nota);
  await page.getByTestId("register-save").click();
  await expect(page.getByTestId("register-dialog")).toBeHidden();
  const lista = page.getByTestId("inicio-ultimas");
  await expect(lista).toContainText(nota);
  await expect(lista.getByTestId("inicio-despesa").first()).toContainText(/7,77/);
  await expect(page.getByTestId("inicio-mini-ultima")).toContainText(/7,77/);
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
  const valor = async () => Number(await page.getByTestId("inicio-left").getAttribute("data-left"));
  const antes = await valor();
  await clicar(page.getByTestId("register-button"));
  await page.getByTestId("register-value").fill("10");
  await page.getByTestId("register-save").click();
  await expect(page.getByTestId("register-dialog")).toBeHidden();
  await expect(async () => {
    const depois = await valor();
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

test("início: o título é Valor disponível e muda quando se passa do planeado", async ({ page }) => {
  await modo(page, "basico");
  await entrar(page);
  await abrirInicio(page);
  const titulo = page.getByTestId("inicio-label");
  const esq = Number(await page.getByTestId("inicio-left").getAttribute("data-left"));
  await expect(titulo).toHaveText(esq < 0 ? "Gasto acima do planeado" : "Valor disponível");
  // regista o suficiente para passar do planeado e o título muda
  await clicar(page.getByTestId("register-button"));
  await page.getByTestId("register-value").fill(String(Math.max(esq, 0) + 1));
  await page.getByTestId("register-save").click();
  await expect(titulo).toHaveText("Gasto acima do planeado");
  // o título já diz tudo: sem frase de estado repetida
  await expect(page.getByTestId("inicio-state")).toHaveCount(0);
});
