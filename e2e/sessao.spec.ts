import { expect, test } from "@playwright/test";
import { clicar, entrar } from "./helpers";

test.describe("Terminar sessão", () => {
  test("pede confirmação; cancelar fica, confirmar volta ao ecrã do código", async ({ page }, info) => {
    await entrar(page);
    const abrir = async () => {
      // no telemóvel o menu lateral existe escondido: usa o botão do painel "Mais"
      const telemovel = info.project.name === "telemovel";
      if (telemovel) await clicar(page.getByTestId("tab-mais"));
      await clicar((telemovel ? page.getByTestId("sheet-mais") : page).getByTestId("button-logout"));
      await expect(page.getByTestId("dialog-confirm")).toContainText("Terminar sessão?");
    };
    await abrir();
    await page.getByTestId("button-confirm-cancel").click();
    if (info.project.name === "telemovel") await page.getByTestId("sheet-mais").getByRole("button", { name: /fechar|close/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Painel" })).toBeVisible();

    await abrir();
    await page.getByTestId("button-confirm-ok").click();
    await expect(page.getByPlaceholder("Código de acesso")).toBeVisible();
    // ao recarregar continua fora: o código guardado foi apagado
    await page.reload();
    await expect(page.getByPlaceholder("Código de acesso")).toBeVisible();
  });

  test("o menu lateral já não tem a frase do espaço privado", async ({ page }, info) => {
    test.skip(info.project.name === "telemovel", "o menu lateral só existe no computador");
    await entrar(page);
    await expect(page.getByText("Espaço privado. Só tu vês estes dados.")).toHaveCount(0);
    await expect(page.getByTestId("button-logout")).toBeVisible();
  });
});
