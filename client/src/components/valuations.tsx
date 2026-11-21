import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/kpi";
import { useConfirm } from "@/components/confirm";
import { useToast } from "@/hooks/use-toast";
import { errMsg } from "@/components/catalogs";
import { isValidDecimalDraft, parseDecimalDraft } from "@/components/months/number-field";
import { useSave, type Derived } from "@/lib/app";
import { cn, localToday } from "@/lib/utils";
import { fmtEur, fmtPct, parcelReturn } from "@shared/calc";

const GOOD = "text-emerald-700 dark:text-emerald-400";
const BAD = "text-destructive";

/** Ganho ou perda em euros: sem "+" quando é zero (não houve ganho nem perda). */
const gainText = (g: number) => (Math.abs(g) < 0.005 ? fmtEur(0) : `${g > 0 ? "+" : "−"}${fmtEur(Math.abs(g))}`);
const gainTone = (g: number | null) => (g == null || Math.abs(g) < 0.005 ? "text-muted-foreground" : g > 0 ? GOOD : BAD);
const pctText = (p: number) => {
  const v = Math.round(p * 1000) / 10;
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmtPct(Math.abs(v) / 100, 1)}`;
};

/**
 * Valor real das parcelas de poupança e investimento: escreves quanto vale cada uma numa data e a app compara
 * com o que lá puseste (saldo de partida mais alocações até esse mês). Não vai buscar cotações a lado nenhum.
 */
export function ValuationsCard({ d, base }: { d: Derived; base: Record<number, number> }) {
  const save = useSave();
  const { toast } = useToast();
  const { ask, dialog: confirmDialog } = useConfirm();
  const [adding, setAdding] = useState<{ parcelId: string } | null>(null);

  const valuations = d.state.valuations ?? [];
  const rows = useMemo(
    () =>
      d.parcels
        .filter((p) => p.kind !== "gastos" && !p.archived)
        .map((p) => ({ parcel: p, ret: parcelReturn(base[p.id] ?? 0, d.allComputed, p.id, valuations) })),
    [d.parcels, d.allComputed, base, valuations],
  );
  const history = useMemo(
    () => [...valuations].sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1)).slice(0, 30),
    [valuations],
  );
  const parcelName = (id: number) => d.parcels.find((p) => p.id === id)?.name ?? "Parcela removida";

  const totals = rows.reduce(
    (a, r) => (r.ret.latest ? { value: a.value + r.ret.latest.value, contributed: a.contributed + r.ret.contributed } : a),
    { value: 0, contributed: 0 },
  );
  const totalGain = Math.round((totals.value - totals.contributed) * 100) / 100;
  const hasAny = rows.some((r) => r.ret.latest);

  const open = (parcelId?: number) => setAdding({ parcelId: String(parcelId ?? rows[0]?.parcel.id ?? "") });

  return (
    <SectionCard
      title="Valor atual e rentabilidade"
      description="Escreve quanto vale cada parcela numa data; a app compara com o que lá puseste"
      actions={
        <Button size="sm" onClick={() => open()} disabled={rows.length === 0} data-testid="button-add-valuation">
          <Plus className="mr-1 h-3.5 w-3.5" />Registar valor
        </Button>
      }
    >
      {confirmDialog}
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Não há parcelas de poupança ou investimento.</p>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm" data-testid="valuations-table">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Parcela</th>
                  <th className="px-3 py-2 text-right font-medium">Posto</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  <th className="px-3 py-2 text-right font-medium">Ganho ou perda</th>
                  <th className="py-2 pl-3 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ parcel, ret }) => (
                  <tr key={parcel.id} className="border-b border-border/60 last:border-0" data-testid={`valuation-row-${parcel.id}`}>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: parcel.color }} />
                        {parcel.name}
                      </span>
                    </td>
                    <td className="tnum px-3 py-2 text-right text-muted-foreground">{fmtEur(ret.contributed)}</td>
                    <td className="tnum px-3 py-2 text-right">
                      {ret.latest ? (
                        <>
                          {fmtEur(ret.latest.value)}
                          <span className="block text-[11px] text-muted-foreground">em {ret.latest.date.split("-").reverse().join("/")}</span>
                        </>
                      ) : (
                        <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => open(parcel.id)}>
                          Registar valor
                        </button>
                      )}
                    </td>
                    <td className={cn("tnum px-3 py-2 text-right", gainTone(ret.gain))}>{ret.gain == null ? "—" : gainText(ret.gain)}</td>
                    <td className={cn("tnum py-2 pl-3 text-right", gainTone(ret.gain))}>{ret.gainPct == null ? "—" : pctText(ret.gainPct)}</td>
                  </tr>
                ))}
              </tbody>
              {hasAny && (
                <tfoot>
                  <tr className="border-t border-border text-xs font-medium" data-testid="valuations-total">
                    <td className="py-2 pr-3">Total das parcelas com valor</td>
                    <td className="tnum px-3 py-2 text-right text-muted-foreground">{fmtEur(totals.contributed)}</td>
                    <td className="tnum px-3 py-2 text-right">{fmtEur(totals.value)}</td>
                    <td className={cn("tnum px-3 py-2 text-right", gainTone(totalGain))}>{gainText(totalGain)}</td>
                    <td className={cn("tnum py-2 pl-3 text-right", gainTone(totalGain))}>{totals.contributed > 0 ? pctText(totalGain / totals.contributed) : "—"}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            “Posto” é o saldo de partida mais as alocações até ao mês do último valor registado. O ganho não conta o tempo (não é uma rentabilidade anualizada).
          </p>

          {history.length > 0 && (
            <div data-testid="valuations-history">
              <h3 className="mb-1 text-xs font-semibold text-muted-foreground">Valores registados</h3>
              <ul className="divide-y divide-border/60 text-sm">
                {history.map((v) => (
                  <li key={v.id} className="flex items-center gap-2 py-1.5" data-testid={`valuation-${v.id}`}>
                    <span className="tnum w-24 shrink-0 text-xs text-muted-foreground">{v.date.split("-").reverse().join("/")}</span>
                    <span className="min-w-0 flex-1 truncate">{parcelName(v.parcelId)}{v.note ? <span className="text-muted-foreground"> · {v.note}</span> : null}</span>
                    <span className="tnum font-medium">{fmtEur(v.value)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      aria-label={`Remover o valor de ${parcelName(v.parcelId)} em ${v.date}`}
                      data-testid={`button-delete-valuation-${v.id}`}
                      onClick={() =>
                        ask(`Remover o valor de ${fmtEur(v.value)} (${parcelName(v.parcelId)}, ${v.date})?`).then(
                          (ok) =>
                            ok &&
                            save.deleteValuation.mutate(v.id, {
                              onError: (e) => toast({ title: "Não foi possível remover", description: errMsg(e), variant: "destructive" }),
                            }),
                        )
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ValuationDialog
        parcels={rows.map((r) => r.parcel)}
        parcelId={adding ? Number(adding.parcelId) || null : null}
        open={!!adding}
        onOpenChange={(o) => !o && setAdding(null)}
      />
    </SectionCard>
  );
}

/**
 * Registar o valor de mercado de uma parcela numa data (Carteira e Parcelas). Com `parcelId` a parcela vem
 * escolhida; a lista deixa mudar para outra.
 */
export function ValuationDialog({
  parcels,
  parcelId,
  open,
  onOpenChange,
}: {
  parcels: { id: number; name: string }[];
  parcelId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSave();
  const { toast } = useToast();
  const [chosen, setChosen] = useState("");
  const [date, setDate] = useState(localToday());
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    // ao abrir, começa sempre limpo
    setWasOpen(open);
    if (open) { setChosen(String(parcelId ?? parcels[0]?.id ?? "")); setDate(localToday()); setValue(""); setNote(""); }
  }
  const parsed = parseDecimalDraft(value);
  const valid = !!chosen && /^\d{4}-\d{2}-\d{2}$/.test(date) && parsed !== null && parsed >= 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-testid="dialog-valuation">
        <DialogHeader>
          <DialogTitle>Registar valor de mercado</DialogTitle>
          <DialogDescription>Quanto vale a parcela nesta data, por exemplo o saldo que vês na corretora. Não muda o acumulado: mostra o ganho ou a perda.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Parcela</Label>
            <Select value={chosen} onValueChange={setChosen}>
              <SelectTrigger className="h-9 text-sm" data-testid="select-valuation-parcel"><SelectValue placeholder="Escolher parcela" /></SelectTrigger>
              <SelectContent>
                {parcels.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="valuation-date" className="text-xs text-muted-foreground">Data</Label>
              <Input id="valuation-date" type="date" value={date} max={localToday()} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" data-testid="input-valuation-date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valuation-value" className="text-xs text-muted-foreground">Valor (€)</Label>
              <Input
                id="valuation-value"
                inputMode="decimal"
                value={value}
                onChange={(e) => isValidDecimalDraft(e.target.value) && setValue(e.target.value)}
                className="tnum h-9 text-sm"
                data-testid="input-valuation-value"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="valuation-note" className="text-xs text-muted-foreground">Nota</Label>
            <Input id="valuation-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" className="h-9 text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!valid || save.createValuation.isPending}
            data-testid="button-save-valuation"
            onClick={() =>
              save.createValuation.mutate(
                { parcelId: Number(chosen), date, value: parsed!, note: note.trim() || undefined },
                {
                  onSuccess: () => { onOpenChange(false); toast({ title: "Valor registado" }); },
                  onError: (e) => toast({ title: "Não foi possível registar", description: errMsg(e), variant: "destructive" }),
                },
              )
            }
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
