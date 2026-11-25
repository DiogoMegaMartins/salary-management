import { expect, test } from "@playwright/test";
import { clicar, entrar } from "./helpers";

const principais = ["Início", "Dividir", "Meses"];
const restantes = [
  { id: "despesas", href: "despesas" }, { id: "fecho-e-planeamento", href: "fecho" }, { id: "parcelas-e-metas", href: "parcelas" },
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
    for (const r of restantes) await expect(lateral.getByTestId(`link-${r.id}`)).toBeVisible();
  }
});

test("menu: cada destino abre a página certa", async ({ page }, info) => {
  await entrar(page);
  const alvos = [{ href: "divisao", h1: "Divisão" }, { href: "meses", h1: "Meses" }, { href: "despesas", h1: "Despesas" }, { href: "orcamento", h1: "Orçamento" }];
  for (const a of alvos) {
    if (info.project.name === "telemovel") {
      const principal = ["divisao", "meses"].includes(a.href);
      if (principal) await clicar(page.getByTestId(a.href === "divisao" ? "tab-dividir" : "tab-meses"));
      else { await clicar(page.getByTestId("tab-mais")); await clicar(page.getByTestId(`more-${a.href}`)); }
    } else {
      await page.locator("aside").locator(`a[href$="/${a.href}"]`).click();
    }
    await expect(page.getByRole("heading", { level: 1, name: a.h1 }).first()).toBeVisible();
  }
});
