import { expect, type Page } from "@playwright/test";

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
