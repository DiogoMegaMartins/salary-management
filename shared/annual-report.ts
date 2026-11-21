/**
 * Relatório anual em Markdown (depois convertido em PDF por `markdownToPdf`). Função pura: recebe os dados
 * já carregados, não lê nem escreve nada. O relatório do período filtrado fica em `client/src/lib/monthly-report.ts`.
 */
import { fmtEur, fmtPct } from "./calc/month";
import { parcelReturn, type ValuationLike } from "./calc/portfolio";
import type { MonthComputed } from "./calc/month";

type ParcelLike = { id: number; name: string; kind: string; archived?: number };
type TxLike = { monthId: number; type: string; value: number; category: string };

export type AnnualReportInput = {
  year: number;
  /** Todos os meses calculados, de todos os anos. */
  computed: MonthComputed[];
  parcels: ParcelLike[];
  transactions: TxLike[];
  valuations: ValuationLike[];
  /** Saldo de partida de cada parcela (saldo inicial, ajustes e submetas), como na Carteira. */
  base: Record<number, number>;
  hideAmounts: boolean;
  generatedAt: string;
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round2 = (n: number) => Math.round(n * 100 + 1e-9) / 100;

export function buildAnnualReportMarkdown(i: AnnualReportInput): string {
  const eur = (n: number) => (i.hideAmounts ? "•••••" : fmtEur(n));
  const year = i.computed.filter((c) => c.month.year === i.year);
  const prev = i.computed.filter((c) => c.month.year === i.year - 1);
  const totals = (list: MonthComputed[]) => {
    const available = sum(list.map((c) => c.available));
    const saved = sum(list.map((c) => c.byKind.poupanca + c.byKind.investimento));
    return {
      gross: sum(list.map((c) => c.gross)),
      descontos: sum(list.map((c) => c.descontos)),
      net: sum(list.map((c) => c.net)),
      available,
      saved,
      spent: sum(list.map((c) => c.byKind.gastos)),
      rate: available > 0 ? saved / available : 0,
    };
  };
  const t = totals(year);
  const p = totals(prev);
  const vs = (cur: number, before: number) => (prev.length && before !== 0 ? `${cur / before - 1 > 0 ? "+" : ""}${((cur / before - 1) * 100).toFixed(1).replace(".", ",")}%` : "—");

  const md: string[] = [];
  md.push(`# Relatório anual ${i.year} — Partição do Salário`, "");
  md.push(`**Ano:** ${i.year} · ${year.length} ${year.length === 1 ? "mês registado" : "meses registados"}`);
  md.push(`**Gerado em:** ${i.generatedAt}`);
  if (i.hideAmounts) md.push("**Nota:** valores monetários ocultados nesta exportação.");
  md.push("", "---", "");

  if (year.length === 0) {
    md.push(`_Não há meses registados em ${i.year}._`);
    return md.join("\n");
  }

  md.push("## Resumo do ano", "");
  md.push(`| Indicador | ${i.year} | vs. ${i.year - 1} |`, "|---|---|---|");
  md.push(`| Rendimento bruto | ${eur(t.gross)} | ${vs(t.gross, p.gross)} |`);
  md.push(`| Descontos (IRS e SS) | ${eur(t.descontos)} | ${vs(t.descontos, p.descontos)} |`);
  md.push(`| Líquido | ${eur(t.net)} | ${vs(t.net, p.net)} |`);
  md.push(`| Média mensal (líquido) | ${eur(t.net / year.length)} | — |`);
  md.push(`| Gastos | ${eur(t.spent)} | ${vs(t.spent, p.spent)} |`);
  md.push(`| Poupança e investimento | ${eur(t.saved)} | ${vs(t.saved, p.saved)} |`);
  md.push(`| Taxa de poupança | ${fmtPct(t.rate)} | — |`);
  md.push(`| Carga fiscal efetiva | ${fmtPct(t.gross > 0 ? t.descontos / t.gross : 0)} | — |`, "");

  md.push("## Mês a mês", "");
  md.push("| Mês | Bruto | Líquido | Disponível | Poupado | Gastos |", "|---|---|---|---|---|---|");
  for (const c of year) {
    md.push(`| ${c.month.label || `${c.month.month}/${c.month.year}`} | ${eur(c.gross)} | ${eur(c.net)} | ${eur(c.available)} | ${eur(c.byKind.poupanca + c.byKind.investimento)} | ${eur(c.byKind.gastos)} |`);
  }
  md.push("");

  md.push("## Parcelas no ano", "");
  md.push("| Parcela | Total alocado | Peso |", "|---|---|---|");
  for (const parcel of i.parcels) {
    const total = round2(sum(year.map((c) => c.byParcel[parcel.id] ?? 0)));
    if (total === 0 && parcel.archived) continue;
    md.push(`| ${parcel.name} | ${eur(total)} | ${fmtPct(t.available > 0 ? total / t.available : 0)} |`);
  }
  md.push("");

  const monthIds = new Set(year.map((c) => c.month.id));
  const byCategory = new Map<string, number>();
  for (const tx of i.transactions) {
    if (!monthIds.has(tx.monthId) || (tx.type !== "expense" && tx.type !== "withdrawal")) continue;
    const key = tx.category.trim() || "(sem categoria)";
    byCategory.set(key, (byCategory.get(key) ?? 0) + tx.value);
  }
  md.push("## Despesas por categoria", "");
  if (byCategory.size === 0) {
    md.push("_Sem despesas registadas neste ano._", "");
  } else {
    const rows = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const total = sum(Array.from(byCategory.values()));
    md.push("| Categoria | Total | Peso |", "|---|---|---|");
    for (const [name, value] of rows) md.push(`| ${name} | ${eur(round2(value))} | ${fmtPct(total > 0 ? value / total : 0)} |`);
    md.push("");
  }

  // valor atual das parcelas, com o último valor registado até ao fim do ano
  const limit = `${i.year}-12-31`;
  const upTo = i.valuations.filter((v) => v.date <= limit);
  const returns = i.parcels
    .filter((parcel) => parcel.kind !== "gastos")
    .map((parcel) => ({ parcel, ret: parcelReturn(i.base[parcel.id] ?? 0, i.computed, parcel.id, upTo) }))
    .filter((r) => r.ret.latest);
  if (returns.length) {
    md.push("## Valor das parcelas no fim do ano", "");
    md.push("| Parcela | Posto | Valor | Ganho ou perda |", "|---|---|---|---|");
    for (const { parcel, ret } of returns) {
      const g = ret.gain ?? 0;
      const gain = Math.abs(g) < 0.005 ? eur(0) : `${g > 0 ? "+" : "-"}${eur(Math.abs(g))}`;
      md.push(`| ${parcel.name} | ${eur(ret.contributed)} | ${eur(ret.latest!.value)} (${ret.latest!.date}) | ${gain}${ret.gainPct != null && !i.hideAmounts ? ` (${(ret.gainPct * 100).toFixed(1).replace(".", ",")}%)` : ""} |`);
    }
    md.push("");
  }

  md.push("---", "", "_Relatório gerado automaticamente pela aplicação Partição do Salário. É uma fotografia dos dados: não altera nada na aplicação._");
  return md.join("\n");
}
