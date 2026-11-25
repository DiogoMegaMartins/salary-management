// Paletas: cada paleta existe em claro e escuro e o texto é legível (contraste WCAG).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PALETTES } from "../shared/appearance";

const css = readFileSync(resolve(import.meta.dirname, "../client/src/index.css"), "utf8");

function bloco(seletor: string): string {
  const i = css.indexOf(`${seletor} {`);
  assert.ok(i >= 0, `falta o bloco ${seletor}`);
  return css.slice(i, css.indexOf("}", i));
}
function hsl(b: string, nome: string): [number, number, number] {
  const m = new RegExp(`--${nome}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`).exec(b);
  assert.ok(m, `falta --${nome}`);
  return [Number(m![1]), Number(m![2]) / 100, Number(m![3]) / 100];
}
function luminancia([h, s, l]: [number, number, number]): number {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
}
const contraste = (a: [number, number, number], b: [number, number, number]) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

for (const p of PALETTES) {
  for (const modo of ["claro", "escuro"] as const) {
    test(`paleta ${p} (${modo}): contraste suficiente`, () => {
      const b = bloco(modo === "claro" ? `:root[data-palette="${p}"]` : `:root[data-palette="${p}"].dark`);
      const [bg, card, fg, soft, pri, onPri] = ["background", "card", "foreground", "muted-foreground", "primary", "primary-foreground"].map((n) => hsl(b, n));
      assert.ok(contraste(fg, bg) >= 7, `texto/fundo ${contraste(fg, bg).toFixed(2)}`);
      assert.ok(contraste(fg, card) >= 7, `texto/cartão ${contraste(fg, card).toFixed(2)}`);
      assert.ok(contraste(soft, bg) >= 4.5, `texto suave/fundo ${contraste(soft, bg).toFixed(2)}`);
      assert.ok(contraste(soft, card) >= 4.5, `texto suave/cartão ${contraste(soft, card).toFixed(2)}`);
      assert.ok(contraste(onPri, pri) >= 4.5, `texto/destaque ${contraste(onPri, pri).toFixed(2)}`);
      assert.ok(contraste(pri, bg) >= 3, `destaque/fundo ${contraste(pri, bg).toFixed(2)}`);
    });
  }
}
