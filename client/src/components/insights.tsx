import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Derived } from "@/lib/app";
import { cn } from "@/lib/utils";
import { fmtEur, formatYearMonth, spendAnomalies, type GoalPace } from "@shared/calc";

/** Variação relativa com sinal ("+12,3%"); "—" quando não há base de comparação. */
export const pctSigned = (x: number | null) => (x == null ? "—" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1).replace(".", ",")}%`);

const GOOD = "text-emerald-700 dark:text-emerald-400";
const BAD = "text-destructive";

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

/* ------------------------------------------------------------ despesas fora do padrão */

/** Despesas do último mês do período (com despesas registadas) que fogem ao habitual de cada categoria. */
export function AnomaliesCard({ d }: { d: Derived }) {
  const result = useMemo(() => {
    const withSpend = new Set(d.allTransactions.filter((t) => t.type === "expense").map((t) => t.monthId));
    const target = [...d.months].reverse().find((m) => withSpend.has(m.id)) ?? null;
    if (!target) return null;
    const priorWithData = d.allMonths.filter((m) => m.year * 12 + m.month < target.year * 12 + target.month).length;
    return { target, priorWithData, items: spendAnomalies(d.allTransactions, d.allMonths, target.id) };
  }, [d.allMonths, d.allTransactions, d.months]);
  if (!result) {
    return (
      <p className="flex items-start gap-2 py-4 text-xs text-muted-foreground" data-testid="anomalies-nospend">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Sem despesas registadas no período para comparar com o habitual.
      </p>
    );
  }
  const target = result.target;
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
