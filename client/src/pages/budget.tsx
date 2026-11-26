import { useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout";
import { SectionCard } from "@/components/kpi";
import { useUiMode } from "@/lib/ui-mode";
import { visibleSections } from "@shared/ui-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { goalTotalOf } from "@/components/goal-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppState, useDerived, useSave } from "@/lib/app";
import { FilterBar } from "@/components/filter-bar";
import { EditableSectionGrid, type SectionSpec } from "@/components/editable-section-grid";
import { usePageLayout } from "@/lib/page-layout";
import { MonthlyReportDialog } from "@/components/monthly-report-dialog";
import { CategoryYearOverYear, useYoYEmpty } from "@/components/yoy";
import {
  budgetVsRealByCategory,
  fmtEur,
  fmtPct,
  projectYearEnd,
  runwayOf,
  sortMonths,
  type ProjectionMethod,
} from "@shared/calc";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/confirm";

export default function BudgetPage() {
  const uiMode = useUiMode();
  const { data, isLoading } = useAppState();
  const d = useDerived(data);
  const yoyEmpty = useYoYEmpty(d);
  const save = useSave();
  const { ask, dialog: confirmDialog } = useConfirm();
  const pageLayout = usePageLayout(data?.settings ?? ({} as any), "orcamento");
  const [addingCategory, setAddingCategory] = useState(false);
  const [draft, setDraft] = useState({ name: "", monthlyBudget: "", essential: false });
  const [alertThreshold, setAlertThreshold] = useState(10);
  const [projMethod, setProjMethod] = useState<ProjectionMethod>("media_simples");
  const [runwayWindow, setRunwayWindow] = useState<3 | 6 | 12>(3);

  if (isLoading || !d || !data) {
    return (
      <AppShell title="Orçamento" subtitle="A carregar…">
        <Skeleton className="h-[420px] rounded-lg" />
      </AppShell>
    );
  }

  const categories = data.categories.filter((c) => c.active);
  // SM-008: a página respeita o filtro global de período (Painel/FilterBar).
  // A projeção de final de ano continua a precisar de um ano concreto — usa-se
  // o ano mais recente presente no período filtrado (ou o ano corrente).
  const year =
    d.months.length > 0 ? Math.max(...d.months.map((m) => m.year)) : new Date().getFullYear();
  const currentMonth = sortMonths(data.months).find(
    (m) => m.year === new Date().getFullYear() && m.month === new Date().getMonth() + 1,
  );

  // SM-004: orçamento vs real do período filtrado (SM-008)
  const monthIdsInPeriod = new Set(d.months.map((m) => m.id));
  const txsInPeriod = data.transactions.filter((t) => monthIdsInPeriod.has(t.monthId));
  const budgetRows = budgetVsRealByCategory(txsInPeriod, categories, alertThreshold);
  const budgetEmpty = categories.length === 0 && budgetRows.length === 0;

  // SM-005: projeção de final de ano
  const goal = data.settings.annualSavingsGoal ?? 0;
  const projection = projectYearEnd(
    data.months,
    d.savedByMonthId,
    currentMonth?.id ?? null,
    year,
    goal,
    projMethod,
  );

  // SM-006: reserva de emergência / runway
  const emergencyIds = (data.settings.emergencyParcelIds || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  const emergencyParcels = d.allParcels.filter((p) => emergencyIds.includes(p.id));
  const saldoReserva = emergencyParcels.reduce(
    (acc, p) => acc + goalTotalOf(data, p, d.allComputed),
    0,
  );
  const orderedMonthIds = sortMonths(data.months).map((m) => m.id);
  const runway = runwayOf(saldoReserva, d.essentialExpensesByMonthId, orderedMonthIds, runwayWindow);

  function saveCategory() {
    if (!draft.name.trim()) return;
    save.createCategory.mutate({
      name: draft.name.trim(),
      monthlyBudget: Number(draft.monthlyBudget) || 0,
      essential: draft.essential,
    } as any);
    setDraft({ name: "", monthlyBudget: "", essential: false });
    setAddingCategory(false);
  }

  return (
    <AppShell
      title="Orçamento"
      subtitle="Orçamento vs. real, projeção anual e reserva de emergência"
      filters={<FilterBar d={d} showParcels={false} />}
      actions={<MonthlyReportDialog d={d} />}
    >
      {(() => {
        const sections: SectionSpec[] = [
          {
            id: "orc-projecao",
            title: "Projeção de final de ano",
            group: "orc-topo",
            groupClass: "grid gap-4 lg:grid-cols-2",
            defaultLayout: { x: 0, y: 0, w: 6, h: 11 },
            node: (
        <SectionCard
          title="Projeção de final de ano"
          description={`Estimativa para ${year}, com base em meses concluídos`}
          actions={
            <Select value={projMethod} onValueChange={(v) => setProjMethod(v as ProjectionMethod)}>
              <SelectTrigger className="w-44" data-testid="select-projection-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="media_simples">Média simples</SelectItem>
                <SelectItem value="media_3m">Média últimos 3 meses</SelectItem>
                <SelectItem value="orcamento">Orçamento planeado</SelectItem>
              </SelectContent>
            </Select>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Projeção" value={fmtEur(projection.projecaoAnual)} testId="stat-projecao" />
            <Stat label="Meta" value={fmtEur(projection.meta)} testId="stat-meta" />
            <Stat
              label="Diferença"
              value={fmtEur(projection.diferenca)}
              tone={projection.diferenca >= 0 ? "positive" : "negative"}
              testId="stat-diferenca"
            />
            <Stat label="Meses restantes" value={String(projection.mesesRestantes)} testId="stat-meses-restantes" />
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Estimativa baseada em {projection.mesesConsiderados.length} mês(es) concluído(s). O mês
            corrente é excluído por defeito. Ajusta a meta anual em Definições, separador Cálculo.
          </p>
        </SectionCard>
            ),
          },
          {
            id: "orc-reserva",
            title: "Reserva de emergência",
            group: "orc-topo",
            groupClass: "grid gap-4 lg:grid-cols-2",
            defaultLayout: { x: 6, y: 0, w: 6, h: 11 },
            node: (
        <SectionCard
          title="Reserva de emergência"
          description={
            emergencyParcels.length
              ? `Parcela(s): ${emergencyParcels.map((p) => p.name).join(", ")}`
              : "Nenhuma parcela definida como reserva"
          }
          actions={
            <Select value={String(runwayWindow)} onValueChange={(v) => setRunwayWindow(Number(v) as 3 | 6 | 12)}>
              <SelectTrigger className="w-44" data-testid="select-runway-window">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Média 3 meses</SelectItem>
                <SelectItem value="6">Média 6 meses</SelectItem>
                <SelectItem value="12">Média 12 meses</SelectItem>
              </SelectContent>
            </Select>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Saldo reserva" value={fmtEur(runway.saldoReservaElegivel)} testId="stat-saldo-reserva" />
            <Stat
              label="Despesa essencial média"
              value={fmtEur(runway.mediaDespesasEssenciais)}
              testId="stat-despesa-essencial"
            />
            <Stat
              label="Meses de cobertura"
              value={runway.mediaDespesasEssenciais > 0 ? runway.runwayMeses.toFixed(1) : "—"}
              testId="stat-runway"
            />
            <Stat
              label="Categorias essenciais"
              value={String(categories.filter((c) => c.essential).length)}
              testId="stat-categorias-essenciais"
            />
          </div>
          {categories.filter((c) => c.essential).length === 0 && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Marca categorias como essenciais abaixo para calcular a despesa essencial média.
            </p>
          )}
        </SectionCard>
            ),
          },
          {
            id: "orc-categorias",
            title: "Orçamento vs. real por categoria",
            defaultLayout: { x: 0, y: 11, w: 12, h: budgetEmpty ? 8 : 18 },
            collapsedH: budgetEmpty ? 5 : undefined,
            node: (
      <SectionCard
        className={budgetEmpty ? "min-h-0" : undefined}
        title="Orçamento vs. real por categoria"
        description={`${d.periodLabel} · alerta a partir de ${alertThreshold}% acima do orçamento`}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Input
                type="number"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(Number(e.target.value) || 0)}
                className="w-24 pr-7"
                aria-label="Limite de alerta em percentagem"
                data-testid="input-alert-threshold"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
            <Button size="sm" onClick={() => setAddingCategory(true)} data-testid="button-add-category">
              <Plus className="mr-1 h-3.5 w-3.5" />
              Categoria
            </Button>
          </div>
        }
      >
        {categories.length === 0 && budgetRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Ainda não há categorias. Cria a primeira para começar a comparar orçamento com despesa real.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Categoria</th>
                  <th className="py-2 pr-3 font-medium">Orçamento</th>
                  <th className="py-2 pr-3 font-medium">Real</th>
                  <th className="py-2 pr-3 font-medium">Desvio (€)</th>
                  <th className="py-2 pr-3 font-medium">Desvio (%)</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium">Essencial</th>
                  <th className="py-2 pr-1 font-medium" />
                </tr>
              </thead>
              <tbody>
                {budgetRows.map((row) => (
                  <tr key={row.category?.id ?? row.categoryName} className="border-b border-card-border/60">
                    <td className="py-2 pr-3 font-medium">{row.categoryName}</td>
                    <td className="tnum py-2 pr-3">{row.budget > 0 ? fmtEur(row.budget) : "—"}</td>
                    <td className="tnum py-2 pr-3">{fmtEur(row.real)}</td>
                    <td
                      className={cn(
                        "tnum py-2 pr-3",
                        row.desvioEUR > 0 ? "text-destructive" : "text-success",
                      )}
                    >
                      {row.budget > 0 ? fmtEur(row.desvioEUR) : "—"}
                    </td>
                    <td className="tnum py-2 pr-3">{row.budget > 0 ? fmtPct(row.desvioPercentual / 100) : "—"}</td>
                    <td className="py-2 pr-3">
                      {row.category === null ? (
                        <Badge variant="outline">sem categoria gerida</Badge>
                      ) : row.overBudget ? (
                        <Badge className="gap-1 bg-destructive/15 text-destructive hover:bg-destructive/15">
                          <AlertTriangle className="h-3 w-3" /> Acima do orçamento
                        </Badge>
                      ) : row.budget > 0 ? (
                        <Badge className="gap-1 bg-primary/15 text-primary hover:bg-primary/15">
                          <CheckCircle2 className="h-3 w-3" /> Dentro do orçamento
                        </Badge>
                      ) : (
                        <Badge variant="outline">sem limite</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {row.category && (
                        <Switch
                          checked={row.essential}
                          onCheckedChange={(v) =>
                            save.updateCategory.mutate({ id: row.category!.id, patch: { essential: v } as any })
                          }
                          data-testid={`switch-essential-${row.category.id}`}
                        />
                      )}
                    </td>
                    <td className="py-2 pr-1 text-right">
                      {row.category && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label={`Eliminar a categoria ${row.categoryName}`}
                          onClick={() => ask(`Eliminar a categoria ${row.categoryName}?`).then((ok) => ok && save.deleteCategory.mutate(row.category!.id))}
                          data-testid={`button-delete-category-${row.category.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
            ),
          },
        ];
        sections.push(
          {
            id: "orc-ano-anterior",
            title: "Comparação mensal e anual",
            defaultLayout: { x: 0, y: 29, w: 12, h: 12 },
            collapsedH: yoyEmpty ? 5 : undefined,
            node: (
              <SectionCard className={yoyEmpty ? "min-h-0" : undefined} title="Comparação mensal e anual" description="Despesa por categoria; a escolha é a mesma do Painel">
                <CategoryYearOverYear d={d} />
              </SectionCard>
            ),
          },
        );
        return (
          <EditableSectionGrid
            pageKey="orcamento"
            sections={visibleSections("orcamento", sections, uiMode)}
            savedLayout={pageLayout.savedLayout}
            isSaving={pageLayout.isSaving}
            onSave={pageLayout.onSave}
          />
        );
      })()}

      <Dialog open={addingCategory} onOpenChange={setAddingCategory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label htmlFor="cat-name">Nome</Label>
              <Input
                id="cat-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ex.: mercado"
                data-testid="input-category-name"
              />
            </div>
            <div>
              <Label htmlFor="cat-budget">Orçamento mensal (€)</Label>
              <Input
                id="cat-budget"
                type="number"
                value={draft.monthlyBudget}
                onChange={(e) => setDraft({ ...draft, monthlyBudget: e.target.value })}
                placeholder="0"
                data-testid="input-category-budget"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-card-border px-3 py-2">
              <Label htmlFor="cat-essential" className="text-sm">
                Despesa essencial
              </Label>
              <Switch
                id="cat-essential"
                checked={draft.essential}
                onCheckedChange={(v) => setDraft({ ...draft, essential: v })}
                data-testid="switch-new-category-essential"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingCategory(false)}>
              Cancelar
            </Button>
            <Button onClick={saveCategory} data-testid="button-save-category">
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </AppShell>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
  testId,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
  testId?: string;
}) {
  return (
    <div className="rounded-md border border-card-border/70 p-3" data-testid={testId}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "tnum mt-1 text-base font-semibold",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}
