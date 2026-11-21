import { expect, test } from "@playwright/test";
import { cabecalhosApi, clicar, entrar, sufixo } from "./helpers";

test.describe("Despesas: pesquisa em todos os meses", () => {
  test("o botão 'Todos os meses' muda o total e a escolha fica guardada", async ({ page }) => {
    await entrar(page);
    await page.goto("/#/despesas");
    const total = page.getByTestId("expense-month-total");
    await expect(total).toContainText("do mês");
    await clicar(page.getByTestId("button-all-months"));
    await expect(total).toContainText("todos os meses");
    await expect(page.getByTestId("button-all-months")).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByTestId("expense-month-total")).toContainText("todos os meses");
    // deixa tudo como estava para os outros testes
    await clicar(page.getByTestId("button-all-months"));
    await expect(page.getByTestId("expense-month-total")).toContainText("do mês");
  });

  test("desfazer a remoção de uma despesa", async ({ page, request }, info) => {
    await entrar(page);
    const estado = await (await request.get("/api/state", { headers: cabecalhosApi() })).json();
    const meses = [...estado.months].sort((a: any, b: any) => b.year * 12 + b.month - (a.year * 12 + a.month));
    const mes = meses[0];
    const nota = `desfazer e2e ${sufixo(info.project.name)}`;
    const criada = await request.post("/api/transactions", {
      headers: cabecalhosApi(),
      data: { monthId: mes.id, date: `${mes.year}-${String(mes.month).padStart(2, "0")}-05`, type: "expense", value: 12.34, category: "", note: nota },
    });
    expect(criada.ok()).toBe(true);
    const idCriada = (await criada.json()).id;
    try {
      await page.goto("/#/despesas");
      await page.reload(); // os dados foram criados pela API
      const linha = page.locator('[data-testid^="row-expense-"]').filter({ hasText: nota });
      await expect(linha).toBeVisible();
      await clicar(linha.getByRole("button", { name: "Remover" }));
      await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click();
      await expect(linha).toHaveCount(0);
      await clicar(page.getByTestId("button-undo-delete"));
      await expect(linha).toBeVisible();
    } finally {
      // apaga a despesa criada pelo teste (a recriada por "desfazer" tem outro id)
      const todas = await (await request.get("/api/state", { headers: cabecalhosApi() })).json();
      for (const t of todas.transactions.filter((x: any) => x.note === nota)) await request.delete(`/api/transactions/${t.id}`, { headers: cabecalhosApi() });
      void idCriada;
    }
  });
});
