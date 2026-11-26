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

function missingLine(g: Goal) {
  if (!hasTarget(g)) return "Sem objetivo definido para a meta principal";
  if (g.incomplete) return "O progresso é parcial até definires a taxa de conversão.";
  if (g.missing <= 0) return "Meta concluída";
  const m = money(g);
  return g.monthsLeft ? `Faltam ${m(g.missing)} · ~${g.monthsLeft} ${g.monthsLeft === 1 ? "mês" : "meses"} ao ritmo de ${m(g.pace)}/mês` : `Faltam ${m(g.missing)}`;
}

/** Cartão de Metas do Início: a meta que mais precisa de atenção em destaque, com submetas, e as outras em anéis. */
export function GoalsCard({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Define uma meta em Parcelas e metas para acompanhar o progresso aqui.</p>;
  }
  const featuredId = featuredGoalId(goals.map((g) => ({ id: g.parcel.id, status: g.paceInfo.status, pct: g.pct })));
  const featured = goals.find((g) => g.parcel.id === featuredId)!;
  const others = goals.filter((g) => g !== featured);
  const pct = (g: Goal) => Math.round(g.pct * 100);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start" data-testid={`dashboard-goal-${featured.parcel.id}`}>
        <Ring pct={pct(featured)} color={featured.parcel.color} size={104} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex min-w-0 items-center gap-2 text-base font-semibold">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: featured.parcel.color }} aria-hidden />
              <span className="min-w-0 wrap-break-word">{featured.parcel.name}</span>
            </h3>
            <Chip status={featured.paceInfo.status} />
          </div>
          <p className="tnum mt-1 text-sm text-muted-foreground">{amounts(featured)}</p>
          {incompleteNote(featured)}
          <p className="mt-0.5 text-xs text-muted-foreground">{missingLine(featured)}</p>
          {!featured.incomplete && <GoalPaceLine pace={featured.paceInfo} money={money(featured)} testId={`dashboard-goal-pace-${featured.parcel.id}`} />}
          {featured.subs.length > 0 && <DashboardSubgoals subs={featured.subs} />}
        </div>
      </div>

      {others.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {others.map((g) => {
            const warn = ["atrasada", "sem_ritmo", "prazo_passado"].includes(g.paceInfo.status);
            return (
              <div key={g.parcel.id} className="flex min-w-0 gap-3 rounded-xl border border-card-border bg-background/60 p-3" data-testid={`dashboard-goal-${g.parcel.id}`}>
                <Ring pct={pct(g)} color={g.parcel.color} size={64} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: g.parcel.color }} aria-hidden /><span className="min-w-0 wrap-break-word">{g.parcel.name}</span></p>
                  <p className="tnum text-xs text-muted-foreground">{amounts(g)}</p>
                  {incompleteNote(g)}
                  <div className="mt-1"><Chip status={g.paceInfo.status} /></div>
                  {warn && !g.incomplete && <GoalPaceLine pace={g.paceInfo} money={money(g)} testId={`dashboard-goal-pace-${g.parcel.id}`} />}
                  {g.subs.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{g.subs.length} {g.subs.length === 1 ? "submeta" : "submetas"}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
