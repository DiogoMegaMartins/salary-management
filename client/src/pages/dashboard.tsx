import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout";
import { FilterBar } from "@/components/filter-bar";
import { Kpi, SectionCard } from "@/components/kpi";
import { ChartTooltip, LegendDots, axisProps, eurAxis, gridProps, useLegendFilter, useSquareFit } from "@/components/charts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAppState, useDerived } from "@/lib/app";
import { useFeatures } from "@/lib/features";
import { GoalsCard } from "@/components/goals-card";
import { fmtEur, fmtPct, monthLabelShort } from "@shared/calc";
import { DrillDownSheet } from "@/components/drill-down-sheet";
import { MonthlyReportDialog } from "@/components/monthly-report-dialog";
import { EditableSectionGrid, type SectionSpec } from "@/components/editable-section-grid";
import { usePageLayout } from "@/lib/page-layout";
import { buildDashboardModel } from "@/lib/dashboard-model";
import { YearOverYearCard, useYoYEmpty } from "@/components/yoy";
import { InicioSummary } from "@/components/inicio-summary";
import { InicioBasico } from "@/components/inicio-basico";
import { parseUiMode } from "@shared/ui-mode";

export default function Dashboard() {
  const features = useFeatures();
  const isMobile = useIsMobile();
  const { data, isLoading } = useAppState();
  const d = useDerived(data);
  const yoyEmpty = useYoYEmpty(d);
  const pageLayout = usePageLayout(data?.settings ?? ({} as any), "painel");
  const legend = useLegendFilter(); // séries escondidas em cada gráfico (carregar na legenda)
  const [drillDown, setDrillDown] = useState<{ title: string; description: string; filter: (t: any) => boolean } | null>(
    null,
  );
  const { ref: donutFitRef, size: donutSize } = useSquareFit(0.45);

  const model = useMemo(() => buildDashboardModel(d, data), [d, data]);

  const openParcelDrill = (parcel: { id: number; name: string }) => {
    const ms = d?.months ?? [];
    const monthIds = new Set(ms.map((m) => m.id));
    setDrillDown({
      title: `Movimentos · ${parcel.name}`,
      description: `Lançamentos individuais desta parcela nos ${ms.length} meses do período filtrado.`,
      filter: (t) => monthIds.has(t.monthId) && (t.parcelId === parcel.id || t.targetParcelId === parcel.id),
    });
  };

  if (isLoading || !d || !model) {
    return (
      <AppShell title="Início" subtitle="A carregar…">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-lg" />
          ))}
        </div>
        <Skeleton className="mt-4 h-[320px] rounded-lg" />
      </AppShell>
    );
  }

  const empty = d.months.length === 0;
  const detailed = parseUiMode(data!.settings.uiMode) === "detalhado";

  return (
    <AppShell
      title="Início"
      subtitle={detailed ? "Visão geral do rendimento e da divisão em parcelas" : "O teu mês de relance"}
      filters={detailed ? <FilterBar d={d} /> : undefined}
      actions={detailed ? <MonthlyReportDialog d={d} /> : undefined}
    >
      {/* No Detalhado com meses, o resumo vive na grelha, ao lado dos cartões pequenos. */}
      {!detailed && <InicioBasico state={data!} />}
      {detailed && empty && <InicioSummary state={data!} detailed />}
      {!detailed ? null : empty ? (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Sem meses no período selecionado</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Ajusta os filtros no topo ou adiciona um mês novo na página Meses.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {model.alerts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="font-medium">
                {model.alerts.length} {model.alerts.length === 1 ? "mês" : "meses"} com divisão acima do valor disponível:
              </span>
              <span className="text-muted-foreground">
                {model.alerts.map((a) => `${monthLabelShort(a.month)} (${fmtEur(a.remaining)})`).join(", ")}
              </span>
            </div>
          )}

          {(() => {
            const offPace = model.goals.filter((g) => !g.incomplete && ["atrasada", "sem_ritmo", "prazo_passado"].includes(g.paceInfo.status));
            if (offPace.length === 0) return null;
            return (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm" data-testid="goals-off-pace">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="font-medium">
                  {offPace.length} {offPace.length === 1 ? "meta fora do ritmo" : "metas fora do ritmo"}:
                </span>
                <span className="text-muted-foreground">{offPace.map((g) => g.parcel.name).join(", ")}</span>
              </div>
            );
          })()}

          {(() => {
            const kpiNodes: { id: string; title: string; node: React.ReactNode }[] = [
  { id: "kpi-net", title: "Líquido total", node: (
            <Kpi
              label="Líquido total"
              value={model.netTotal}
              delta={model.comparison.hasData ? model.comparison.netDelta : null}
              hint={
                model.comparison.hasData
                  ? `vs. ${model.comparison.n} ${model.comparison.n === 1 ? "mês" : "meses"} anteriores`
                  : `${model.n} meses`
              }
              testId="kpi-net"
              helpSlug="painel"
            />
  ) },
  { id: "kpi-avg", title: "Média mensal", node: (
            <Kpi label="Média mensal" value={model.avgNet} hint="líquido por mês" testId="kpi-avg" />
  ) },
  { id: "kpi-savings", title: "Taxa de poupança", node: (
            <Kpi
              label="Taxa de poupança"
              value={model.savingsRate}
              kind="pct"
              tone="primary"
              delta={model.comparison.hasData ? model.comparison.savingsRateDeltaPP : null}
              hint={fmtEur(model.savedTotal)}
              testId="kpi-savings"
              helpSlug="formulas-e-calculos"
            />
  ) },
  { id: "kpi-spent", title: "Gastos", node: (
            <Kpi
              label="Gastos"
              deltaTone="up-bad"
              value={model.spentTotal}
              delta={model.comparison.hasData ? model.comparison.spentDelta : null}
              hint={`${fmtPct(model.availableTotal > 0 ? model.spentTotal / model.availableTotal : 0)} do disponível`}
              testId="kpi-spent"
              helpSlug="painel"
              onClick={() => {
                const monthIds = new Set(d.months.map((m) => m.id));
                setDrillDown({
                  title: "Gastos do período",
                  description: `Movimentos do tipo despesa nos ${d.months.length} meses do período filtrado.`,
                  filter: (t) => t.type === "expense" && monthIds.has(t.monthId),
                });
              }}
            />
  ) },
  { id: "kpi-tax", title: "Carga fiscal efetiva", node: (
            <Kpi
              label="Carga fiscal efetiva"
              value={model.effectiveTax}
              kind="pct"
              hint={`${fmtEur(model.descontosTotal)} de descontos`}
              testId="kpi-tax"
              helpSlug="formulas-e-calculos"
            />
  ) },
  { id: "kpi-remaining", title: "Por alocar", node: (
            <Kpi
              label="Por alocar"
              value={model.remainingTotal}
              tone={model.remainingTotal < -0.5 ? "negative" : "neutral"}
              hint={model.remainingTotal < -0.5 ? "acima do disponível" : "sobra acumulada"}
              testId="kpi-remaining"
              helpSlug="formulas-e-calculos"
              onClick={() => {
                const monthIds = new Set(d.months.map((m) => m.id));
                setDrillDown({
                  title: "Movimentos do período",
                  description: `Todos os lançamentos individuais nos ${d.months.length} meses do período filtrado, para investigar o valor por alocar.`,
                  filter: (t) => monthIds.has(t.monthId),
                });
              }}
            />
  ) },
];
            const KPI_GROUP = "grid grid-cols-2 gap-3 lg:grid-cols-4";
            // resumo do mês à esquerda (meia largura) e os 6 cartões pequenos ao lado, 2 por linha
            const sections: SectionSpec[] = [
              {
                id: "inicio-resumo",
                title: "Resumo do mês",
                group: "kpis",
                groupClass: KPI_GROUP,
                itemClass: "col-span-2 lg:row-span-3",
                minW: 4,
                minH: 8,
                defaultLayout: { x: 0, y: 0, w: 6, h: 10 },
                node: <InicioSummary state={data!} detailed={detailed} />,
              },
              ...kpiNodes.map((kn, i): SectionSpec => ({
                id: kn.id,
                title: kn.title,
                group: "kpis",
                groupClass: KPI_GROUP,
                minW: 3,
                minH: 3,
                defaultLayout: { x: 6 + (i % 2) * 3, y: Math.floor(i / 2) * 3, w: 3, h: Math.floor(i / 2) === 2 ? 4 : 3 },
                node: kn.node,
              })),
            ];
            sections.push({
              id: "rendimento-poupanca",
              title: "Rendimento e poupança",
              defaultLayout: { x: 0, y: 10, w: 7, h: 11 },
              node: (
            <SectionCard
              title="Rendimento e poupança"
              description="Líquido, subsídio de alimentação e taxa de poupança mês a mês"
            >
            <div className="in-[.grid-widget]:flex in-[.grid-widget]:h-full in-[.grid-widget]:flex-col">
              <div className="h-[300px] in-[.grid-widget]:h-auto in-[.grid-widget]:min-h-0 in-[.grid-widget]:flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={model.series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="fillNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="name" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={eurAxis} width={44} />
                    <YAxis
                      yAxisId="pct"
                      orientation="right"
                      {...axisProps}
                      tickFormatter={(v) => `${Math.round(v * 100)}%`}
                      width={40}
                      domain={[0, 1]}
                    />
                    <Tooltip trigger={isMobile ? "click" : "hover"} content={<ChartTooltip />} />
                    <Area
                      type="linear"
                      dataKey="liquido"
                      name="Líquido"
                      hide={legend.isHidden("rendimento", "Líquido")}
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      fill="url(#fillNet)"
                    />
                    <Bar dataKey="subsidio" name="Subsídio alimentação" hide={legend.isHidden("rendimento", "Subsídio alimentação")} fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} barSize={14} />
                    <Line
                      yAxisId="pct"
                      type="linear"
                      dataKey="taxa"
                      name="Taxa de poupança"
                      hide={legend.isHidden("rendimento", "Taxa de poupança")}
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={2}
                      dot={{ r: 2.5 }}
                      unit="%"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 shrink-0">
                <LegendDots
                  chart="rendimento"
                  filter={legend}
                  items={[
                    { name: "Líquido", color: "hsl(var(--chart-1))" },
                    { name: "Subsídio alimentação", color: "hsl(var(--chart-4))" },
                    { name: "Taxa de poupança", color: "hsl(var(--chart-3))" },
                  ]}
                />
              </div>
            </div>
            </SectionCard>
              ),
            });
            sections.push({
              id: "distribuicao-media",
              title: "Distribuição média",
              defaultLayout: { x: 7, y: 10, w: 5, h: 11 },
              node: (
            <SectionCard title="Distribuição média" description="Peso de cada parcela no período filtrado">
              <div className="donut-layout flex h-full min-h-[260px] min-w-0 items-stretch">
                <div ref={donutFitRef} className="donut-disc shrink-0" style={{ width: donutSize || undefined, height: donutSize || undefined, minWidth: donutSize ? undefined : 180, minHeight: donutSize ? undefined : 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={model.perParcel.filter((p) => p.total > 0 && !legend.isHidden("donut", p.parcel.name)).map((p) => ({
                          name: p.parcel.name,
                          value: p.total,
                          color: p.parcel.color,
                        }))}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="58%"
                        outerRadius="96%"
                        paddingAngle={2}
                        stroke="hsl(var(--card))"
                        strokeWidth={2}
                      >
                        {model.perParcel
                          .filter((p) => p.total > 0 && !legend.isHidden("donut", p.parcel.name))
                          .map((p) => (
                            <Cell key={p.parcel.id} fill={p.parcel.color} />
                          ))}
                      </Pie>
                      <Tooltip trigger={isMobile ? "click" : "hover"} content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="donut-legend flex min-w-0 flex-1 flex-col justify-center space-y-2 pl-2">
                  {model.perParcel
                    .filter((p) => p.total > 0)
                    .map((p, _i, all) => {
                      const off = legend.isHidden("donut", p.parcel.name);
                      return (
                        <button
                          key={p.parcel.id} type="button" aria-pressed={!off} title={off ? `Mostrar ${p.parcel.name}` : `Esconder ${p.parcel.name}`}
                          data-testid={`legend-${p.parcel.name}`} data-hidden={off}
                          onClick={() => legend.toggle("donut", p.parcel.name, all.map((x) => x.parcel.name))}
                          className={`flex min-h-8 w-full items-center gap-2 rounded-md px-1.5 text-left text-xs hover:bg-muted pointer-coarse:min-h-11 ${off ? "opacity-60" : ""}`}
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: off ? "transparent" : p.parcel.color, boxShadow: off ? `inset 0 0 0 1.5px ${p.parcel.color}` : undefined }} />
                          <span className={`min-w-0 wrap-break-word ${off ? "line-through" : ""}`}>{p.parcel.name}</span>
                          <span className="tnum ml-auto font-medium">{fmtPct(p.share)}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            </SectionCard>
              ),
            });
            sections.push({
              id: "divisao-por-parcela",
              title: "Divisão por parcela",
              defaultLayout: { x: 0, y: 21, w: 12, h: 11 },
              node: (
          <SectionCard
            title="Divisão por parcela"
            description="Como cada mês foi repartido, com o valor disponível como referência"
          >
          <div className="in-[.grid-widget]:flex in-[.grid-widget]:h-full in-[.grid-widget]:flex-col">
            <div className="h-[320px] in-[.grid-widget]:h-auto in-[.grid-widget]:min-h-0 in-[.grid-widget]:flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={model.series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={eurAxis} width={44} />
                  <Tooltip trigger={isMobile ? "click" : "hover"} content={<ChartTooltip total />} />
                  {d.parcels.map((p, i) => (
                    <Bar
                      key={p.id}
                      dataKey={`p${p.id}`}
                      name={p.name}
                      hide={legend.isHidden("divisao", p.name)}
                      stackId="a"
                      fill={p.color}
                      radius={i === d.parcels.length - 1 ? [3, 3, 0, 0] : undefined}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="disponivel"
                    name="Disponível"
                    hide={legend.isHidden("divisao", "Disponível")}
                    stroke="hsl(var(--foreground))"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 shrink-0">
              <LegendDots chart="divisao" filter={legend} items={[...d.parcels.map((p) => ({ name: p.name, color: p.color })), { name: "Disponível", color: "hsl(var(--foreground))" }]} />
            </div>
          </div>
          </SectionCard>
              ),
            });
            sections.push({
              id: "parcelas-periodo",
              title: "Parcelas no período",
              defaultLayout: { x: 0, y: 32, w: 6, h: 11 },
              node: (
            <SectionCard title="Parcelas no período" description="Total, média e tendência da segunda metade do período">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="py-2 text-left font-medium">Parcela</th>
                      <th className="py-2 text-right font-medium">Total</th>
                      <th className="py-2 text-right font-medium">Média</th>
                      <th className="py-2 text-right font-medium">Peso</th>
                      <th className="py-2 pl-3 text-right font-medium">Tendência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.perParcel.map((p) => (
                      <tr
                        key={p.parcel.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Ver movimentos de ${p.parcel.name}`}
                        className="cursor-pointer border-b border-border/60 last:border-0 transition-colors hover:bg-muted/40 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ring"
                        onClick={() => openParcelDrill(p.parcel)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openParcelDrill(p.parcel);
                          }
                        }}
                        data-testid={`row-parcel-drilldown-${p.parcel.id}`}
                      >
                        <td className="py-2">
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.parcel.color }} />
                            <span className="truncate">{p.parcel.name}</span>
                          </span>
                        </td>
                        <td className="tnum py-2 text-right font-medium">{fmtEur(p.total)}</td>
                        <td className="tnum py-2 text-right text-muted-foreground">{fmtEur(p.avg)}</td>
                        <td className="tnum py-2 text-right text-muted-foreground">{fmtPct(p.share)}</td>
                        <td className="py-2 pl-3 text-right">
                          <Badge
                            variant="secondary"
                            className={
                              p.trend > 0.02
                                ? "bg-primary/15 text-primary"
                                : p.trend < -0.02
                                  ? "bg-destructive/15 text-destructive"
                                  : ""
                            }
                          >
                            <span className="tnum">
                              {p.trend > 0 ? "+" : ""}
                              {fmtPct(p.trend, 0)}
                            </span>
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
              ),
            });
            sections.push({
              id: "metas",
              title: "Metas",
              defaultLayout: { x: 6, y: 32, w: 6, h: 11 },
              node: (
            <SectionCard
              title="Metas"
              description="Metas e submetas com base em todo o histórico; ritmo das metas nos últimos 3 meses"
            >
              <GoalsCard goals={model.goals} />
            </SectionCard>
              ),
            });
            sections.push({
              id: "bruto-descontos",
              title: "Bruto vs. descontos",
              defaultLayout: { x: 0, y: 43, w: 6, h: 9 },
              node: (
            <SectionCard title="Bruto vs. descontos" description="Quanto do rendimento bruto fica retido">
            <div className="in-[.grid-widget]:flex in-[.grid-widget]:h-full in-[.grid-widget]:flex-col">
              <div className="h-[240px] in-[.grid-widget]:h-auto in-[.grid-widget]:min-h-0 in-[.grid-widget]:flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={model.series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="name" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={eurAxis} width={44} />
                    <Tooltip trigger={isMobile ? "click" : "hover"} content={<ChartTooltip />} />
                    <Bar dataKey="liquido" name="Líquido" hide={legend.isHidden("bruto", "Líquido")} stackId="b" fill="hsl(var(--chart-1))" />
                    <Bar dataKey="descontos" name="Descontos" hide={legend.isHidden("bruto", "Descontos")} stackId="b" fill="hsl(var(--chart-5))" radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 shrink-0">
                <LegendDots
                  chart="bruto"
                  filter={legend}
                  items={[
                    { name: "Líquido", color: "hsl(var(--chart-1))" },
                    { name: "Descontos", color: "hsl(var(--chart-5))" },
                  ]}
                />
              </div>
            </div>
            </SectionCard>
              ),
            });
            sections.push({
              id: "gastos-poupanca-investimento",
              title: "Gastos, poupança e investimento",
              defaultLayout: { x: 6, y: 43, w: 6, h: 9 },
              node: (
            <SectionCard title="Gastos, poupança e investimento" description="Divisão por tipo de parcela">
            <div className="in-[.grid-widget]:flex in-[.grid-widget]:h-full in-[.grid-widget]:flex-col">
              <div className="h-[240px] in-[.grid-widget]:h-auto in-[.grid-widget]:min-h-0 in-[.grid-widget]:flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={model.series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="name" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={eurAxis} width={44} />
                    <Tooltip trigger={isMobile ? "click" : "hover"} content={<ChartTooltip total />} />
                    <Bar dataKey="gastos" name="Gastos" hide={legend.isHidden("tipos", "Gastos")} stackId="c" fill="hsl(var(--chart-5))" />
                    <Bar dataKey="poupanca" name="Poupança" hide={legend.isHidden("tipos", "Poupança")} stackId="c" fill="hsl(var(--chart-2))" />
                    <Bar dataKey="investimento" name="Investimento" hide={legend.isHidden("tipos", "Investimento")} stackId="c" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <LegendDots
                  chart="tipos"
                  filter={legend}
                  items={[
                    { name: "Gastos", color: "hsl(var(--chart-5))" },
                    { name: "Poupança", color: "hsl(var(--chart-2))" },
                    { name: "Investimento", color: "hsl(var(--chart-1))" },
                  ]}
                />
                <span className="text-xs text-muted-foreground tnum">
                  Reserva ≈ {model.runway.toFixed(1)} meses de gastos
                </span>
              </div>
            </div>
            </SectionCard>
              ),
            });
            sections.push({
              id: "ano-anterior",
              title: "Comparação mensal e anual",
              defaultLayout: { x: 0, y: 52, w: 12, h: 16 },
              collapsedH: yoyEmpty ? 5 : undefined,
              node: (
                <SectionCard className={yoyEmpty ? "min-h-0" : undefined} title="Comparação mensal e anual" description="Compara com um ano ou com outros meses do mesmo ano">
                  <YearOverYearCard d={d} />
                </SectionCard>
              ),
            });
            return (
              <EditableSectionGrid
                pageKey="painel"
                sections={sections.filter((sec) => !(sec.id === "metas" || sec.id === "parcelas-periodo") || features.parcelas).filter((sec) => sec.id !== "divisao-por-parcela" || features.divisao)}
                savedLayout={pageLayout.savedLayout}
                isSaving={pageLayout.isSaving}
                onSave={pageLayout.onSave}
              />
            );
          })()}
        </div>
      )}

      <DrillDownSheet
        open={drillDown != null}
        onOpenChange={(v) => !v && setDrillDown(null)}
        title={drillDown?.title ?? ""}
        description={drillDown?.description}
        transactions={drillDown ? data!.transactions.filter(drillDown.filter) : []}
        parcels={d.parcels}
        months={d.months}
      />
    </AppShell>
  );
}
