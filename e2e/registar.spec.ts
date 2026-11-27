import { expect, test, type Page } from "@playwright/test";
import { cabecalhosApi, clicar, entrar, guardarTransacoes, sufixo } from "./helpers";

const definirModo = (page: Page, uiMode: "basico" | "detalhado") =>
  page.request.patch("/api/settings", { data: { uiMode }, headers: cabecalhosApi() });

let limpar: () => Promise<void> = async () => {};
test.beforeEach(async ({ page }) => { await definirModo(page, "basico"); limpar = await guardarTransacoes(page); });
test.afterEach(async ({ page }) => { await limpar(); await definirModo(page, "detalhado"); });

const transacoes = async (page: Page, nota: string) => {
  const r = await page.request.get("/api/state", { headers: cabecalhosApi() });
  return ((await r.json()).transactions as any[]).filter((t) => t.note === nota);
};
const abrir = async (page: Page) => {
  await clicar(page.getByTestId("register-button"));
  await expect(page.getByTestId("register-dialog")).toBeVisible();
};

test("registar: o botão está sempre à mão, por baixo do conteúdo", async ({ page }) => {
  await entrar(page);
  const botao = page.getByTestId("register-button");
  await expect(botao).toBeVisible();
  await expect(botao).toBeInViewport();
  await page.locator("main").evaluate((m) => m.scrollTo(0, m.scrollHeight));
  await expect(botao).toBeInViewport();
  await page.goto("/#/meses");
  await expect(botao).toBeInViewport();
});

test("registar: grava a despesa e avisa", async ({ page }, info) => {
  const nota = `registo-rapido-${sufixo(info.project.name)}-${Date.now()}`;
  await entrar(page);
  await abrir(page);
  await page.getByTestId("register-value").fill("12,50");
  await page.getByTestId("register-note").fill(nota);
  await page.getByTestId("register-save").click();
  await expect(page.getByTestId("register-dialog")).toBeHidden();
  await expect(page.getByText(/12,50/).first()).toBeVisible();
  const t = await transacoes(page, nota);
  expect(t).toHaveLength(1);
  expect(t[0].value).toBe(12.5);
  expect(t[0].type).toBe("expense");
  // pede a parcela e, por defeito, cai na de gastos
  const estado = await (await page.request.get("/api/state", { headers: cabecalhosApi() })).json();
  const gastos = estado.parcels.filter((p: any) => p.kind === "gastos" && !p.archived).sort((a: any, b: any) => a.id - b.id)[0];
  expect(t[0].parcelId).toBe(gastos.id);
});

test("registar: a parcela vem preenchida com a de gastos e pode mudar-se", async ({ page }, info) => {
  const nota = `registo-parcela-${sufixo(info.project.name)}-${Date.now()}`;
  await entrar(page);
  await abrir(page);
  await expect(page.getByTestId("register-parcel")).toContainText("Gastos Mensais");
  await page.getByTestId("register-parcel").click();
  await page.getByRole("option", { name: "Fundo de Emergência" }).click();
  await page.getByTestId("register-value").fill("1");
  await page.getByTestId("register-note").fill(nota);
  await page.getByTestId("register-save").click();
  await expect(page.getByTestId("register-dialog")).toBeHidden();
  const estado = await (await page.request.get("/api/state", { headers: cabecalhosApi() })).json();
  const fundo = estado.parcels.find((p: any) => p.name === "Fundo de Emergência");
  expect((await transacoes(page, nota))[0].parcelId).toBe(fundo.id);
});

test("registar: valor vazio, zero ou texto dá erro e não grava", async ({ page }, info) => {
  const nota = `registo-invalido-${sufixo(info.project.name)}`;
  await entrar(page);
  await abrir(page);
  await page.getByTestId("register-note").fill(nota);
  for (const v of ["", "0", "abc"]) {
    await page.getByTestId("register-value").fill(v);
    await page.getByTestId("register-save").click();
    await expect(page.getByTestId("register-error")).toContainText("valor");
    await expect(page.getByTestId("register-dialog")).toBeVisible();
  }
  expect(await transacoes(page, nota)).toHaveLength(0);
});

