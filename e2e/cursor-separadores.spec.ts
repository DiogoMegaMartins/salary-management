import { expect, test, type Page } from "@playwright/test";
import { cabecalhosApi, entrar } from "./helpers";

test.describe("Cursor e barras de separadores", () => {
  test.beforeEach(async ({ page }) => entrar(page));
  test.afterEach(async ({ request }) => { await request.patch("/api/settings", { headers: cabecalhosApi(), data: { features: "{}" } }); });

  test("botões, separadores e interruptores mostram a mãozinha; o que está desativado não", async ({ page }) => {
    await page.goto("/#/dados");
    await page.getByTestId("settings-tab-funcionalidades").click();
    const cursor = (loc: ReturnType<Page["getByTestId"]>) => loc.evaluate((e) => getComputedStyle(e).cursor);
    expect(await cursor(page.getByTestId("settings-tab-calculo"))).toBe("pointer"); // separador
    expect(await cursor(page.getByTestId("feature-switch-parcelas"))).toBe("pointer"); // interruptor
    expect(await cursor(page.getByTestId("assistant-fab"))).toBe("pointer"); // botão
    await page.getByTestId("feature-switch-movimentos").click(); // a reconciliação fica desativada
    await expect(page.getByTestId("feature-switch-reconciliacao")).toBeDisabled();
    expect(await cursor(page.getByTestId("feature-switch-reconciliacao"))).toBe("not-allowed");
  });

  for (const [rota, nome] of [["#/dados", "Definições"]] as const) {
    test(`${nome}: ao descer, a barra de separadores cobre o topo e o conteúdo não aparece por cima dela`, async ({ page }) => {
      await page.goto(`/${rota}`);
      await expect(page.getByRole("tablist").first()).toBeVisible();
      const desceu = await page.evaluate(() => {
        const m = document.querySelector("main")!;
        m.scrollTop = 300;
        return m.scrollTop;
      });
      test.skip(desceu === 0, "a página cabe no ecrã: não há nada para descer");
      const r = await page.evaluate(() => {
        const m = document.querySelector("main")!.getBoundingClientRect();
        const dentro = (x: number, y: number) => !!document.elementFromPoint(x, y)?.closest('[role="tablist"]');
        // rente ao topo da zona que desloca, à esquerda, ao centro e à direita (incluindo a margem lateral)
        return [dentro(m.left + 4, m.top + 2), dentro(m.left + m.width / 2, m.top + 2), dentro(m.right - 20, m.top + 2)];
      });
      expect(r).toEqual([true, true, true]);
    });
  }

  test("a barra de separadores só desloca na horizontal (não mexe para os lados nem para cima e para baixo)", async ({ page }) => {
    await page.goto("/#/dados");
    const lista = page.getByTestId("settings-tablist");
    const css = await lista.evaluate((e) => {
      const s = getComputedStyle(e);
      return { overflowY: s.overflowY, touchAction: s.touchAction, overscrollX: s.overscrollBehaviorX };
    });
    expect(css.overflowY).toBe("hidden");
    expect(css.touchAction).toContain("pan-x");
    expect(css.overscrollX).toBe("contain");
    // escolher um separador não mexe na página nem desloca a barra na vertical
    await page.getByTestId("settings-tab-historico").click();
    expect(await lista.evaluate((e) => e.scrollTop)).toBe(0);
    expect(await page.evaluate(() => document.scrollingElement!.scrollTop)).toBe(0);
  });
});
