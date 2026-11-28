import { useMemo, useState } from "react";
import { Plus, Scale, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAppState, useSave } from "@/lib/app";
import { errMsg } from "@/components/catalogs";
import { AssetsEditor, Donut, Slider } from "@/components/assets-editor";
import { NumberInput } from "@/components/number-input";
import { distribute, convertLines, equalParts, type DistLine, fmtEur } from "@shared/calc";

/** Cores das plataformas (a mesma plataforma tem sempre a mesma cor dentro de uma parcela). */
const PALETTE = ["#2a64b8", "#7a5bd0", "#2c9c8d", "#d97b57", "#c9a227", "#cc4f7e", "#4a8f3c", "#6b7a8c"];
const colorOf = (i: number) => PALETTE[i % PALETTE.length];

/** Barra com uma fatia por plataforma; o que falta detalhar fica a cinzento. */
function SplitBar({ parts, total }: { parts: { cents: number; color: string; label: string }[]; total: number }) {
  const t = Math.max(1, Math.round(total * 100));
  return (
    <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={parts.map((p) => `${p.label} ${fmtEur(p.cents / 100)}`).join(", ") || "Sem detalhe"}>
      {parts.map((p, i) => <span key={i} style={{ width: `${Math.min(100, (Math.max(0, p.cents) / t) * 100)}%`, background: p.color }} />)}
    </div>
  );
}

/**
 * Detalhe de uma parcela por plataforma (EVO-03). No cartão da parcela vê-se só um resumo. «Detalhar» abre uma janela com
 * o anel e o que falta à esquerda e, à direita, uma linha por plataforma (valor, cursor e ativos). Reparte-se por valor
 * (€) ou por percentagem, e os ativos de cada plataforma abrem noutra janela.
 */
