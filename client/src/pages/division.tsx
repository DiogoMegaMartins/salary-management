import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { AppShell } from "@/components/layout";
import { SectionCard } from "@/components/kpi";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppState, useDerived } from "@/lib/app";
import { useFeatures } from "@/lib/features";
import { takePendingDividirTab, type DividirTab } from "@/lib/dividir-tab";
import { DivisionPanel } from "@/components/months/division-panel";
import { MovementsPanel } from "@/components/months/movements-panel";
import { DividirSteps } from "@/components/dividir-steps";
import { ParcelsPanel } from "@/pages/parcels";
import { ClosingPanel, MonthClosing } from "@/pages/closing";
import { computeMonth } from "@shared/calc";
import { dividirSteps, type StepKey } from "@shared/dividir";
import { parseUiMode } from "@shared/ui-mode";

type View = StepKey | "parcelas";

/**
 * Plano do mês (rota /divisao): o teu mês em 3 passos (salário, repartir, fechar). O Básico mostra os passos e o passo em curso; o Detalhado
 * junta os separadores completos (Divisão, Movimentos, Parcelas e metas, Fechar o mês). O mês vem da rota
 * (`#/divisao/<id>`); sem id, usa o último mês aberto (ou o último, se todos estiverem fechados).
 */
export default function DivisionPage() {
  const { data, isLoading } = useAppState();
  const d = useDerived(data);
  const features = useFeatures();
  const [, params] = useRoute("/divisao/:mes?");
  const [, navigate] = useLocation();
  const [pending] = useState<DividirTab | null>(() => takePendingDividirTab());
  const [tabChoice, setTab] = useState<DividirTab | null>(pending);
  const [viewChoice, setView] = useState<View | null>(pending === "parcelas" ? "parcelas" : pending === "fecho" ? "fechar" : null);

  if (isLoading || !d || !data) {
    return (
      <AppShell title="Plano do mês" subtitle="A carregar…">
        <Skeleton className="h-[360px] rounded-lg" />
      </AppShell>
    );
  }

  const months = d.allMonths;
  const subtitle = "O teu mês em 3 passos";
  if (!months.length) {
    return (
      <AppShell title="Plano do mês" subtitle={subtitle}>
        <SectionCard description="Ainda não há meses.">
          <p className="text-sm" data-testid="division-empty">
            Cria primeiro um mês em <Link href="/meses" className="font-medium text-primary underline-offset-4 hover:underline">Meses</Link> para o dividires aqui.
          </p>
        </SectionCard>
      </AppShell>
    );
  }

  const wanted = Number(params?.mes);
  const month =
    months.find((m) => m.id === wanted) ??
    [...months].reverse().find((m) => m.status !== "fechado") ??
    months[months.length - 1];
  const computed = computeMonth(month, data.allocations, data.parcels, data.settings);
  const { steps, current } = dividirSteps({ available: computed.available, remaining: computed.remaining, closed: month.status === "fechado" });
  const detailed = parseUiMode(data.settings.uiMode) === "detalhado";
  const movementCount = data.transactions.filter((t) => t.monthId === month.id).length;

  const available: DividirTab[] = [
    ...(features.divisao ? (["divisao"] as const) : []),
    ...(features.movimentos ? (["movimentos"] as const) : []),
    ...(features.parcelas ? (["parcelas"] as const) : []),
    "fecho",
  ];
  const tab: DividirTab = tabChoice && available.includes(tabChoice) ? tabChoice : available[0];
  const view: View = viewChoice ?? current;
  const splitPanel = features.divisao ? <DivisionPanel key={month.id} month={month} /> : features.movimentos ? <MovementsPanel key={month.id} month={month} /> : null;

  return (
    <AppShell
      title="Plano do mês"
      subtitle={subtitle}
      actions={
        <Select value={String(month.id)} onValueChange={(v) => navigate(`/divisao/${v}`, { replace: true })}>
          <SelectTrigger className="h-9 w-48 text-sm" aria-label="Mês" data-testid="select-division-month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[...months].reverse().map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>{m.label} {m.year}{m.status === "fechado" ? " (fechado)" : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="space-y-4" data-testid="page-dividir">
        {/* Folga por baixo: a barra de separadores fixa (sticky-tabs) sobe por cima desta zona e não deve tapar os passos. */}
        <div className={detailed ? "pb-5 md:pb-6" : undefined}>
          <DividirSteps steps={steps} shown={view === "parcelas" ? null : view} onShow={(k) => { setView(k); setTab(k === "fechar" ? "fecho" : k === "repartir" ? (features.divisao ? "divisao" : "movimentos") : tab); }} />
        </div>

        {detailed ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v as DividirTab)} className="space-y-4" data-testid="division-tabs">
            <TabsList className="sticky-tabs">
              {features.divisao && <TabsTrigger value="divisao" data-testid="division-tab-divisao">Divisão</TabsTrigger>}
              {features.movimentos && (
                <TabsTrigger value="movimentos" data-testid="division-tab-movimentos">
                  Movimentos
                  {movementCount > 0 && <Badge variant="secondary" className="px-1.5 py-0 text-[11px]">{movementCount}</Badge>}
                </TabsTrigger>
              )}
              {features.parcelas && <TabsTrigger value="parcelas" data-testid="division-tab-parcelas">Parcelas e metas</TabsTrigger>}
              <TabsTrigger value="fecho" data-testid="division-tab-fecho">Fechar o mês</TabsTrigger>
            </TabsList>
            {features.divisao && <TabsContent value="divisao" className="mt-0"><DivisionPanel key={month.id} month={month} /></TabsContent>}
            {features.movimentos && <TabsContent value="movimentos" className="mt-0"><MovementsPanel key={month.id} month={month} /></TabsContent>}
            {features.parcelas && <TabsContent value="parcelas" className="mt-0"><ParcelsPanel /></TabsContent>}
            <TabsContent value="fecho" className="mt-0"><ClosingPanel /></TabsContent>
          </Tabs>
        ) : (
          <div data-testid="dividir-basico">
            {view === "salario" && (
              <SectionCard title="Salário do mês" description="O salário vem do mês que criaste.">
                <p className="text-sm" data-testid="dividir-salario">
                  {steps[0].state === "done" ? steps[0].text : "Este mês ainda não tem salário."}{" "}
                  <Link href="/meses" className="font-medium text-primary underline-offset-4 hover:underline">Ver ou alterar em Meses</Link>
                </p>
              </SectionCard>
            )}
            {view === "repartir" && splitPanel}
            {view === "fechar" && <MonthClosing />}
            {view === "parcelas" && <ParcelsPanel />}
            {features.parcelas && view !== "parcelas" && (
              <button type="button" className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline" onClick={() => setView("parcelas")} data-testid="dividir-ver-parcelas">
                Ver parcelas e metas
              </button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
