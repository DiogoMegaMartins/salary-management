import { useState } from "react";
import { DashboardSubgoals, formatGoalMoney } from "@/components/dashboard-subgoals";
import { GoalPaceLine } from "@/components/insights";
import { cn } from "@/lib/utils";
import { featuredGoalId, goalChip } from "@shared/goals-view";
import type { buildDashboardModel } from "@/lib/dashboard-model";

type Goal = NonNullable<ReturnType<typeof buildDashboardModel>>["goals"][number];
const TONE = { ok: "bg-success/15 text-success", warn: "bg-warning/15 text-warning", bad: "bg-destructive/15 text-destructive" } as const;

function Chip({ status }: { status: string }) {
  const c = goalChip(status);
  return c ? <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[c.tone])} data-testid="goal-chip">{c.text}</span> : null;
}

/** Anel de progresso em CSS: o texto no meio diz a percentagem (o anel é só decoração). */
function Ring({ pct, color, size }: { pct: number; color: string; size: number }) {
  const inner = Math.round(size * 0.76);
  return (
    <div className="grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: `conic-gradient(${color} 0 ${pct}%, hsl(var(--muted)) ${pct}% 100%)` }} aria-hidden>
      <div className="tnum grid place-items-center rounded-full bg-card font-semibold" style={{ width: inner, height: inner, fontSize: size >= 90 ? 20 : 14 }}>{pct}%</div>
    </div>
  );
}

const hasTarget = (g: Goal) => g.parcel.targetAmount != null && g.parcel.targetAmount > 0;
const money = (g: Goal) => (n: number) => formatGoalMoney(n, g.parcel.currency || "EUR");
const amounts = (g: Goal) => `${money(g)(g.acc)}${hasTarget(g) ? ` de ${money(g)(g.parcel.targetAmount!)}` : ""}`;

function incompleteNote(g: Goal) {
  return g.incomplete ? <p className="mt-1 text-xs text-destructive">Acumulado incompleto: falta taxa {g.missingRates.join(", ")}.</p> : null;
}

/** "~8 meses", "~1 mês" ou, a partir de 2 anos, "~24 anos": 288 meses lê-se mal. */
function span(months: number) {
  if (months >= 24) return `~${Math.round(months / 12)} anos`;
  return `~${months} ${months === 1 ? "mês" : "meses"}`;
}

function missingLine(g: Goal) {
  if (!hasTarget(g)) return "Sem objetivo definido para a meta principal";
  if (g.incomplete) return "O progresso é parcial até definires a taxa de conversão.";
  if (g.missing <= 0) return "Meta concluída";
  const m = money(g);
  return g.monthsLeft ? `Faltam ${m(g.missing)} · ${span(g.monthsLeft)} ao ritmo de ${m(g.pace)}/mês` : `Faltam ${m(g.missing)}`;
}

/**
 * Cartão de Metas do Início: cada meta é um cartão pequeno com o anel de progresso; a escolhida (por defeito, a que mais
 * precisa de atenção) abre por baixo com o ritmo e as submetas, uma por cartão.
 */
export function GoalsCard({ goals }: { goals: Goal[] }) {
  const featuredId = goals.length ? featuredGoalId(goals.map((g) => ({ id: g.parcel.id, status: g.paceInfo.status, pct: g.pct }))) : null;
  const [picked, setPicked] = useState<number | null>(null);
  if (goals.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Define uma meta em Parcelas e metas para acompanhar o progresso aqui.</p>;
  }
  const selected = goals.find((g) => g.parcel.id === picked) ?? goals.find((g) => g.parcel.id === featuredId)!;
  const pct = (g: Goal) => Math.round(g.pct * 100);
  const eta = (g: Goal) => (hasTarget(g) && !g.incomplete && g.missing > 0 && g.monthsLeft ? `${span(g.monthsLeft)} para chegar` : null);

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Metas" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {goals.map((g) => {
          const on = g.parcel.id === selected.parcel.id;
          return (
            <button
              key={g.parcel.id} type="button" aria-pressed={on} onClick={() => setPicked(g.parcel.id)}
              className={cn(
                "flex h-full min-w-0 items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11",
                on ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "border-card-border bg-background/60",
              )}
              data-testid={`dashboard-goal-${g.parcel.id}`}
            >
              <Ring pct={pct(g)} color={g.parcel.color} size={64} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: g.parcel.color }} aria-hidden /><span className="min-w-0 wrap-break-word">{g.parcel.name}</span></span>
                <span className="tnum block text-xs text-muted-foreground">{amounts(g)}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Chip status={g.paceInfo.status} />
                  {eta(g) && <span className="text-[11px] text-muted-foreground">{eta(g)}</span>}
                </span>
                {g.subs.length > 0 && <span className="mt-0.5 block text-[11px] text-muted-foreground">{g.subs.length} {g.subs.length === 1 ? "submeta" : "submetas"}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <section aria-label={`Detalhe de ${selected.parcel.name}`} className="space-y-3 rounded-2xl border border-card-border bg-muted/20 p-4" data-testid={`dashboard-goal-detail-${selected.parcel.id}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-2 text-base font-semibold">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: selected.parcel.color }} aria-hidden />
            <span className="min-w-0 wrap-break-word">{selected.parcel.name}</span>
          </h3>
          <span className="tnum text-sm text-muted-foreground">{amounts(selected)}</span>
        </div>
        {hasTarget(selected) && (
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct(selected))}%`, background: selected.parcel.color }} />
          </div>
        )}
        {incompleteNote(selected)}
        <p className="text-sm text-muted-foreground">{missingLine(selected)}</p>
        {!selected.incomplete && <GoalPaceLine pace={selected.paceInfo} money={money(selected)} testId={`dashboard-goal-pace-${selected.parcel.id}`} />}
        {selected.subs.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submetas</p>
            <DashboardSubgoals subs={selected.subs} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Esta meta ainda não tem submetas.</p>
        )}
      </section>
    </div>
  );
}
