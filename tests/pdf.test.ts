// Gerador de PDF do relatório mensal: estrutura válida e texto extraível (com acentos e euro).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { markdownToPdf } from "../shared/pdf";

const text = (b: Uint8Array) => Buffer.from(b).toString("latin1");

const SAMPLE = [
  "# Relatório mensal — Partição do Salário",
  "",
  "**Período:** Janeiro a Março 2026 · 3 meses",
  "**Gerado em:** 18 de novembro de 2026",
  "",
  "---",
  "",
  "## Indicadores principais",
  "",
  "| Indicador | Valor | vs. período anterior |",
  "|---|---|---|",
  "| Líquido total | 10 375,00 € | +5,0% |",
  "| Taxa de poupança | 12,5% | — |",
  "| Gastos (parênteses) e \\ barra | 1 234,56 € | -3,2% |",
  "",
  "> **Alertas:** 1 mês com divisão acima do valor disponível — Fevereiro (-12,50 €). ⚠️",
  "",
  "_Texto em itálico simples e um parágrafo mais comprido para obrigar a quebra de linha: " + "lorem ipsum dolor sit amet ".repeat(12) + "_",
].join("\n");

test("PDF: cabeçalho, xref e fim de ficheiro coerentes", () => {
  const pdf = markdownToPdf(SAMPLE, { title: "Relatório", footer: "Partição do Salário" });
  const s = text(pdf);
  assert.ok(s.startsWith("%PDF-1.4\n"));
  assert.ok(s.trimEnd().endsWith("%%EOF"));
  const start = Number(/startxref\n(\d+)\n%%EOF/.exec(s)![1]);
  assert.equal(s.slice(start, start + 4), "xref");
  // cada entrada da xref aponta para "N 0 obj"
  const entries = [...s.slice(start).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  assert.ok(entries.length >= 8);
  entries.forEach((off, i) => assert.equal(s.slice(off, off + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`));
  assert.match(s, /\/Count 1 /);
});

test("PDF: documentos longos passam a várias páginas e numeram o rodapé", () => {
  const rows = Array.from({ length: 120 }, (_, i) => `| Mês ${i + 1} | ${i * 10},00 € | ${i},0% |`).join("\n");
  const s = text(markdownToPdf(`# T\n\n| A | B | C |\n|---|---|---|\n${rows}\n`, { footer: "X" }));
  const count = Number(/\/Count (\d+)/.exec(s)![1]);
  assert.ok(count >= 3, `páginas: ${count}`);
  // o "á" vai em octal no fluxo de conteúdo (\341)
  assert.ok(s.includes(`P\\341gina ${count} de ${count}`));
});

test("PDF: o texto extraído mantém acentos, euro e valores", { skip: spawnSync("pdftotext", ["-v"]).error != null ? "pdftotext não instalado" : false }, () => {
  const dir = mkdtempSync(join(tmpdir(), "sm-pdf-"));
  const file = join(dir, "r.pdf");
  writeFileSync(file, markdownToPdf(SAMPLE, { footer: "Partição do Salário" }));
  const out = execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" });
  for (const needle of ["Relatório mensal", "Partição do Salário", "Indicadores principais", "Líquido total", "10 375,00 €", "+5,0%", "12,5%", "1 234,56 €", "(parênteses)", "(!)", "Página 1 de 1"]) {
    assert.ok(out.includes(needle), `falta "${needle}" em:\n${out}`);
  }
  assert.ok(!out.includes("**"), "marcação Markdown por limpar");
});
