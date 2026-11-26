import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthInput } from "@/components/month-input";
import { useToast } from "@/hooks/use-toast";
import { useSave, type AppState } from "@/lib/app";
import { errMsg } from "@/components/catalogs";
import { isValidDecimalDraft, parseDecimalDraft } from "@/components/months/number-field";
import { localToday } from "@/lib/utils";
import { convertAmount } from "@shared/calc";
import type { Subgoal } from "@shared/schema";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "BRL"];

/**
 * Criar ou editar uma submeta. Uma submeta pode ser um objetivo (ex.: Casa) ou o dinheiro numa plataforma
 * (ex.: XTB); com plataforma escolhida, a lista mostra-a como "Plataforma". Noutra moeda, pede a taxa se ainda
 * não houver nenhuma.
 */
export function SubgoalDialog({
  state,
  parcelId,
  refCurrency,
  editing,
  open,
  onOpenChange,
}: {
  state: AppState;
  parcelId: number;
  refCurrency: string;
  editing: Subgoal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSave();
  const { toast } = useToast();
  const [f, setF] = useState({ name: "", platformId: "", currency: refCurrency, target: "", deadline: "", rate: "" });
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open)
      setF(
        editing
          ? { name: editing.name, platformId: editing.platformId != null ? String(editing.platformId) : "", currency: editing.currency, target: editing.target != null ? String(editing.target).replace(".", ",") : "", deadline: editing.deadline ?? "", rate: "" }
          : { name: "", platformId: "", currency: refCurrency, target: "", deadline: "", rate: "" },
      );
  }
  const other = f.currency !== refCurrency;
  const hasRate = !other || convertAmount(1, f.currency, refCurrency, state.fxRates ?? []) != null;
  const target = f.target.trim() === "" ? null : parseDecimalDraft(f.target);
  const rate = f.rate.trim() === "" ? null : parseDecimalDraft(f.rate);
  const valid = !!f.name.trim() && (f.target.trim() === "" || (target != null && target >= 0)) && (f.rate.trim() === "" || (rate != null && rate > 0)) && /^[A-Z]{3}$/.test(f.currency);
  const fail = (title: string) => (e: unknown) => toast({ title, description: errMsg(e), variant: "destructive" });

  const submit = () => {
    if (!valid) return;
    const body = { name: f.name.trim(), platformId: f.platformId ? Number(f.platformId) : null, currency: f.currency, target, deadline: f.deadline || null };
    const done = () => {
      if (other && rate != null)
        save.createFxRate.mutate({ fromCurrency: f.currency, toCurrency: refCurrency, rate, date: localToday() }, { onError: fail("A submeta ficou guardada, mas a taxa não") });
      onOpenChange(false);
      toast({ title: editing ? "Submeta atualizada" : "Submeta criada" });
    };
    if (editing) save.updateSubgoal.mutate({ id: editing.id, patch: body }, { onSuccess: done, onError: fail("Não foi possível guardar") });
    else save.createSubgoal.mutate({ parcelId, ...body }, { onSuccess: done, onError: fail("Não foi possível criar") });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-subgoal">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar submeta" : "Nova submeta"}</DialogTitle>
          <DialogDescription>Uma parte da parcela com saldo próprio: um objetivo (ex.: Casa) ou o que está numa plataforma (ex.: XTB).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="subgoal-name" className="text-xs text-muted-foreground">Nome</Label>
            <Input id="subgoal-name" value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Ações EUA ou Casa" className="h-9 text-sm" data-testid="input-subgoal-name" />
          </div>
          <div className="grid grid-cols-[1fr_6.5rem] gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Plataforma</Label>
              <Select value={f.platformId || "none"} onValueChange={(v) => setF({ ...f, platformId: v === "none" ? "" : v })}>
                <SelectTrigger aria-label="Plataforma" className="h-9 text-sm" data-testid="select-subgoal-platform"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (é um objetivo)</SelectItem>
                  {state.platforms.filter((p) => !p.archived || String(p.id) === f.platformId).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Moeda</Label>
              <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v })}>
                <SelectTrigger aria-label="Moeda" className="h-9 text-sm" data-testid="select-subgoal-currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from(new Set([refCurrency, f.currency, ...CURRENCIES])).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {other && (
            <div className="space-y-1.5 rounded-md bg-muted/40 p-2.5">
              <Label htmlFor="subgoal-rate" className="text-xs text-muted-foreground">
                Taxa de hoje: 1 {f.currency} = ? {refCurrency}{hasRate ? " (opcional: já existe uma taxa)" : ""}
              </Label>
              <Input id="subgoal-rate" inputMode="decimal" value={f.rate} onChange={(e) => isValidDecimalDraft(e.target.value) && setF({ ...f, rate: e.target.value })} placeholder="Ex.: 0,92" className="tnum h-9 text-sm" data-testid="input-subgoal-rate" />
              {!hasRate && f.rate.trim() === "" && <p className="text-xs text-warning">Sem taxa, esta submeta não entra no total da parcela.</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="subgoal-target" className="text-xs text-muted-foreground">Objetivo ({f.currency})</Label>
              <Input id="subgoal-target" inputMode="decimal" value={f.target} onChange={(e) => isValidDecimalDraft(e.target.value) && setF({ ...f, target: e.target.value })} placeholder="Opcional" className="tnum h-9 text-sm" data-testid="input-subgoal-target" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Prazo</Label>
              <MonthInput clearable aria-label="Prazo" value={f.deadline} onChange={(v) => setF({ ...f, deadline: v })} className="h-9 text-sm" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!valid} onClick={submit} data-testid="button-save-subgoal">Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
