import { expect, test, type Page } from "@playwright/test";
import { entrar } from "./helpers";

/** Simula um servidor com chave configurada e a opção ligada (o servidor de testes não tem chave). */
async function iaDisponivel(page: Page, intent: unknown, parseStatus = 200, message = "") {
  await page.route("**/api/assistant/ai-status", (r) => r.fulfill({ json: { configured: true, enabled: true, model: "haiku", limit: 50, used: 3 } }));
  await page.route("**/api/assistant/parse", (r) =>
    parseStatus === 200 ? r.fulfill({ json: { intent, remaining: 46 } }) : r.fulfill({ status: parseStatus, json: { message } }),
  );
}
const abrir = async (page: Page) => {
  await page.getByTestId("assistant-fab").click();
  await expect(page.getByTestId("assistant-chat")).toBeVisible();
};

test.describe("Assistente com IA (frases livres)", () => {
  test("desativado por defeito: sem chave não há caixa de frase nem opção nas definições", async ({ page }) => {
    await entrar(page);
    await abrir(page);
    await expect(page.getByTestId("assistant-choice-despesa")).toBeVisible();
    await expect(page.getByTestId("assistant-ai")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.goto("/#/dados");
    await page.getByTestId("settings-tab-funcionalidades").click();
    await expect(page.getByTestId("features-list")).toBeVisible();
    await expect(page.getByTestId("ai-settings")).toHaveCount(0);
  });

  test("com a IA ligada: a frase entra no fluxo guiado já preenchida e pede confirmação", async ({ page }) => {
    await iaDisponivel(page, { task: "despesa", amount: 40, category: "Supermercado", date: "2026-08-15" });
    await entrar(page);
    await abrir(page);
    await expect(page.getByTestId("assistant-ai")).toContainText("Restam 47 pedidos hoje");
    await page.getByTestId("assistant-sentence").fill("gastei 40 no supermercado a 15 de agosto");
    await page.getByTestId("assistant-sentence-send").click();
    await expect(page.getByTestId("assistant-confirm")).toBeVisible(); // saltou o valor, a categoria e a data
    const chat = page.getByTestId("assistant-chat");
    await expect(chat).toContainText("40,00");
    await expect(chat).toContainText("Supermercado (nova)");
    await expect(chat).toContainText("15/08/2026");
    await page.getByTestId("assistant-cancel").click(); // nada se grava sem confirmar
    await expect(page.getByTestId("assistant-choice-despesa")).toBeVisible();
  });

  test("se faltar algum campo, o assistente pergunta o que falta", async ({ page }) => {
    await iaDisponivel(page, { task: "despesa", amount: 25 });
    await entrar(page);
    await abrir(page);
    await page.getByTestId("assistant-sentence").fill("gastei 25");
    await page.getByTestId("assistant-sentence-send").click();
    await expect(page.getByTestId("assistant-chat")).toContainText("Em que categoria?");
  });

  test("frase que a IA não percebe: explica e volta ao início", async ({ page }) => {
    await iaDisponivel(page, { task: "desconhecido" });
    await entrar(page);
    await abrir(page);
    await page.getByTestId("assistant-sentence").fill("blá blá");
    await page.getByTestId("assistant-sentence-send").click();
    await expect(page.getByTestId("assistant-chat")).toContainText("Não percebi o que queres fazer");
    await page.getByTestId("assistant-action-home").click();
    await expect(page.getByTestId("assistant-choice-despesa")).toBeVisible();
  });

  test("limite diário: mostra a mensagem do servidor e deixa continuar com as perguntas", async ({ page }) => {
    await iaDisponivel(page, null, 429, "Atingiste o limite de 50 pedidos de IA por hoje.");
    await entrar(page);
    await abrir(page);
    await page.getByTestId("assistant-sentence").fill("gastei 10");
    await page.getByTestId("assistant-sentence-send").click();
    await expect(page.getByTestId("assistant-ai-error")).toContainText("limite de 50 pedidos");
    await expect(page.getByTestId("assistant-choice-despesa")).toBeVisible(); // as perguntas continuam
  });

  test("em Definições, com chave configurada, a opção aparece desligada e com o aviso de privacidade", async ({ page }) => {
    await iaDisponivel(page, null);
    await entrar(page);
    await page.goto("/#/dados");
    await page.getByTestId("settings-tab-funcionalidades").click();
    await expect(page.getByTestId("ai-settings")).toBeVisible();
    await expect(page.getByTestId("switch-ai-enabled")).not.toBeChecked();
    await expect(page.getByTestId("ai-settings")).toContainText("sai da app para a Anthropic");
    await expect(page.getByTestId("ai-usage")).toContainText("3 de 50");
  });
});

test.describe("Assistente com IA: fechar o mês", () => {
  test("'fecha o mês' leva ao fluxo de fecho (pergunta o mês) e não grava sem confirmar", async ({ page, request }) => {
    const fechados = async () => ((await (await request.get("/api/state", { headers: { "x-codigo-acesso": "codigo-de-teste-1234", "x-sm-client": "1" } })).json()).months as any[]).filter((m) => m.status === "fechado").length;
    const antes = await fechados();
    await iaDisponivel(page, { task: "fechar" });
    await entrar(page);
    await page.getByTestId("assistant-fab").click();
    await page.getByTestId("assistant-sentence").fill("quero fechar o mês");
    await page.getByTestId("assistant-sentence-send").click();
    await expect(page.getByTestId("assistant-chat")).toContainText("Que mês queres fechar?");
    await page.getByTestId("assistant-back").click();
    expect(await fechados()).toBe(antes); // nada foi fechado
  });
});
