import type { Category, Month } from "@shared/schema";
import { markdownToPdf } from "@shared/pdf";
import type { Derived } from "@/lib/app";
import {
  budgetVsRealByCategory,
  fmtEur,
  fmtPct,
  type MonthComputed,
} from "@shared/calc";

/**
 * SM-010: relatório mensal/periódico arquivável, gerado inteiramente no
 * cliente a partir dos dados já carregados e do período filtrado (SM-008).
 * Não faz nenhuma chamada de escrita ao servidor — a exportação não altera
 * dados da aplicação.
 */
export type ReportOptions = {
  hideAmounts: boolean;
};

function line(...parts: (string | undefined | false)[]) {
  return parts.filter(Boolean).join(" ");
}

const mask = (s: string, hide: boolean) => (hide ? "•••••" : s);

export function buildMonthlyReportMarkdown(
  d: Derived,
  categories: Category[],
  opts: ReportOptions,
): string {
  const { hideAmounts } = opts;
  const eur = (n: number) => mask(fmtEur(n), hideAmounts);
  const now = new Date();
  const generatedAt = now.toLocaleString("pt-PT", { dateStyle: "long", timeStyle: "short" });

  const c = d.computed;
  const n = c.length || 1;
  const netTotal = c.reduce((a, x) => a + x.net, 0);
  const grossTotal = c.reduce((a, x) => a + x.gross, 0);
  const descontosTotal = c.reduce((a, x) => a + x.descontos, 0);
  const availableTotal = c.reduce((a, x) => a + x.available, 0);
  const remainingTotal = c.reduce((a, x) => a + x.remaining, 0);
  const savedTotal = c.reduce((a, x) => a + x.byKind.poupanca + x.byKind.investimento, 0);
  const spentTotal = c.reduce((a, x) => a + x.byKind.gastos, 0);
  const savingsRate = availableTotal > 0 ? savedTotal / availableTotal : 0;
  const effectiveTax = grossTotal > 0 ? descontosTotal / grossTotal : 0;

  const pc = d.previousComputed;
  const prevNetTotal = pc.reduce((a, x) => a + x.net, 0);
  const prevSavedTotal = pc.reduce((a, x) => a + x.byKind.poupanca + x.byKind.investimento, 0);
  const prevSpentTotal = pc.reduce((a, x) => a + x.byKind.gastos, 0);
  const pct = (curr: number, prev: number) => (prev !== 0 ? ((curr / prev - 1) * 100).toFixed(1) : null);

  const alerts = d.computed
    .map((x, i) => ({ month: d.months[i], remaining: x.remaining }))
    .filter((a) => a.remaining < -0.5);

  const monthIds = new Set(d.months.map((m) => m.id));
  const txsInPeriod = d.allTransactions.filter((t) => monthIds.has(t.monthId));
  const budgetRows = budgetVsRealByCategory(txsInPeriod, categories, 10);

  const md: string[] = [];

  md.push(`# Relatório mensal — Partição do Salário`);
  md.push("");
  md.push(`**Período:** ${d.periodLabel} · ${d.months.length} ${d.months.length === 1 ? "mês" : "meses"}`);
  md.push(`**Gerado em:** ${generatedAt}`);
  if (hideAmounts) md.push(`**Nota:** valores monetários ocultados nesta exportação.`);
  md.push("");
  md.push("---");
  md.push("");

  md.push("## Indicadores principais");
  md.push("");
  md.push("| Indicador | Valor | vs. período anterior |");
  md.push("|---|---|---|");
  md.push(`| Líquido total | ${eur(netTotal)} | ${pct(netTotal, prevNetTotal) != null ? `${pct(netTotal, prevNetTotal)}%` : "—"} |`);
  md.push(`| Média mensal (líquido) | ${eur(netTotal / n)} | — |`);
  md.push(`| Taxa de poupança | ${fmtPct(savingsRate)} | — |`);
  md.push(`| Gastos | ${eur(spentTotal)} | ${pct(spentTotal, prevSpentTotal) != null ? `${pct(spentTotal, prevSpentTotal)}%` : "—"} |`);
  md.push(`| Poupança/investimento | ${eur(savedTotal)} | ${pct(savedTotal, prevSavedTotal) != null ? `${pct(savedTotal, prevSavedTotal)}%` : "—"} |`);
  md.push(`| Carga fiscal efetiva | ${fmtPct(effectiveTax)} | — |`);
  md.push(`| Por alocar (restante) | ${eur(remainingTotal)} | — |`);
  md.push("");

  if (alerts.length > 0) {
    md.push(`> **Alertas:** ${alerts.length} ${alerts.length === 1 ? "mês" : "meses"} com divisão acima do valor disponível — ${alerts
      .map((a) => `${a.month.label ?? `${a.month.month}/${a.month.year}`} (${eur(a.remaining)})`)
      .join(", ")}.`);
    md.push("");
  } else {
    md.push(`> Sem alertas de divisão acima do disponível no período.`);
    md.push("");
  }

  md.push("## Orçamento vs. real por categoria");
  md.push("");
  if (budgetRows.length === 0) {
    md.push("_Sem categorias ou despesas registadas no período._");
  } else {
    md.push("| Categoria | Orçamento | Real | Desvio | Essencial |");
    md.push("|---|---|---|---|---|");
    for (const r of budgetRows) {
      const desvioLabel = `${r.desvioEUR >= 0 ? "+" : ""}${eur(r.desvioEUR)}${r.overBudget ? " ⚠️" : ""}`;
      md.push(
        `| ${r.categoryName} | ${r.budget > 0 ? eur(r.budget) : "—"} | ${eur(r.real)} | ${desvioLabel} | ${r.essential ? "Sim" : "Não"} |`,
      );
    }
  }
  md.push("");

  md.push("## Parcelas no período");
  md.push("");
  md.push("| Parcela | Total | Peso | Meta |");
  md.push("|---|---|---|---|");
  for (const p of d.parcels) {
    const total = d.computed.reduce((a, x) => a + (x.byParcel[p.id] ?? 0), 0);
    const weight = availableTotal > 0 ? total / availableTotal : 0;
    const goalLabel = p.targetAmount
      ? `${eur(p.targetAmount)}${p.targetDate ? ` até ${p.targetDate}` : ""}`
      : "—";
    md.push(`| ${p.name} | ${eur(total)} | ${fmtPct(weight)} | ${goalLabel} |`);
  }
  md.push("");

  md.push("## Meses incluídos");
  md.push("");
  md.push("| Mês | Bruto | Líquido | Disponível | Alocado | Restante |");
  md.push("|---|---|---|---|---|---|");
  for (let i = 0; i < d.months.length; i++) {
    const m = d.months[i];
    const mc: MonthComputed = d.computed[i];
    md.push(
      `| ${monthRowLabel(m)} | ${eur(mc.gross)} | ${eur(mc.net)} | ${eur(mc.available)} | ${eur(mc.allocated)} | ${eur(mc.remaining)} |`,
    );
  }
  md.push("");

  md.push("---");
  md.push("");
  md.push(
    `_Relatório gerado automaticamente pela aplicação Partição do Salário. Esta exportação é apenas uma fotografia dos dados — não altera nem persiste nada na aplicação._`,
  );

  return md.join("\n");
}

function monthRowLabel(m: Month) {
  return m.label || `${m.month}/${m.year}`;
}

export function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** PDF do relatório: o mesmo conteúdo do Markdown, gerado no navegador (sem pedidos ao servidor). */
export function buildMonthlyReportPdf(
  d: Derived,
  categories: Category[],
  opts: ReportOptions,
): Uint8Array {
  return markdownToPdf(buildMonthlyReportMarkdown(d, categories, opts), {
    title: `Relatório mensal — ${d.periodLabel}`,
    footer: "Partição do Salário",
  });
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
