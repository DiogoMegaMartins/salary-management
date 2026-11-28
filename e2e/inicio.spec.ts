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

test("início: com um layout antigo guardado, o resumo enche a sua caixa e alinha com os cartões da direita", async ({ page }, info) => {
  test.skip(info.project.name === "telemovel", "a grelha com layout guardado só existe em ecrãs largos");
  const antigo: Record<string, { x: number; y: number; w: number; h: number }> = {};
  ["kpi-net", "kpi-avg", "kpi-savings", "kpi-spent", "kpi-tax", "kpi-remaining"].forEach((id, i) => { antigo[id] = { x: (i % 3) * 4, y: Math.floor(i / 3) * 3, w: 4, h: 3 }; });
  antigo["rendimento-poupanca"] = { x: 0, y: 6, w: 7, h: 11 };
  await page.request.patch("/api/settings", { data: { uiMode: "detalhado", pageLayouts: JSON.stringify({ painel: antigo }) }, headers: cabecalhosApi() });
  try {
    await entrar(page);
    await page.goto("/#/");
    await page.reload();
    await expect(page.getByTestId("inicio-summary")).toBeVisible();
    const m = await page.evaluate(() => {
      const bottom = (e: Element | null) => Math.round((e as HTMLElement).getBoundingClientRect().bottom);
      const resumo = document.querySelector('[data-testid="inicio-summary"]');
      const ultimo = document.querySelector('[data-testid="kpi-remaining"]')!.closest(".grid-widget");
      return { resumo: bottom(resumo), caixaResumo: bottom(resumo!.closest(".grid-widget")), ultimo: bottom(ultimo) };
    });
    expect(Math.abs(m.resumo - m.caixaResumo)).toBeLessThanOrEqual(2); // o cartão enche a caixa
    expect(Math.abs(m.resumo - m.ultimo)).toBeLessThanOrEqual(2); // e acaba onde acaba o cartão de baixo, à direita
  } finally {
    await page.request.patch("/api/settings", { data: { pageLayouts: "{}" }, headers: cabecalhosApi() });
  }
});

test("início Básico: os dois cartões de cima têm a mesma altura, mesmo sem despesas", async ({ page }, info) => {
  test.skip(info.project.name === "telemovel", "no telemóvel os cartões ficam um por baixo do outro");
  await modo(page, "basico");
  await entrar(page);
  await abrirInicio(page);
  const alturas = await page.evaluate(() => {
    const resumo = document.querySelector('[data-testid="inicio-summary"]') as HTMLElement;
    const anel = document.querySelector('section[aria-label="Para onde vai o dinheiro"]') as HTMLElement;
    return { resumo: Math.round(resumo.getBoundingClientRect().height), anel: Math.round(anel.getBoundingClientRect().height) };
  });
  expect(Math.abs(alturas.resumo - alturas.anel)).toBeLessThanOrEqual(2);
});

test("início Básico: dá para editar e guardar o layout", async ({ page, request }, info) => {
  test.skip(info.project.name === "telemovel", "a edição por arrastar só existe em ecrãs largos");
  await modo(page, "basico");
  await entrar(page);
  await abrirInicio(page);
  await clicar(page.getByTestId("button-edit-layout"));
  await expect(page.getByText("Modo de edição")).toBeVisible();
  await expect(page.getByText("Valor disponível", { exact: true }).first()).toBeVisible(); // as secções ficam arrastáveis
  await clicar(page.getByTestId("button-save-layout-painel-basico"));
  await expect(page.getByText("Modo de edição")).toBeHidden();
  await expect(async () => {
    const e = await (await request.get("/api/state", { headers: cabecalhosApi() })).json();
    const guardado = JSON.parse(e.settings.pageLayouts || "{}")["painel-basico"];
    expect(guardado?.["basico-resumo"]).toBeTruthy();
    expect(guardado?.["basico-ultimas"]).toBeTruthy();
  }).toPass({ timeout: 8000 });
  await request.patch("/api/settings", { data: { pageLayouts: "{}" }, headers: cabecalhosApi() }); // deixa como estava
});

test("modo Básico: Orçamento e Carteira também deixam editar o layout", async ({ page }, info) => {
  test.skip(info.project.name === "telemovel", "a edição por arrastar só existe em ecrãs largos");
  await modo(page, "basico");
  await entrar(page);
  for (const rota of ["#/orcamento", "#/carteira"]) {
    await page.goto(`/${rota}`);
    await expect(page.getByTestId("button-edit-layout")).toBeVisible();
  }
});

test("início: metas em cartões; escolher uma abre o ritmo e as submetas por baixo", async ({ page, request }) => {
  const estado = async () => (await (await request.get("/api/state", { headers: cabecalhosApi() })).json());
  const e0 = await estado();
  const [a, b] = e0.parcels.filter((p: any) => !p.archived);
  const orig = [a, b].map((p: any) => ({ id: p.id, targetAmount: p.targetAmount, targetDate: p.targetDate }));
  let sub: any;
  try {
    for (const p of [a, b]) await request.patch(`/api/parcels/${p.id}`, { headers: cabecalhosApi(), data: { targetAmount: 50_000, targetDate: "2030-06" } });
    sub = await (await request.post("/api/subgoals", { headers: cabecalhosApi(), data: { parcelId: b.id, name: "Submeta de teste", currency: "EUR", target: 1000 } })).json();
    await entrar(page);
    await page.goto("/#/");
    await page.reload();
    const cartaoB = page.getByTestId(`dashboard-goal-${b.id}`);
    await cartaoB.scrollIntoViewIfNeeded();
    await clicar(cartaoB);
    await expect(cartaoB).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId(`dashboard-goal-${a.id}`)).toHaveAttribute("aria-pressed", "false");
    const detalhe = page.getByTestId(`dashboard-goal-detail-${b.id}`);
    await expect(detalhe).toBeVisible();
    await expect(detalhe.getByTestId(`dashboard-subgoal-${sub.id}`)).toContainText("Submeta de teste");
    await clicar(page.getByTestId(`dashboard-goal-${a.id}`));
    await expect(page.getByTestId(`dashboard-goal-detail-${a.id}`)).toBeVisible();
    await expect(page.getByTestId(`dashboard-goal-detail-${b.id}`)).toHaveCount(0);
  } finally {
    if (sub?.id) await request.delete(`/api/subgoals/${sub.id}`, { headers: cabecalhosApi() });
    for (const o of orig) await request.patch(`/api/parcels/${o.id}`, { headers: cabecalhosApi(), data: { targetAmount: o.targetAmount, targetDate: o.targetDate } });
  }
});