export function PlatformDistribution({
  monthId, parcelId, parcelName, allocationId, total,
}: {
  monthId: number; parcelId: number; parcelName?: string; allocationId: number | null; total: number;
}) {
  const { data } = useAppState();
  const save = useSave();
  const { toast } = useToast();
  const saved = useMemo(() => (data?.allocationPlatforms ?? []).filter((l) => l.allocationId === allocationId), [data, allocationId]);
  const savedLines: DistLine[] = saved.map((l) => ({ platformId: l.platformId, mode: l.mode as any, value: l.value }));
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<DistLine[]>([]);
  const platforms = data?.platforms ?? [];
  const nameOf = (id: number) => platforms.find((x) => x.id === id)?.name ?? "—";
  const savedResult = distribute(total, savedLines);
  const mode: "fixo" | "percentagem" = lines[0]?.mode ?? savedLines[0]?.mode ?? "fixo";
  const r = distribute(total, lines);
  const totalCents = Math.max(1, Math.round(total * 100));
  const pctOf = (cents: number) => (cents / totalCents) * 100;
  const assetCount = (platformId: number) => (data?.allocationAssets ?? []).filter((x) => x.allocationId === allocationId && x.platformId === platformId).length;

  const begin = () => { setLines(savedLines.map((l) => ({ ...l }))); setOpen(true); };
  const usable = (current: number) => platforms.filter((x) => (!x.archived || x.id === current) && (x.id === current || !lines.some((l) => l.platformId === x.id)));
  const addLine = () => {
    const free = platforms.find((x) => !x.archived && !lines.some((l) => l.platformId === x.id));
    if (!free) { toast({ title: "Sem plataformas disponíveis", description: "Cria plataformas em Organizar › Plataformas ou arquiva menos.", variant: "destructive" }); return; }
    setLines([...lines, { platformId: free.id, mode, value: 0 }]);
  };
  const patchLine = (i: number, patch: Partial<DistLine>) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const switchMode = (m: "fixo" | "percentagem") => { if (m !== mode) setLines(convertLines(total, lines, m)); };
  const equalise = () => {
    if (lines.length === 0) return;
    const parts = equalParts(mode === "fixo" ? total : 100, lines.length, 2);
    setLines(lines.map((l, i) => ({ ...l, value: parts[i] })));
  };
  const fillRest = (i: number) => {
    if (r.remainingCents <= 0) return;
    patchLine(i, { value: mode === "fixo" ? Math.round((lines[i].value + r.remainingCents / 100) * 100) / 100 : Math.round((lines[i].value + (r.remainingCents / totalCents) * 100) * 100) / 100 });
  };

  const submit = (after?: () => void) => {
    save.setDistribution.mutate({ monthId, parcelId, lines }, {
      onSuccess: () => {
        if (after) { setTimeout(after, 80); return; } // guardou para poder abrir os ativos: a janela fica aberta
        toast({ title: lines.length ? "Detalhe guardado" : "Detalhe removido", description: "Planeamento apenas: saldos e movimentos não foram alterados." });
        setOpen(false);
      },
      onError: (e) => toast({ title: "Não foi possível guardar", description: errMsg(e), variant: "destructive" }),
    });
  };
  // os ativos dependem do montante guardado de cada plataforma: se a linha mudou, guarda primeiro e só depois abre
  const sameAsSaved = (l: DistLine) => savedLines.some((s) => s.platformId === l.platformId && s.mode === l.mode && Math.abs(s.value - l.value) < 0.005) && savedLines.length === lines.length;
  const withAssets = (l: DistLine) => (go: () => void) => {
    if (!r.ok) { toast({ title: "Corrige o detalhe primeiro", description: r.error, variant: "destructive" }); return; }
    if (sameAsSaved(l)) go(); else submit(go);
  };

  const savedParts = saved.map((l, i) => ({ cents: savedResult.ok ? savedResult.amountsCents[i] ?? 0 : 0, color: colorOf(i), label: nameOf(l.platformId) }));
  const donutParts = lines.map((_, i) => ({ pct: r.ok ? pctOf(r.amountsCents[i] ?? 0) : 0, color: colorOf(i) }));
  const sliderStep = mode === "percentagem" ? 0.5 : total >= 1000 ? 5 : total >= 100 ? 1 : 0.5;
  const remainingUnits = mode === "fixo" ? r.remainingCents / 100 : (r.remainingCents / totalCents) * 100;

  return (
    <>
      {/* resumo no cartão da parcela */}
      <div className="space-y-2" data-testid={`detail-${parcelId}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs font-semibold text-primary" onClick={begin} disabled={allocationId == null}
            title={allocationId == null ? "Guarda a divisão do mês primeiro" : undefined} data-testid={`button-distribute-${parcelId}`}>
            {saved.length ? `Detalhe por plataforma (${saved.length})` : "＋ Detalhar por plataforma"}
          </Button>
          {saved.length > 0 && savedResult.ok && (
            <span className="text-xs text-muted-foreground" data-testid={`detail-status-${parcelId}`}>
              {saved.map((l) => nameOf(l.platformId)).join(" · ")}
              {savedResult.remainingCents > 0
                ? <> · <span className="font-medium text-warning">Por detalhar {fmtEur(savedResult.remainingCents / 100)}</span></>
                : <> · <span className="font-medium text-success">✔ Detalhe completo</span></>}
            </span>
          )}
          {saved.length > 0 && !savedResult.ok && <span className="text-xs font-medium text-destructive" role="alert">Excede o total da parcela: corrige o detalhe.</span>}
        </div>
        {saved.length > 0 && savedResult.ok && (
          <>
            <SplitBar parts={savedParts} total={total} />
            <ul className="flex flex-wrap gap-1.5 text-[11px]">
              {saved.map((l, i) => (
                <li key={l.platformId} className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: colorOf(i) }} aria-hidden />
                  {nameOf(l.platformId)} <span className="tnum text-muted-foreground">{fmtEur((savedResult.amountsCents[i] ?? 0) / 100)}</span>
                  {assetCount(l.platformId) > 0 && <span className="text-muted-foreground">· {assetCount(l.platformId)} {assetCount(l.platformId) === 1 ? "ativo" : "ativos"}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* janela de edição */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex flex-col gap-0 p-0 sm:rounded-2xl" data-testid={`panel-distribute-${parcelId}`}
          // inline: o CSS global das janelas (sem camada) limita a largura e a altura e ganharia às classes
          style={{ width: "min(62rem, calc(100dvw - 1rem))", maxWidth: "calc(100dvw - 1rem)", maxHeight: "calc(100dvh - 1rem)", overflow: "hidden" }}
        >
          <DialogHeader className="space-y-1 border-b border-border p-5 pr-14 text-left">
            <DialogTitle>Detalhar {parcelName ?? "parcela"} · {fmtEur(total)}</DialogTitle>
            <DialogDescription>Por plataforma e, dentro de cada uma, por ativo. É planeamento: não cria movimentos nem altera saldos.</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="flex flex-col gap-5 md:flex-row">
              {/* resumo sempre à vista */}
              <div className="flex shrink-0 flex-col items-stretch gap-3 md:w-56" data-testid={`summary-dist-${parcelId}`}>
                <div className="hidden justify-center md:flex">
                  <Donut size={170} parts={donutParts} center={fmtEur(r.distributedCents / 100)} sub="distribuído" />
                </div>
                <div className="md:hidden"><SplitBar parts={lines.map((l, i) => ({ cents: r.ok ? r.amountsCents[i] ?? 0 : 0, color: colorOf(i), label: nameOf(l.platformId) }))} total={total} /></div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm md:flex-col md:items-center md:gap-0.5">
                  <span>Distribuído <b className="tnum">{fmtEur(r.distributedCents / 100)}</b></span>
                  <span>Restante <b className={`tnum ${r.remainingCents < 0 ? "text-destructive" : r.remainingCents === 0 && lines.length > 0 ? "text-success" : ""}`}>{fmtEur(r.remainingCents / 100)}</b></span>
                  {mode === "percentagem" && lines.length > 0 && <span className="text-xs text-muted-foreground">{r.percentSum.toFixed(2)} % distribuído</span>}
                </div>
                {!r.ok && <p className="text-center text-xs font-medium text-destructive" role="alert" data-testid={`error-dist-${parcelId}`}>{r.error}</p>}
                <div className="flex overflow-hidden rounded-md border text-xs" role="radiogroup" aria-label="Repartir por" data-testid={`select-dist-mode-${parcelId}`}>
                  {([["fixo", "Valor (€)"], ["percentagem", "Percentagem"]] as const).map(([m, label]) => (
                    <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => switchMode(m)} data-testid={`mode-dist-${parcelId}-${m}`}
                      className={`min-h-9 flex-1 px-2.5 pointer-coarse:min-h-11 ${mode === m ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>{label}</button>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="min-h-9 gap-1.5" onClick={equalise} disabled={lines.length < 2} data-testid={`button-equalise-${parcelId}`}>
                  <Scale className="h-4 w-4" aria-hidden />Dividir igualmente
                </Button>
              </div>

              {/* uma linha por plataforma */}
              <div className="min-w-0 flex-1 space-y-2.5">
                {lines.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    Sem plataformas: o valor fica integralmente na parcela. Carrega em «Adicionar plataforma» para o repartir.
                  </p>
                )}
                {lines.map((l, i) => {
                  const savedIdx = savedResult.ok ? saved.findIndex((s) => s.platformId === l.platformId) : -1;
                  const amount = r.ok ? (r.amountsCents[i] ?? 0) / 100 : 0;
                  return (
                    <section key={`${l.platformId}-${i}`} className="space-y-1.5 rounded-xl border border-card-border bg-card p-3" aria-label={nameOf(l.platformId)} data-testid={`dist-line-${parcelId}-${i}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colorOf(i) }} aria-hidden />
                        <Select value={String(l.platformId)} onValueChange={(v) => patchLine(i, { platformId: Number(v) })}>
                          <SelectTrigger className="h-10 min-w-0 flex-1 basis-40 text-sm" aria-label="Plataforma" data-testid={`select-dist-platform-${parcelId}-${i}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {usable(l.platformId).map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.name}{x.archived ? " (arquivada)" : ""}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <NumberInput value={l.value} onCommit={(v) => patchLine(i, { value: v })} label={`${mode === "fixo" ? "Valor em euros" : "Percentagem"} de ${nameOf(l.platformId)}`} className="h-10 w-24 text-sm" testId={`input-dist-value-${parcelId}-${i}`} />
                        <span className="w-4 text-sm text-muted-foreground">{mode === "fixo" ? "€" : "%"}</span>
                        {allocationId != null && (
                          <AssetsEditor
                            monthId={monthId} parcelId={parcelId} allocationId={allocationId} platformId={l.platformId} platformName={nameOf(l.platformId)}
                            amount={savedIdx >= 0 && savedResult.ok ? (savedResult.amountsCents[savedIdx] ?? 0) / 100 : amount}
                            disabledReason={amount <= 0 ? "Indica primeiro um valor para esta plataforma" : null}
                            beforeOpen={withAssets(l)}
                          />
                        )}
                        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Remover ${nameOf(l.platformId)}`} onClick={() => setLines(lines.filter((_, k) => k !== i))}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <div className="min-w-[10rem] flex-1 basis-full sm:basis-0"><Slider value={l.value} scale={mode === "fixo" ? total : 100} limit={l.value + Math.max(0, remainingUnits)} step={sliderStep} onChange={(v) => patchLine(i, { value: Math.round(v * 100) / 100 })} label={`Cursor de ${nameOf(l.platformId)}`} color={colorOf(i)} /></div>
                        <span className="tnum ml-auto text-xs text-muted-foreground sm:w-36 sm:shrink-0 sm:text-right">
                          {mode === "percentagem" ? fmtEur(amount) : `${pctOf(r.amountsCents[i] ?? 0).toFixed(1)} % da parcela`}
                        </span>
                        {r.remainingCents > 0 && (
                          <button type="button" onClick={() => fillRest(i)} className="shrink-0 text-xs font-medium text-primary hover:underline" title="Põe nesta plataforma o que falta distribuir">+ restante</button>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row flex-wrap items-center gap-2 border-t border-border bg-background p-4 sm:space-x-0">
            <Button variant="outline" className="min-h-10 gap-1.5" onClick={addLine} data-testid={`button-add-dist-line-${parcelId}`}><Plus className="h-4 w-4" aria-hidden />Adicionar plataforma</Button>
            <span className="flex-1" />
            <Button variant="ghost" className="min-h-10" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="min-h-10" disabled={!r.ok || save.setDistribution.isPending} onClick={() => submit()} data-testid={`button-save-dist-${parcelId}`}>Guardar detalhe</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
