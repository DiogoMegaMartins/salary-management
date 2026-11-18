import { expect, test } from "@playwright/test";
import { clicar, entrar, sufixo } from "./helpers";


test.describe("Fluxos de escrita", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  test("criar e eliminar uma plataforma", async ({ page }, info) => {
    const nome = `Plataforma E2E ${sufixo(info.project.name)}`;
    await page.goto("/#/dados");
    await page.getByTestId("settings-tab-catalogos").click();
    await page.getByTestId("input-new-platform").fill(nome);
    await clicar(page.getByTestId("button-create-platform"));
    // o nome está num campo editável (aria-label "Nome: ..."), não em texto da linha
    const linha = page.locator('[data-testid^="row-platform-"]').filter({ has: page.getByLabel(`Nome: ${nome}`, { exact: true }) });
    await expect(linha).toBeVisible();

    // duplicado (sem distinguir maiúsculas) é recusado
    await page.getByTestId("input-new-platform").fill(nome.toLowerCase());
    await clicar(page.getByTestId("button-create-platform"));
    await expect(page.getByText(/Já existe uma plataforma/).first()).toBeVisible();

    await clicar(linha.getByRole("button", { name: "Eliminar" }));
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(linha).toHaveCount(0);
  });

  test("criar uma despesa, vê-la na lista e eliminá-la", async ({ page }, info) => {
    const nota = `Despesa E2E ${sufixo(info.project.name)}`;
    await page.goto("/#/despesas");
    const total = page.getByTestId("expense-month-total");
    await expect(total).toBeVisible();
    await page.getByTestId("button-new-expense").click();
    await expect(page.getByTestId("expense-form")).toBeVisible();
    await page.getByTestId("input-expense-value").fill("12,34");
    await page.getByTestId("input-expense-note").fill(nota);
    await clicar(page.getByTestId("button-save-expense"));
    const linha = page.locator('[data-testid^="row-expense-"]', { hasText: nota });
    await expect(linha).toBeVisible();

    // continua lá depois de recarregar
    await page.reload();
    await expect(linha).toBeVisible();

    await clicar(linha.getByRole("button", { name: "Remover" }));
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(linha).toHaveCount(0);
  });

  test("criar um mês, vê-lo na lista e eliminá-lo", async ({ page }) => {
    // o mês seguinte ao último do conjunto inicial (Setembro 2026) vem preenchido por omissão
    // computador: botão "Eliminar" dentro da linha do mês; telemóvel: botão "Eliminar Setembro"
    const eliminarSetembro = () =>
      page
        .locator('[data-testid^="row-month-"]', { hasText: "Setembro" })
        .getByRole("button", { name: "Eliminar" })
        .or(page.getByRole("button", { name: "Eliminar Setembro" }))
        .filter({ visible: true });

    await page.goto("/#/meses");
    await page.getByTestId("button-new-month").click();
    await page.getByTestId("input-base").fill("1000");
    await clicar(page.getByTestId("button-save-month"));
    // depois de guardar, a janela fica aberta (para editar a divisão); fecha-se para ver a lista
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(eliminarSetembro()).toHaveCount(1);

    await page.reload();
    await expect(eliminarSetembro()).toHaveCount(1);
    await clicar(eliminarSetembro());
    await page.getByRole("alertdialog").getByRole("button", { name: /Confirmar|Eliminar/ }).click();
    await expect(eliminarSetembro()).toHaveCount(0);
  });
});
