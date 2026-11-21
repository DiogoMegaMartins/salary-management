import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSave } from "@/lib/app";
import { errMsg } from "@/components/catalogs";
import { isValidDecimalDraft, parseDecimalDraft } from "@/components/months/number-field";
import { localToday } from "@/lib/utils";
import { formatGoalMoney } from "@/components/dashboard-subgoals";

/** Onde o movimento entra: a meta principal (subgoalId null) ou uma submeta. */
export type MovementTarget = { subgoalId: number | null; label: string; currency: string; current: number };
type Kind = "entrada" | "saida" | "corrigir" | "transferir";

const KIND_HELP: Record<Kind, string> = {
  entrada: "Dinheiro que puseste fora da divisão dos meses (ex.: um prémio que foi direto para aqui). Aumenta o acumulado.",
  saida: "Dinheiro que tiraste daqui (ex.: usaste parte para uma compra). Diminui o acumulado.",
  corrigir: "Escreves o total certo e a app regista a diferença como entrada ou saída. Para acertos de mercado usa \"Registar valor de mercado\".",
  transferir: "Passa dinheiro de um sítio para outro dentro da parcela (ex.: do não distribuído para a submeta Casa). O acumulado não muda.",
};

/**
 * Entrada, saída ou correção do total de uma meta ou submeta. Por baixo é um "ajuste" (positivo ou negativo):
 * muda o acumulado, ao contrário do valor de mercado, que só mostra ganho ou perda.
 */
export function MovementDialog({
  parcelId,
  targets,
  initial,
  open,
  onOpenChange,
}: {
  parcelId: number;
  targets: MovementTarget[];
  /** subgoalId escolhido ao abrir (null = meta principal). */
  initial: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSave();
  const { toast } = useToast();
  const [kind, setKind] = useState<Kind>("entrada");
  const [where, setWhere] = useState("m");
  const [to, setTo] = useState("");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(localToday());
  const [note, setNote] = useState("");
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) { setKind("entrada"); setWhere(initial == null ? "m" : String(initial)); setTo(""); setValue(""); setDate(localToday()); setNote(""); }
  }
  const keyOf = (t: MovementTarget) => (t.subgoalId == null ? "m" : String(t.subgoalId));
  const target = targets.find((t) => keyOf(t) === where) ?? targets[0];
  // transferir só entre sítios na mesma moeda
  const destinations = targets.filter((t) => keyOf(t) !== where && t.currency === target?.currency);
  const dest = destinations.find((t) => keyOf(t) === to) ?? null;
  const n = parseDecimalDraft(value);
  const amount =
    n == null ? null : kind === "entrada" ? n : kind === "saida" || kind === "transferir" ? -n : Math.round((n - (target?.current ?? 0)) * 100) / 100;
  const valid = !!target && n != null && (kind === "corrigir" ? amount !== 0 : n > 0) && (kind !== "transferir" || !!dest) && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const money = (x: number) => formatGoalMoney(x, target?.currency || "EUR");

  const submit = () => {
    if (!valid || amount == null || !target) return;
    const autoNote = kind === "corrigir" ? `Correção do total para ${money(n!)}` : "";
    if (kind === "transferir" && dest) {
      const text = note.trim() || `Transferência de ${target.label} para ${dest.label}`;
      // saída de um lado e entrada do outro: o total da parcela fica igual
      save.createGoalEntry
        .mutateAsync({ parcelId, subgoalId: target.subgoalId, kind: "ajuste", amount: -n!, date, note: text })
        .then(() => save.createGoalEntry.mutateAsync({ parcelId, subgoalId: dest.subgoalId, kind: "ajuste", amount: n!, date, note: text }))
        .then(
          () => { onOpenChange(false); toast({ title: `Transferidos ${money(n!)} para ${dest.label}` }); },
          (e) => toast({ title: "Não foi possível transferir", description: errMsg(e), variant: "destructive" }),
        );
      return;
    }
    save.createGoalEntry.mutate(
      { parcelId, subgoalId: target.subgoalId, kind: "ajuste", amount, date, note: note.trim() || autoNote },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast({ title: amount > 0 ? `Entrada de ${money(amount)} registada` : `Saída de ${money(-amount)} registada` });
        },
        onError: (e) => toast({ title: "Não foi possível guardar", description: errMsg(e), variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-movement">
        <DialogHeader>
          <DialogTitle>Registar movimento</DialogTitle>
          <DialogDescription>{KIND_HELP[kind]}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className={`grid gap-1 rounded-lg bg-muted p-1 ${targets.length > 1 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`} role="radiogroup" aria-label="Tipo de movimento">
            {(targets.length > 1 ? (["entrada", "saida", "transferir", "corrigir"] as Kind[]) : (["entrada", "saida", "corrigir"] as Kind[])).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                data-testid={`movement-kind-${k}`}
                onClick={() => setKind(k)}
                className={`rounded-md px-2 py-1.5 text-sm transition-colors ${kind === k ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
              >
                {k === "entrada" ? "Entrada" : k === "saida" ? "Saída" : k === "transferir" ? "Transferir" : "Corrigir total"}
              </button>
            ))}
          </div>
          {targets.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{kind === "transferir" ? "De" : "Onde"}</Label>
              <Select value={where} onValueChange={setWhere}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-movement-target"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {targets.map((t) => (
                    <SelectItem key={t.subgoalId ?? "m"} value={t.subgoalId == null ? "m" : String(t.subgoalId)}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {kind === "transferir" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Para</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-movement-dest"><SelectValue placeholder="Escolher destino" /></SelectTrigger>
                <SelectContent>
                  {destinations.map((t) => <SelectItem key={keyOf(t)} value={keyOf(t)}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="movement-value" className="text-xs text-muted-foreground">
                {kind === "corrigir" ? `Total certo (${target?.currency ?? "EUR"})` : `Valor (${target?.currency ?? "EUR"})`}
              </Label>
              <Input id="movement-value" inputMode="decimal" value={value} onChange={(e) => isValidDecimalDraft(e.target.value) && setValue(e.target.value)} className="tnum h-9 text-sm" data-testid="input-movement-value" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="movement-date" className="text-xs text-muted-foreground">Data</Label>
              <Input id="movement-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          {kind === "corrigir" && target && (
            <p className="text-xs text-muted-foreground" data-testid="movement-diff">
              Agora: {money(target.current)}
              {amount != null && amount !== 0 && ` · vai registar uma ${amount > 0 ? "entrada" : "saída"} de ${money(Math.abs(amount))}`}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="movement-note" className="text-xs text-muted-foreground">Nota</Label>
            <Input id="movement-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Opcional (ex.: prémio de desempenho)" className="h-9 text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!valid || save.createGoalEntry.isPending} onClick={submit} data-testid="button-save-movement">Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
