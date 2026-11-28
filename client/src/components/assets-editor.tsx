import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, Scale, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NumberInput } from "@/components/number-input";
import { useToast } from "@/hooks/use-toast";
import { useAppState, useSave } from "@/lib/app";
import { errMsg } from "@/components/catalogs";
import { assetPercentsFromValues, assetValuesFromPercents, distributeAssets, equalParts, fmtEur, type AssetLine } from "@shared/calc";

const PALETTE = ["#2a64b8", "#7a5bd0", "#2c9c8d", "#d97b57", "#c9a227", "#cc4f7e", "#4a8f3c", "#6b7a8c"];
const color = (i: number) => PALETTE[i % PALETTE.length];
type Row = { name: string; value: number; note: string };
type Mode = "valor" | "percentagem";
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Anel com a percentagem distribuída (e o que falta a cinzento). */
export function Donut({ parts, center, sub, size = 150 }: { parts: { pct: number; color: string }[]; center: string; sub?: string; size?: number }) {
  let acc = 0;
  const stops = parts.filter((p) => p.pct > 0).map((p) => { const a = acc; acc += Math.min(100 - a, p.pct); return `${p.color} ${a}% ${acc}%`; });
  const bg = stops.length ? `conic-gradient(${stops.join(", ")}, hsl(var(--muted)) ${acc}% 100%)` : "hsl(var(--muted))";
  const inner = Math.round(size * 0.66);
  return (
    <div className="grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: bg }} aria-hidden>
      <div className="grid place-items-center rounded-full bg-background text-center" style={{ width: inner, height: inner }}>
        <div><div className="tnum text-base font-semibold leading-tight">{center}</div>{sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}</div>
      </div>
    </div>
  );
}

/**
 * Cursor numa escala fixa (0 a `scale`, a mesma em todas as linhas) que não deixa passar de `limit`
 * (o valor da linha mais o que falta distribuir). Devolve o número já dentro do limite.
 */
export function Slider({ value, scale, limit, step, onChange, label, color: c }: { value: number; scale: number; limit: number; step: number; onChange: (v: number) => void; label: string; color: string }) {
  const max = Math.max(step, scale);
  const pct = Math.min(100, (Math.max(0, value) / max) * 100);
  return (
    <input
      type="range" min={0} max={max} step={step} value={Math.min(value, max)} aria-label={label}
      onChange={(e) => onChange(Math.min(Number(e.target.value), Math.max(0, limit)))}
      className="sm-range w-full min-w-0 cursor-pointer"
      style={{ ["--range-color" as string]: c, backgroundImage: `linear-gradient(to right, ${c} ${pct}%, hsl(var(--muted)) ${pct}%)` }}
    />
  );
}

/**
 * Ativos de uma plataforma: uma linha na janela da plataforma ("3 ativos ▸") que abre esta janela, onde se reparte o
 * montante da plataforma por ativos ou classes, por valor (€) ou por percentagem. A base guarda sempre percentagens.
 */
