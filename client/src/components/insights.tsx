import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Derived } from "@/lib/app";
import { cn } from "@/lib/utils";
import {
  categoryYearOverYear,
  fmtEur,
  fmtPct,
  formatYearMonth,
  spendAnomalies,
  yearOverYear,
  type GoalPace,
} from "@shared/calc";

/** Variação relativa com sinal ("+12,3%"); "—" quando não há base de comparação. */
export const pctSigned = (x: number | null) => (x == null ? "—" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1).replace(".", ",")}%`);

const GOOD = "text-emerald-700 dark:text-emerald-400";
const BAD = "text-destructive";

/** Cor da variação: `upIsGood` indica se subir é bom (rendimento, poupança) ou mau (gastos). */
const deltaTone = (x: number | null, upIsGood: boolean) => (x == null || Math.abs(x) < 0.0005 ? "text-muted-foreground" : (x > 0) === upIsGood ? GOOD : BAD);

/* ------------------------------------------------------------------ ritmo das metas */

/** Uma linha sobre o ritmo da meta face ao prazo. Não mostra nada quando não há o que dizer. */
export function GoalPaceLine({ pace, money, testId }: { pace: GoalPace; money: (n: number) => string; testId?: string }) {
  const until = (ym: string | null) => formatYearMonth(ym);
  let text: string | null = null;
  let tone: "ok" | "warn" = "ok";
  switch (pace.status) {
    case "no_ritmo":
      text = `No ritmo: previsto para ${until(pace.projectedMonth)}, dentro do prazo.`;
      break;
    case "atrasada":
      tone = "warn";
      text = `Fora do ritmo: ao ritmo atual chega em ${until(pace.projectedMonth)}, ${pace.delayMonths} ${pace.delayMonths === 1 ? "mês" : "meses"} depois do prazo. Para chegar a tempo seriam precisos ${money(pace.requiredMonthly ?? 0)} por mês.`;
      break;
    case "sem_ritmo":
      tone = "warn";
      text = `Sem contribuições recentes: para chegar ao prazo seriam precisos ${money(pace.requiredMonthly ?? 0)} por mês.`;
      break;
    case "prazo_passado":
      tone = "warn";
      text = `O prazo já passou e ainda faltam ${money(pace.missing)}.`;
      break;
    default:
      return null;
  }
  return (
    <p className={cn("mt-1 flex items-start gap-1.5 text-xs", tone === "warn" ? BAD : GOOD)} data-testid={testId} data-pace={pace.status}>
      {tone === "warn" ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span>{text}</span>
    </p>
  );
}

/* ------------------------------------------------------- comparação com o ano anterior */

export function useYearOverYear(d: Derived) {
  return useMemo(() => yearOverYear(d.months, d.computed, d.allMonths, d.allComputed), [d.months, d.computed, d.allMonths, d.allComputed]);
}

export function YearOverYearCard({ d }: { d: Derived }) {
  const yoy = useYearOverYear(d);
  if (!yoy) {
    return (
      <p className="flex items-start gap-2 py-4 text-xs text-muted-foreground" data-testid="yoy-empty">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Sem os mesmos meses do ano anterior para comparar neste período. A comparação aparece quando houver pelo menos um mês com o seu par um ano antes.
      </p>
    );
  }
  const n = yoy.pairs.length;
  const rows: { label: string; cur: string; prev: string; delta: number | null; text?: string; upIsGood: boolean; id: string }[] = [
    { id: "net", label: "Líquido", cur: fmtEur(yoy.current.net), prev: fmtEur(yoy.previous.net), delta: yoy.delta.net, upIsGood: true },
    { id: "spent", label: "Gastos", cur: fmtEur(yoy.current.spent), prev: fmtEur(yoy.previous.spent), delta: yoy.delta.spent, upIsGood: false },
    { id: "saved", label: "Poupança e investimento", cur: fmtEur(yoy.current.saved), prev: fmtEur(yoy.previous.saved), delta: yoy.delta.saved, upIsGood: true },
    {
      id: "rate",
      label: "Taxa de poupança",
      cur: fmtPct(yoy.current.savingsRate),
      prev: fmtPct(yoy.previous.savingsRate),
      delta: yoy.savingsRateDeltaPP,
      text: `${yoy.savingsRateDeltaPP >= 0 ? "+" : ""}${(yoy.savingsRateDeltaPP * 100).toFixed(1).replace(".", ",")} p.p.`,
      upIsGood: true,
    },
  ];
  return (
    <div data-testid="yoy-card" className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {n} {n === 1 ? "mês comparado" : "meses comparados"} com o mesmo {n === 1 ? "mês" : "período"} do ano anterior. Meses sem par ficam de fora.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Indicador</th>
              <th className="py-1 pr-3 text-right font-medium">Agora</th>
              <th className="py-1 pr-3 text-right font-medium">Ano anterior</th>
              <th className="py-1 text-right font-medium">Variação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border" data-testid={`yoy-row-${r.id}`}>
                <td className="py-1.5 pr-3">{r.label}</td>
                <td className="tnum py-1.5 pr-3 text-right">{r.cur}</td>
                <td className="tnum py-1.5 pr-3 text-right text-muted-foreground">{r.prev}</td>
                <td className={cn("tnum py-1.5 text-right font-medium", deltaTone(r.delta, r.upIsGood))}>{r.text ?? pctSigned(r.delta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Despesa por categoria face ao ano anterior (Orçamento). */
export function CategoryYearOverYear({ d }: { d: Derived }) {
  const yoy = useYearOverYear(d);
  const rows = useMemo(() => (yoy ? categoryYearOverYear(d.allTransactions, yoy).slice(0, 10) : []), [d.allTransactions, yoy]);
  if (!yoy) {
    return (
      <p className="flex items-start gap-2 py-4 text-xs text-muted-foreground" data-testid="yoy-categories-empty">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Sem os mesmos meses do ano anterior para comparar neste período.
      </p>
    );
  }
  if (rows.length === 0) return <p className="py-4 text-xs text-muted-foreground">Sem despesas com categoria nos meses comparados.</p>;
  return (
    <div className="overflow-x-auto" data-testid="yoy-categories">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1 pr-3 font-medium">Categoria</th>
            <th className="py-1 pr-3 text-right font-medium">Agora</th>
            <th className="py-1 pr-3 text-right font-medium">Ano anterior</th>
            <th className="py-1 text-right font-medium">Variação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-border">
              <td className="py-1.5 pr-3">{r.name}</td>
              <td className="tnum py-1.5 pr-3 text-right">{fmtEur(r.current)}</td>
              <td className="tnum py-1.5 pr-3 text-right text-muted-foreground">{fmtEur(r.previous)}</td>
              <td className={cn("tnum py-1.5 text-right font-medium", deltaTone(r.delta === 0 ? 0 : r.delta, false))}>
                {r.delta >= 0 ? "+" : ""}
                {fmtEur(r.delta)}
                {r.deltaPct != null && ` (${pctSigned(r.deltaPct)})`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------ despesas fora do padrão */

/** Despesas do último mês do período que fogem ao habitual de cada categoria. */
export function AnomaliesCard({ d }: { d: Derived }) {
  const target = d.months.length > 0 ? d.months[d.months.length - 1] : null;
  const result = useMemo(() => {
    if (!target) return null;
    const priorWithData = d.allMonths.filter((m) => m.year * 12 + m.month < target.year * 12 + target.month).length;
    return { priorWithData, items: spendAnomalies(d.allTransactions, d.allMonths, target.id) };
  }, [d.allMonths, d.allTransactions, target]);
  if (!target || !result) return null;
  const label = target.label || `${target.month}/${target.year}`;

  if (result.priorWithData < 3) {
    return (
      <p className="flex items-start gap-2 py-4 text-xs text-muted-foreground" data-testid="anomalies-nohistory">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        São precisos pelo menos 3 meses anteriores a {label} para saber o que é habitual em cada categoria.
      </p>
    );
  }
  if (result.items.length === 0) {
    return (
      <p className="flex items-start gap-2 py-4 text-xs text-muted-foreground" data-testid="anomalies-none">
        <CheckCircle2 className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", GOOD)} aria-hidden="true" />
        Nenhuma categoria fugiu ao habitual em {label}.
      </p>
    );
  }
  return (
    <div className="space-y-2" data-testid="anomalies-list">
      <p className="text-xs text-muted-foreground">
        Categorias de {label} bem acima do habitual dos meses anteriores (média e dispersão dos até 12 meses antes).
      </p>
      <ul className="space-y-1.5">
        {result.items.map((a) => (
          <li key={a.category} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-border pt-1.5 text-sm" data-testid={`anomaly-${a.category.toLowerCase().replace(/\s+/g, "-")}`}>
            <span className="flex items-center gap-2">
              <span className="font-medium">{a.category}</span>
              {a.kind === "novo" && <Badge variant="outline" className="text-[10px]">Novo</Badge>}
            </span>
            <span className="tnum text-xs">
              <span className={cn("font-semibold", BAD)}>{fmtEur(a.current)}</span>
              <span className="text-muted-foreground">
                {a.kind === "novo" ? " · sem gasto nos meses anteriores" : ` · habitual ${fmtEur(a.mean)} (${a.ratio!.toFixed(1).replace(".", ",")}×)`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
