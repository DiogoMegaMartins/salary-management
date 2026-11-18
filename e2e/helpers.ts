import { expect, type Locator, type Page } from "@playwright/test";

export const ACCESS_CODE = process.env.E2E_ACCESS_CODE ?? "codigo-de-teste-1234";

/** Ecrãs da app: rota (hash) e título principal (h1). */
export const SCREENS = [
  { route: "#/", title: "Painel" },
  { route: "#/meses", title: "Meses" },
  { route: "#/despesas", title: "Despesas" },
  { route: "#/fecho", title: "Fecho e planeamento" },
  { route: "#/parcelas", title: "Parcelas e metas" },
  { route: "#/carteira", title: "Carteira" },
  { route: "#/orcamento", title: "Orçamento" },
  { route: "#/dados", title: "Definições" },
  { route: "#/ajuda", title: "Ajuda e documentação" },
] as const;

export async function entrar(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("Código de acesso").fill(ACCESS_CODE);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Painel" })).toBeVisible();
}

/** Recolhe erros de consola e exceções da página, para afirmar que não há nenhum. */
export function recolherErros(page: Page) {
  const erros: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => erros.push(`excecao: ${e.message}`));
  return erros;
}

/** Cada projeto (computador, telemóvel) usa nomes próprios para não colidir na mesma base de dados. */
export const sufixo = (projeto: string) => (projeto === "telemovel" ? "T" : "D");

/**
 * Centra o elemento antes de clicar. O Playwright encosta o botão à borda do ecrã, por baixo da barra de
 * navegação do telemóvel, mas ainda fora da zona visível do conteúdo (que tem o seu próprio deslocamento):
 * o foco volta a deslocar o conteúdo e o clique cai na barra. Uma pessoa só toca no que vê, por isso
 * isto reproduz o uso real (confirmado: um toque no fim do deslocamento funciona).
 */
export async function clicar(alvo: Locator) {
  await alvo.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await alvo.click();
}

/** Pedido autenticado à API (para preparar ou verificar dados sem passar pela interface). */
export function cabecalhosApi() {
  return { "x-codigo-acesso": ACCESS_CODE, "x-sm-client": "1" };
}

/**
 * Clica até o efeito esperado aparecer. Serve para botões que a aplicação recria logo a seguir a uma
 * gravação (a atualização do estado volta a compor o ecrã): um clique nessa janela perde-se, o seguinte não.
 */
export async function clicarAteAparecer(botao: Locator, efeito: Locator) {
  await expect(async () => {
    await clicar(botao);
    await expect(efeito).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
}
