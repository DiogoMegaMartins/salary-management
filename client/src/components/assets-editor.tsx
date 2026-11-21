import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAppState, useSave } from "@/lib/app";
import { errMsg } from "@/components/catalogs";
import { distributeAssets, fmtEur, type AssetLine } from "@shared/calc";

const toNum = (s: string) => {
  const t = s.trim().replace(",", ".");
  return t === "" ? 0 : /^\d+(\.\d{0,4})?$/.test(t) ? Number(t) : NaN;
};

/** Distribuição opcional por ativos/classes dentro de uma plataforma: nome, % e nota. O valor é sempre derivado. */
export function AssetsEditor({ monthId, parcelId, allocationId, platformId, platformName, amount }: {
  monthId: number; parcelId: number; allocationId: number; platformId: number; platformName: string; amount: number;
}) {
  const { data } = useAppState();
  const save = useSave();
  const { toast } = useToast();
  const saved = useMemo(
    () => (data?.allocationAssets ?? []).filter((x) => x.allocationId === allocationId && x.platformId === platformId).sort((a, b) => a.position - b.position),
    [data, allocationId, platformId],
  );
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<{ name: string; percent: string; note: string }[]>([]);
  const key = `${parcelId}-${platformId}`;
  const begin = () => {
    setRows(saved.map((x) => ({ name: x.name, percent: String(x.percent).replace(".", ","), note: x.note })));
    setOpen(true);
  };
  const lines: AssetLine[] = rows.map((r) => ({ name: r.name, percent: toNum(r.percent), note: r.note }));
  const r = distributeAssets(amount, lines);
  const savedR = distributeAssets(amount, saved.map((x) => ({ name: x.name, percent: x.percent })));
  const patch = (i: number, p: Partial<(typeof rows)[number]>) => setRows(rows.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const submit = () =>
    save.setAssets.mutate(
      { monthId, parcelId, platformId, lines },
      {
        onSuccess: () => { toast({ title: "Ativos guardados", description: "Planeamento apenas: não cria compras nem posições na carteira." }); setOpen(false); },
        onError: (e) => toast({ title: "Não foi possível guardar", description: errMsg(e), variant: "destructive" }),
      },
    );

  return (
    <div className="assets-panel ml-10 text-xs" data-testid={`assets-${key}`}>
      <button type="button" onClick={() => (open ? setOpen(false) : begin())} aria-expanded={open} className="flex max-w-full flex-wrap items-center gap-1 text-left text-muted-foreground hover:text-foreground" data-testid={`button-assets-${key}`}>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {platformName} ({fmtEur(amount)}): ativos{saved.length ? ` (${saved.length})` : ""}
        {!open && saved.length > 0 && savedR.remainingCents > 0 && <span className="ml-1">· restante {savedR.remainingPercent.toFixed(2)}% = {fmtEur(savedR.remainingCents / 100)}</span>}
      </button>
      {!open && saved.length > 0 && (
        <ul className="ml-4 mt-0.5 space-y-0.5 text-muted-foreground">
          {saved.map((x, i) => (
            <li key={x.id} className="flex flex-wrap gap-2 wrap-break-word"><span>{x.name}</span><span className="tnum">{x.percent}% = {fmtEur((savedR.amountsCents[i] ?? 0) / 100)}</span>{x.note && <span className="wrap-break-word">· {x.note}</span>}</li>
          ))}
        </ul>
      )}
      {open && (
        <div className="mt-1.5 space-y-1.5 rounded-md border border-border bg-muted/20 p-2.5">
          {rows.length === 0 && <p className="text-muted-foreground">Sem linhas: o montante fica todo na plataforma.</p>}
          {rows.map((x, i) => (
            <div key={i} className="asset-row grid grid-cols-[minmax(0,1fr)_80px_90px_minmax(0,1fr)_44px] items-center gap-1.5">
              <Input value={x.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="Ativo / classe" aria-label="Nome do ativo" className="h-8 text-xs" data-testid={`input-asset-name-${key}-${i}`} />
              <Input value={x.percent} onChange={(e) => patch(i, { percent: e.target.value })} inputMode="decimal" placeholder="%" aria-label="Percentagem" className="tnum h-8 text-xs" data-testid={`input-asset-pct-${key}-${i}`} />
              <span className="tnum text-right text-muted-foreground" aria-label="Valor calculado">{fmtEur((r.amountsCents[i] ?? 0) / 100)}</span>
              <Input value={x.note} onChange={(e) => patch(i, { note: e.target.value })} placeholder="nota (opcional)" aria-label="Nota" className="h-8 text-xs" />
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Remover linha" onClick={() => setRows(rows.filter((_, k) => k !== i))}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setRows([...rows, { name: "", percent: "", note: "" }])} data-testid={`button-add-asset-${key}`}><Plus className="h-3 w-3" />Adicionar ativo</Button>
          <div className="flex flex-wrap gap-x-4" data-testid={`summary-assets-${key}`}>
            <span>Distribuído <b className="tnum">{r.ok ? `${r.percentSum.toFixed(2)}% = ${fmtEur(r.distributedCents / 100)}` : "—"}</b></span>
            <span>Não distribuído <b className="tnum">{r.ok ? `${r.remainingPercent.toFixed(2)}% = ${fmtEur(r.remainingCents / 100)}` : "—"}</b></span>
          </div>
          {!r.ok && <p className="font-medium text-destructive" role="alert" data-testid={`error-assets-${key}`}>{r.error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs" disabled={!r.ok || save.setAssets.isPending} onClick={submit} data-testid={`button-save-assets-${key}`}>Guardar ativos</Button>
          </div>
        </div>
      )}
    </div>
  );
}
