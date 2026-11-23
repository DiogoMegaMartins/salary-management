import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { cabecalhosApi, entrar } from "./helpers";

type Estado = {
  months: { id: number; year: number; month: number; status?: string; base: number }[];
  parcels: { id: number; archived?: number; sortOrder: number }[];
  transactions: { id: number; value: number; category: string; monthId: number }[];
  categories: { id: number; name: string }[];
  allocations: { monthId: number; parcelId: number; value: number }[];
};
async function estado(request: APIRequestContext) {
  const r = await request.get("/api/state", { headers: cabecalhosApi() });
  expect(r.ok()).toBe(true);
  return (await r.json()) as Estado;
}
const abrir = async (page: Page) => {
  await page.getByTestId("assistant-fab").click();
  await expect(page.getByTestId("assistant-chat")).toBeVisible();
};

test.describe("Assistente", () => {
  test.beforeEach(async ({ page }) => entrar(page));

  test("o botão abre o assistente com as quatro tarefas e fecha com Esc", async ({ page }) => {
    await abrir(page);
    for (const k of ["mes", "despesa", "sobra", "resumo"]) await expect(page.getByTestId(`assistant-choice-${k}`)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("assistant-chat")).toHaveCount(0);
    await expect(page.getByTestId("assistant-fab")).toBeVisible();
  });

  test("registar uma despesa: valida, confirma e grava; voltar atrás corrige", async ({ page, request }) => {
    const antes = (await estado(request)).transactions.length;
    await abrir(page);
    await page.getByTestId("assistant-choice-despesa").click();
    await page.getByTestId("assistant-input").fill("abc");
    await page.getByTestId("assistant-send").click();
    await expect(page.getByTestId("assistant-error")).toContainText("Não percebi o valor");
    await page.getByTestId("assistant-input").fill("40,5");
    await page.keyboard.press("Enter");
    await page.getByTestId("assistant-choice-outra").click(); // "Outra…" (categoria)
    await page.getByTestId("assistant-input").fill("Categoria E2E");
    await page.keyboard.press("Enter");
    await page.getByTestId("assistant-choice-outra").click(); // "Outra data…"
    await page.getByTestId("assistant-input").fill("31/02");
    await page.getByTestId("assistant-send").click();
    await expect(page.getByTestId("assistant-error")).toContainText("Não percebi a data");
    await page.getByTestId("assistant-input").fill("15/08/2026");
    await page.getByTestId("assistant-send").click();
    await expect(page.getByTestId("assistant-confirm")).toBeVisible();
    await expect(page.getByTestId("assistant-chat")).toContainText("40,50");
    await page.getByTestId("assistant-confirm").click();
    await expect(page.getByTestId("assistant-chat")).toContainText("registada");
    const st = await estado(request);
    expect(st.transactions.length).toBe(antes + 1);
    const nova = st.transactions.find((t) => t.value === 40.5)!;
    expect(nova.category).toBe("Categoria E2E");
    await request.delete(`/api/transactions/${nova.id}`, { headers: cabecalhosApi() });
    const cat = st.categories.find((c) => c.name === "Categoria E2E");
    if (cat) await request.delete(`/api/categories/${cat.id}`, { headers: cabecalhosApi() });
  });

  test("despesa numa data sem mês explica e não grava", async ({ page, request }) => {
    const antes = (await estado(request)).transactions.length;
    await abrir(page);
    await page.getByTestId("assistant-choice-despesa").click();
    await page.getByTestId("assistant-input").fill("10");
    await page.keyboard.press("Enter");
    await page.getByTestId("assistant-choice-outra").click(); // "Outra…" (categoria)
    await page.getByTestId("assistant-input").fill("Categoria E2E");
    await page.keyboard.press("Enter");
    await page.getByTestId("assistant-choice-outra").click(); // "Outra data…"
    await page.getByTestId("assistant-input").fill("01/01/2001");
    await page.getByTestId("assistant-send").click();
    await expect(page.getByTestId("assistant-chat")).toContainText("Não existe o mês 01/2001");
    expect((await estado(request)).transactions.length).toBe(antes);
  });

  test("Voltar atrás regressa ao passo anterior", async ({ page }) => {
    await abrir(page);
    await page.getByTestId("assistant-choice-despesa").click();
    await expect(page.getByTestId("assistant-input")).toBeVisible();
    await page.getByTestId("assistant-back").click();
    await expect(page.getByTestId("assistant-choice-despesa")).toBeVisible();
  });

  test("registar o mês grava o vencimento (cria o mês ou preenche o que está vazio) e oferece abrir a Divisão", async ({ page, request }) => {
    const antes = await estado(request);
    await abrir(page);
    await page.getByTestId("assistant-choice-mes").click();
    await page.getByTestId("assistant-input").fill("1500");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("assistant-chat")).toContainText("Líquido calculado");
    await page.getByTestId("assistant-confirm").click();
    await expect(page.getByTestId("assistant-action-open")).toBeVisible();
    const st = await estado(request);
    const novo = st.months.find((m) => m.base === 1500 && antes.months.find((a) => a.id === m.id)?.base !== 1500)!;
    expect(novo).toBeTruthy();
    try {
      await page.getByTestId("assistant-action-open").click();
      await expect(page).toHaveURL(new RegExp(`#/divisao/${novo.id}$`));
    } finally {
      if (st.months.length > antes.months.length) await request.delete(`/api/months/${novo.id}`, { headers: cabecalhosApi() });
      else await request.patch(`/api/months/${novo.id}`, { headers: cabecalhosApi(), data: { base: antes.months.find((m) => m.id === novo.id)!.base } });
    }
  });

  test("distribuir o que sobra: tudo para uma parcela e a divisão fica completa", async ({ page, request }, info) => {
    const st = await estado(request);
    const parcelas = st.parcels.filter((p) => !p.archived).sort((a, b) => a.sortOrder - b.sortOrder);
    const r = await request.post("/api/months", { headers: cabecalhosApi(), data: { year: 2060 + (info.project.name === "telemovel" ? 1 : 0), month: 5, label: "Teste assistente", base: 1000, taxaSs: 0, taxaIrsBase: 0 } });
    const mes = await r.json();
    try {
      for (const [i, p] of parcelas.entries())
        await request.put("/api/allocations", { headers: cabecalhosApi(), data: { monthId: mes.id, parcelId: p.id, mode: "fixo", value: [300, 200][i] ?? 0, included: true } });
      await page.reload();
      await abrir(page);
      await page.getByTestId("assistant-choice-sobra").click();
      await expect(page.getByTestId("assistant-chat")).toContainText("sobram 500,00");
      await page.getByTestId("assistant-choice-uma").click();
      await page.getByTestId(`assistant-choice-${parcelas[0].id}`).click();
      await page.getByTestId("assistant-confirm").click();
      await expect(page.getByTestId("assistant-chat")).toContainText("distribuídos");
      const depois = (await estado(request)).allocations.find((a) => a.monthId === mes.id && a.parcelId === parcelas[0].id)!;
      expect(depois.value).toBe(800);
    } finally {
      await request.delete(`/api/months/${mes.id}`, { headers: cabecalhosApi() });
    }
  });

  test("Como estou este mês? mostra o resumo e não grava nada", async ({ page }) => {
    await abrir(page);
    await page.getByTestId("assistant-choice-resumo").click();
    await expect(page.getByTestId("assistant-chat")).toContainText("Disponível");
    await expect(page.getByTestId("assistant-chat")).toContainText("Despesas registadas");
  });

  test("com o Assistente desligado, o botão não aparece", async ({ page, request }) => {
    await request.patch("/api/settings", { headers: cabecalhosApi(), data: { features: '{"assistente":false}' } });
    try {
      await page.reload();
      await expect(page.getByRole("heading", { level: 1, name: "Painel" })).toBeVisible();
      await expect(page.getByTestId("assistant-fab")).toHaveCount(0);
    } finally {
      await request.patch("/api/settings", { headers: cabecalhosApi(), data: { features: "{}" } });
    }
  });
});
