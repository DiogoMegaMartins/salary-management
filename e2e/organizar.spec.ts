import { expect, test } from "@playwright/test";
import { cabecalhosApi, clicar, entrar, sufixo } from "./helpers";

const estado = async (request: any) => (await request.get("/api/state", { headers: cabecalhosApi() })).json();

test("organizar: o ecrã inicial resume as quatro áreas", async ({ page }) => {
  await entrar(page);
  await page.goto("/#/organizar");
  await expect(page.getByRole("heading", { level: 1, name: "Organizar" })).toBeVisible();
  for (const id of ["parcelas", "categorias", "plataformas", "movimentos"]) await expect(page.getByTestId(`organizar-${id}`)).toBeVisible();
  await clicar(page.getByTestId("organizar-categorias-abrir"));
  await expect(page.getByRole("heading", { level: 1, name: "Categorias" })).toBeVisible();
  await clicar(page.getByTestId("organizar-voltar"));
  await expect(page.getByTestId("page-organizar")).toBeVisible();
});

test("organizar: o cartão de parcelas abre a gestão e daí o ecrã completo", async ({ page }) => {
  await entrar(page);
  await page.goto("/#/organizar");
  await clicar(page.getByTestId("organizar-parcelas-abrir"));
  await expect(page.getByTestId("parc-manage")).toBeVisible();
  await clicar(page.getByTestId("organizar-parcelas-editor"));
  await expect(page.getByTestId("parcels-list")).toBeVisible();
});

test("organizar: criar, renomear, arquivar e eliminar uma parcela", async ({ page }, info) => {
  const base = `Parc Org ${sufixo(info.project.name)} ${Date.now()}`;
  const novo = `${base} v2`;
  await entrar(page);
  await page.goto("/#/organizar/parcelas");
  await clicar(page.getByTestId("parc-add"));
  await page.getByTestId("parc-new-input").fill(base);
  await page.getByTestId("parc-new-save").click();
  const linha = page.locator('[data-testid^="parc-row-"]', { hasText: base });
  await expect(linha).toBeVisible();
  await expect(linha).toContainText("sem uso");
  await clicar(linha.getByRole("button", { name: /Renomear/ }));
  await page.getByTestId("parc-rename-input").fill(novo);
  await page.getByTestId("parc-rename-save").click();
  const renomeada = page.locator('[data-testid^="parc-row-"]', { hasText: novo });
  await expect(renomeada).toBeVisible();
  await clicar(renomeada.getByRole("button", { name: /Eliminar/ }));
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click();
  await expect(page.locator('[data-testid^="parc-row-"]', { hasText: novo })).toHaveCount(0);
});

test("organizar: criar, renomear, arquivar, restaurar e eliminar uma categoria", async ({ page, request }, info) => {
  const base = `Cat Org ${sufixo(info.project.name)} ${Date.now()}`;
  const novo = `${base} v2`;
  await entrar(page);
  await page.goto("/#/organizar/categorias");
  await expect(page.getByTestId("cat-manage")).toBeVisible();

  await clicar(page.getByTestId("cat-add"));
  await page.getByTestId("cat-new-input").fill(base);
  await page.getByTestId("cat-new-save").click();
  const linha = page.locator('[data-testid^="cat-row-"]', { hasText: base });
  await expect(linha).toBeVisible();
  await expect(linha).toContainText("sem uso");

  // nome repetido é recusado
  await clicar(page.getByTestId("cat-add"));
  await page.getByTestId("cat-new-input").fill(base.toLowerCase());
  await page.getByTestId("cat-new-save").click();
  await expect(page.getByTestId("cat-error")).toContainText("Já existe");
  await page.getByRole("button", { name: "Cancelar" }).click();

  // renomear
  await linha.getByRole("button", { name: /Renomear/ }).click();
  await page.getByTestId("cat-rename-input").fill(novo);
  await page.getByTestId("cat-rename-save").click();
  const renomeada = page.locator('[data-testid^="cat-row-"]', { hasText: novo });
  await expect(renomeada).toBeVisible();

  // arquivar: some da lista; "Mostrar arquivadas" traz de volta; restaurar
  await renomeada.getByRole("button", { name: /Arquivar/ }).click();
  await expect(page.locator('[data-testid^="cat-row-"]', { hasText: novo })).toHaveCount(0);
  await clicar(page.getByTestId("cat-show-archived"));
  const arq = page.locator('[data-testid^="cat-row-"]', { hasText: novo });
  await expect(arq).toContainText("Arquivada");
  await arq.getByRole("button", { name: /Restaurar/ }).click();
  await expect(arq).not.toContainText("Arquivada");

  // eliminar (sem uso)
  await arq.getByRole("button", { name: /Eliminar/ }).click();
  await page.getByRole("button", { name: /Eliminar|Confirmar|Sim/ }).last().click();
  await expect(page.locator('[data-testid^="cat-row-"]', { hasText: novo })).toHaveCount(0);
  const e = await estado(request);
  expect((e.categories as any[]).some((c) => c.name === novo)).toBe(false);
});

