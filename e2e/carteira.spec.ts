import { expect, test } from "@playwright/test";
import { clicar, entrar, sufixo } from "./helpers";

test.describe("Carteira: valor atual e rentabilidade", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  test("registar o valor de uma parcela, ver o ganho ou a perda e removê-lo", async ({ page }, info) => {
    const nota = `valor e2e ${sufixo(info.project.name)}`;
    await page.goto("/#/carteira");
    const cartao = page.getByTestId("valuations-table");
    await cartao.scrollIntoViewIfNeeded();
    await expect(cartao).toBeVisible();

    await clicar(page.getByTestId("button-add-valuation"));
    const dialogo = page.getByTestId("dialog-valuation");
    await expect(dialogo).toBeVisible();
    await dialogo.getByTestId("input-valuation-value").fill("100000,5");
    await dialogo.getByLabel("Nota").fill(nota);
    await clicar(dialogo.getByTestId("button-save-valuation"));

    const historico = page.getByTestId("valuations-history");
    const linha = historico.locator("li").filter({ hasText: nota });
    await expect(linha).toBeVisible();
    await expect(linha).toContainText("100 000,50");
    // com um valor registado aparece o total e o ganho
    await expect(page.getByTestId("valuations-total")).toBeVisible();

    await clicar(linha.getByRole("button", { name: /Remover o valor/ }));
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(historico.locator("li").filter({ hasText: nota })).toHaveCount(0);
  });

  test("não deixa guardar sem valor", async ({ page }) => {
    await page.goto("/#/carteira");
    await page.getByTestId("valuations-table").scrollIntoViewIfNeeded();
    await clicar(page.getByTestId("button-add-valuation"));
    await expect(page.getByTestId("button-save-valuation")).toBeDisabled();
    await page.getByTestId("input-valuation-value").fill("abc");
    await expect(page.getByTestId("input-valuation-value")).toHaveValue("");
  });
});
