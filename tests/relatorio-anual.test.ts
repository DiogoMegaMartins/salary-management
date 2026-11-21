// Relatório anual: texto e PDF a partir de dados sintéticos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAnnualReportMarkdown, type AnnualReportInput } from "../shared/annual-report";
import { markdownToPdf } from "../shared/pdf";

const mc = (id: number, year: number, month: number, net: number, saved: number, spent: number, extra: Record<number, number> = {}): any => ({
  month: { id, year, month, label: `M${month}/${year}` },
  gross: net + 100, descontos: 100, net, available: net, allocated: saved + spent, remaining: 0, ss: 0, irs: 0, meal: 0, savingsRate: 0,
  byParcel: { 1: spent, 2: saved, ...extra },
  byKind: { gastos: spent, poupanca: saved, investimento: 0 },
});
// fmtEur usa espaços não separáveis
const gerar = (over: Partial<AnnualReportInput> = {}) => buildAnnualReportMarkdown(input(over)).replace(/\u00a0/g, " ");
const input = (over: Partial<AnnualReportInput> = {}): AnnualReportInput => ({
  year: 2026,
  computed: [mc(1, 2025, 12, 1000, 200, 800), mc(2, 2026, 1, 1200, 300, 900), mc(3, 2026, 2, 1200, 400, 800)],
  parcels: [{ id: 1, name: "Gastos", kind: "gastos" }, { id: 2, name: "ETF", kind: "investimento" }],
  transactions: [
    { monthId: 2, type: "expense", value: 50, category: "Casa" },
    { monthId: 3, type: "expense", value: 30, category: "Casa" },
    { monthId: 3, type: "expense", value: 10, category: "" },
    { monthId: 3, type: "transfer", value: 999, category: "Casa" },
    { monthId: 1, type: "expense", value: 777, category: "Outro ano" },
  ],
  valuations: [{ id: 1, parcelId: 2, date: "2026-02-28", value: 800 }, { id: 2, parcelId: 2, date: "2027-01-01", value: 5 }],
  base: { 2: 0 },
  hideAmounts: false,
  generatedAt: "hoje",
  ...over,
});

test("resumo do ano soma só os meses desse ano e compara com o anterior", () => {
  const md = gerar();
  assert.match(md, /# Relatório anual 2026/);
  assert.match(md, /\| Líquido \| 2 400,00 € \| \+140,0% \|/);
  assert.match(md, /\| Gastos \| 1 700,00 € \| \+112,5% \|/);
  assert.doesNotMatch(md, /Outro ano/);
});

test("despesas por categoria ignoram transferências e outros anos, e agrupam sem categoria", () => {
  const md = gerar();
  assert.match(md, /\| Casa \| 80,00 € \| 88,9% \|/);
  assert.match(md, /\(sem categoria\)/);
  assert.doesNotMatch(md, /999/);
});

test("valor da carteira usa o último valor até ao fim do ano e o posto até esse mês", () => {
  const md = gerar();
  assert.match(md, /Valor das parcelas no fim do ano/);
  // posto = 200 (dez. 2025) + 300 + 400 = 900; valor 800 -> perda de 100
  assert.match(md, /\| ETF \| 900,00 € \| 800,00 € \(2026-02-28\) \| -100,00 € \(-11,1%\) \|/);
});

test("ocultar valores troca os montantes e não mostra percentagem de ganho", () => {
  const md = gerar({ hideAmounts: true });
  assert.doesNotMatch(md, /1 200,00|2 400,00/);
  assert.match(md, /•••••/);
});

test("ano sem meses explica e o PDF gera-se", () => {
  const vazio = gerar({ year: 2031 });
  assert.match(vazio, /Não há meses registados em 2031/);
  const pdf = markdownToPdf(buildAnnualReportMarkdown(input()), { title: "Relatório anual 2026", footer: "x" });
  assert.equal(Buffer.from(pdf.subarray(0, 8)).toString("latin1"), "%PDF-1.4");
});
