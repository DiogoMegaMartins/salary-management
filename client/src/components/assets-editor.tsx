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

/**
 * Distribuição opcional por ativos/classes dentro de uma plataforma: nome, % e nota. O valor é sempre derivado.
 * Vive dentro do painel de detalhe de cada parcela: fechado mostra um resumo numa linha; aberto, uma linha por ativo.
 */
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
  const summary = saved.length === 0
    ? "Sem ativos"
    : savedR.remainingCents > 0
      ? `${saved.length} ${saved.length === 1 ? "ativo" : "ativos"} · faltam ${savedR.remainingPercent.toFixed(1)} %`
      : `${saved.length} ${saved.length === 1 ? "ativo" : "ativos"} · 100 %`;

  return (
    <div className="border-t border-border/70 pt-2 text-xs" data-testid={`assets-${key}`}>
      <button type="button" onClick={() => (open ? setOpen(false) : begin())} aria-expanded={open} className="flex min-h-9 w-full items-center gap-1.5 text-left font-medium text-muted-foreground hover:text-foreground pointer-coarse:min-h-11" data-testid={`button-assets-${key}`}>
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />}
        <span>Ativos de {platformName}</span>
        <span className={`ml-auto font-normal ${!open && saved.length > 0 && savedR.remainingCents > 0 ? "text-warning" : ""}`}>{summary}</span>
      </button>
      {!open && saved.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1.5 pl-5">
          {saved.map((x, i) => (
            <li key={x.id} className="tnum rounded-full border border-border bg-background px-2 py-0.5 text-[11px]" title={x.note || undefined}>
              {x.name} · {x.percent} % · {fmtEur((savedR.amountsCents[i] ?? 0) / 100)}
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div className="mt-1.5 space-y-2 pl-1">
          {rows.length === 0 && <p className="text-muted-foreground">Sem linhas: o montante fica todo na plataforma.</p>}
          {rows.map((x, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border border-border/70 bg-background p-2">
              <div className="flex items-center gap-1.5">
                <Input value={x.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="Ativo ou classe" aria-label="Nome do ativo" className="h-9 min-w-0 flex-1 text-sm" data-testid={`input-asset-name-${key}-${i}`} />
                <Input value={x.percent} onChange={(e) => patch(i, { percent: e.target.value })} inputMode="decimal" placeholder="%" aria-label="Percentagem" className="tnum h-9 w-16 text-right text-sm" data-testid={`input-asset-pct-${key}-${i}`} />
                <span className="tnum w-20 shrink-0 text-right text-muted-foreground" aria-label="Valor calculado">{fmtEur((r.amountsCents[i] ?? 0) / 100)}</span>
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" aria-label="Remover ativo" onClick={() => setRows(rows.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" aria-hidden /></Button>
              </div>
              <Input value={x.note} onChange={(e) => patch(i, { note: e.target.value })} placeholder="Nota (opcional)" aria-label="Nota" className="h-8 text-xs" />
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-9 gap-1 text-xs" onClick={() => setRows([...rows, { name: "", percent: "", note: "" }])} data-testid={`button-add-asset-${key}`}><Plus className="h-3.5 w-3.5" aria-hidden />Adicionar ativo</Button>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5" data-testid={`summary-assets-${key}`}>
            <span>Distribuído <b className="tnum">{r.ok ? `${r.percentSum.toFixed(2)}% = ${fmtEur(r.distributedCents / 100)}` : "—"}</b></span>
            <span>Não distribuído <b className="tnum">{r.ok ? `${r.remainingPercent.toFixed(2)}% = ${fmtEur(r.remainingCents / 100)}` : "—"}</b></span>
          </div>
          {!r.ok && <p className="font-medium text-destructive" role="alert" data-testid={`error-assets-${key}`}>{r.error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" className="h-9 text-xs" disabled={!r.ok || save.setAssets.isPending} onClick={submit} data-testid={`button-save-assets-${key}`}>Guardar ativos</Button>
          </div>
        </div>
      )}
    </div>
  );
}
