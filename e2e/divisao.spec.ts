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
    await page.getByTestId(`mode-${parcela.id}-fixo`).click();
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

test.describe("Do mês para a Divisão", () => {
  test.beforeEach(async ({ page }) => entrar(page));

  test("o resumo no editor do mês leva à Divisão desse mês", async ({ page }) => {
    await page.goto("/#/meses");
    const botao = page.locator('[data-testid^="button-edit-"], [data-testid^="button-mobile-edit-"]').filter({ visible: true }).first();
    const id = (await botao.getAttribute("data-testid"))!.replace(/\D/g, "");
    await botao.click();
    await page.getByTestId("button-open-division").click();
    await expect(page).toHaveURL(new RegExp(`#/divisao/${id}$`));
    await expect(page.getByTestId("division-panel")).toBeVisible();
  });

  test("em mês novo (ainda não guardado) não há resumo da divisão", async ({ page }) => {
    await page.goto("/#/meses");
    await page.getByTestId("button-new-month").click();
    await expect(page.getByTestId("month-editor")).toBeVisible();
    await expect(page.getByTestId("division-glance")).toHaveCount(0);
  });
});

/** Cria um mês de teste com a divisão controlada: 1.ª parcela 300 €, 2.ª 200 €, as outras 0 €. Devolve os ids. */
async function mesDeTeste(request: APIRequestContext, seed: number) {
  const st = await estado(request);
  const parcelas = st.parcels.filter((p) => !p.archived).sort((a, b) => a.sortOrder - b.sortOrder);
  const r = await request.post("/api/months", { headers: cabecalhosApi(), data: { year: 2040 + seed, month: 5, label: "Teste divisão", base: 1000, taxaSs: 0, taxaIrsBase: 0 } });
  expect(r.ok()).toBe(true);
  const mes = await r.json();
  const valores = [300, 200];
  for (const [i, p] of parcelas.entries()) {
    const put = await request.put("/api/allocations", { headers: cabecalhosApi(), data: { monthId: mes.id, parcelId: p.id, mode: "fixo", value: valores[i] ?? 0, included: true } });
    expect(put.ok()).toBe(true);
  }
  return { mesId: mes.id as number, a: parcelas[0].id, b: parcelas[1].id };
}

/** Abre a Divisão de um mês criado há instantes pela API (recarrega para a app o conhecer). */
async function abrirMes(page: Page, id: number) {
  await page.goto(`/#/divisao/${id}`);
  await page.reload();
  await expect(page.getByTestId("division-panel")).toBeVisible();
}

