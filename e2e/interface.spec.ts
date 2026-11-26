import { expect, test } from "@playwright/test";
import { clicar, entrar } from "./helpers";

test.describe("Interface: erros visíveis, confirmações e teclado", () => {
  test("se o estado não carregar, aparece o erro com 'Tentar de novo'", async ({ page }) => {
    await entrar(page);
    await page.route("**/api/state", (r) => r.abort());
    await page.reload();
    await expect(page.getByTestId("state-error")).toBeVisible();
    await page.unroute("**/api/state");
    await clicar(page.getByTestId("button-retry-state"));
    await expect(page.getByRole("heading", { level: 1, name: "Início" })).toBeVisible();
    await expect(page.getByTestId("state-error")).toHaveCount(0);
  });

  test("fechar o editor de mês com alterações pede confirmação", async ({ page }) => {
    await entrar(page);
    await page.goto("/#/meses");
    await page.getByTestId("button-new-month").click();
    await page.getByTestId("input-base").fill("1234");
    await page.keyboard.press("Escape");
    const alerta = page.getByRole("alertdialog");
    await expect(alerta).toContainText("Descartar");
    await alerta.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByTestId("month-editor")).toBeVisible(); // continua aberto, nada se perdeu
    await expect(page.getByTestId("input-base")).toHaveValue(/1234|1 234/);
    await page.getByTestId("button-close-month-editor").click();
    await page.getByRole("alertdialog").getByRole("button", { name: /Confirmar|Descartar/ }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("os filtros do Painel funcionam só com o teclado", async ({ page }, info) => {
    test.skip(info.project.name === "telemovel", "no telemóvel os filtros ficam numa folha própria");
    await entrar(page);
    await page.getByTestId("button-filter-parcels").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitemcheckbox").first()).toBeVisible();
    const atual = page.locator('[role="menuitemcheckbox"]:focus');
    await expect(atual).toHaveCount(1); // ao abrir, o foco vai para o primeiro item
    const primeiro = await atual.textContent();
    await page.keyboard.press("ArrowDown");
    await expect(atual).not.toHaveText(primeiro ?? ""); // só carrega em Espaço depois de o foco ter mudado
    const antes = await atual.getAttribute("aria-checked");
    await page.keyboard.press("Space");
    await expect(page.locator('[role="menuitemcheckbox"]:focus')).not.toHaveAttribute("aria-checked", String(antes));
    await page.keyboard.press("Space"); // repõe
    await expect(page.locator('[role="menuitemcheckbox"]:focus')).toHaveAttribute("aria-checked", String(antes));
  });
});
