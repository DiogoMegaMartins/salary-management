import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useConfirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAppState, useSave } from "@/lib/app";
import { useFeatures } from "@/lib/features";
import type { Month } from "@shared/schema";
import { errMsg } from "@/components/catalogs";
import { MONTH_NAMES, availableOf, descontosOf, fmtEur, grossOf, mealOf } from "@shared/calc";
import { editableMonthPatch } from "@shared/month-patch";
import { NumberField } from "@/components/months/number-field";
import { DivisionGlance } from "@/components/months/division-glance";
import { Summary } from "@/components/months/summary";

export function MonthEditor({ month, isNew, onClose }: { month: Month; isNew: boolean; onClose: () => void }) {
  const { data } = useAppState();
  const features = useFeatures();
  const save = useSave();
  const { toast } = useToast();
  const [form, setForm] = useState<Month>(month);
  const [saveError, setSaveError] = useState("");
  useEffect(() => setForm(month), [month.id]);

  const settings = data!.settings;

  const available = availableOf(form, settings);
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

  const [, navigate] = useLocation();
  /** A divisão edita-se na página Divisão; com alterações por guardar, pergunta antes de sair. */
  const openDivision = async () => {
    const dirty = !isClosedMonth && JSON.stringify(form) !== initialForm.current;
    if (dirty && !(await ask("Descartar as alterações?", "Os valores que alteraste neste mês ainda não foram guardados."))) return;
    onClose();
    navigate(`/divisao/${month.id}`);
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
            {isNew ? "Preenche os valores do recibo." : "Edita os valores do recibo."}
          </DialogDescription>
        </DialogHeader>

        <div className="month-editor-body min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <div className="space-y-5">
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
                  <SelectTrigger aria-label="Mês" className="h-9 text-sm" data-testid="select-month">
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
                {features.irsJovem && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">IRS Jovem</Label>
                  <Select value={form.irsJovem || "nenhum"} onValueChange={(v) => set("irsJovem", v === "nenhum" ? "" : v)}>
                    <SelectTrigger aria-label="IRS Jovem" className="h-9 text-sm" data-testid="select-irs-jovem">
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
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descontos</p>
                <Select value={form.descontosMode} onValueChange={(v) => set("descontosMode", v)}>
                  <SelectTrigger aria-label="Modo dos descontos" className="h-8 w-[210px] text-xs" data-testid="select-descontos-mode">
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
          {!isDraft && (features.divisao || features.movimentos) && <DivisionGlance month={month} onOpen={openDivision} />}
        </div>
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
