import { useState } from "react";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AppState } from "@/lib/app";
import { computeMonth, fmtEur, sortMonths } from "@shared/calc";
import { inicioSummary } from "@shared/inicio";
import { latestOpenMonth } from "@shared/assistant";

const hoje = () => new Date().toLocaleDateString("sv-SE");
const nomeMes = (year: number, month: number) => {
  const n = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("pt-PT", { month: "long", timeZone: "UTC" });
  return n.charAt(0).toUpperCase() + n.slice(1);
};
const FRASE = {
  ok: "Estás dentro do previsto",
  atencao: "Atenção: já gastaste quase tudo o que planeaste",
  excedido: "Gastaste mais do que planeaste",
} as const;

/**
 * Resumo do mês no topo do Início: "Ainda podes gastar" = gastos mensais planeados − despesas registadas,
 * a barra de progresso e para onde vai o dinheiro. O Básico mostra as 3 maiores categorias; o Detalhado, todas.
 */
export function InicioSummary({ state, detailed }: { state: AppState; detailed: boolean }) {
  const months = sortMonths(state.months);
  const [pick, setPick] = useState<number | null>(null);
  const month = months.find((m) => m.id === pick) ?? latestOpenMonth(months) ?? months[months.length - 1];
  if (!month) {
    return (
      <section className="rounded-2xl border border-card-border bg-card p-6 text-center" data-testid="inicio-summary">
        <p className="text-base font-medium">Ainda não tens nenhum mês</p>
        <p className="mt-1 text-sm text-muted-foreground">Cria o primeiro mês para ver aqui quanto ainda podes gastar.</p>
        <Link href="/meses" className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">Ir para Meses</Link>
      </section>
    );
  }
  const computed = computeMonth(month, state.allocations, state.parcels, state.settings);
  const kindOf = new Map(state.parcels.map((p) => [p.id, p.kind]));
  const expenses = state.transactions
    .filter((t) => t.monthId === month.id && t.type === "expense")
    .map((t) => ({ value: t.value, category: t.category, parcelKind: t.parcelId == null ? null : (kindOf.get(t.parcelId) ?? null) }));
  const s = inicioSummary({ month, planned: computed.byKind.gastos ?? 0, expenses, today: hoje() });
  const cats = detailed ? s.categories : s.categories.slice(0, 3);
  const tom = s.state === "excedido" ? "text-destructive" : s.state === "atencao" ? "text-warning" : "text-foreground";

  return (
    <section className="overflow-hidden rounded-2xl border border-card-border bg-card" data-testid="inicio-summary">
      <div className="flex items-start justify-between gap-3 bg-accent px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight" data-testid="inicio-title">{nomeMes(month.year, month.month)}</h2>
          <p className="text-sm text-muted-foreground">
            {month.year}
            {s.daysLeft != null && ` · ${s.daysLeft === 0 ? "último dia do mês" : s.daysLeft === 1 ? "falta 1 dia" : `faltam ${s.daysLeft} dias`}`}
          </p>
        </div>
        {months.length > 1 && (
          <Select value={String(month.id)} onValueChange={(v) => setPick(Number(v))}>
            <SelectTrigger className="h-9 w-40 bg-card text-sm" aria-label="Mês" data-testid="inicio-month"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[...months].reverse().map((m) => <SelectItem key={m.id} value={String(m.id)}>{nomeMes(m.year, m.month)} {m.year}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-5 px-5 py-5">
        {s.state === "sem-plano" ? (
          <div data-testid="inicio-no-plan">
            <p className="text-lg font-medium">Define quanto queres gastar este mês</p>
            <p className="mt-1 text-sm text-muted-foreground">Ainda não há gastos planeados neste mês, por isso não consigo dizer quanto ainda podes gastar.</p>
            <Link href="/divisao" className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">Ir para Dividir</Link>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ainda podes gastar</p>
            <p className={cn("tnum text-4xl font-semibold tracking-tight sm:text-5xl", tom)} data-testid="inicio-left">{fmtEur(s.left)}</p>
            <p className="mt-1 text-sm text-muted-foreground">de {fmtEur(s.planned)} planeados para gastos</p>
            <p className={cn("mt-3 inline-block rounded-full px-3 py-1 text-sm font-medium", s.state === "ok" ? "bg-success/15 text-success" : s.state === "atencao" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive")} data-testid="inicio-state">
              {FRASE[s.state]}
            </p>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Gasto sobre o planeado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.pctSpent} data-testid="inicio-progress">
              <div className={cn("h-full rounded-full", s.state === "excedido" ? "bg-destructive" : s.state === "atencao" ? "bg-warning" : "bg-primary")} style={{ width: `${s.pctSpent}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{fmtEur(s.spent)} gastos</span><span>{s.pctSpent}%</span></div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold">Para onde vai o dinheiro</h3>
          {cats.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground" data-testid="inicio-categories">Ainda não registaste despesas neste mês.</p>
          ) : (
            <ul className="mt-2 space-y-2.5" data-testid="inicio-categories">
              {cats.map((c) => (
                <li key={c.name} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3"><span className="truncate">{c.name}</span><span className="tnum font-medium">{fmtEur(c.value)}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden><div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(2, Math.round(c.pct))}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
          {!detailed && s.categories.length > 3 && <p className="mt-2 text-xs text-muted-foreground">Mais categorias no modo Detalhado.</p>}
        </div>

        {detailed && (
          <p className="text-sm text-muted-foreground" data-testid="inicio-undistributed">
            Por distribuir neste mês: <span className={cn("tnum font-medium", computed.remaining < -0.005 ? "text-destructive" : "text-foreground")}>{fmtEur(computed.remaining)}</span>
          </p>
        )}
      </div>
    </section>
  );
}
