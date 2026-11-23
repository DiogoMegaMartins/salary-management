import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { cabecalhosApi, entrar } from "./helpers";

type Estado = { parcels: { id: number; archived?: number; sortOrder: number }[]; allocations: { monthId: number; parcelId: number; mode: string; value: number }[] };

async function estado(request: APIRequestContext) {
  const r = await request.get("/api/state", { headers: cabecalhosApi() });
  expect(r.ok()).toBe(true);
  return (await r.json()) as Estado;
}

/** Abre a divisão do primeiro mês da lista e devolve o seu id (a Divisão muda de sítio na fase 2; os testes passam por aqui). */
async function abrirDivisao(page: Page): Promise<number> {
  await page.goto("/#/meses");
  const botao = page.locator('[data-testid^="button-edit-"], [data-testid^="button-mobile-edit-"]').filter({ visible: true }).first();
  const id = Number((await botao.getAttribute("data-testid"))!.replace(/\D/g, ""));
  await botao.click();
  await page.getByTestId("tab-divisao").click();
  return id;
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
