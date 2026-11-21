import { expect, test } from "@playwright/test";
import { entrar } from "./helpers";

test.describe("Atalhos de teclado e estado do backup", () => {
  test("g e uma letra navegam; ? mostra a lista; escrever num campo não dispara atalhos", async ({ page }, info) => {
    test.skip(info.project.name === "telemovel", "teclado físico só no computador");
    await entrar(page);
    await page.keyboard.press("g");
    await page.keyboard.press("m");
    await expect(page.getByRole("heading", { level: 1, name: "Meses" })).toBeVisible();
    await page.keyboard.press("g");
    await page.keyboard.press("d");
    await expect(page.getByRole("heading", { level: 1, name: "Despesas" })).toBeVisible();

    await page.keyboard.press("/");
    await expect(page.getByTestId("input-expense-search")).toBeFocused();
    await page.keyboard.type("gm"); // dentro de um campo: não navega
    await expect(page.getByRole("heading", { level: 1, name: "Despesas" })).toBeVisible();
    await page.getByTestId("input-expense-search").fill("");
    await page.getByTestId("input-expense-search").blur();

    await page.keyboard.press("?");
    await expect(page.getByTestId("dialog-shortcuts")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("dialog-shortcuts")).toHaveCount(0);
  });

  test("o rodapé do menu mostra o estado do último backup", async ({ page }, info) => {
    test.skip(info.project.name === "telemovel", "o menu lateral só existe no computador");
    await entrar(page);
    await expect(page.getByTestId("backup-status")).toContainText(/backup/i);
  });
});

test.describe("Ecrã do código: o motivo da falha", () => {
  test("o servidor responde com erro: não diz que falta internet", async ({ page }) => {
    await page.route("**/api/auth/status", (r) => r.fulfill({ status: 500, contentType: "text/plain", body: "error code: 1101" }));
    await page.goto("/");
    await expect(page.getByText(/O servidor não respondeu como esperado/)).toBeVisible();
    await expect(page.getByText(/Sem ligação/)).toHaveCount(0);
  });

  test("falha de rede: diz que não há ligação", async ({ page }) => {
    await page.route("**/api/auth/status", (r) => r.abort("connectionrefused"));
    await page.goto("/");
    await expect(page.getByText(/Sem ligação e sem cópia offline preparada/)).toBeVisible();
  });
});
