import { expect, test, type APIRequestContext } from "@playwright/test";
import { cabecalhosApi, clicar, entrar } from "./helpers";

type Estado = {
  months: { id: number; year: number; month: number; label: string }[];
  parcels: { id: number; name: string; kind: string; targetAmount: number | null; targetDate: string | null }[];
};

async function estado(request: APIRequestContext): Promise<Estado> {
  const r = await request.get("/api/state", { headers: cabecalhosApi() });
  expect(r.ok()).toBe(true);
  return r.json();
}
const ordenados = (e: Estado) => [...e.months].sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));

test.describe("Leituras sobre o histórico", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  test("meta com prazo ultrapassado mostra o aviso no Painel", async ({ page, request }) => {
    const e = await estado(request);
    const meta = e.parcels[0];
    const original = { targetAmount: meta.targetAmount, targetDate: meta.targetDate };
    try {
      const r = await request.patch(`/api/parcels/${meta.id}`, { headers: cabecalhosApi(), data: { targetAmount: 1_000_000, targetDate: "2020-01" } });
      expect(r.ok()).toBe(true);
      await page.goto("/#/");
      await page.reload(); // os dados foram alterados pela API: recarrega o estado
      await expect(page.getByTestId("goals-off-pace")).toBeVisible();
      const linha = page.getByTestId(`dashboard-goal-pace-${meta.id}`);
      await expect(linha).toBeVisible();
      await expect(linha).toHaveAttribute("data-pace", "prazo_passado");
      await expect(linha).toContainText("O prazo já passou");
      // a meta que mais precisa de atenção fica em destaque, com a etiqueta do estado
      await expect(page.getByTestId(`dashboard-goal-${meta.id}`).getByTestId("goal-chip")).toHaveText("Prazo passado");
    } finally {
      await request.patch(`/api/parcels/${meta.id}`, { headers: cabecalhosApi(), data: original });
    }
  });

  test("despesa muito acima do habitual aparece em 'fora do padrão'", async ({ page, request }) => {
    const e = await estado(request);
    const meses = ordenados(e);
    const alvo = meses[meses.length - 1];
    const historico = meses.slice(-4, -1);
    const gastos = e.parcels.find((p) => p.kind === "gastos") ?? e.parcels[0];
    const criados: number[] = [];
    try {
      const novo = async (mes: (typeof meses)[number], valor: number) => {
        const r = await request.post("/api/transactions", {
          headers: cabecalhosApi(),
          data: { monthId: mes.id, date: `${mes.year}-${String(mes.month).padStart(2, "0")}-10`, type: "expense", value: valor, parcelId: gastos.id, category: "Anomalia E2E", note: "e2e" },
        });
        expect(r.ok()).toBe(true);
        criados.push((await r.json()).id);
      };
      for (const m of historico) await novo(m, 10);
      await novo(alvo, 300);

      await page.goto("/#/despesas"); // mostra o mês mais recente, que é o alvo
      await page.reload(); // os dados foram alterados pela API: recarrega o estado
      const item = page.getByTestId("anomaly-anomalia-e2e");
      await expect(item).toBeVisible();
      await expect(item).toContainText("300,00");
      await expect(item).toContainText("habitual");
    } finally {
      for (const id of criados) await request.delete(`/api/transactions/${id}`, { headers: cabecalhosApi() });
    }
  });

  test("comparação com o ano anterior: sem par mostra o aviso; com par mostra a tabela", async ({ page, request }) => {
    await page.goto("/#/");
    await expect(page.getByTestId("yoy-empty")).toBeVisible();

    const criados: number[] = [];
    try {
      for (const [year, base] of [[2025, 1000], [2026, 1200]] as const) {
        const r = await request.post("/api/months", { headers: cabecalhosApi(), data: { year, month: 9, label: `Setembro ${year} E2E`, base } });
        expect(r.ok()).toBe(true);
        criados.push((await r.json()).id);
      }
      await page.goto("/#/");
      await page.reload();
      const cartao = page.getByTestId("yoy-card");
      await expect(cartao).toBeVisible();
      // sem ano de comparação por omissão: pede para escolher
      await expect(page.getByTestId("yoy-empty")).toContainText("Escolhe o ano de comparação");
      await clicar(page.getByTestId("yoy-ref-select"));
      await page.getByRole("option", { name: "Comparar com 2025" }).click();
      await expect(cartao).toContainText("1 mês comparado");
      await expect(page.getByTestId("yoy-row-net")).toContainText("+");

      await page.goto("/#/orcamento");
      await expect(page.getByText("Comparação mensal e anual").first()).toBeVisible();
    } finally {
      for (const id of criados) await request.delete(`/api/months/${id}`, { headers: cabecalhosApi() });
    }
  });

  test("comparar meses do mesmo ano com a base à escolha", async ({ page, request }) => {
    const criados: number[] = [];
    try {
      for (const [month, base] of [[7, 1000], [8, 1200]] as const) {
        const r = await request.post("/api/months", { headers: cabecalhosApi(), data: { year: 2026, month, label: `Mês ${month} E2E`, base } });
        expect(r.ok()).toBe(true);
        criados.push((await r.json()).id);
      }
      await page.goto("/#/");
      await page.reload();
      await expect(page.getByTestId("yoy-card")).toBeVisible();
      await clicar(page.getByTestId("yoy-type-select"));
      await page.getByRole("option", { name: "Comparar com mês" }).click();
      await expect(page.getByTestId("yoy-empty")).toContainText("cada lado");
      await expect(page.getByTestId("yoy-year-select")).toBeVisible();
      await expect(page.getByTestId("yoy-ref-select")).toHaveCount(0);

      // primeiro a base (inicial), depois a comparação (final)
      const ordem = await page.getByTestId("yoy-controls").locator("[data-testid$='-trigger']").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
      expect(ordem.indexOf("yoy-base-trigger")).toBeLessThan(ordem.indexOf("yoy-months-trigger"));
      await clicar(page.getByTestId("yoy-base-trigger"));
      await expect(page.getByTestId("yoy-base-panel").locator("fieldset")).toHaveCount(1); // só o ano escolhido
      await page.getByTestId("yoy-base-month-2026-07").click();
      await page.keyboard.press("Escape");
      await clicar(page.getByTestId("yoy-months-trigger"));
      await page.getByTestId("yoy-months-month-2026-08").click();
      await page.keyboard.press("Escape");

      const cartao = page.getByTestId("yoy-card");
      await expect(cartao).toContainText(/\d+ (mês|meses) de comparação face a \d+ (mês|meses) de base/);
      await expect(cartao.locator("thead th").nth(1)).toHaveText("Base");
      await expect(cartao.locator("thead th").nth(2)).toHaveText("Comparação");
      await expect(page.getByTestId("yoy-row-net")).toContainText("+");

      await clicar(page.getByTestId("yoy-reset"));
      await expect(page.getByTestId("yoy-base-trigger")).toHaveCount(0);
    } finally {
      for (const id of criados) await request.delete(`/api/months/${id}`, { headers: cabecalhosApi() });
    }
  });

  test("escolher os meses e o ano de comparação, com a escolha guardada", async ({ page, request }) => {
    const criados: number[] = [];
    try {
      for (const [year, base] of [[2025, 1000], [2026, 1200]] as const) {
        const r = await request.post("/api/months", { headers: cabecalhosApi(), data: { year, month: 9, label: `Setembro ${year} E2E`, base } });
        expect(r.ok()).toBe(true);
        criados.push((await r.json()).id);
      }
      await page.goto("/#/");
      await page.reload();
      const cartao = page.getByTestId("yoy-card");
      await expect(cartao).toBeVisible();
      await expect(page.getByTestId("yoy-empty")).toContainText("Escolhe o ano de comparação");

      // escolher só o último mês (Setembro 2026) e comparar com 2025
      await clicar(page.getByTestId("yoy-months-trigger"));
      await page.getByTestId("yoy-months-year-2026").click(); // primeiro o ano, depois os meses
      const todos = page.getByTestId("yoy-months-toggle-all");
      await expect(todos).toHaveText("Limpar seleção");
      await todos.click();
      await expect(page.getByTestId("yoy-months-trigger")).toContainText("nenhum mês");
      await expect(page.getByTestId("yoy-empty")).toBeVisible();
      await page.getByTestId("yoy-months-month-2026-09").click();
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("yoy-months-trigger")).toContainText("1 mês");
      await clicar(page.getByTestId("yoy-ref-select"));
      await page.getByRole("option", { name: "Comparar com 2025" }).click();
      await expect(cartao).toContainText("1 mês comparado com o mesmo mês de 2025");
      // métricas novas
      for (const linha of ["gross", "descontos", "tax"]) await expect(page.getByTestId(`yoy-row-${linha}`)).toBeVisible();

      // o ano escolhido não aparece como ano de comparação
      await clicar(page.getByTestId("yoy-ref-select"));
      await expect(page.getByRole("option", { name: "Comparar com 2026" })).toHaveCount(0);
      await expect(page.getByRole("option", { name: "Comparar com ano anterior" })).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(cartao.locator("thead th").nth(1)).toHaveText("2026");
      await expect(cartao.locator("thead th").nth(2)).toHaveText("2025");

      // a escolha fica guardada e vale também no Orçamento
      await page.reload();
      await expect(page.getByTestId("yoy-months-trigger")).toContainText("1 mês");
      await expect(page.getByTestId("yoy-card")).toContainText("de 2025");
      await page.goto("/#/orcamento");
      await expect(page.getByTestId("yoy-months-trigger")).toContainText("1 mês");

      // repor volta aos meses do filtro
      await clicar(page.getByTestId("yoy-reset"));
      await expect(page.getByTestId("yoy-reset")).toHaveCount(0);
    } finally {
      for (const id of criados) await request.delete(`/api/months/${id}`, { headers: cabecalhosApi() });
    }
  });

  test("relatório anual em PDF", async ({ page }) => {
    await page.goto("/#/");
    await clicar(page.getByTestId("button-open-report"));
    await page.getByTestId("select-report-scope").click();
    await page.getByRole("option", { name: /Relatório anual de \d{4}/ }).first().click();
    const [descarga] = await Promise.all([page.waitForEvent("download"), clicar(page.getByTestId("button-generate-report-pdf"))]);
    expect(descarga.suggestedFilename()).toMatch(/^relatorio-anual-\d{4}-particao-salario\.pdf$/);
    const bytes = await (await import("node:fs/promises")).readFile(await descarga.path());
    expect(bytes.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(bytes.length).toBeGreaterThan(1500);
  });

  test("descarregar o relatório em PDF", async ({ page }) => {
    await page.goto("/#/");
    await clicar(page.getByTestId("button-open-report"));
    const [descarga] = await Promise.all([page.waitForEvent("download"), clicar(page.getByTestId("button-generate-report-pdf"))]);
    expect(descarga.suggestedFilename()).toMatch(/^relatorio-particao-salario-\d{4}-\d{2}-\d{2}\.pdf$/);
    const bytes = await (await import("node:fs/promises")).readFile(await descarga.path());
    expect(bytes.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(bytes.subarray(-8).toString("latin1")).toContain("%%EOF");
    expect(bytes.length).toBeGreaterThan(1500);
  });
});
