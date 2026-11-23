import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAppState, useSave } from "@/lib/app";
import { errMsg } from "@/components/catalogs";
import { AssetsEditor } from "@/components/assets-editor";
import { distribute, convertLines, type DistLine, fmtEur } from "@shared/calc";
import { Plus } from "lucide-react";
import { isValidDecimalDraft, parseDecimalDraft, formatNumberForInput } from "@/components/months/number-field";

/* ------------------------------------------------------------------ EVO-03: distribuir por plataformas */

export function PlatformDistribution({
  monthId,
  parcelId,
  allocationId,
  total,
}: {
  monthId: number;
  parcelId: number;
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
      toast({ title: "Sem plataformas disponíveis", description: "Cria plataformas em Definições ou arquiva menos.", variant: "destructive" });
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

  if (!open) {
    return (
      <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid={`detail-${parcelId}`}>
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
              ? <> · <span className="font-medium text-amber-700 dark:text-amber-400">Por detalhar {fmtEur(savedResult.remainingCents / 100)}</span></>
              : <> · <span className="font-medium text-primary">✔ Detalhe completo</span></>}
          </span>
        )}
        {saved.length > 0 && !savedResult.ok && (
          <span className="text-xs font-medium text-destructive" role="alert">Excede o total da parcela: corrige o detalhe.</span>
        )}
      </div>
      {allocationId != null && savedResult.ok && saved.map((l, i) => (
        <AssetsEditor key={l.platformId} monthId={monthId} parcelId={parcelId} allocationId={allocationId} platformId={l.platformId} platformName={nameOf(l.platformId)} amount={(savedResult.amountsCents[i] ?? 0) / 100} />
      ))}
      </>
    );
  }

  return (
    <div className="platform-panel ml-5 space-y-2 rounded-lg border border-border bg-muted/20 p-3" data-testid={`panel-distribute-${parcelId}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold">Detalhar {fmtEur(total)} por plataformas</p>
        <Select
          value={mode}
          onValueChange={(v) => {
            setLines(convertLines(total, lines, v as any));
            setRev((x) => x + 1);
          }}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="Modo da distribuição" data-testid={`select-dist-mode-${parcelId}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fixo">Por valor (€)</SelectItem>
            <SelectItem value="percentagem">Por percentagem</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {lines.length === 0 && (
        <p className="text-xs text-muted-foreground">Sem linhas: o valor fica integralmente na parcela.</p>
      )}
      {lines.map((l, i) => (
        <div key={`${l.platformId}-${rev}`} className="platform-row grid grid-cols-[minmax(0,1fr)_100px_90px_44px] items-center gap-2">
          <Select value={String(l.platformId)} onValueChange={(v) => patchLine(i, { platformId: Number(v) })}>
            <SelectTrigger className="h-8 text-xs" aria-label="Plataforma" data-testid={`select-dist-platform-${parcelId}-${i}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {usable(l.platformId).map((x) => (
                <SelectItem key={x.id} value={String(x.id)}>
                  {x.name}
                  {x.archived ? " (arquivada)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="text"
            inputMode="decimal"
            aria-label={mode === "fixo" ? "Valor em euros" : "Percentagem"}
            defaultValue={formatNumberForInput(l.value)}
            onChange={(e) => {
              if (!isValidDecimalDraft(e.target.value)) e.target.value = e.target.value.slice(0, -1);
            }}
            onBlur={(e) => {
              const parsed = e.target.value === "" ? 0 : parseDecimalDraft(e.target.value);
              const v = parsed === null ? l.value : Math.max(0, parsed);
              e.target.value = formatNumberForInput(v);
              patchLine(i, { value: v });
            }}
            className="tnum h-8 text-xs"
            data-testid={`input-dist-value-${parcelId}-${i}`}
          />
          <span className="tnum text-right text-xs text-muted-foreground">
            {mode === "percentagem"
              ? fmtEur((r.amountsCents[i] ?? 0) / 100)
              : `${pctOf(r.amountsCents[i] ?? 0).toFixed(1)}%`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            aria-label="Remover linha"
            onClick={() => {
              setLines(lines.filter((_, k) => k !== i));
              setRev((x) => x + 1);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={addLine} data-testid={`button-add-dist-line-${parcelId}`}>
        <Plus className="h-3 w-3" />
        Adicionar plataforma
      </Button>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" data-testid={`summary-dist-${parcelId}`}>
        <span>Distribuído <b className="tnum">{fmtEur(r.distributedCents / 100)}</b></span>
        <span>Restante <b className={`tnum ${r.remainingCents < 0 ? "text-destructive" : ""}`}>{fmtEur(r.remainingCents / 100)}</b></span>
        <span>Total <b className="tnum">{fmtEur(total)}</b></span>
        {mode === "percentagem" && lines.length > 0 && <span>{r.percentSum.toFixed(2)}% distribuído</span>}
      </div>
      {!r.ok && (
        <p className="text-xs font-medium text-destructive" role="alert" data-testid={`error-dist-${parcelId}`}>
          {r.error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button size="sm" className="h-8 text-xs" disabled={!r.ok || save.setDistribution.isPending} onClick={submit} data-testid={`button-save-dist-${parcelId}`}>
          Guardar detalhe
        </Button>
      </div>
    </div>
  );
}
