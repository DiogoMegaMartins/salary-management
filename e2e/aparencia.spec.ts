import { test, expect } from "@playwright/test";
import { entrar, recolherErros } from "./helpers";

const html = (page: import("@playwright/test").Page) => page.locator("html");

test.describe("aparência", () => {
  test("primeira abertura: paleta Céu", async ({ page }) => {
    await entrar(page);
    await expect(html(page)).toHaveAttribute("data-palette", "ceu");
  });

  test("modo automático acompanha o sistema sem recarregar", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await entrar(page);
    await expect(html(page)).toHaveClass(/dark/);
    await page.emulateMedia({ colorScheme: "light" });
    await expect(html(page)).not.toHaveClass(/dark/);
  });

  test("a cache local é aplicada antes de a app montar (sem piscar)", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("sm.appearance", JSON.stringify({ palette: "mare", mode: "escuro" }));
      document.addEventListener("DOMContentLoaded", () => {
        const el = document.documentElement;
        (window as any).__cedo = { palette: el.getAttribute("data-palette"), dark: el.classList.contains("dark"), montado: !!document.querySelector("#root > *") };
      });
    });
    await page.goto("/");
    const cedo = await page.evaluate(() => (window as any).__cedo);
    expect(cedo).toEqual({ palette: "mare", dark: true, montado: false });
  });

  test("tema antigo (sm.theme) é respeitado", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("sm.theme", "dark"));
    await page.goto("/");
    await expect(html(page)).toHaveClass(/dark/);
    await expect(html(page)).toHaveAttribute("data-palette", "ceu");
  });

  test("cache estragada: abre em Céu automático, sem erros", async ({ page }) => {
    const erros = recolherErros(page);
    await page.addInitScript(() => localStorage.setItem("sm.appearance", "{"));
    await entrar(page);
    await expect(html(page)).toHaveAttribute("data-palette", "ceu");
    expect(erros).toEqual([]);
  });
});
