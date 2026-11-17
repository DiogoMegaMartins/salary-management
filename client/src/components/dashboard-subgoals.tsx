import * as React from "react";
import { Progress } from "@/components/ui/progress";
import { fmtPct, type SubBreakdown } from "@shared/calc";

export function formatGoalMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: "always",
  }).format(amount);
}

/** Read-only summary. Balances and progress come from the shared goal breakdown. */
export function DashboardSubgoals({ subs }: { subs: SubBreakdown[] }) {
  if (!subs.length) return null;

  return (
    <ul aria-label="Submetas" className="mt-3 space-y-3 rounded-md bg-muted/30 p-3">
      {subs.map(({ sub, balance, remaining, progress }) => {
        const hasTarget = sub.target != null && sub.target > 0;
        const pct = Math.max(0, Math.min(1, progress ?? 0));
        return (
          <li key={sub.id} className="min-w-0 space-y-1.5" data-testid={`dashboard-subgoal-${sub.id}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
              <span className="min-w-0 break-words font-medium">{sub.name}</span>
              {hasTarget && <span className="tnum text-muted-foreground">{fmtPct(pct, 0)}</span>}
            </div>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Acumulado</dt>
              <dd className="tnum text-right">{formatGoalMoney(balance, sub.currency)}</dd>
              {hasTarget && (
                <>
                  <dt className="text-muted-foreground">Objetivo</dt>
                  <dd className="tnum text-right">{formatGoalMoney(sub.target!, sub.currency)}</dd>
                </>
              )}
            </dl>
            {hasTarget ? (
              <>
                <Progress value={pct * 100} aria-valuenow={pct * 100} aria-valuetext={fmtPct(pct, 0)} aria-label={`Progresso de ${sub.name}`} className="h-1.5" />
                <p className="tnum text-xs text-muted-foreground">
                  {remaining != null && remaining <= 0
                    ? "Objetivo atingido"
                    : `Faltam ${formatGoalMoney(Math.max(0, remaining ?? 0), sub.currency)}`}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Sem objetivo definido</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
