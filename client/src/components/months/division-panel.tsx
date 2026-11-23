import { useMemo, useState } from "react";
import { Minus, Plus, Save, Wand2, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/confirm";
import { useAppState, useSave } from "@/lib/app";
import { useFeatures } from "@/lib/features";
import type { Month } from "@shared/schema";
import { errMsg } from "@/components/catalogs";
import { allocationAmount, availableOf, fmtEur } from "@shared/calc";
import { divisionStatus, shareOf } from "@shared/division";
import { isValidDecimalDraft, parseDecimalDraft, formatNumberForInput } from "@/components/months/number-field";
import { PlatformDistribution } from "@/components/months/platform-distribution";
import { DistributeLeftoverDialog, type LeftoverChange } from "@/components/months/distribute-leftover-dialog";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Divisão do salário de um mês por parcelas: escolher as que entram, ver de relance o que sobra e repartir. */
export function DivisionPanel({ month }: { month: Month }) {
  const { data } = useAppState();
  const features = useFeatures();
  const save = useSave();
  const { toast } = useToast();
  const { ask, dialog: confirmDialog } = useConfirm();
  const [leftoverOpen, setLeftoverOpen] = useState(false);
  const parcels = useMemo(
    () => (data?.parcels ?? []).filter((p) => !p.archived).sort((a, b) => a.sortOrder - b.sortOrder),
    [data?.parcels],
  );
  const allocations = (data?.allocations ?? []).filter((a) => a.monthId === month.id);
  const available = availableOf(month, data!.settings);
  const rows = parcels.map((p) => {
    const a = allocations.find((x) => x.parcelId === p.id);
    const included = (a?.included ?? 1) !== 0;
    const mode = a?.mode ?? p.defaultMode;
    const value = a?.value ?? 0;
    const amount = included ? allocationAmount({ mode, value } as any, available) : 0;
    return { p, a, included, mode, value, amount };
  });
  const allocated = rows.reduce((acc, r) => acc + r.amount, 0);
  const { status, remaining } = divisionStatus(available, allocated);
  const isClosedMonth = month.status === "fechado";

  const write = (r: (typeof rows)[number], patch: { mode?: string; value?: number; included?: boolean }) =>
    save.allocation.mutate({ monthId: month.id, parcelId: r.p.id, mode: patch.mode ?? r.mode, value: patch.value ?? r.value, included: patch.included });
  const setMode = (r: (typeof rows)[number], mode: "fixo" | "percentagem") => {
    if (mode === r.mode) return;
    // converte para o valor equivalente, para a parcela não mudar ao trocar de € para %
    const value = available > 0 ? (mode === "fixo" ? round2(r.amount) : round2((r.amount / available) * 100)) : r.value;
    write(r, { mode, value });
  };
  const nudge = (r: (typeof rows)[number], dir: 1 | -1) => {
    const step = r.mode === "fixo" ? 10 : 1;
    write(r, { value: Math.max(0, round2(r.value + dir * step)) });
  };

  const applyLeftover = async (changes: LeftoverChange[]) => {
    try {
      for (const c of changes) {
        await save.allocation.mutateAsync({ monthId: month.id, parcelId: c.id, mode: "fixo", value: c.amount });
      }
      setLeftoverOpen(false);
      toast({ title: "Divisão atualizada", description: `${fmtEur(remaining)} distribuídos.` });
    } catch (e) {
      toast({ title: "Não foi possível distribuir", description: errMsg(e), variant: "destructive" });
    }
  };

  const hasData = allocations.some((a) => a.value !== 0);
  const applyModel = async () => {
    if (hasData && !(await ask("Aplicar o modelo a este mês?", "Substitui a divisão atual das parcelas que têm modelo (valor, se entram, plataformas e ativos). As outras ficam como estão."))) return;
    save.applyRules.mutate(month.id, {
      onSuccess: (res: any) => {
        const sem: number[] = res?.modelo?.semDetalhe ?? [];
        toast({
          title: "Modelo aplicado",
          description: sem.length
            ? `Sem detalhe por plataforma (não cabia no valor do mês): ${sem.map((id) => parcels.find((p) => p.id === id)?.name ?? "").filter(Boolean).join(", ")}.`
            : "A divisão deste mês passou a seguir o modelo das parcelas.",
        });
      },
      onError: (e) => toast({ title: "Não foi possível aplicar o modelo", description: errMsg(e), variant: "destructive" }),
    });
  };

  const counted = rows.filter((r) => r.included && r.amount > 0);
  return (
    <div className="space-y-4" data-testid="division-panel">
      {/* visão de relance */}
      <section
        aria-label="Resumo da divisão"
        className={`division-summary space-y-3 rounded-xl border p-4 ${status === "completo" ? "border-primary/40 bg-primary/5" : status === "excede" ? "border-destructive/40 bg-destructive/5" : "border-border bg-background"}`}
        data-testid="division-summary"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Disponível este mês</p>
            <p className="tnum text-2xl font-semibold" data-testid="division-available">{fmtEur(available)}</p>
          </div>
          <div className="text-right" role="status" aria-live="polite" data-testid="division-status">
            {status === "completo" && <p className="text-sm font-medium text-primary">✔ Tudo distribuído</p>}
            {status === "livre" && <p className="text-sm font-medium">Por distribuir <span className="tnum text-amber-700 dark:text-amber-400">{fmtEur(remaining)}</span></p>}
            {status === "excede" && <p className="text-sm font-medium text-destructive">Excede em <span className="tnum">{fmtEur(-remaining)}</span></p>}
            <p className="text-xs text-muted-foreground">Alocado <span className="tnum">{fmtEur(allocated)}</span> · Restante <span className="tnum" data-testid="badge-remaining">{fmtEur(remaining)}</span></p>
          </div>
        </div>
        <div className="flex h-4 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Divisão: ${counted.map((r) => `${r.p.name} ${fmtEur(r.amount)}`).join(", ") || "sem valores"}`} data-testid="division-bar">
          {available > 0 && counted.map((r) => (
            <span key={r.p.id} style={{ width: `${Math.min(100, (r.amount / available) * 100)}%`, background: r.p.color }} />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {counted.map((r) => (
            <li key={r.p.id} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: r.p.color }} aria-hidden />{r.p.name} <span className="tnum">{fmtEur(r.amount)}</span></li>
          ))}
        </ul>
        {isClosedMonth && <p role="status" className="text-sm text-muted-foreground">Mês fechado. Reabre-o em Fecho e planeamento para alterar a divisão.</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="h-9 gap-1.5" disabled={isClosedMonth || status !== "livre"} onClick={() => setLeftoverOpen(true)} data-testid="button-distribute-leftover">
            <Scale className="h-4 w-4" aria-hidden />
            Distribuir o que sobra
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" data-testid="button-apply-rules" disabled={isClosedMonth || save.applyRules.isPending} onClick={applyModel}>
            <Wand2 className="h-4 w-4" aria-hidden />
            Aplicar modelo
          </Button>
          <Button
            variant="ghost" size="sm" className="h-9 gap-1.5" data-testid="button-save-as-rules"
            disabled={isClosedMonth || save.saveAsRules.isPending}
            onClick={() => save.saveAsRules.mutate(month.id, { onSuccess: () => toast({ title: "Modelo guardado", description: "Esta divisão passou a ser o modelo das parcelas: os meses novos começam com ela." }) })}
          >
            <Save className="h-4 w-4" aria-hidden />
            Guardar como modelo
          </Button>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">Os valores são guardados ao sair de cada campo ou ao usar − e +. A divisão é planeamento, não cria movimentos.</p>

      {/* parcelas */}
      <div className="grid items-start gap-3 lg:grid-cols-2">
        {rows.map((r) => (
          <fieldset
            key={r.p.id}
            disabled={isClosedMonth}
            className={`allocation-card min-w-0 space-y-3 rounded-xl border p-3 ${r.included ? "border-border bg-card" : "border-dashed border-border bg-transparent"}`}
            data-testid={`allocation-card-${r.p.id}`}
          >
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.p.color }} aria-hidden />
              <span className={`min-w-0 flex-1 wrap-break-word text-sm font-medium ${r.included ? "" : "text-muted-foreground"}`}>{r.p.name}</span>
              {!r.included && <span className="text-xs text-muted-foreground">fora deste mês</span>}
              <Switch
                checked={r.included}
                disabled={isClosedMonth}
                aria-label={`${r.p.name} entra neste mês`}
                data-testid={`switch-include-${r.p.id}`}
                onCheckedChange={(v) => write(r, { included: v })}
              />
            </div>
            {r.included && (
              <>
                <div className="allocation-row flex flex-wrap items-center gap-2">
                  <div className="flex overflow-hidden rounded-md border text-xs" role="radiogroup" aria-label={`Modo de ${r.p.name}`}>
                    {(["fixo", "percentagem"] as const).map((m) => (
                      <button
                        key={m} type="button" role="radio" aria-checked={r.mode === m} disabled={isClosedMonth}
                        data-testid={`mode-${r.p.id}-${m}`}
                        onClick={() => setMode(r, m)}
                        className={`min-h-9 px-3 pointer-coarse:min-h-11 ${r.mode === m ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                      >{m === "fixo" ? "€" : "%"}</button>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11" aria-label={`Diminuir ${r.p.name}`} data-testid={`alloc-minus-${r.p.id}`} onClick={() => nudge(r, -1)}><Minus className="h-4 w-4" /></Button>
                  <Input
                    type="text"
                    inputMode="decimal"
                    aria-label={`Valor de ${r.p.name}`}
                    defaultValue={formatNumberForInput(r.value)}
                    key={`${r.p.id}-${r.mode}-${r.value}`}
                    onChange={(e) => {
                      if (!isValidDecimalDraft(e.target.value)) e.target.value = e.target.value.slice(0, -1);
                    }}
                    onBlur={(e) => {
                      const raw = e.target.value;
                      const parsed = raw === "" ? 0 : parseDecimalDraft(raw);
                      const v = parsed === null ? r.value : Math.max(0, parsed);
                      e.target.value = formatNumberForInput(v);
                      if (v !== r.value) write(r, { value: v });
                    }}
                    className="tnum h-9 min-w-0 flex-1 text-center text-sm pointer-coarse:h-11"
                    data-testid={`input-alloc-${r.p.id}`}
                  />
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11" aria-label={`Aumentar ${r.p.name}`} data-testid={`alloc-plus-${r.p.id}`} onClick={() => nudge(r, 1)}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-xs text-muted-foreground">{r.mode === "fixo" ? `${shareOf(r.amount, available)}% do disponível` : "Valor calculado"}</span>
                  <span className="allocation-result tnum font-medium" data-testid={`text-alloc-${r.p.id}`}>{fmtEur(r.amount)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full" style={{ width: `${available > 0 ? Math.min(100, (r.amount / available) * 100) : 0}%`, background: r.p.color }} />
                </div>
                {features.plataformas && (
                  <PlatformDistribution monthId={month.id} parcelId={r.p.id} allocationId={r.a?.id ?? null} total={r.amount} />
                )}
              </>
            )}
          </fieldset>
        ))}
      </div>
      {save.allocation.isPending && <p role="status" className="text-xs text-muted-foreground">A guardar divisão…</p>}
      {save.allocation.isError && <p role="alert" className="text-sm text-destructive">A divisão não foi guardada: {errMsg(save.allocation.error)}. Tenta novamente.</p>}

      <DistributeLeftoverDialog
        open={leftoverOpen}
        onOpenChange={setLeftoverOpen}
        remaining={remaining}
        parts={rows.filter((r) => r.included).map((r) => ({ id: r.p.id, name: r.p.name, amount: r.amount, fixed: r.mode === "fixo" }))}
        onApply={applyLeftover}
        busy={save.allocation.isPending}
      />
      {confirmDialog}
    </div>
  );
}
