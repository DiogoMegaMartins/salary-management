import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { SCREENS, cabecalhosApi, entrar } from "./helpers";

/**
 * Verificação automática de acessibilidade (axe, regras WCAG 2.0/2.1 A e AA) em todas as páginas, nos dois temas
 * e nos dois modos. Só apanha o que uma máquina consegue ver; o teclado e o resto têm testes à parte.
 */
const modo = (page: Page, uiMode: "basico" | "detalhado") => page.request.patch("/api/settings", { data: { uiMode }, headers: cabecalhosApi() });
test.afterEach(async ({ page }) => { await modo(page, "detalhado"); });

const resumo = (v: { id: string; nodes: { target: unknown[] }[]; help: string }[]) =>
  v.map((x) => `${x.id} (${x.nodes.length}): ${x.help} → ${x.nodes.slice(0, 3).map((n) => String(n.target[0])).join(" | ")}`);

async function verificar(page: Page, rota: string, titulo: string): Promise<string[]> {
  await page.goto(`/${rota}`);
  await expect(page.getByRole("heading", { level: 1, name: titulo }).first()).toBeVisible();
  await page.waitForTimeout(500);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
  return resumo(r.violations).map((v) => `${rota}: ${v}`);
}

for (const tema of ["claro", "escuro"] as const) {
  for (const uiMode of ["basico", "detalhado"] as const) {
    test(`acessibilidade: todas as páginas sem violações (${tema}, ${uiMode})`, async ({ page }) => {
      test.setTimeout(120_000);
      await modo(page, uiMode);
      await page.addInitScript((m) => localStorage.setItem("sm.appearance", JSON.stringify({ palette: "ceu", mode: m })), tema);
      await entrar(page);
      const todas: string[] = [];
      for (const { route, title } of SCREENS) todas.push(...(await verificar(page, route, title)));
      expect(todas).toEqual([]);
    });
  }
}

const axeAgora = async (page: Page) => resumo((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations);

test("acessibilidade: movimento reduzido desliga as transições e animações", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await entrar(page);
  const duracoes = await page.evaluate(() =>
    [...document.querySelectorAll("button, a")].slice(0, 40).map((el) => {
      const c = getComputedStyle(el);
      return Math.max(parseFloat(c.transitionDuration) || 0, parseFloat(c.animationDuration) || 0);
    }),
  );
  expect(Math.max(...duracoes), "nenhuma transição ou animação acima de 1 ms").toBeLessThanOrEqual(0.001);
});

test("acessibilidade: o primeiro Tab leva a 'Saltar para o conteúdo', que põe o foco no conteúdo", async ({ page }) => {
  await entrar(page);
  await page.keyboard.press("Tab");
  const salto = page.getByRole("button", { name: "Saltar para o conteúdo" });
  await expect(salto).toBeFocused();
  await expect(salto).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await expect(page).toHaveURL(/#\/$/);
});

test("acessibilidade: alvos de toque com pelo menos 44 px no telemóvel", async ({ page }, info) => {
  test.skip(info.project.name !== "telemovel", "só se aplica ao telemóvel");
  await entrar(page);
  const pequenos = await page.evaluate(() =>
    [...document.querySelectorAll('.app-header button, .app-header a, nav[aria-label="Navegação principal"] a, nav[aria-label="Navegação principal"] button, [data-testid="register-button"], [data-testid="assistant-fab"]')]
      .map((el) => ({ el, r: (el as HTMLElement).getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0 && (r.width < 43.5 || r.height < 43.5))
      .map(({ el, r }) => `${el.getAttribute("data-testid") ?? el.getAttribute("aria-label") ?? el.textContent?.trim()}: ${Math.round(r.width)}x${Math.round(r.height)}`),
  );
  expect(pequenos).toEqual([]);
});

test("acessibilidade: diálogos e painéis abertos sem violações", async ({ page }, info) => {
  await modo(page, "basico"); // o botão Registar despesa só existe no modo Básico
  await entrar(page);
  await page.getByTestId("register-button").click();
  await expect(page.getByTestId("register-dialog")).toBeVisible();
  expect(await axeAgora(page), "diálogo Registar despesa").toEqual([]);
  await page.keyboard.press("Escape");
  await page.getByTestId("assistant-fab").click();
  await expect(page.getByTestId("assistant-sheet")).toBeVisible();
  expect(await axeAgora(page), "assistente").toEqual([]);
  await page.keyboard.press("Escape");
  if (info.project.name === "telemovel") {
    await page.getByTestId("tab-mais").click();
    await expect(page.getByTestId("sheet-mais")).toBeVisible();
    expect(await axeAgora(page), "painel Mais").toEqual([]);
  }
});

for (const paleta of ["pessego", "lavanda", "mare", "salvia"]) {
  test(`acessibilidade: ${paleta} em claro e escuro sem violações de contraste`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "as paletas são iguais nos dois formatos");
    test.setTimeout(90_000);
    await entrar(page);
    for (const m of ["claro", "escuro"]) {
      await page.evaluate(([p, mo]) => localStorage.setItem("sm.appearance", JSON.stringify({ palette: p, mode: mo })), [paleta, m]);
      for (const { route, title } of SCREENS.filter((s) => ["#/", "#/despesas", "#/divisao"].includes(s.route))) {
        await page.goto(`/${route}`);
        await page.reload();
        await expect(page.getByRole("heading", { level: 1, name: title }).first()).toBeVisible();
        await page.waitForTimeout(400);
        const contraste = (await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze()).violations;
        expect(resumo(contraste), `${paleta} ${m} ${route}`).toEqual([]);
      }
    }
  });
}