export function AssetsEditor({ monthId, parcelId, allocationId, platformId, platformName, amount, disabledReason, beforeOpen }: {
  monthId: number; parcelId: number; allocationId: number; platformId: number; platformName: string; amount: number;
  disabledReason?: string | null; beforeOpen?: (go: () => void) => void;
}) {
  const { data } = useAppState();
  const save = useSave();
  const { toast } = useToast();
  const saved = useMemo(
    () => (data?.allocationAssets ?? []).filter((x) => x.allocationId === allocationId && x.platformId === platformId).sort((a, b) => a.position - b.position),
    [data, allocationId, platformId],
  );
  const savedR = distributeAssets(amount, saved.map((x) => ({ name: x.name, percent: x.percent })));
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("valor");
  const [rows, setRows] = useState<Row[]>([]);
  const [rev, setRev] = useState(0);
  const key = `${parcelId}-${platformId}`;
  const total = Math.round(amount * 100) / 100;

  const begin = () => setOpen(true);
  // as linhas arrancam do que está guardado quando a janela abre (com os dados já atualizados)
  useEffect(() => {
    if (!open) return;
    setRows(saved.map((x, i) => ({ name: x.name, value: savedR.ok ? (savedR.amountsCents[i] ?? 0) / 100 : 0, note: x.note })));
    setMode("valor");
    setRev((n) => n + 1);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // percentagens que a base vai guardar: em modo valor vêm dos valores (soma acumulada); em modo percentagem, são o valor tal e qual
  const percents = mode === "percentagem" ? rows.map((r) => r.value) : assetPercentsFromValues(total, rows.map((r) => r.value));
  const lines: AssetLine[] = rows.map((r, i) => ({ name: r.name, percent: percents[i], note: r.note }));
  const r = distributeAssets(total, lines);
  const euros = assetValuesFromPercents(total, percents);
  const pctSum = r.ok ? r.percentSum : percents.reduce((a, b) => a + b, 0);
  const patch = (i: number, p: Partial<Row>) => setRows(rows.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const used = mode === "valor" ? rows.reduce((a, x) => a + x.value, 0) : pctSum;
  const left = mode === "valor" ? Math.round((total - used) * 100) / 100 : r4(100 - used);
  const unit = mode === "valor" ? "€" : "%";

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    if (m === "percentagem") setRows(rows.map((x, i) => ({ ...x, value: percents[i] })));
    else setRows(rows.map((x, i) => ({ ...x, value: euros[i] })));
    setMode(m);
    setRev((n) => n + 1);
  };
  const step = mode === "valor" ? (total >= 1000 ? 5 : total >= 100 ? 1 : 0.5) : 0.5;
  const round = (v: number) => (mode === "valor" ? Math.round(v * 100) / 100 : r4(v));
  const addRow = () => setRows([...rows, { name: "", value: 0, note: "" }]);
  const addOthers = () => {
    if (left <= 0) return;
    const i = rows.findIndex((x) => x.name.trim().toLowerCase() === "outros");
    if (i >= 0) patch(i, { value: round(rows[i].value + left) });
    else setRows([...rows, { name: "Outros", value: round(left), note: "" }]);
    setRev((n) => n + 1);
  };
  const equalise = () => {
    if (rows.length === 0) return;
    setRows(rows.map((x, i) => ({ ...x, value: equalParts(mode === "valor" ? total : 100, rows.length, mode === "valor" ? 2 : 4)[i] })));
    setRev((n) => n + 1);
  };
  const submit = () =>
    save.setAssets.mutate(
      { monthId, parcelId, platformId, lines },
      {
        onSuccess: () => { toast({ title: "Ativos guardados", description: "Planeamento apenas: não cria compras nem posições na carteira." }); setOpen(false); },
        onError: (e) => toast({ title: "Não foi possível guardar", description: errMsg(e), variant: "destructive" }),
      },
    );
  const label = saved.length === 0 ? "Sem ativos" : `${saved.length} ${saved.length === 1 ? "ativo" : "ativos"}`;
  const incompleteSaved = saved.length > 0 && savedR.remainingCents > 0;

  return (
    <>
      <button
        type="button" disabled={!!disabledReason} title={disabledReason ?? `Ativos de ${platformName}`}
        onClick={() => (beforeOpen ? beforeOpen(begin) : begin())}
        className={`inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-background px-3 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11 ${incompleteSaved ? "text-warning" : "text-primary"}`}
        data-testid={`button-assets-${key}`} aria-label={`Ativos de ${platformName}: ${label}`}
      >
        {label}{incompleteSaved ? ` · faltam ${savedR.remainingPercent.toFixed(1)} %` : ""}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex flex-col gap-0 p-0 sm:rounded-2xl" data-testid={`assets-${key}`}
          style={{ width: "min(46rem, calc(100dvw - 1rem))", maxWidth: "calc(100dvw - 1rem)", maxHeight: "calc(100dvh - 1rem)", overflow: "hidden" }}
        >
          <DialogHeader className="space-y-1 border-b border-border p-5 pr-14 text-left">
            <DialogTitle>Ativos de {platformName}</DialogTitle>
            <DialogDescription>{fmtEur(total)} nesta plataforma, repartidos por ativos ou classes. É planeamento: não cria compras nem posições.</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="flex shrink-0 flex-col items-center gap-3 sm:w-44" data-testid={`summary-assets-${key}`}>
                <Donut size={132} parts={rows.map((_, i) => ({ pct: percents[i] || 0, color: color(i) }))} center={`${(pctSum || 0).toFixed(pctSum % 1 ? 1 : 0)} %`} sub="distribuído" />
                <p className="text-center text-xs text-muted-foreground">
                  {r.ok
                    ? <>Distribuído <b className="tnum text-foreground">{fmtEur(r.distributedCents / 100)}</b><br />Por distribuir <b className={`tnum ${r.remainingCents === 0 ? "text-success" : "text-foreground"}`}>{fmtEur(r.remainingCents / 100)}</b></>
                    : "—"}
                </p>
                <div className="flex overflow-hidden rounded-md border text-xs" role="radiogroup" aria-label="Repartir por">
                  {([["valor", "Valor (€)"], ["percentagem", "Percentagem"]] as const).map(([m, l]) => (
                    <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => switchMode(m)} data-testid={`mode-assets-${key}-${m}`}
                      className={`min-h-9 px-2.5 pointer-coarse:min-h-11 ${mode === m ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>{l}</button>
                  ))}
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-2.5">
                {rows.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Sem ativos: o montante fica todo na plataforma. Adiciona o primeiro ativo.</p>}
                {rows.map((x, i) => (
                  <div key={`${i}-${rev}`} className="space-y-1.5 rounded-xl border border-card-border bg-card p-3" data-testid={`asset-row-${key}-${i}`}>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color(i) }} aria-hidden />
                      <Input value={x.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="Ativo ou classe" aria-label="Nome do ativo" className="h-10 min-w-0 flex-1 text-sm" data-testid={`input-asset-name-${key}-${i}`} />
                      <NumberInput value={x.value} onCommit={(v) => patch(i, { value: round(v) })} label={`${mode === "valor" ? "Valor em euros" : "Percentagem"} de ${x.name || "ativo"}`} decimals={mode === "valor" ? 2 : 4} className="h-10 w-24 text-sm" testId={`input-asset-pct-${key}-${i}`} />
                      <span className="w-4 text-sm text-muted-foreground">{unit}</span>
                      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Remover ${x.name || "ativo"}`} onClick={() => { setRows(rows.filter((_, k) => k !== i)); setRev((n) => n + 1); }}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <div className="min-w-[10rem] flex-1 basis-full sm:basis-0"><Slider value={x.value} scale={mode === "valor" ? total : 100} limit={x.value + left} step={step} onChange={(v) => patch(i, { value: round(v) })} label={`Cursor de ${x.name || "ativo"}`} color={color(i)} /></div>
                      <span className="tnum ml-auto text-xs text-muted-foreground sm:w-28 sm:shrink-0 sm:text-right">{mode === "valor" ? `${(percents[i] || 0).toFixed(1)} %` : fmtEur(euros[i] || 0)}</span>
                    </div>
                    <Input value={x.note} onChange={(e) => patch(i, { note: e.target.value })} placeholder="Nota (opcional)" aria-label={`Nota de ${x.name || "ativo"}`} className="h-8 text-xs" />
                  </div>
                ))}
                {!r.ok && <p className="text-sm font-medium text-destructive" role="alert" data-testid={`error-assets-${key}`}>{r.error}</p>}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row flex-wrap items-center gap-2 border-t border-border bg-background p-4 sm:space-x-0">
            <Button variant="outline" className="min-h-10 gap-1.5" onClick={addRow} data-testid={`button-add-asset-${key}`}><Plus className="h-4 w-4" aria-hidden />Adicionar ativo</Button>
            <Button variant="ghost" className="min-h-10 gap-1.5" onClick={equalise} disabled={rows.length < 2}><Scale className="h-4 w-4" aria-hidden />Dividir igualmente</Button>
            <Button variant="ghost" className="min-h-10" onClick={addOthers} disabled={left <= 0} title="Põe o que falta numa linha «Outros»">Completar com «Outros»</Button>
            <span className="flex-1" />
            <Button variant="ghost" className="min-h-10" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="min-h-10" disabled={!r.ok || save.setAssets.isPending} onClick={submit} data-testid={`button-save-assets-${key}`}>Guardar ativos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
