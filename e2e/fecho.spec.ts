import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { cabecalhosApi, entrar } from "./helpers";

type Estado = { months: { id: number; year: number; month: number; status?: string; carryIn?: number; label: string }[]; parcels: { id: number; archived?: number; sortOrder: number }[] };
const H = () => ({ headers: cabecalhosApi() });
async function estado(request: APIRequestContext) {
  const r = await request.get("/api/state", H());
  expect(r.ok()).toBe(true);
  return (await r.json()) as Estado;
}

/** Cria um mês de teste (base 1000, sem descontos → disponível 1000) e distribui `valores` pelas parcelas (as outras a 0). */
async function mes(request: APIRequestContext, year: number, month: number, label: string, valores: number[]) {
  const r = await request.post("/api/months", { ...H(), data: { year, month, label, base: 1000, taxaSs: 0, taxaIrsBase: 0 } });
  expect(r.ok()).toBe(true);
  const m = await r.json();
  const parcelas = (await estado(request)).parcels.filter((p) => !p.archived).sort((a, b) => a.sortOrder - b.sortOrder);
  for (const [i, p] of parcelas.entries())
    expect((await request.put("/api/allocations", { ...H(), data: { monthId: m.id, parcelId: p.id, mode: "fixo", value: valores[i] ?? 0, included: true } })).ok()).toBe(true);
  return m.id as number;
}
/** Limpa: reabre se estiver fechado (desfaz o transporte) e apaga, do mais recente para o mais antigo. */
async function limpar(request: APIRequestContext, ids: number[]) {
  for (const id of [...ids].reverse()) {
    const m = (await estado(request)).months.find((x) => x.id === id);
    if (m?.status === "fechado") await request.post(`/api/months/${id}/reopen`, { ...H(), data: { note: "limpeza do teste" } });
    await request.delete(`/api/months/${id}`, H());
  }
}
const abrirFecho = async (page: Page, rotulo: string) => {
  await page.goto("/#/fecho");
  await page.reload();
  await expect(page.getByTestId("month-closing")).toBeVisible();
  await page.getByTestId("select-closing-month").click();
  await page.getByRole("option", { name: rotulo }).click();
};

test.describe("Fecho do mês: restante e transporte", () => {
  let ids: number[] = [];
  test.beforeEach(async ({ page }) => entrar(page));
  test.afterEach(async ({ request }) => { await limpar(request, ids); ids = []; });

  test("sem restante: fecha-se sem escolher destino", async ({ page, request }, info) => {
    const y = info.project.name === "telemovel" ? 2081 : 2080;
    ids.push(await mes(request, y, 5, "Teste fecho zero", [700, 300]));
    await abrirFecho(page, `Teste fecho zero ${y}`);
    await expect(page.getByTestId("closing-no-destination")).toContainText("sem escolher destino");
    await expect(page.getByTestId("select-closing-dest")).toHaveCount(0);
    await page.getByTestId("button-close-month").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByTestId("closing-status")).toHaveText("Fechado");
  });

  test("com restante e mês seguinte aberto: transporta por defeito e o mês seguinte recebe o valor", async ({ page, request }, info) => {
    const y = info.project.name === "telemovel" ? 2083 : 2082;
    const a = await mes(request, y, 5, "Teste fecho A", [700]); // restante 300
    const b = await mes(request, y, 6, "Teste fecho B", [500]);
    ids.push(a, b);
    await abrirFecho(page, `Teste fecho A ${y}`);
    await expect(page.getByTestId("select-closing-dest")).toContainText("Transportar");
    await page.getByTestId("button-close-month").click();
    await expect(page.getByRole("alertdialog")).toContainText("transportar para o mês seguinte");
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByTestId("closing-status")).toHaveText("Fechado");
    expect((await estado(request)).months.find((m) => m.id === b)!.carryIn).toBe(300);
    // a Divisão do mês seguinte conta o transporte: 1000 + 300 - 500 = 800 por distribuir
    await page.goto(`/#/divisao/${b}`);
    await page.reload();
    await expect(page.getByTestId("division-carry")).toContainText("300,00");
    await expect(page.getByTestId("division-available")).toContainText("1 300,00");
    await expect(page.getByTestId("division-status")).toContainText("800,00");
  });

  test("sem mês seguinte: 'transportar' não se pode escolher e fica 'manter' por defeito", async ({ page, request }, info) => {
    const y = info.project.name === "telemovel" ? 2085 : 2084;
    ids.push(await mes(request, y, 5, "Teste fecho C", [700]));
    await abrirFecho(page, `Teste fecho C ${y}`);
    await expect(page.getByTestId("select-closing-dest")).toContainText("Manter");
    await page.getByTestId("select-closing-dest").click();
    await expect(page.getByRole("option", { name: /Transportar/ })).toHaveAttribute("aria-disabled", "true");
  });

  test("assistente: fechar um mês sem restante não pergunta o destino", async ({ page, request }, info) => {
    const y = info.project.name === "telemovel" ? 2001 : 2000; // o mais antigo: aparece primeiro na lista do assistente
    const id = await mes(request, y, 5, "Teste assistente fecho", [700, 300]);
    ids.push(id);
    await page.reload();
    await page.getByTestId("assistant-fab").click();
    await page.getByTestId("assistant-choice-fechar").click();
    await page.getByTestId(`assistant-choice-${id}`).click();
    await expect(page.getByTestId("assistant-chat")).toContainText("Sem restante");
    await page.getByTestId("assistant-confirm").click();
    await expect(page.getByTestId("assistant-chat")).toContainText("fechado");
    expect((await estado(request)).months.find((m) => m.id === id)!.status).toBe("fechado");
  });

  test("assistente: com restante e mês seguinte, oferece transportar", async ({ page, request }, info) => {
    const y = info.project.name === "telemovel" ? 2003 : 2002;
    const a = await mes(request, y, 5, "Teste assistente fecho A", [700]);
    const b = await mes(request, y, 6, "Teste assistente fecho B", [0]);
    ids.push(a, b);
    await page.reload();
    await page.getByTestId("assistant-fab").click();
    await page.getByTestId("assistant-choice-fechar").click();
    await page.getByTestId(`assistant-choice-${a}`).click();
    await expect(page.getByTestId("assistant-chat")).toContainText("restam 300,00");
    await page.getByTestId("assistant-choice-transportar").click();
    await page.getByTestId("assistant-confirm").click();
    await expect(page.getByTestId("assistant-chat")).toContainText("fechado");
    expect((await estado(request)).months.find((m) => m.id === b)!.carryIn).toBe(300);
  });
});
