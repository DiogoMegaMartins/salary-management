import { useEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Save, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAppState, useSave } from "@/lib/app";
import type { Month } from "@shared/schema";
import { errMsg } from "@/components/catalogs";
import { MONTH_NAMES, allocationAmount, availableOf, descontosOf, fmtEur, grossOf, mealOf, reconcileMonth } from "@shared/calc";
import { editableMonthPatch } from "@shared/month-patch";
import { isValidDecimalDraft, parseDecimalDraft, formatNumberForInput, NumberField } from "@/components/months/number-field";
import { ReconciliationPanel } from "@/components/months/reconciliation-panel";
import { PlatformDistribution } from "@/components/months/platform-distribution";
import { TransactionsPanel } from "@/components/months/transactions-panel";

export function MonthEditor({ month, isNew, onClose, initialTab }: { month: Month; isNew: boolean; onClose: () => void; initialTab: string }) {
  const { data } = useAppState();
  const save = useSave();
  const { toast } = useToast();
  const [form, setForm] = useState<Month>(month);
  const [saveError, setSaveError] = useState("");
  useEffect(() => setForm(month), [month.id]);

  const parcels = useMemo(
    () => (data?.parcels ?? []).filter((p) => !p.archived).sort((a, b) => a.sortOrder - b.sortOrder),
    [data?.parcels],
  );
  const allocations = (data?.allocations ?? []).filter((a) => a.monthId === month.id);
  const transactions = (data?.transactions ?? []).filter((t) => t.monthId === month.id);
  const settings = data!.settings;

  const available = availableOf(form, settings);
  const allocated = allocations.reduce((acc, a) => acc + allocationAmount(a, available), 0);
  const remaining = available - allocated;
  // o transporte recebido do mês anterior soma ao valor a distribuir, mas NÃO é rendimento (available não muda)
  const carryIn = month.carryIn ?? 0;
  const rec0 = reconcileMonth(available, allocated, transactions);
  const rec = { ...rec0, porAlocar: rec0.porAlocar + carryIn, estado: Math.abs(rec0.porAlocar + carryIn) < 0.005 ? ("zero" as const) : rec0.porAlocar + carryIn > 0 ? ("excedente" as const) : ("defice" as const) };
  const isClosedMonth = month.status === "fechado";

  const set = <K extends keyof Month>(key: K, value: Month[K]) => setForm((f) => ({ ...f, [key]: value }));

  const isDraft = month.id < 0;

  // fechar com alterações por guardar pede confirmação (Esc, clique fora e "Fechar")
  const { ask, dialog: confirmDialog } = useConfirm();
  const initialForm = useRef(JSON.stringify(month));
  useEffect(() => { initialForm.current = JSON.stringify(month); }, [month.id]);
  const requestClose = async () => {
    const dirty = !isClosedMonth && JSON.stringify(form) !== initialForm.current;
    if (dirty && !(await ask("Descartar as alterações?", "Os valores que alteraste neste mês ainda não foram guardados."))) return;
    onClose();
  };

  const persist = () => {
    if (!form.label || !form.label.trim()) {
      toast({ title: "Etiqueta obrigatória", description: "Indica um nome para o mês.", variant: "destructive" });
      return;
    }
    setSaveError("");
    const patch = editableMonthPatch(form, isDraft ? undefined : month);
    if (!isDraft && !Object.keys(patch).length) { onClose(); return; }
    if (isDraft) {
      save.createMonth.mutate(patch as any, {
        onSuccess: () => {
          toast({ title: "Mês criado", description: `${form.label} ${form.year}` });
          onClose();
        },
        onError: (err: any) => {
          setSaveError(errMsg(err));
          toast({
            title: "Erro ao criar o mês",
            description: err?.message ?? "Não foi possível guardar. Tenta novamente.",
            variant: "destructive",
          });
        },
      });
    } else {
      save.month.mutate(
        { id: month.id, patch },
        {
          onSuccess: () => {
            toast({ title: "Mês guardado", description: `${form.label} ${form.year}` });
            onClose();
          },
          onError: (err: any) => {
            setSaveError(errMsg(err));
            toast({
              title: "Erro ao guardar o mês",
              description: err?.message ?? "Não foi possível guardar. Tenta novamente.",
              variant: "destructive",
            });
          },
        },
      );
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && requestClose()}>
      <DialogContent className="month-editor flex max-h-[90dvh] max-w-3xl flex-col gap-0 overflow-hidden p-0" data-testid="month-editor">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>
            {form.label} <span className="text-muted-foreground">{form.year}</span>
          </DialogTitle>
          <DialogDescription>
            {isNew ? "Preenche os valores do recibo e a divisão do salário." : "Edita os valores do recibo e a divisão."}
          </DialogDescription>
        </DialogHeader>

        <div className="month-editor-body min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <Tabs defaultValue={initialTab}>
          <TabsList className="month-tabs grid w-full grid-cols-3">
            <TabsTrigger value="vencimento" data-testid="tab-vencimento">Vencimento</TabsTrigger>
            <TabsTrigger value="divisao" disabled={isDraft} data-testid="tab-divisao">Divisão</TabsTrigger>
            <TabsTrigger value="movimentos" disabled={isDraft} data-testid="tab-movimentos">Movimentos</TabsTrigger>
          </TabsList>
          {isDraft && (
            <p className="pt-2 text-xs text-muted-foreground">
              Guarda o vencimento para poderes editar a divisão e os movimentos deste mês.
            </p>
          )}

          <TabsContent value="vencimento" className="space-y-5 pt-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Etiqueta</Label>
                <Input
                  value={form.label}
                  onChange={(e) => set("label", e.target.value)}
                  className="h-9 text-sm"
                  aria-label="Etiqueta do mês"
                  data-testid="input-label"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Mês</Label>
                <Select value={String(form.month)} onValueChange={(v) => set("month", Number(v))}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <NumberField label="Ano" value={form.year} onChange={(v) => set("year", v)} suffix="" step={1} />
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rendimentos</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <NumberField label="Vencimento base" value={form.base} onChange={(v) => set("base", v)} testId="input-base" />
                <NumberField
                  label="Retribuição extraordinária"
                  value={form.extraordinaria}
                  onChange={(v) => set("extraordinaria", v)}
                />
                <NumberField
                  label="Outros rend. suj. IRS e SS"
                  value={form.outrosIrsSs}
                  onChange={(v) => set("outrosIrsSs", v)}
                />
                <NumberField
                  label="Outros rend. suj. IRS"
                  value={form.outrosIrs}
                  onChange={(v) => set("outrosIrs", v)}
                  hint={settings.excludeOutrosIrsFromNet ? "Excluído do líquido (definições)" : undefined}
                />
                <NumberField label="Rendimentos isentos" value={form.isentos} onChange={(v) => set("isentos", v)} />
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">IRS Jovem</Label>
                  <Select value={form.irsJovem || "nenhum"} onValueChange={(v) => set("irsJovem", v === "nenhum" ? "" : v)}>
                    <SelectTrigger className="h-9 text-sm" data-testid="select-irs-jovem">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Não aplicável</SelectItem>
                      {["1º ano", "2º ano", "3º ano", "4º ano", "5º ano", "6º ano", "7º ano", "8º ano", "9º ano", "10º ano"].map((y) => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descontos</p>
                <Select value={form.descontosMode} onValueChange={(v) => set("descontosMode", v)}>
                  <SelectTrigger className="h-8 w-[210px] text-xs" data-testid="select-descontos-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Calcular pela fórmula</SelectItem>
                    <SelectItem value="manual">Valor do recibo (manual)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.descontosMode === "manual" ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <NumberField
                    label="Descontos (recibo)"
                    value={form.descontosManual}
                    onChange={(v) => set("descontosManual", v)}
                    testId="input-descontos"
                  />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <NumberField
                    label="Taxa Segurança Social"
                    value={form.taxaSs * 100}
                    onChange={(v) => set("taxaSs", v / 100)}
                    suffix="%"
                    step={0.001}
                  />
                  <NumberField
                    label="Taxa IRS base"
                    value={form.taxaIrsBase * 100}
                    onChange={(v) => set("taxaIrsBase", v / 100)}
                    suffix="%"
                    step={0.0001}
                  />
                  <NumberField
                    label="Taxa IRS extra"
                    value={form.taxaIrsExtra * 100}
                    onChange={(v) => set("taxaIrsExtra", v / 100)}
                    suffix="%"
                    step={0.0001}
                  />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Subsídio de alimentação
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <NumberField label="Valor diário" value={form.mealDaily} onChange={(v) => set("mealDaily", v)} />
                <NumberField label="Dias no mês" value={form.mealDays} onChange={(v) => set("mealDays", v)} suffix="dias" step={0.5} />
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Total</Label>
                  <div className="tnum flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-sm">
                    {fmtEur(mealOf(form))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={2}
                placeholder="Ex.: subsídio de férias pago neste mês"
                aria-label="Notas do mês"
                className="text-sm"
              />
            </div>

            <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-4">
              <Summary label="Bruto" value={fmtEur(grossOf(form))} />
              <Summary label="Descontos" value={fmtEur(descontosOf(form))} />
              <Summary label="Líquido" value={fmtEur(available - (settings.includeMeal ? mealOf(form) : 0))} strong />
              <Summary label="Disponível" value={fmtEur(available)} strong />
            </div>
          </TabsContent>

          <TabsContent value="divisao" className="space-y-4 pt-4">
            <div className="division-summary grid grid-cols-3 gap-2 rounded-lg border border-border bg-background p-3" data-testid="division-summary">
              <Summary label="Disponível" value={fmtEur(available)} />
              <Summary label="Alocado" value={fmtEur(allocated)} />
              <Summary label="Restante" value={fmtEur(remaining)} strong />
            </div>
            <p className="text-xs text-muted-foreground">Os valores da divisão são guardados ao sair de cada campo. A distribuição é planeamento, não cria movimentos.</p>
            {isClosedMonth && <p role="status" className="text-sm text-muted-foreground">Mês fechado. Reabre-o em Fecho e planeamento para alterar a divisão.</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Valor disponível: <span className="tnum font-medium text-foreground">{fmtEur(available)}</span>
              </p>
              <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                data-testid="button-save-as-rules"
                disabled={isClosedMonth || save.saveAsRules.isPending}
                onClick={() =>
                  save.saveAsRules.mutate(month.id, {
                    onSuccess: () =>
                      toast({
                        title: "Regras atualizadas",
                        description: "Esta divisão passou a ser a regra por omissão das parcelas.",
                      }),
                  })
                }
              >
                <Save className="h-3.5 w-3.5" />
                Guardar como regras
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                data-testid="button-apply-rules"
                disabled={isClosedMonth || save.applyRules.isPending}
                onClick={() =>
                  save.applyRules.mutate(month.id, {
                    onSuccess: () =>
                      toast({ title: "Regras aplicadas", description: "Alocações preenchidas com as regras das parcelas." }),
                  })
                }
              >
                <Wand2 className="h-3.5 w-3.5" />
                Aplicar regras das parcelas
              </Button>
              </div>
            </div>

            <div className="space-y-2">
              {parcels.map((p) => {
                const a = allocations.find((x) => x.parcelId === p.id);
                const mode = a?.mode ?? p.defaultMode;
                const value = a?.value ?? 0;
                const amount = allocationAmount({ mode, value } as any, available);
                return (
                  <fieldset key={p.id} disabled={isClosedMonth} className="allocation-card min-w-0 space-y-1.5" data-testid={`allocation-card-${p.id}`}>
                  <div className="allocation-row grid grid-cols-[minmax(0,1fr)_92px_120px_96px] items-center gap-2">
                    <span className="allocation-name flex min-w-0 items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                      <span className="break-words">{p.name}</span>
                    </span>
                    <Select
                      value={mode}
                      onValueChange={(v) =>
                        save.allocation.mutate({ monthId: month.id, parcelId: p.id, mode: v, value })
                      }
                    >
                      <SelectTrigger disabled={isClosedMonth} aria-label={`Modo de ${p.name}`} className="h-9 text-xs" data-testid={`select-mode-${p.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixo">€ fixo</SelectItem>
                        <SelectItem value="percentagem">% disp.</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Valor de ${p.name}`}
                      defaultValue={formatNumberForInput(value)}
                      key={`${p.id}-${mode}-${value}`}
                      onChange={(e) => {
                        if (!isValidDecimalDraft(e.target.value)) e.target.value = e.target.value.slice(0, -1);
                      }}
                      onBlur={(e) => {
                        const raw = e.target.value;
                        const parsed = raw === "" ? 0 : parseDecimalDraft(raw);
                        const v = parsed === null ? value : Math.max(0, parsed);
                        e.target.value = formatNumberForInput(v);
                        if (v !== value) save.allocation.mutate({ monthId: month.id, parcelId: p.id, mode, value: v });
                      }}
                      className="tnum h-9 text-sm"
                      data-testid={`input-alloc-${p.id}`}
                    />
                    <span className="allocation-result tnum text-right text-sm font-medium" data-testid={`text-alloc-${p.id}`}>
                      {fmtEur(amount)}
                    </span>
                  </div>
                  <PlatformDistribution
                    monthId={month.id}
                    parcelId={p.id}
                    allocationId={a?.id ?? null}
                    total={amount}
                  />
                  </fieldset>
                );
              })}
            </div>
            {save.allocation.isPending && <p role="status" className="text-xs text-muted-foreground">A guardar divisão…</p>}
            {save.allocation.isError && <p role="alert" className="text-sm text-destructive">A divisão não foi guardada: {errMsg(save.allocation.error)}. Mantém o campo aberto e tenta novamente.</p>}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Alocado</span>
              <span className="tnum font-medium">{fmtEur(allocated)}</span>
              <span className="mx-2 h-4 w-px bg-border" />
              <span className="text-muted-foreground">Restante</span>
              <Badge
                variant="secondary"
                className={
                  remaining < -0.01
                    ? "bg-destructive/15 text-destructive"
                    : remaining > 0.01
                      ? "bg-primary/15 text-primary"
                      : ""
                }
                data-testid="badge-remaining"
              >
                <span className="tnum">{fmtEur(remaining)}</span>
              </Badge>
            </div>
          </TabsContent>

          <TabsContent value="movimentos" className="space-y-4 pt-4">
            <ReconciliationPanel
              rec={rec}
              month={form}
              monthId={month.id}
              onSaveReason={(deficitReason, deficitNote) =>
                save.reconciliation.mutate({ id: month.id, deficitReason, deficitNote })
              }
            />
            <TransactionsPanel monthId={month.id} parcels={parcels} transactions={transactions} />
          </TabsContent>
        </Tabs>
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-background px-6 py-4">
          {saveError && <p role="alert" className="mr-auto text-sm text-destructive" data-testid="error-save-month">{saveError}</p>}
          <Button variant="ghost" onClick={requestClose} data-testid="button-close-month-editor">
            Fechar
          </Button>
          <Button onClick={persist} disabled={isClosedMonth || save.month.isPending || save.createMonth.isPending || save.allocation.isPending} data-testid="button-save-month">
            {save.month.isPending || save.createMonth.isPending ? "A guardar…" : isDraft || Object.keys(editableMonthPatch(form, month)).length ? "Guardar vencimento" : "Concluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    {confirmDialog}
    </Dialog>
  );
}

function Summary({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`tnum text-sm ${strong ? "font-semibold" : ""}`}>{value}</p>
    </div>
  );
}
