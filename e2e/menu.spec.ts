import { expect, test } from "@playwright/test";
import { clicar, entrar } from "./helpers";

const principais = ["Início", "Plano do mês", "Meses"];
const restantes = [
  { id: "organizar", href: "organizar" },
  { id: "despesas", href: "despesas" },
  { id: "carteira", href: "carteira" }, { id: "orçamento", href: "orcamento" }, { id: "definições", href: "dados" }, { id: "ajuda-e-documentação", href: "ajuda" },
];

test("menu: três destinos principais e o resto em Mais", async ({ page }, info) => {
  await entrar(page);
  if (info.project.name === "telemovel") {
    const nav = page.getByTestId("bottom-nav");
    for (const n of principais) await expect(nav.getByRole("link", { name: n })).toBeVisible();
    await expect(nav.getByTestId("tab-mais")).toBeVisible();
    await expect(nav.getByTestId("tab-despesas")).toHaveCount(0);
    await clicar(page.getByTestId("tab-mais"));
    for (const r of restantes) await expect(page.getByTestId(`more-${r.href}`)).toBeVisible();
  } else {
    const lateral = page.locator("aside");
    for (const n of principais) await expect(lateral.getByRole("link", { name: n, exact: true })).toBeVisible();
    await expect(lateral.getByTestId("nav-more-heading")).toHaveText("Mais");
    // "Mais" é um botão que mostra e esconde as outras opções
    const botao = lateral.getByTestId("nav-more-toggle");
    await expect(botao).toHaveAttribute("aria-expanded", "false");
    for (const r of restantes) await expect(lateral.getByTestId(`link-${r.id}`)).toHaveCount(0);
    await clicar(botao);
    await expect(botao).toHaveAttribute("aria-expanded", "true");
    for (const r of restantes) await expect(lateral.getByTestId(`link-${r.id}`)).toBeVisible();
    await clicar(botao);
    await expect(botao).toHaveAttribute("aria-expanded", "false");
    for (const r of restantes) await expect(lateral.getByTestId(`link-${r.id}`)).toHaveCount(0);
  }
});

test("menu: Mais abre sozinho na página de uma das opções e lembra a escolha", async ({ page }, info) => {
  test.skip(info.project.name === "telemovel", "a barra lateral só existe no computador");
  await entrar(page);
  const lateral = page.locator("aside");
  await page.goto("/#/despesas");
  await expect(lateral.getByTestId("nav-more-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(lateral.getByTestId("link-despesas")).toBeVisible();
  await page.goto("/#/");
  await expect(lateral.getByTestId("nav-more-toggle")).toHaveAttribute("aria-expanded", "false");
  await clicar(lateral.getByTestId("nav-more-toggle"));
  await page.reload();
  await expect(lateral.getByTestId("nav-more-toggle")).toHaveAttribute("aria-expanded", "true");
  await clicar(lateral.getByTestId("nav-more-toggle")); // deixa fechado para os outros testes
});

test("menu: cada destino abre a página certa", async ({ page }, info) => {
  await entrar(page);
  const alvos = [{ href: "divisao", h1: "Plano do mês" }, { href: "meses", h1: "Meses" }, { href: "despesas", h1: "Despesas" }, { href: "orcamento", h1: "Orçamento" }];
  for (const a of alvos) {
    if (info.project.name === "telemovel") {
      const principal = ["divisao", "meses"].includes(a.href);
      if (principal) await clicar(page.getByTestId(a.href === "divisao" ? "tab-dividir" : "tab-meses"));
      else { await clicar(page.getByTestId("tab-mais")); await clicar(page.getByTestId(`more-${a.href}`)); }
    } else {
      if (!["divisao", "meses"].includes(a.href) && (await page.getByTestId("nav-more-toggle").getAttribute("aria-expanded")) !== "true") await clicar(page.getByTestId("nav-more-toggle"));
      await page.locator("aside").locator(`a[href$="/${a.href}"]`).click();
    }
    await expect(page.getByRole("heading", { level: 1, name: a.h1 }).first()).toBeVisible();
  }
});
