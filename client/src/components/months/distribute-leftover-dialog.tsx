import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtEur } from "@shared/calc";
import { splitLeftover } from "@shared/division";

/** Uma parcela que entra no mês, com o valor atual em euros. */
export type LeftoverPart = { id: number; name: string; amount: number; fixed: boolean };
/** Novo valor em € fixo para uma parcela. */
export type LeftoverChange = { id: number; amount: number };

type Kind = "uma" | "proporcional";

/**
 * Reparte o que sobra do mês. Mostra o resultado antes de aplicar. Só altera valores em € fixo (uma parcela em %
 * passa a € fixo se for escolhida como destino). "Deixar por distribuir" é só fechar.
 */
export function DistributeLeftoverDialog({
  open,
  onOpenChange,
  remaining,
  parts,
  onApply,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remaining: number;
  parts: LeftoverPart[];
  onApply: (changes: LeftoverChange[]) => void;
  busy?: boolean;
}) {
  const [kind, setKind] = useState<Kind>("uma");
  const [target, setTarget] = useState<string>("");
  const leftoverCents = Math.round(remaining * 100);
  const chosen = parts.find((p) => String(p.id) === target) ?? parts[0];
  const prop = splitLeftover(leftoverCents, parts.filter((p) => p.fixed).map((p) => ({ id: p.id, value: p.amount })));

  const changes: LeftoverChange[] =
    kind === "uma"
      ? chosen ? [{ id: chosen.id, amount: Math.round((chosen.amount + remaining) * 100) / 100 }] : []
      : prop ? parts.filter((p) => prop[p.id] != null).map((p) => ({ id: p.id, amount: Math.round((p.amount + prop[p.id] / 100) * 100) / 100 })) : [];
  const nameOf = (id: number) => parts.find((p) => p.id === id)?.name ?? "";
  const gain = (c: LeftoverChange) => c.amount - (parts.find((p) => p.id === c.id)?.amount ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-distribute-leftover">
        <DialogHeader>
          <DialogTitle>Distribuir {fmtEur(remaining)}</DialogTitle>
          <DialogDescription>Escolhe como repartir o que sobra. Vês o resultado antes de aplicar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3" role="radiogroup" aria-label="Como distribuir">
          <button
            type="button" role="radio" aria-checked={kind === "uma"} onClick={() => setKind("uma")} data-testid="leftover-kind-uma"
            className={`w-full rounded-lg border p-3 text-left ${kind === "uma" ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <span className="block text-sm font-medium">Tudo para uma parcela</span>
            <span className="block text-xs text-muted-foreground">Junta o que sobra ao valor de uma parcela.</span>
          </button>
          {kind === "uma" && (
            <div className="space-y-1.5 pl-1">
              <Label className="text-xs text-muted-foreground">Parcela</Label>
              <Select value={String(chosen?.id ?? "")} onValueChange={setTarget}>
                <SelectTrigger className="h-9 text-sm" data-testid="leftover-target" aria-label="Parcela de destino"><SelectValue /></SelectTrigger>
                <SelectContent>{parts.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <button
            type="button" role="radio" aria-checked={kind === "proporcional"} aria-disabled={!prop} disabled={!prop}
            onClick={() => setKind("proporcional")} data-testid="leftover-kind-proporcional"
            className={`w-full rounded-lg border p-3 text-left disabled:opacity-50 ${kind === "proporcional" ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <span className="block text-sm font-medium">Proporcional ao que já tens</span>
            <span className="block text-xs text-muted-foreground">{prop ? "Reparte pelas parcelas em € fixo, conforme o peso de cada uma." : "Precisa de parcelas em € fixo com valor."}</span>
          </button>
          <div className="rounded-lg bg-muted/40 p-3 text-sm" data-testid="leftover-preview" aria-live="polite">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Resultado</p>
            {changes.length ? (
              <ul className="space-y-0.5">
                {changes.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3"><span>{nameOf(c.id)}</span><span className="tnum font-medium">+ {fmtEur(gain(c))}</span></li>
                ))}
              </ul>
            ) : <p className="text-muted-foreground">Nada a alterar.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Deixar por distribuir</Button>
          <Button disabled={!changes.length || busy} onClick={() => onApply(changes)} data-testid="button-apply-leftover">Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
