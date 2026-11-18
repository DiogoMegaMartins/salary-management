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
      await expect(page.getByTestId("goals-off-pace")).toBeVisible();
      const linha = page.getByTestId(`dashboard-goal-pace-${meta.id}`);
      await expect(linha).toBeVisible();
      await expect(linha).toHaveAttribute("data-pace", "prazo_passado");
      await expect(linha).toContainText("O prazo já passou");
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

      await page.goto("/#/");
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
      await expect(cartao).toContainText("1 mês comparado");
      await expect(page.getByTestId("yoy-row-net")).toContainText("+");

      await page.goto("/#/orcamento");
      await expect(page.getByText("Face ao ano anterior").first()).toBeVisible();
    } finally {
      for (const id of criados) await request.delete(`/api/months/${id}`, { headers: cabecalhosApi() });
    }
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
