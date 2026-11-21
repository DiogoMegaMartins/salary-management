import { expect, test } from "@playwright/test";
import { cabecalhosApi, clicar, entrar, sufixo } from "./helpers";

test.describe("Parcelas e metas: lista e detalhe", () => {
  test("meta, entrada, transferência para submeta noutra moeda, valor de mercado e histórico", async ({ page, request }, info) => {
    const nome = `Invest E2E ${sufixo(info.project.name)}`;
    const r = await request.post("/api/parcels", { headers: cabecalhosApi(), data: { name: nome, kind: "investimento", color: "#2f9e8f", sortOrder: 99, defaultMode: "fixo", defaultValue: 0 } });
    expect(r.ok()).toBe(true);
    const parcel = await r.json();
    const id = parcel.id as number;
    try {
      await entrar(page);
      await page.goto("/#/parcelas");
      await clicar(page.getByTestId(`card-parcel-${id}`));
      const painel = page.getByTestId(`parcel-detail-${id}`);
      await expect(painel).toBeVisible();

      // meta e data alvo (mês em português, sem depender do idioma do navegador)
      await painel.getByTestId(`input-target-${id}`).fill("1000");
      await painel.getByTestId(`input-target-${id}`).press("Enter");
      await clicar(painel.getByTestId(`input-target-date-${id}-month`));
      await page.getByRole("option", { name: "Dezembro" }).click();
      await painel.getByTestId(`input-target-date-${id}-year`).fill("2030");
      await expect(page.getByTestId(`card-parcel-${id}`)).toContainText("até 12/2030");

      // entrada fora dos meses
      await clicar(painel.getByTestId(`button-movement-${id}`));
      await page.getByTestId("input-movement-value").fill("200");
      await page.getByTestId("button-save-movement").click();
      await expect(painel.getByTestId(`goal-total-${id}`)).toContainText("200,00");
      await expect(page.getByTestId(`card-parcel-${id}`)).toContainText("20%");

      // submeta em dólares com taxa
      await clicar(painel.getByTestId("tab-parcel-submetas"));
      await clicar(painel.getByTestId(`button-new-subgoal-${id}`));
      await page.getByTestId("input-subgoal-name").fill("Ações EUA");
      await clicar(page.getByTestId("select-subgoal-currency"));
      await page.getByRole("option", { name: "USD" }).click();
      await page.getByTestId("input-subgoal-rate").fill("0,5");
      await page.getByTestId("button-save-subgoal").click();
      await expect(painel.getByText("Ações EUA")).toBeVisible();
      await expect(painel.getByText(/Taxa: 1 USD = 0,5000 EUR/)).toBeVisible();

      // submeta em euros e transferência do não distribuído: o total não muda
      await clicar(painel.getByTestId(`button-new-subgoal-${id}`));
      await page.getByTestId("input-subgoal-name").fill("Casa");
      await page.getByTestId("button-save-subgoal").click();
      await expect(painel.getByText("Casa", { exact: true })).toBeVisible();
      await clicar(painel.getByTestId("tab-parcel-meta"));
      await clicar(painel.getByTestId(`button-movement-${id}`));
      await page.getByTestId("movement-kind-transferir").click();
      await clicar(page.getByTestId("select-movement-dest"));
      await page.getByRole("option", { name: "Casa" }).click();
      await page.getByTestId("input-movement-value").fill("50");
      await page.getByTestId("button-save-movement").click();
      await expect(painel.getByTestId(`goal-total-${id}`)).toContainText("200,00");
      await clicar(painel.getByTestId("tab-parcel-submetas"));
      await expect(painel.getByText("Não distribuído (meta principal)").locator("..")).toContainText("150,00");
      await clicar(painel.getByTestId("tab-parcel-meta"));

      // valor de mercado: mostra o ganho sem mexer no acumulado
      await clicar(painel.getByTestId(`button-market-${id}`));
      await page.getByTestId("input-valuation-value").fill("260");
      await page.getByTestId("button-save-valuation").click();
      await expect(painel.getByTestId(`market-${id}`)).toContainText("+60,00");
      await expect(painel.getByTestId(`goal-total-${id}`)).toContainText("200,00");

      // histórico com tudo
      await clicar(painel.getByTestId("tab-parcel-historico"));
      await expect(painel.getByTestId(`history-${id}`)).toContainText("Valor de mercado");
      await expect(painel.getByTestId(`history-${id}`)).toContainText("Entrada");
      await expect(painel.getByTestId(`history-${id}`)).toContainText("Saída");

      // definições: saldo inicial
      await clicar(painel.getByTestId("tab-parcel-definicoes"));
      await painel.getByTestId(`input-opening-${id}`).fill("1000");
      await painel.getByTestId(`button-save-opening-${id}`).click();
      await clicar(painel.getByTestId("tab-parcel-meta"));
      await expect(painel.getByTestId(`goal-total-${id}`)).toContainText(/1\s200,00/);
      if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/parcelas-${info.project.name}.png`, fullPage: false });
    } finally {
      await request.delete(`/api/parcels/${id}`, { headers: cabecalhosApi() });
    }
  });
});
