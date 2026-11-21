import { expect, test } from "@playwright/test";
import { clicar, entrar } from "./helpers";

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
});
