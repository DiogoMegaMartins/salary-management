import { useMemo } from "react";
import { Save, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAppState, useSave } from "@/lib/app";
import { useFeatures } from "@/lib/features";
import type { Month } from "@shared/schema";
import { errMsg } from "@/components/catalogs";
import { allocationAmount, availableOf, fmtEur } from "@shared/calc";
import { isValidDecimalDraft, parseDecimalDraft, formatNumberForInput } from "@/components/months/number-field";
import { PlatformDistribution } from "@/components/months/platform-distribution";
import { Summary } from "@/components/months/summary";

/** Divisão do salário de um mês por parcelas (valores guardados ao sair de cada campo). */
export function DivisionPanel({ month }: { month: Month }) {
  const { data } = useAppState();
  const features = useFeatures();
  const save = useSave();
  const { toast } = useToast();
  const parcels = useMemo(
    () => (data?.parcels ?? []).filter((p) => !p.archived).sort((a, b) => a.sortOrder - b.sortOrder),
    [data?.parcels],
  );
  const allocations = (data?.allocations ?? []).filter((a) => a.monthId === month.id);
  const available = availableOf(month, data!.settings);
  const allocated = allocations.reduce((acc, a) => acc + allocationAmount(a, available), 0);
  const remaining = available - allocated;
  const isClosedMonth = month.status === "fechado";
  return (
    <div className="space-y-4" data-testid="division-panel">
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
                      <span className="wrap-break-word">{p.name}</span>
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
                  {features.plataformas && (
                    <PlatformDistribution
                      monthId={month.id}
                      parcelId={p.id}
                      allocationId={a?.id ?? null}
                      total={amount}
                    />
                  )}
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
              </div>
  );
}
