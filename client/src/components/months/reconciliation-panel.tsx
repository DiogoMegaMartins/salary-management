import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppState, useSave } from "@/lib/app";
import { dateInMonth } from "@/lib/utils";
import type { Month } from "@shared/schema";
import { allocationAmount, availableOf, fmtEur, reconcileMonth, suggestSurplusDistribution } from "@shared/calc";

const DEFICIT_REASONS = [
  { value: "reducao_saldo", label: "Redução de saldo" },
  { value: "movimento_parcela", label: "Movimento de parcela" },
  { value: "credito", label: "Crédito" },
  { value: "correcao", label: "Correção de registo" },
];

export function ReconciliationPanel({
  rec,
  month,
  monthId,
  onSaveReason,
}: {
  rec: ReturnType<typeof reconcileMonth>;
  month: Month;
  monthId: number;
  onSaveReason: (reason: string, note: string) => void;
}) {
  const carryIn = month.carryIn ?? 0;
  const isClosedMonth = month.status === "fechado";
  const [reason, setReason] = useState(month.deficitReason || "");
  const [note, setNote] = useState(month.deficitNote || "");
  useEffect(() => {
    setReason(month.deficitReason || "");
    setNote(month.deficitNote || "");
  }, [month.id]);
  const { data } = useAppState();
  const save2 = useSave();
  const [suggestion, setSuggestion] = useState<ReturnType<typeof suggestSurplusDistribution> | null>(null);

  const threshold = data?.settings.surplusSuggestionThreshold ?? 50;
  const showSuggestButton = data && rec.porAlocar > threshold;

  function computeSuggestion() {
    if (!data) return;
    const emergencyIds = (data.settings.emergencyParcelIds || "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    const balanceByParcel: Record<number, number> = {};
    for (const p of data.parcels) {
      balanceByParcel[p.id] = data.allocations
        .filter((a) => a.parcelId === p.id)
        .reduce((acc, a) => {
          const m = data.months.find((mm) => mm.id === a.monthId);
          if (!m) return acc;
          const avail = availableOf(m, data.settings);
          return acc + allocationAmount(a, avail);
        }, 0);
    }
    const items = suggestSurplusDistribution(
      rec.porAlocar,
      data.parcels.filter((p) => !p.archived),
      emergencyIds,
      balanceByParcel,
      threshold,
    );
    setSuggestion(items);
  }

  async function applySuggestion() {
    if (!suggestion) return;
    const todo = suggestion.filter((item) => item.parcelId != null && item.amount > 0);
    const results = await Promise.allSettled(todo.map((item) =>
      save2.createTransaction.mutateAsync({
        monthId,
        date: dateInMonth(month.year, month.month),
        type: "contribution",
        value: item.amount,
        parcelId: item.parcelId,
        category: "Distribuição de excedente",
        note: item.reason === "reserva" ? "Reserva de emergência (sugestão SM-007)" : item.reason === "meta_proxima" ? "Meta próxima (sugestão SM-007)" : "Sugestão de distribuição (SM-007)",
      } as any)));
    // ficam na sugestão só os que falharam (já mostraram o erro), para não duplicar os que foram criados
    const failed = todo.filter((_, i) => results[i].status === "rejected");
    setSuggestion(failed.length ? failed : null);
  }

  const chipClass =
    rec.estado === "defice"
      ? "bg-destructive/15 text-destructive"
      : rec.estado === "excedente"
        ? "bg-primary/15 text-primary"
        : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reconciliação do mês</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="tnum rounded-md border border-border bg-card px-2.5 py-1.5">
          Disponível <b>{fmtEur(rec.available)}</b>
        </span>
        <span className="text-muted-foreground">−</span>
        <span className="tnum rounded-md border border-border bg-card px-2.5 py-1.5">
          Despesas <b>{fmtEur(rec.despesas)}</b>
        </span>
        <span className="text-muted-foreground">−</span>
        <span className="tnum rounded-md border border-border bg-card px-2.5 py-1.5">
          Alocações <b>{fmtEur(rec.alocacoes)}</b>
        </span>
        {carryIn > 0 && (
          <span className="tnum rounded-md border border-border bg-card px-2.5 py-1.5" data-testid="badge-carry-in">
            Transporte <b>+{fmtEur(carryIn)}</b>
          </span>
        )}
        {isClosedMonth && (
          <Badge variant="outline" data-testid="badge-month-closed">Mês fechado: reabre em Fecho e planeamento para alterar</Badge>
        )}
        <span className="text-muted-foreground">=</span>
        <Badge className={chipClass} data-testid="badge-por-alocar">
          <span className="tnum">Por alocar {fmtEur(rec.porAlocar)}</span>
        </Badge>
        {showSuggestButton && !suggestion && (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={computeSuggestion} data-testid="button-suggest-surplus">
            Sugerir distribuição do excedente
          </Button>
        )}
      </div>

      {suggestion && (
        <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs font-semibold text-primary">Sugestão de distribuição (SM-007)</p>
          {suggestion.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem sugestão: não há parcelas de reserva ou metas com folga definida.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {suggestion.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
                  <span>
                    {item.parcelName}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({item.reason === "reserva" ? "reserva de emergência" : item.reason === "meta_proxima" ? "meta próxima" : item.reason === "outra_parcela" ? "outra parcela" : "saldo livre"})
                    </span>
                  </span>
                  <Input
                    type="number"
                    step={0.01}
                    value={item.amount}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 0;
                      setSuggestion((cur) => cur!.map((x, xi) => (xi === i ? { ...x, amount: v } : x)));
                    }}
                    className="tnum h-8 w-28 text-sm"
                    data-testid={`input-suggestion-amount-${i}`}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSuggestion(null)} data-testid="button-cancel-suggestion">
              Cancelar
            </Button>
            {suggestion.length > 0 && (
              <Button size="sm" onClick={applySuggestion} data-testid="button-apply-suggestion">
                Aplicar como lançamentos
              </Button>
            )}
          </div>
        </div>
      )}

      {rec.estado === "defice" && (
        <div className="grid gap-2 sm:grid-cols-[200px_1fr_auto] items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Motivo do défice</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-9 text-xs" data-testid="select-deficit-reason">
                <SelectValue placeholder="Seleciona um motivo" />
              </SelectTrigger>
              <SelectContent>
                {DEFICIT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nota</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-9 text-sm" placeholder="Opcional" />
          </div>
          <Button size="sm" className="h-9" onClick={() => onSaveReason(reason, note)} data-testid="button-save-deficit-reason">
            Guardar
          </Button>
        </div>
      )}
    </div>
  );
}
