import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useAppState, useSave } from "@/lib/app";
import { errMsg } from "@/components/catalogs";
import { AssetsEditor } from "@/components/assets-editor";
import { distribute, convertLines, type DistLine, fmtEur } from "@shared/calc";
import { isValidDecimalDraft, parseDecimalDraft, formatNumberForInput } from "@/components/months/number-field";

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
 * Detalhe de uma parcela por plataforma e por ativo (EVO-03). No cartão da parcela vê-se só um resumo; para editar abre-se
 * um painel lateral só com essa parcela: o que falta distribuir fica sempre à vista no topo, cada plataforma é um bloco e
 * os ativos de cada uma abrem dentro dele.
 */
export function PlatformDistribution({
  monthId,
  parcelId,
  parcelName,
  allocationId,
  total,
}: {
  monthId: number;
  parcelId: number;
  parcelName?: string;
  allocationId: number | null;
  total: number;
}) {
  const { data } = useAppState();
  const save = useSave();
  const { toast } = useToast();
  const saved = useMemo(
    () => (data?.allocationPlatforms ?? []).filter((l) => l.allocationId === allocationId),
    [data, allocationId],
  );
  const savedLines: DistLine[] = saved.map((l) => ({ platformId: l.platformId, mode: l.mode as any, value: l.value }));
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<DistLine[]>([]);
  const [rev, setRev] = useState(0); // força remontar os inputs de texto
  const platforms = data?.platforms ?? [];
  const nameOf = (id: number) => platforms.find((x) => x.id === id)?.name ?? "—";
  const savedResult = distribute(total, savedLines);
  const mode: "fixo" | "percentagem" = lines[0]?.mode ?? savedLines[0]?.mode ?? "fixo";
  const r = distribute(total, lines);
  const pctOf = (cents: number) => (total > 0 ? (cents / Math.max(1, Math.round(total * 100))) * 100 : 0);
  const assetCount = (platformId: number) => (data?.allocationAssets ?? []).filter((x) => x.allocationId === allocationId && x.platformId === platformId).length;

  const begin = () => {
    setLines(savedLines.map((l) => ({ ...l })));
    setRev((x) => x + 1);
    setOpen(true);
  };
  const usable = (current: number) =>
    platforms.filter((x) => (!x.archived || x.id === current) && (x.id === current || !lines.some((l) => l.platformId === x.id)));
  const addLine = () => {
    const free = platforms.find((x) => !x.archived && !lines.some((l) => l.platformId === x.id));
    if (!free) {
      toast({ title: "Sem plataformas disponíveis", description: "Cria plataformas em Organizar › Plataformas ou arquiva menos.", variant: "destructive" });
      return;
    }
    setLines([...lines, { platformId: free.id, mode, value: 0 }]);
  };
  const patchLine = (i: number, patch: Partial<DistLine>) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  const submit = () => {
    save.setDistribution.mutate(
      { monthId, parcelId, lines },
      {
        onSuccess: () => {
          toast({ title: lines.length ? "Detalhe guardado" : "Detalhe removido", description: "Planeamento apenas: saldos e movimentos não foram alterados." });
          setOpen(false);
        },
        onError: (e) => toast({ title: "Não foi possível guardar", description: errMsg(e), variant: "destructive" }),
      },
    );
  };

  const savedParts = saved.map((l, i) => ({ cents: savedResult.ok ? savedResult.amountsCents[i] ?? 0 : 0, color: colorOf(i), label: nameOf(l.platformId) }));

  return (
    <>
      {/* resumo no cartão da parcela */}
      <div className="space-y-2" data-testid={`detail-${parcelId}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-xs font-semibold text-primary"
            onClick={begin}
            disabled={allocationId == null}
            title={allocationId == null ? "Guarda a divisão do mês primeiro" : undefined}
            data-testid={`button-distribute-${parcelId}`}
          >
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
          {saved.length > 0 && !savedResult.ok && (
            <span className="text-xs font-medium text-destructive" role="alert">Excede o total da parcela: corrige o detalhe.</span>
          )}
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

      {/* painel de edição */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right" className="flex flex-col gap-0 p-0" data-testid={`panel-distribute-${parcelId}`}
          // inline: o CSS global dos painéis (sem camada) limita a largura e a altura e ganharia às classes
          style={{ width: "min(36rem, 100dvw)", maxWidth: "100dvw", maxHeight: "none", height: "100dvh", overflowY: "hidden" }}
        >
          <SheetHeader className="space-y-1 border-b border-border p-5 pr-14">
            <SheetTitle>Detalhar {parcelName ?? "parcela"}</SheetTitle>
            <SheetDescription>{fmtEur(total)} por plataforma e por ativo. É planeamento: não cria movimentos nem altera saldos.</SheetDescription>
          </SheetHeader>

          {/* resumo sempre à vista */}
          <div className="space-y-2.5 border-b border-border bg-muted/30 px-5 py-3" data-testid={`summary-dist-${parcelId}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
              <span>Distribuído <b className="tnum">{fmtEur(r.distributedCents / 100)}</b></span>
              <span>Restante <b className={`tnum ${r.remainingCents < 0 ? "text-destructive" : r.remainingCents === 0 && lines.length > 0 ? "text-success" : ""}`}>{fmtEur(r.remainingCents / 100)}</b></span>
              {mode === "percentagem" && lines.length > 0 && <span className="text-xs text-muted-foreground">{r.percentSum.toFixed(2)} % distribuído</span>}
            </div>
            <SplitBar parts={lines.map((l, i) => ({ cents: r.ok ? r.amountsCents[i] ?? 0 : 0, color: colorOf(i), label: nameOf(l.platformId) }))} total={total} />
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Repartir</span>
              <div className="flex overflow-hidden rounded-md border" role="radiogroup" aria-label="Modo da distribuição" data-testid={`select-dist-mode-${parcelId}`}>
                {([["fixo", "Por valor (€)"], ["percentagem", "Por percentagem"]] as const).map(([m, label]) => (
                  <button
                    key={m} type="button" role="radio" aria-checked={mode === m}
                    onClick={() => { if (m !== mode) { setLines(convertLines(total, lines, m)); setRev((x) => x + 1); } }}
                    className={`min-h-9 px-3 pointer-coarse:min-h-11 ${mode === m ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                    data-testid={`mode-dist-${parcelId}-${m}`}
                  >{label}</button>
                ))}
              </div>
            </div>
            {!r.ok && (
              <p className="text-xs font-medium text-destructive" role="alert" data-testid={`error-dist-${parcelId}`}>{r.error}</p>
            )}
          </div>

          {/* uma plataforma por bloco */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
            {lines.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Sem plataformas: o valor fica integralmente na parcela. Carrega em «Adicionar plataforma» para o repartir.
              </p>
            )}
            {lines.map((l, i) => {
              const savedHere = savedResult.ok ? saved.findIndex((s) => s.platformId === l.platformId) : -1;
              return (
                <section key={`${l.platformId}-${rev}`} className="space-y-2.5 rounded-2xl border border-card-border bg-card p-3.5" aria-label={nameOf(l.platformId)} data-testid={`dist-line-${parcelId}-${i}`}>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colorOf(i) }} aria-hidden />
                    <Select value={String(l.platformId)} onValueChange={(v) => patchLine(i, { platformId: Number(v) })}>
                      <SelectTrigger className="h-10 min-w-0 flex-1 text-sm" aria-label="Plataforma" data-testid={`select-dist-platform-${parcelId}-${i}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {usable(l.platformId).map((x) => (
                          <SelectItem key={x.id} value={String(x.id)}>{x.name}{x.archived ? " (arquivada)" : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remover ${nameOf(l.platformId)}`}
                      onClick={() => { setLines(lines.filter((_, k) => k !== i)); setRev((x) => x + 1); }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      aria-label={mode === "fixo" ? `Valor em euros de ${nameOf(l.platformId)}` : `Percentagem de ${nameOf(l.platformId)}`}
                      defaultValue={formatNumberForInput(l.value)}
                      onChange={(e) => { if (!isValidDecimalDraft(e.target.value)) e.target.value = e.target.value.slice(0, -1); }}
                      onBlur={(e) => {
                        const parsed = e.target.value === "" ? 0 : parseDecimalDraft(e.target.value);
                        const v = parsed === null ? l.value : Math.max(0, parsed);
                        e.target.value = formatNumberForInput(v);
                        patchLine(i, { value: v });
                      }}
                      className="tnum h-10 w-28 text-right text-sm"
                      data-testid={`input-dist-value-${parcelId}-${i}`}
                    />
                    <span className="text-sm text-muted-foreground">{mode === "fixo" ? "€" : "%"}</span>
                    <span className="tnum ml-auto text-sm font-medium">
                      {mode === "percentagem" ? fmtEur((r.amountsCents[i] ?? 0) / 100) : `${pctOf(r.amountsCents[i] ?? 0).toFixed(1)} % da parcela`}
                    </span>
                  </div>
                  {savedHere >= 0 && allocationId != null && (
                    <AssetsEditor
                      monthId={monthId} parcelId={parcelId} allocationId={allocationId} platformId={l.platformId}
                      platformName={nameOf(l.platformId)} amount={(savedResult.ok ? savedResult.amountsCents[savedHere] ?? 0 : 0) / 100}
                    />
                  )}
                  {savedHere < 0 && (
                    <p className="border-t border-border/70 pt-2 text-xs text-muted-foreground">Guarda o detalhe para poderes indicar os ativos desta plataforma.</p>
                  )}
                </section>
              );
            })}
          </div>

          <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t border-border bg-background p-4 sm:space-x-0">
            <Button variant="outline" className="min-h-10 gap-1.5" onClick={addLine} data-testid={`button-add-dist-line-${parcelId}`}>
              <Plus className="h-4 w-4" aria-hidden />
              Adicionar plataforma
            </Button>
            <span className="flex-1" />
            <Button variant="ghost" className="min-h-10" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="min-h-10" disabled={!r.ok || save.setDistribution.isPending} onClick={submit} data-testid={`button-save-dist-${parcelId}`}>
              Guardar detalhe
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
