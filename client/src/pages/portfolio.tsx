import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/layout";
import { FilterBar } from "@/components/filter-bar";
import { Kpi, SectionCard } from "@/components/kpi";
import { useUiMode } from "@/lib/ui-mode";
import { visibleSections } from "@shared/ui-mode";
import { ChartTooltip, LegendDots, axisProps, eurAxis, gridProps } from "@/components/charts";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppState, useDerived } from "@/lib/app";
import { goalTotalOf } from "@/components/goal-panel";
import { ValuationsCard } from "@/components/valuations";
import { fmtEur, fmtPct, monthLabelShort } from "@shared/calc";
import { EditableSectionGrid, type SectionSpec } from "@/components/editable-section-grid";
import { usePageLayout } from "@/lib/page-layout";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Portfolio() {
  const uiMode = useUiMode();
  const isMobile = useIsMobile();
  const { data, isLoading } = useAppState();
  const d = useDerived(data);
  const pageLayout = usePageLayout(data?.settings ?? ({} as any), "carteira");

  const model = useMemo(() => {
    if (!d) return null;
    const visibleIds = new Set(d.months.map((m) => m.id));

    // acumulado desde o início do histórico, mostrado apenas no período filtrado
    // base = saldo inicial + ajustes + submetas (acumulado completo menos o histórico de alocações)
    const base: Record<number, number> = {};
    const running: Record<number, number> = {};
    for (const p of d.parcels) {
      const hist = d.allComputed.reduce((a, c) => a + (c.byParcel[p.id] ?? 0), 0);
      base[p.id] = data ? goalTotalOf(data, p, d.allComputed) - hist : 0;
      running[p.id] = base[p.id];
    }
    const series: any[] = [];
    for (const c of d.allComputed) {
      for (const p of d.parcels) running[p.id] = (running[p.id] ?? 0) + (c.byParcel[p.id] ?? 0);
      if (visibleIds.has(c.month.id)) {
        const row: any = { name: `${monthLabelShort(c.month)} ${String(c.month.year).slice(2)}` };
        for (const p of d.parcels) row[`p${p.id}`] = running[p.id] ?? 0;
        series.push(row);
      }
    }

    const byYear = d.years.map((year) => {
      const list = d.allComputed.filter((c) => c.month.year === year);
      const row: Record<string, number> = {};
      for (const p of d.parcels) row[p.id] = list.reduce((a, c) => a + (c.byParcel[p.id] ?? 0), 0);
      return { year, row, total: Object.values(row).reduce((a, b) => a + b, 0) };
    });

    const totals: Record<number, number> = {};
    for (const p of d.parcels) totals[p.id] = (running[p.id] ?? 0);
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

    const invested = d.parcels
      .filter((p) => p.kind !== "gastos")
      .reduce((a, p) => a + (totals[p.id] ?? 0), 0);
    const spent = d.parcels.filter((p) => p.kind === "gastos").reduce((a, p) => a + (totals[p.id] ?? 0), 0);

    // exposição estimada por plataforma (divisão igual entre as plataformas de cada parcela)
    const platforms: Record<string, number> = {};
    for (const p of d.parcels) {
      const list = p.platforms
        .split(/[|,/]/)
        .map((x) => x.trim())
        .filter(Boolean);
      if (list.length === 0) continue;
      const share = (totals[p.id] ?? 0) / list.length;
      for (const plat of list) platforms[plat] = (platforms[plat] ?? 0) + share;
    }
    const platformRows = Object.entries(platforms)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return { series, byYear, totals, base, grandTotal, invested, spent, platformRows };
  }, [d, data]);

  if (isLoading || !d || !model) {
    return (
      <AppShell title="Carteira" subtitle="A carregar…">
        <Skeleton className="h-[420px] rounded-lg" />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Carteira"
      subtitle="Acumulado por parcela ao longo do histórico"
      filters={<FilterBar d={d} />}
    >
      <div className="space-y-4">
        {(() => {
          const kpiNodes: { id: string; title: string; node: React.ReactNode }[] = [
  { id: "kpi-total", title: "Total distribuído", node: (
          <Kpi label="Total distribuído" value={model.grandTotal} hint="todo o histórico" testId="kpi-total" />
  ) },
  { id: "kpi-invested", title: "Poupado e investido", node: (
          <Kpi
            label="Poupado e investido"
            value={model.invested}
            tone="primary"
            hint={fmtPct(model.grandTotal > 0 ? model.invested / model.grandTotal : 0)}
            testId="kpi-invested"
          />
  ) },
  { id: "kpi-spent-total", title: "Gastos acumulados", node: (
          <Kpi label="Gastos acumulados" value={model.spent} testId="kpi-spent-total" />
  ) },
  { id: "kpi-carteira-4", title: "Meses registados", node: (
          <Kpi label="Meses registados" value={d.allMonths.length} kind="raw" hint="no histórico" />
  ) },
];
          const kpiSections: SectionSpec[] = kpiNodes.map((kn, i) => ({
            id: kn.id,
            title: kn.title,
            group: "kpis",
            groupClass: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
            minW: 3,
            minH: 3,
            defaultLayout: { x: i * 3, y: 0, w: 3, h: 3 },
            node: kn.node,
          }));
          const sections: SectionSpec[] = [
            ...kpiSections,
            {
              id: "evolucao-acumulado",
              title: "Evolução do acumulado",
              defaultLayout: { x: 0, y: 3, w: 12, h: 14 },
              node: (
                <SectionCard
                  title="Evolução do acumulado"
                  description="Soma acumulada das alocações de cada parcela, mês a mês. O gráfico mostra o período filtrado; os indicadores de cima contam todo o histórico."
                >
                <div className="in-[.grid-widget]:flex in-[.grid-widget]:h-full in-[.grid-widget]:flex-col">
                  <div className="h-[320px] in-[.grid-widget]:h-auto in-[.grid-widget]:min-h-0 in-[.grid-widget]:flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={model.series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="name" {...axisProps} />
                        <YAxis {...axisProps} tickFormatter={eurAxis} width={48} />
                        <Tooltip trigger={isMobile ? "click" : "hover"} content={<ChartTooltip total />} />
                        {d.parcels.map((p) => (
                          <Area
                            key={p.id}
                            type="monotone"
                            dataKey={`p${p.id}`}
                            name={p.name}
                            stackId="1"
                            stroke={p.color}
                            fill={p.color}
                            fillOpacity={0.28}
                            strokeWidth={1.5}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 shrink-0">
                    <LegendDots items={d.parcels.map((p) => ({ name: p.name, color: p.color }))} />
                  </div>
                </div>
                </SectionCard>
              ),
            },
            {
              id: "por-ano-parcela",
              title: "Por ano e parcela",
              defaultLayout: { x: 0, y: 17, w: 12, h: 13 },
              node: (
                <SectionCard title="Por ano e parcela" description="Quanto entrou em cada parcela em cada ano">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th className="py-2 pr-3 text-left font-medium">Ano</th>
                          {d.parcels.map((p) => (
                            <th key={p.id} className="px-3 py-2 text-right font-medium">
                              <span className="flex items-center justify-end gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                                {p.name}
                              </span>
                            </th>
                          ))}
                          <th className="pl-3 py-2 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {model.byYear.map((y) => (
                          <tr key={y.year} className="border-b border-border/60 last:border-0">
                            <td className="py-2 pr-3 font-medium">{y.year}</td>
                            {d.parcels.map((p) => (
                              <td key={p.id} className="tnum px-3 py-2 text-right text-muted-foreground">
                                {fmtEur(y.row[p.id] ?? 0, 0)}
                              </td>
                            ))}
                            <td className="tnum py-2 pl-3 text-right font-medium">{fmtEur(y.total, 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="text-xs text-muted-foreground" data-testid="row-base">
                          <td className="py-2 pr-3">Saldos, ajustes e submetas</td>
                          {d.parcels.map((p) => (
                            <td key={p.id} className="tnum px-3 py-2 text-right">{fmtEur(model.base[p.id] ?? 0, 0)}</td>
                          ))}
                          <td className="tnum py-2 pl-3 text-right">{fmtEur(Object.values(model.base).reduce((a, b) => a + b, 0), 0)}</td>
                        </tr>
                        <tr className="border-t border-border text-xs font-medium">
                          <td className="py-2 pr-3">Acumulado</td>
                          {d.parcels.map((p) => (
                            <td key={p.id} className="tnum px-3 py-2 text-right">
                              {fmtEur(model.totals[p.id] ?? 0, 0)}
                            </td>
                          ))}
                          <td className="tnum py-2 pl-3 text-right">{fmtEur(model.grandTotal, 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </SectionCard>
              ),
            },
            {
              id: "valor-carteira",
              title: "Valor atual e rentabilidade",
              defaultLayout: { x: 0, y: 30, w: 12, h: 15 },
              node: <ValuationsCard d={d} base={model.base} />,
            },
            {
              id: "exposicao-plataforma",
              title: "Exposição por plataforma",
              defaultLayout: { x: 0, y: 45, w: 12, h: 11 },
              node: (
                <SectionCard
                  title="Exposição por plataforma"
                  description="Estimativa: o valor de cada parcela é dividido igualmente pelas plataformas indicadas"
                >
                  {model.platformRows.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      Indica as plataformas de cada parcela para ver esta estimativa.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {model.platformRows.map((row) => (
                        <div key={row.name} className="flex items-center gap-3 text-sm">
                          <span className="w-40 shrink-0 truncate">{row.name}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${(row.value / (model.platformRows[0]?.value || 1)) * 100}%` }}
                            />
                          </div>
                          <span className="tnum w-24 text-right text-muted-foreground">{fmtEur(row.value, 0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              ),
            },
          ];
          return (
            <EditableSectionGrid
              pageKey="carteira"
              sections={visibleSections("carteira", sections, uiMode)}
              savedLayout={pageLayout.savedLayout}
              isSaving={pageLayout.isSaving}
              onSave={pageLayout.onSave}
            />
          );
        })()}
      </div>
    </AppShell>
  );
}
