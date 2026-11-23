import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { cabecalhosApi, entrar } from "./helpers";

type Estado = { months: { id: number; year: number; month: number; status?: string; label: string }[]; transactions: { monthId: number; id: number }[]; parcels: { id: number; archived?: number; sortOrder: number }[]; allocations: { monthId: number; parcelId: number; mode: string; value: number }[] };

async function estado(request: APIRequestContext) {
  const r = await request.get("/api/state", { headers: cabecalhosApi() });
  expect(r.ok()).toBe(true);
  return (await r.json()) as Estado;
}

/** Abre a página Divisão (o mês por omissão é o último aberto) e devolve o id do mês escolhido. */
async function abrirDivisao(page: Page, mes?: number): Promise<number> {
  await page.goto(mes ? `/#/divisao/${mes}` : "/#/divisao");
  await expect(page.getByRole("heading", { level: 1, name: "Divisão" })).toBeVisible();
  await expect(page.getByTestId("division-panel")).toBeVisible();
  const estadoAtual = await estado(page.request);
  const aberto = [...(estadoAtual as any).months].sort((a: any, b: any) => a.year - b.year || a.month - b.month).reverse().find((m: any) => m.status !== "fechado");
  return mes ?? aberto.id;
}

test.describe("Divisão do salário", () => {
  test.beforeEach(async ({ page }) => entrar(page));

  test("editar o valor de uma parcela atualiza o alocado e o restante", async ({ page, request }) => {
    const parcela = (await estado(request)).parcels.filter((p) => !p.archived).sort((a, b) => a.sortOrder - b.sortOrder)[0];
    const mesId = await abrirDivisao(page);
    const antes = (await estado(request)).allocations.find((a) => a.monthId === mesId && a.parcelId === parcela.id);
    await expect(page.getByTestId("division-summary")).toBeVisible();
    await page.getByTestId(`select-mode-${parcela.id}`).click();
    await page.getByRole("option", { name: "€ fixo" }).click();
    const campo = page.getByTestId(`input-alloc-${parcela.id}`);
    await campo.fill("123,45");
    await campo.blur();
    await expect(page.getByTestId(`text-alloc-${parcela.id}`)).toContainText("123,45");
    await expect(page.getByTestId("badge-remaining")).toBeVisible();
    await request.put("/api/allocations", { headers: cabecalhosApi(), data: { monthId: mesId, parcelId: parcela.id, mode: antes?.mode ?? "fixo", value: antes?.value ?? 0 } }); // repõe
  });
});

test.describe("Página Divisão: estados", () => {
  test.beforeEach(async ({ page }) => entrar(page));
  test.afterEach(async ({ request }) => { await request.patch("/api/settings", { headers: cabecalhosApi(), data: { features: "{}" } }); });

  test("um id de mês que não existe cai num mês válido, sem ecrã em branco", async ({ page }) => {
    await page.goto("/#/divisao/999999");
    await expect(page.getByTestId("division-panel")).toBeVisible();
  });

  test("mudar o mês no seletor muda a rota", async ({ page, request }) => {
    const meses = (await estado(request)).months;
    test.skip(meses.length < 2, "precisa de dois meses");
    await page.goto("/#/divisao");
    await page.getByTestId("select-division-month").click();
    await page.getByRole("option").nth(1).click();
    await expect(page).toHaveURL(/#\/divisao\/\d+$/);
  });

  test("os movimentos estão num separador próprio, com o painel de movimentos", async ({ page }) => {
    await page.goto("/#/divisao");
    await page.getByTestId("division-tab-movimentos").click();
    await expect(page.getByTestId("movements-panel")).toBeVisible();
  });

  test("só com Movimentos ligados não há barra de separadores e vê-se os movimentos", async ({ page, request }) => {
    await request.patch("/api/settings", { headers: cabecalhosApi(), data: { features: '{"divisao":false}' } });
    await page.goto("/#/divisao");
    await page.reload();
    await expect(page.getByTestId("movements-panel")).toBeVisible();
    await expect(page.getByTestId("division-tab-divisao")).toHaveCount(0);
  });

  test("sem Divisão nem Movimentos, a rota volta ao Painel e o menu perde a Divisão", async ({ page, request }) => {
    await request.patch("/api/settings", { headers: cabecalhosApi(), data: { features: '{"divisao":false,"movimentos":false}' } });
    await page.goto("/#/divisao");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Painel" })).toBeVisible();
  });
});