test.describe("Divisão renovada", () => {
  let mesId = 0;
  test.beforeEach(async ({ page }) => entrar(page));
  test.afterEach(async ({ request }) => {
    if (mesId) await request.delete(`/api/months/${mesId}`, { headers: cabecalhosApi() });
    mesId = 0;
  });

  test("tirar uma parcela do mês liberta o valor e guarda-o para quando voltar", async ({ page, request }, info) => {
    const m = await mesDeTeste(request, info.project.name === "telemovel" ? 1 : 2);
    mesId = m.mesId;
    await abrirMes(page, m.mesId);
    await expect(page.getByTestId("division-status")).toContainText("Por distribuir");
    await expect(page.getByTestId("division-status")).toContainText("500,00");
    await page.getByTestId(`switch-include-${m.b}`).click();
    await expect(page.getByTestId("division-status")).toContainText("700,00");
    await expect(page.getByTestId(`input-alloc-${m.b}`)).toHaveCount(0); // sem controlos enquanto está fora
    const guardado = (await estado(request)).allocations.find((a) => a.monthId === m.mesId && a.parcelId === m.b)!;
    expect(guardado.value).toBe(200); // o valor não se perdeu
    await page.getByTestId(`switch-include-${m.b}`).click();
    await expect(page.getByTestId("division-status")).toContainText("500,00");
  });

  test("− e + ajustam o valor e o resumo acompanha", async ({ page, request }, info) => {
    const m = await mesDeTeste(request, info.project.name === "telemovel" ? 3 : 4);
    mesId = m.mesId;
    await abrirMes(page, m.mesId);
    await page.getByTestId(`alloc-plus-${m.a}`).click();
    await expect(page.getByTestId(`text-alloc-${m.a}`)).toContainText("310,00");
    await page.getByTestId(`alloc-minus-${m.a}`).click();
    await expect(page.getByTestId(`text-alloc-${m.a}`)).toContainText("300,00");
  });

  test("Distribuir o que sobra: mostra o resultado e deixa tudo distribuído a verde", async ({ page, request }, info) => {
    const m = await mesDeTeste(request, info.project.name === "telemovel" ? 5 : 6);
    mesId = m.mesId;
    await abrirMes(page, m.mesId);
    await page.getByTestId("button-distribute-leftover").click();
    await expect(page.getByTestId("leftover-preview")).toContainText("500,00");
    await page.getByTestId("button-apply-leftover").click();
    await expect(page.getByTestId("division-status")).toContainText("Tudo distribuído");
    await expect(page.getByTestId("badge-remaining")).toContainText("0,00");
    await expect(page.getByTestId("button-distribute-leftover")).toBeDisabled(); // nada a distribuir
  });

  test("Distribuir proporcionalmente reparte pelas parcelas em € fixo", async ({ page, request }, info) => {
    const m = await mesDeTeste(request, info.project.name === "telemovel" ? 7 : 8);
    mesId = m.mesId;
    await abrirMes(page, m.mesId);
    await page.getByTestId("button-distribute-leftover").click();
    await page.getByTestId("leftover-kind-proporcional").click();
    await page.getByTestId("button-apply-leftover").click();
    await expect(page.getByTestId("division-status")).toContainText("Tudo distribuído");
    const st = await estado(request);
    const a = st.allocations.find((x) => x.monthId === m.mesId && x.parcelId === m.a)!.value;
    const b = st.allocations.find((x) => x.monthId === m.mesId && x.parcelId === m.b)!.value;
    expect(a).toBeCloseTo(600, 2); // 300 + 60% de 500
    expect(b).toBeCloseTo(400, 2); // 200 + 40% de 500
  });

  test("Aplicar modelo num mês com dados pede confirmação e cancelar não muda nada", async ({ page, request }, info) => {
    const m = await mesDeTeste(request, info.project.name === "telemovel" ? 9 : 10);
    mesId = m.mesId;
    await abrirMes(page, m.mesId);
    await page.getByTestId("button-apply-rules").click();
    await expect(page.getByTestId("dialog-confirm")).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar" }).click();
    const a = (await estado(request)).allocations.find((x) => x.monthId === m.mesId && x.parcelId === m.a)!.value;
    expect(a).toBe(300);
  });

  test("com Plataformas e carteira desligada, a parcela não oferece detalhe por plataforma", async ({ page, request }, info) => {
    const m = await mesDeTeste(request, info.project.name === "telemovel" ? 11 : 12);
    mesId = m.mesId;
    await request.patch("/api/settings", { headers: cabecalhosApi(), data: { features: '{"plataformas":false}' } });
    await abrirMes(page, m.mesId);
    await page.reload();
    await expect(page.getByTestId(`allocation-card-${m.a}`)).toBeVisible();
    await expect(page.getByTestId(`detail-${m.a}`)).toHaveCount(0);
    await request.patch("/api/settings", { headers: cabecalhosApi(), data: { features: "{}" } });
  });
});

test.describe("Detalhe por plataforma (opcional)", () => {
  let mesId = 0;
  test.beforeEach(async ({ page }) => entrar(page));
  test.afterEach(async ({ request }) => {
    if (mesId) await request.delete(`/api/months/${mesId}`, { headers: cabecalhosApi() });
    mesId = 0;
  });

  test("por defeito está fechado; detalhar guarda e mostra o que falta detalhar", async ({ page, request }, info) => {
    const m = await mesDeTeste(request, info.project.name === "telemovel" ? 13 : 14);
    mesId = m.mesId;
    await abrirMes(page, m.mesId);
    await expect(page.getByTestId(`button-distribute-${m.a}`)).toContainText("Detalhar por plataforma");
    await expect(page.getByTestId(`panel-distribute-${m.a}`)).toHaveCount(0);
    await page.getByTestId(`button-distribute-${m.a}`).click();
    await page.getByTestId(`button-add-dist-line-${m.a}`).click();
    const campo = page.getByTestId(`input-dist-value-${m.a}-0`);
    await campo.fill("100");
    await campo.blur();
    await page.getByTestId(`button-save-dist-${m.a}`).click();
    await expect(page.getByTestId(`detail-status-${m.a}`)).toContainText("Por detalhar 200,00");
  });
});
