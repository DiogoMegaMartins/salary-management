import { useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { AppShell } from "@/components/layout";
import { SectionCard } from "@/components/kpi";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppState, useDerived } from "@/lib/app";
import { useFeatures } from "@/lib/features";
import { takePendingDividirTab, type DividirTab } from "@/lib/dividir-tab";
import { DivisionPanel } from "@/components/months/division-panel";
import { MovementsPanel } from "@/components/months/movements-panel";
import { DividirSteps } from "@/components/dividir-steps";
import { SalaryInfo } from "@/components/salary-info";
import { ClosingChecklist, type ChecklistItem } from "@/components/closing-checklist";
import { ParcelsPanel } from "@/pages/parcels";
import { Composition, MonthClosing, Recurring, Simulator } from "@/pages/closing";
import { cn } from "@/lib/utils";
import { computeMonth, fmtEur } from "@shared/calc";
import { dividirSteps } from "@shared/dividir";
import { parseUiMode } from "@shared/ui-mode";

type View = "salario" | "repartir" | "gastos" | "parcelas" | "fechar" | "recorrencias" | "simulador" | "composicao";
const FROM_TAB: Record<DividirTab, View> = { divisao: "repartir", movimentos: "gastos", parcelas: "parcelas", fecho: "fechar" };
const hoje = () => new Date().toLocaleDateString("sv-SE");

/**
 * Plano do mês (rota /divisao): à esquerda os 3 passos do mês (Quanto entra, Para onde vai, Fechar o mês) e as
 * ferramentas; à direita o que se escolheu. O Básico mostra só as ferramentas do dia a dia; o Detalhado junta as outras.
 * O mês vem da rota (`#/divisao/<id>`); sem id, usa o último mês aberto (ou o último, se todos estiverem fechados).
 */
export default function DivisionPage() {
  const { data, isLoading } = useAppState();
  const d = useDerived(data);
  const features = useFeatures();
  const [, params] = useRoute("/divisao/:mes?");
  const [, navigate] = useLocation();
  const [pending] = useState<DividirTab | null>(() => takePendingDividirTab());
  const [viewChoice, setView] = useState<View | null>(pending ? FROM_TAB[pending] : null);
  const openedAt = useRef<Record<number, View>>({}); // o passo em curso quando se abriu cada mês: a vista não salta sozinha ao mudar o estado

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
  const carry = month.carryIn ?? 0;
  const { steps, current } = dividirSteps({ available: computed.available, remaining: computed.remaining, closed: month.status === "fechado", carryIn: carry });
  const detailed = parseUiMode(data.settings.uiMode) === "detalhado";
  const previous = months.find((m) => (month.month === 1 ? m.year === month.year - 1 && m.month === 12 : m.year === month.year && m.month === month.month - 1)) ?? null;

  const tools: { key: View; label: string; testId: string; show: boolean }[] = [
    { key: "gastos", label: "Gastos do mês", testId: "tool-gastos", show: features.movimentos && features.divisao },
    { key: "parcelas", label: "Parcelas e metas", testId: "tool-parcelas", show: features.parcelas },
    { key: "recorrencias", label: "Recorrências e reservas", testId: "tool-recorrencias", show: detailed },
    { key: "simulador", label: "Simulador de metas", testId: "tool-simulador", show: detailed },
    { key: "composicao", label: "Composição dos totais", testId: "tool-composicao", show: detailed },
  ];
  const shownTools = tools.filter((t) => t.show);
  openedAt.current[month.id] ??= current;
  const view: View = viewChoice && (["salario", "repartir", "fechar"].includes(viewChoice) || shownTools.some((t) => t.key === viewChoice)) ? viewChoice : openedAt.current[month.id];
  const splitPanel = features.divisao ? <DivisionPanel key={month.id} month={month} /> : features.movimentos ? <MovementsPanel key={month.id} month={month} /> : null;

  const lastDay = new Date(month.year, month.month, 0).toLocaleDateString("sv-SE");
  const daysLeft = Math.max(0, Math.round((new Date(lastDay).getTime() - new Date(hoje()).getTime()) / 86400000));
  const hasSalary = computed.available > 0.005;
  const split = hasSalary && Math.abs(computed.remaining) < 0.005;
  const checklist: ChecklistItem[] = [
    { key: "salario", done: hasSalary, text: hasSalary ? "Salário definido" : "Falta definir o salário deste mês" },
    { key: "repartido", done: split, text: split ? "Todo o valor repartido" : computed.remaining > 0.005 ? `Falta repartir ${fmtEur(computed.remaining)}` : computed.remaining < -0.005 ? `A divisão excede o disponível em ${fmtEur(-computed.remaining)}` : "Falta repartir o valor" },
    month.status === "fechado"
      ? { key: "fim", done: true, text: "Mês fechado" }
      : daysLeft === 0
        ? { key: "fim", done: true, text: "O mês já acabou" }
        : { key: "fim", done: false, text: `O mês ainda não acabou (${daysLeft === 1 ? "falta 1 dia" : `faltam ${daysLeft} dias`}). Podes fechar antes, se quiseres.` },
  ];

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
      <div className="grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]" data-testid="page-dividir">
        <aside className="space-y-3 lg:sticky lg:top-4">
          <div className="rounded-2xl border border-card-border bg-card p-1.5">
            <DividirSteps steps={steps} shown={["salario", "repartir", "fechar"].includes(view) ? view : null} onShow={setView} />
          </div>
          {shownTools.length > 0 && (
            <nav className="rounded-2xl border border-card-border bg-card p-3" aria-label="Mais ferramentas" data-testid="dividir-tools">
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mais ferramentas</p>
              <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
                {shownTools.map((t) => (
                  <li key={t.key} className="shrink-0 lg:shrink">
                    <button
                      type="button" onClick={() => setView(t.key)} data-testid={t.testId} aria-current={view === t.key ? "page" : undefined}
                      className={cn("w-full whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/60 lg:whitespace-normal", view === t.key ? "bg-accent font-medium text-primary" : "text-foreground")}
                    >
                      {t.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </aside>

        <div className="min-w-0 space-y-4" data-testid="dividir-view" data-view={view}>
          {view === "salario" && <SalaryInfo month={month} income={computed.available} carryIn={carry} previous={previous} />}
          {view === "repartir" && splitPanel}
          {view === "gastos" && <MovementsPanel key={month.id} month={month} />}
          {view === "parcelas" && <ParcelsPanel />}
          {view === "fechar" && (
            <>
              <ClosingChecklist items={checklist} />
              <MonthClosing />
            </>
          )}
          {view === "recorrencias" && <Recurring />}
          {view === "simulador" && <Simulator />}
          {view === "composicao" && <Composition />}
        </div>
      </div>
    </AppShell>
  );
}
