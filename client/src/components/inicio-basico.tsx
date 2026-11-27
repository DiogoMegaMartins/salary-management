import { useState } from "react";
import { Link } from "wouter";
import { InicioSummary, useInicioData } from "@/components/inicio-summary";
import { EditableSectionGrid, type SectionSpec } from "@/components/editable-section-grid";
import { usePageLayout } from "@/lib/page-layout";
import type { AppState } from "@/lib/app";
import { fmtEur } from "@shared/calc";
import { dailyAllowance, dayLabel, latestExpenses } from "@shared/inicio";

const hoje = () => new Date().toLocaleDateString("sv-SE");
const CORES = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];

function Mini({ label, value, hint, testId }: { label: string; value: string; hint: string; testId: string }) {
  return (
    <div className="h-full rounded-2xl border border-card-border bg-card p-4" data-testid={testId}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="tnum mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Para onde vai o dinheiro: anel com as 5 maiores categorias (o resto junta-se em "Outras") e a lista com os valores. */
function CategoryRing({ categories, spent }: { categories: { name: string; value: number; pct: number }[]; spent: number }) {
  if (categories.length === 0) {
    return (
      <section className="h-full rounded-2xl border border-card-border bg-card p-5" aria-label="Para onde vai o dinheiro">
        <h2 className="text-sm font-semibold">Para onde vai o dinheiro</h2>
        <p className="mt-2 text-sm text-muted-foreground" data-testid="inicio-categories">Ainda não registaste despesas neste mês.</p>
      </section>
    );
  }
  const top = categories.slice(0, 5);
  const rest = categories.slice(5).reduce((a, c) => a + c.value, 0);
  const parts = [...top.map((c, i) => ({ name: c.name, value: c.value, color: `hsl(var(${CORES[i]}))` })), ...(rest > 0.005 ? [{ name: "Outras", value: rest, color: "hsl(var(--muted-foreground))" }] : [])];
  let acc = 0;
  const stops = parts.map((p) => { const from = acc; acc += (p.value / spent) * 100; return `${p.color} ${from}% ${Math.min(100, acc)}%`; }).join(", ");
  return (
    <section className="flex h-full flex-col gap-4 rounded-2xl border border-card-border bg-card p-5 sm:flex-row sm:items-center" aria-label="Para onde vai o dinheiro">
      <div className="grid h-36 w-36 shrink-0 place-items-center self-center rounded-full" style={{ background: `conic-gradient(${stops})` }} aria-hidden data-testid="inicio-ring">
        <div className="grid h-24 w-24 place-items-center rounded-full bg-card text-center">
          <span><span className="tnum block text-base font-semibold">{fmtEur(spent)}</span><span className="block text-xs text-muted-foreground">gastos</span></span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold">Para onde vai o dinheiro</h2>
        <ul className="mt-2 divide-y divide-border" data-testid="inicio-categories">
          {parts.map((p) => (
            <li key={p.name} className="flex items-center gap-2.5 py-1.5 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="tnum font-medium">{fmtEur(p.value)}</span>
              <span className="tnum w-10 text-right text-xs text-muted-foreground">{Math.round((p.value / spent) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Início no modo Básico: o valor disponível ao lado de para onde vai o dinheiro, três números do dia a dia
 * (gasto, quanto podes gastar por dia, última despesa) e as últimas despesas. O botão Registar está sempre por baixo.
 */
export function InicioBasico({ state }: { state: AppState }) {
  const [pick, setPick] = useState<number | null>(null);
  const pageLayout = usePageLayout(state.settings, "painel-basico");
  const data = useInicioData(state, pick);
  if (!data) return <InicioSummary state={state} detailed={false} />;
  const { month, s } = data;
  const spent = s.categories.reduce((a, c) => a + c.value, 0);
  const lista = latestExpenses(state.transactions, month.id, 5);
  const ultima = lista[0];
  const porDia = dailyAllowance(s.left, s.daysLeft);
  const hojeStr = hoje();

  const TOPO = "grid items-stretch gap-4 lg:grid-cols-2";
  const NUMEROS = "grid gap-3 sm:grid-cols-3";
  const sections: SectionSpec[] = [
    { id: "basico-resumo", title: "Valor disponível", group: "basico-topo", groupClass: TOPO, minW: 4, minH: 6, defaultLayout: { x: 0, y: 0, w: 6, h: 8 }, node: <InicioSummary state={state} detailed={false} hideCategories pick={pick} onPick={setPick} /> },
    { id: "basico-categorias", title: "Para onde vai o dinheiro", group: "basico-topo", groupClass: TOPO, minW: 4, minH: 6, defaultLayout: { x: 6, y: 0, w: 6, h: 8 }, node: <CategoryRing categories={s.categories} spent={spent} /> },
    { id: "basico-gasto", title: "Gasto este mês", group: "basico-numeros", groupClass: NUMEROS, minW: 3, minH: 3, defaultLayout: { x: 0, y: 8, w: 4, h: 3 }, node: <Mini testId="inicio-mini-gasto" label="Gasto este mês" value={fmtEur(s.spent)} hint={s.state === "sem-plano" ? "sem plano de gastos" : `${s.pctSpent}% do planeado`} /> },
    { id: "basico-dia", title: "Podes gastar por dia", group: "basico-numeros", groupClass: NUMEROS, minW: 3, minH: 3, defaultLayout: { x: 4, y: 8, w: 4, h: 3 }, node: <Mini testId="inicio-mini-dia" label="Podes gastar por dia" value={porDia == null ? "—" : fmtEur(porDia)} hint={porDia == null ? (s.daysLeft == null ? "só no mês de hoje" : "sem valor disponível") : "até ao fim do mês"} /> },
    { id: "basico-ultima", title: "Última despesa", group: "basico-numeros", groupClass: NUMEROS, minW: 3, minH: 3, defaultLayout: { x: 8, y: 8, w: 4, h: 3 }, node: <Mini testId="inicio-mini-ultima" label="Última despesa" value={ultima ? fmtEur(ultima.value) : "—"} hint={ultima ? `${ultima.category} · ${dayLabel(ultima.date, hojeStr)}` : "ainda sem registos"} /> },
    {
      id: "basico-ultimas", title: "Últimas despesas", minW: 4, minH: 6, defaultLayout: { x: 0, y: 11, w: 12, h: 10 },
      node: (
        <section className="h-full overflow-auto rounded-2xl border border-card-border bg-card" aria-label="Últimas despesas" data-testid="inicio-ultimas">
          <h2 className="px-5 pt-4 text-sm font-semibold">Últimas despesas</h2>
          {lista.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">Ainda não registaste despesas neste mês. Usa o botão &quot;Registar despesa&quot; aqui por baixo.</p>
          ) : (
            <ul className="mt-1 divide-y divide-border">
              {lista.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-2.5" data-testid="inicio-despesa">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{e.note || e.category}</span>
                    <span className="block text-xs text-muted-foreground">{e.category} · {dayLabel(e.date, hojeStr)}</span>
                  </span>
                  <span className="tnum text-sm font-semibold">{fmtEur(e.value)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border px-5 py-3">
            <Link href="/despesas" className="text-sm font-medium text-primary underline-offset-4 hover:underline" data-testid="inicio-ver-despesas">Ver todas as despesas</Link>
          </div>
        </section>
      ),
    },
  ];

  return (
    <div data-testid="inicio-basico">
      <EditableSectionGrid pageKey="painel-basico" sections={sections} savedLayout={pageLayout.savedLayout} isSaving={pageLayout.isSaving} onSave={pageLayout.onSave} />
    </div>
  );
}