test("registar: data sem mês explica o que fazer e não grava", async ({ page }, info) => {
  const nota = `registo-sem-mes-${sufixo(info.project.name)}`;
  await entrar(page);
  await abrir(page);
  await page.getByTestId("register-value").fill("5");
  await page.getByTestId("register-note").fill(nota);
  await page.getByTestId("register-date").fill("2001-01-15");
  await page.getByTestId("register-save").click();
  await expect(page.getByTestId("register-error")).toContainText("Meses");
  expect(await transacoes(page, nota)).toHaveLength(0);
});

test("registar: duplo clique em Guardar grava uma só vez", async ({ page }, info) => {
  const nota = `registo-duplo-${sufixo(info.project.name)}-${Date.now()}`;
  await entrar(page);
  await abrir(page);
  await page.getByTestId("register-value").fill("3,20");
  await page.getByTestId("register-note").fill(nota);
  await page.getByTestId("register-save").dblclick();
  await expect(page.getByTestId("register-dialog")).toBeHidden();
  expect(await transacoes(page, nota)).toHaveLength(1);
});

test("registar: não tapa o assistente", async ({ page }) => {
  await entrar(page);
  const a = await page.getByTestId("register-button").boundingBox();
  const b = await page.getByTestId("assistant-fab").boundingBox();
  expect(a && b).toBeTruthy();
  const sobrepoe = a!.x < b!.x + b!.width && a!.x + a!.width > b!.x && a!.y < b!.y + b!.height && a!.y + a!.height > b!.y;
  expect(sobrepoe, "botão Registar e assistente não se podem sobrepor").toBe(false);
});

test("registar: o botão do assistente fica por cima da faixa do botão Registar, nítido", async ({ page }) => {
  await entrar(page);
  const z = async (id: string) => Number(await page.getByTestId(id).evaluate((el) => getComputedStyle(el).zIndex));
  expect(await z("assistant-fab")).toBeGreaterThan(await z("register-bar"));
});

test("registar: o botão só aparece no modo Básico, e o modo escolhe-se em Definições › Funcionalidades", async ({ page }) => {
  await entrar(page);
  await expect(page.getByTestId("register-button")).toBeVisible();
  await page.goto("/#/dados");
  await page.getByTestId("settings-tab-funcionalidades").click();
  await expect(page.getByRole("radiogroup", { name: "Modo de utilização" })).toBeVisible();
  await expect(page.getByTestId("ui-mode-basico").getByRole("radio")).toBeChecked();
  await page.getByTestId("ui-mode-detalhado").click();
  await expect(page.getByTestId("register-button")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("register-button")).toHaveCount(0);
  await page.getByTestId("settings-tab-funcionalidades").click();
  await page.getByTestId("ui-mode-basico").click();
  await expect(page.getByTestId("register-button")).toBeVisible();
});

test("registar: se a categoria ainda não existe, dá para a criar ali mesmo", async ({ page }, info) => {
  const nota = `registo-categoria-${sufixo(info.project.name)}-${Date.now()}`;
  const nome = `Cat nova ${sufixo(info.project.name)} ${Date.now()}`;
  await entrar(page);
  await abrir(page);
  await page.getByTestId("register-value").fill("3,20");
  await page.getByTestId("register-note").fill(nota);
  await clicar(page.getByTestId("register-category"));
  await page.getByRole("option", { name: /Criar categoria/ }).click();
  await page.getByTestId("register-new-category").fill(nome);
  await page.getByTestId("register-create-category").click();
  await expect(page.getByTestId("register-category")).toContainText(nome);
  await page.getByTestId("register-save").click();
  await expect(page.getByTestId("register-dialog")).toBeHidden();
  const t = await transacoes(page, nota);
  expect(t).toHaveLength(1);
  expect(t[0].category).toBe(nome);
  const estado = await (await page.request.get("/api/state", { headers: cabecalhosApi() })).json();
  const criada = (estado.categories as any[]).find((c) => c.name === nome);
  expect(criada).toBeTruthy();
  // deixa tudo como estava: primeiro o movimento (uma categoria com movimentos não se elimina), depois a categoria
  await page.request.delete(`/api/transactions/${t[0].id}`, { headers: cabecalhosApi() });
  await page.request.delete(`/api/categories/${criada.id}`, { headers: cabecalhosApi() });
});
