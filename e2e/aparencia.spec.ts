import { test, expect } from "@playwright/test";
import { ACCESS_CODE, entrar, recolherErros } from "./helpers";

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

  test.describe("Definições › Aparência", () => {
    test.afterEach(async ({ page }) => {
      // repõe Céu e automático na conta, para não afetar os outros testes
      await page.request.patch("/api/settings", { data: { palette: "ceu", colorMode: "auto" }, headers: { "x-codigo-acesso": ACCESS_CODE, "x-sm-client": "1" } });
    });
    const abrir = async (page: import("@playwright/test").Page) => {
      await entrar(page);
      await page.goto("/#/dados");
      await page.getByTestId("settings-tab-aparencia").click();
      await expect(page.getByTestId("appearance-settings")).toBeVisible();
    };

    test("escolher a paleta aplica-se, grava-se e sobrevive ao recarregar", async ({ page }) => {
      await abrir(page);
      await page.getByTestId("palette-mare").click();
      await expect(html(page)).toHaveAttribute("data-palette", "mare");
      await expect(page.getByRole("radio", { name: /Maré/ })).toBeChecked();
      await expect(page.getByRole("radio", { name: /Céu/ })).not.toBeChecked();
      await page.reload();
      await expect(html(page)).toHaveAttribute("data-palette", "mare");
    });

    test("escolher o modo: escuro, claro e automático", async ({ page }) => {
      await page.emulateMedia({ colorScheme: "light" });
      await abrir(page);
      await page.getByTestId("mode-escuro").click();
      await expect(html(page)).toHaveClass(/dark/);
      await page.getByTestId("mode-claro").click();
      await expect(html(page)).not.toHaveClass(/dark/);
      await page.getByTestId("mode-auto").click();
      await page.emulateMedia({ colorScheme: "dark" });
      await expect(html(page)).toHaveClass(/dark/);
    });

    test("só com o teclado: setas mudam a opção dentro do grupo", async ({ page }) => {
      await abrir(page);
      await page.getByRole("radio", { name: /Céu/ }).focus();
      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("radio", { name: /Sálvia/ })).toBeChecked();
      await expect(html(page)).toHaveAttribute("data-palette", "salvia");
    });

    test("os grupos têm nome para leitores de ecrã e cada opção tem descrição", async ({ page }) => {
      await abrir(page);
      await expect(page.getByRole("radiogroup", { name: "Cor da app" })).toBeVisible();
      await expect(page.getByRole("radiogroup", { name: "Modo" })).toBeVisible();
      await expect(page.getByRole("radio", { name: /Pêssego/ })).toHaveAccessibleDescription(/caloroso/);
    });
  });
});
