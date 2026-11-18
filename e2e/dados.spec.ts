import { expect, test } from "@playwright/test";
import { cabecalhosApi, clicar, clicarAteAparecer, entrar, sufixo } from "./helpers";

/** Estado completo através da API (só para preparar e verificar dados). */
async function estado(request: import("@playwright/test").APIRequestContext) {
  const r = await request.get("/api/state", { headers: cabecalhosApi() });
  expect(r.ok()).toBe(true);
  return (await r.json()) as { months: { id: number; label: string; status?: string }[]; parcels: { id: number; name: string }[]; transactions: { id: number; note: string; value: number }[] };
}

test.describe("Fecho, importação e restauro", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  test("fechar um mês, ver o histórico e reabri-lo", async ({ page, request }, info) => {
    const motivo = `Reabertura E2E ${sufixo(info.project.name)}`;
    await page.goto("/#/fecho");
    await expect(page.getByTestId("month-closing")).toBeVisible();
    await expect(page.getByText("Aberto", { exact: true })).toBeVisible();

    // "manter" não mexe noutros meses
    await page.getByTestId("select-closing-dest").click();
    await page.getByRole("option", { name: /manter/i }).click();
    await clicar(page.getByTestId("button-close-month"));
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Fechado", { exact: true })).toBeVisible();
    await expect(page.getByTestId("closing-history")).toContainText(/fecho/i);
    expect((await estado(request)).months.some((m) => m.status === "fechado")).toBe(true);

    await page.getByTestId("input-reopen-note").fill(motivo);
    const confirmar = page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" });
    await clicarAteAparecer(page.getByTestId("button-reopen-month"), confirmar);
    await confirmar.click();
    await expect(page.getByText("Aberto", { exact: true })).toBeVisible();
    await expect(page.getByTestId("closing-history")).toContainText(motivo);
    expect((await estado(request)).months.some((m) => m.status === "fechado")).toBe(false);
  });

  test("importar um CSV, ver a linha nas despesas e removê-la", async ({ page }, info) => {
    const nota = `Linha CSV E2E ${sufixo(info.project.name)}`;
    await page.goto("/#/dados");
    await page.getByTestId("settings-tab-backups").click();
    // a nota faz parte do conteúdo: cada projeto importa um ficheiro diferente (o mesmo ficheiro é recusado)
    await page.getByTestId("input-csv-file").setInputFiles({
      name: "e2e.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(`data;valor;categoria;nota\n2026-08-05;-12,50;Casa;${nota}\n`),
    });
    await page.getByTestId("csv-parcel").click();
    await page.getByRole("option").first().click();
    await clicar(page.getByTestId("button-csv-preview"));
    await expect(page.getByTestId("csv-summary")).toContainText("1 a importar");
    await expect(page.getByTestId("csv-summary")).toContainText("0 com erro");
    await clicar(page.getByTestId("button-csv-import"));
    const importado = page.waitForResponse((r) => r.url().includes("/api/import/csv") && !r.url().includes("preview") && r.request().method() === "POST");
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click();
    expect((await importado).ok()).toBe(true);

    await page.goto("/#/despesas");
    await page.getByTestId("select-expense-month").click();
    await page.getByRole("option", { name: /Agosto/ }).click();
    const linha = page.locator('[data-testid^="row-expense-"]', { hasText: nota });
    await expect(linha).toBeVisible();
    await clicar(linha.getByRole("button", { name: "Remover" }));
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(linha).toHaveCount(0);
  });

  test("restaurar um backup JSON repõe o que foi apagado depois da exportação", async ({ page, request }, info) => {
    const nota = `Backup E2E ${sufixo(info.project.name)}`;
    const antes = await estado(request);
    const mes = antes.months[0];
    const parcela = antes.parcels[0];
    const criado = await request.post("/api/transactions", {
      headers: cabecalhosApi(),
      data: { monthId: mes.id, date: "2026-01-10", type: "expense", value: 7.5, parcelId: parcela.id, category: "Casa", note: nota },
    });
    expect(criado.ok()).toBe(true);
    const idCriado = (await criado.json()).id as number;

    await page.goto("/#/dados");
    await page.getByTestId("settings-tab-backups").click();
    const [descarga] = await Promise.all([page.waitForEvent("download"), clicar(page.getByTestId("button-export-json"))]);
    const ficheiro = await descarga.path();

    // apaga o movimento criado e confirma que desapareceu
    const apagado = await request.delete(`/api/transactions/${idCriado}`, { headers: cabecalhosApi() });
    expect(apagado.ok()).toBe(true);
    expect((await estado(request)).transactions.some((t) => t.note === nota)).toBe(false);

    await page.locator('input[type="file"][accept*="json"]').setInputFiles(ficheiro);
    const confirmacao = page.locator('[role="dialog"], [role="alertdialog"]');
    await expect(confirmacao).toContainText("Substituir tudo por este backup?");
    await clicar(page.getByTestId("button-confirm-import"));
    await expect(confirmacao).toHaveCount(0);

    const depois = await estado(request);
    expect(depois.transactions.some((t) => t.note === nota)).toBe(true);
    expect(depois.months.length).toBe(antes.months.length);

    // limpeza: remove o movimento restaurado
    const restaurado = depois.transactions.find((t) => t.note === nota)!;
    await request.delete(`/api/transactions/${restaurado.id}`, { headers: cabecalhosApi() });
  });
});