test("organizar: uma categoria com movimentos não se elimina, só se arquiva", async ({ page, request }, info) => {
  const nome = `Cat Uso ${sufixo(info.project.name)} ${Date.now()}`;
  const e0 = await estado(request);
  const mes = e0.months[e0.months.length - 1];
  const cat = await (await request.post("/api/categories", { headers: cabecalhosApi(), data: { name: nome } })).json();
  const tx = await (await request.post("/api/transactions", { headers: cabecalhosApi(), data: { monthId: mes.id, date: `${mes.year}-${String(mes.month).padStart(2, "0")}-10`, type: "expense", value: 5, category: nome, note: "organizar-uso" } })).json();
  try {
    await entrar(page);
    await page.goto("/#/organizar/categorias");
    await page.reload();
    const linha = page.locator('[data-testid^="cat-row-"]', { hasText: nome });
    await expect(linha).toContainText("1 movimento");
    await expect(linha.getByRole("button", { name: /Eliminar/ })).toBeDisabled();
  } finally {
    await request.delete(`/api/transactions/${tx.id}`, { headers: cabecalhosApi() });
    await request.delete(`/api/categories/${cat.id}`, { headers: cabecalhosApi() });
  }
});

test("organizar: pesquisar categorias ignora acentos e maiúsculas", async ({ page, request }, info) => {
  const nome = `Saúde Org ${sufixo(info.project.name)} ${Date.now()}`;
  const cat = await (await request.post("/api/categories", { headers: cabecalhosApi(), data: { name: nome } })).json();
  try {
    await entrar(page);
    await page.goto("/#/organizar/categorias");
    await page.reload();
    await page.getByTestId("cat-search").fill("SAUDE ORG");
    await expect(page.locator('[data-testid^="cat-row-"]', { hasText: nome })).toBeVisible();
    await page.getByTestId("cat-search").fill("zzz-nada");
    await expect(page.getByTestId("cat-empty")).toBeVisible();
  } finally {
    await request.delete(`/api/categories/${cat.id}`, { headers: cabecalhosApi() });
  }
});

test("organizar: criar, renomear e arquivar uma plataforma", async ({ page, request }, info) => {
  const base = `Plat Org ${sufixo(info.project.name)} ${Date.now()}`;
  await entrar(page);
  await page.goto("/#/organizar/plataformas");
  await clicar(page.getByTestId("plat-add"));
  await page.getByTestId("plat-new-input").fill(base);
  await page.getByTestId("plat-new-save").click();
  const linha = page.locator('[data-testid^="plat-row-"]', { hasText: base });
  await expect(linha).toContainText("sem uso");
  await linha.getByRole("button", { name: /Renomear/ }).click();
  await page.getByTestId("plat-rename-input").fill(`${base} B`);
  await page.getByTestId("plat-rename-save").click();
  const r = page.locator('[data-testid^="plat-row-"]', { hasText: `${base} B` });
  await expect(r).toBeVisible();
  await r.getByRole("button", { name: /Arquivar/ }).click();
  await expect(page.locator('[data-testid^="plat-row-"]', { hasText: `${base} B` })).toHaveCount(0);
  const e = await estado(request);
  const p = (e.platforms as any[]).find((x) => x.name === `${base} B`);
  expect(p?.archived).toBe(1);
  if (p) await request.delete(`/api/platforms/${p.id}`, { headers: cabecalhosApi() });
});
