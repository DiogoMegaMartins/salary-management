import { useState } from "react";
import { ArchiveRestore, ArrowLeft, ChevronRight, Plus } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppState, useDerived, useSave } from "@/lib/app";
import { cn } from "@/lib/utils";
import type { Parcel } from "@shared/schema";
import { KINDS, fmtEur, fmtPct } from "@shared/calc";
import { PlatformPicker, CreateTypeDialog } from "@/components/catalogs";
import { ParcelDetail, parcelFigures, type ParcelTab } from "@/components/parcels/parcel-detail";

const PALETTE = ["#2f9e8f", "#3b7dd8", "#7a5cd0", "#c9a227", "#d97757", "#c2477f", "#2aa7c0", "#4b9c5c"];

export default function Parcels() {
  const { data, isLoading } = useAppState();
  const d = useDerived(data);
  const save = useSave();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<Parcel | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", kind: "investimento", color: PALETTE[0], typeId: null as number | null });
  const [draftPlatforms, setDraftPlatforms] = useState<number[]>([]);
  const [newTypeFor, setNewTypeFor] = useState<null | { parcelId: number | null }>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState<ParcelTab>("meta");
  const isMobile = useIsMobile();

  if (isLoading || !d || !data) {
    return (
      <AppShell title="Parcelas e metas" subtitle="A carregar…">
        <Skeleton className="h-[420px] rounded-lg" />
      </AppShell>
    );
  }

  const active = d.allParcels.filter((p) => !p.archived);
  const archived = d.allParcels.filter((p) => p.archived);
  const percentSum = active
    .filter((p) => p.defaultMode === "percentagem")
    .reduce((a, p) => a + p.defaultValue, 0);
  const fixedSum = active.filter((p) => p.defaultMode === "fixo").reduce((a, p) => a + p.defaultValue, 0);

  const sel = active.find((p) => p.id === selected) ?? (isMobile ? null : active[0] ?? null);
  const figures = (p: Parcel) => parcelFigures(data, d, p);
  const detail = sel && (
    <ParcelDetail
      fill={isMobile}
      state={data}
      d={d}
      parcel={sel}
      tab={tab}
      onTab={setTab}
      onNewType={() => setNewTypeFor({ parcelId: sel.id })}
      onDelete={() => setDeleting(sel)}
    />
  );
  const header = (p: Parcel) => (
    <div className="flex items-center gap-2">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} />
      <h2 className="min-w-0 truncate text-base font-semibold">{p.name}</h2>
    </div>
  );

  return (
    <AppShell
      title="Parcelas e metas"
      subtitle={
        percentSum === 0 && fixedSum === 0
          ? "Nenhuma parcela tem regra de divisão"
          : `Regras: ${fmtPct(percentSum / 100, 1)} do disponível · ${fmtEur(fixedSum)} fixos`
      }
      actions={
        <Button size="sm" className="gap-1.5" onClick={() => setAdding(true)} data-testid="button-new-parcel">
          <Plus className="h-4 w-4" />
          Nova parcela
        </Button>
      }
    >
      {percentSum > 100 && (
        <p className="mb-3 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive" data-testid="rules-over">
          A soma das percentagens passa dos 100% do disponível.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
        <div className="min-w-0 overflow-hidden rounded-lg border border-card-border bg-card" data-testid="parcels-list">
          {active.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Ainda não há parcelas. Cria a primeira com "Nova parcela".</p>
          ) : (
            <ul role="listbox" aria-label="Parcelas" className="divide-y divide-border/60">
              {active.map((p) => {
                const f = figures(p);
                const on = sel?.id === p.id;
                const platforms = (data.parcelPlatforms ?? []).filter((l) => l.parcelId === p.id).map((l) => data.platforms.find((x) => x.id === l.platformId)?.name).filter(Boolean);
                const subsN = (data.subgoals ?? []).filter((s) => s.parcelId === p.id).length;
                const rule = p.defaultValue > 0 ? (p.defaultMode === "percentagem" ? `${fmtPct(p.defaultValue / 100, 1)} do disp.` : `${fmtEur(p.defaultValue, 0)} fixo`) : "sem regra";
                const meta = [rule, platforms.length ? platforms.join(" · ") : null, subsN ? `${subsN} ${subsN === 1 ? "submeta" : "submetas"}` : null].filter(Boolean).join(" · ");
                return (
                  <li key={p.id} role="option" aria-selected={on}>
                    <button
                      type="button"
                      onClick={() => setSelected(p.id)}
                      className={cn(
                        "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-l-[3px] px-4 py-3 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_auto_8.5rem]",
                        on ? "border-l-primary bg-primary/6" : "border-l-transparent hover:bg-muted/50",
                      )}
                      data-testid={`card-parcel-${p.id}`}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-medium">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                          <span className="truncate">{p.name}</span>
                        </span>
                        <span className="block truncate pl-[18px] text-xs text-muted-foreground">{meta}</span>
                      </span>
                      <span className="tnum flex items-center justify-end gap-1 text-right text-sm font-medium" data-testid={`text-acc-${p.id}`}>
                        {p.kind === "gastos" && !f.target ? "—" : fmtEur(f.br.total)}
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground sm:hidden" aria-hidden="true" />
                      </span>
                      <span className="col-span-2 min-w-0 sm:col-span-1">
                        {f.target > 0 ? (
                          <>
                            <Progress value={f.pct * 100} className="h-1.5" />
                            <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                              {fmtPct(f.pct, 0)} de {fmtEur(f.target, 0)}{p.targetDate ? ` · até ${p.targetDate.split("-").reverse().join("/")}` : ""}
                            </span>
                          </>
                        ) : (
                          <span className="hidden text-xs text-muted-foreground sm:block">sem meta</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {archived.length > 0 && (
            <details className="border-t border-border px-4 py-3 text-sm" data-testid="parcels-archived">
              <summary className="cursor-pointer text-muted-foreground">Arquivadas ({archived.length})</summary>
              <ul className="mt-2 flex flex-wrap gap-2">
                {archived.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                    {p.name}
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Reativar" aria-label={`Reativar ${p.name}`} onClick={() => save.parcel.mutate({ id: p.id, patch: { archived: 0 } })}>
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">Usa "Aplicar regras das parcelas" no editor de cada mês para dividir o disponível com estas regras.</p>
        </div>

        {!isMobile && sel && (
          <section className="min-w-0 self-start rounded-lg border border-card-border bg-card p-4 lg:sticky lg:top-0" aria-label={`Detalhe de ${sel.name}`}>
            {header(sel)}
            <div className="mt-3">{detail}</div>
          </section>
        )}
      </div>

      {isMobile && (
        <Sheet open={!!sel} onOpenChange={(o) => !o && setSelected(null)}>
          <SheetContent side="bottom" className="flex h-dvh! max-h-dvh! flex-col gap-0 overflow-hidden rounded-none border-0 p-0 [&>button.absolute]:hidden" data-testid="sheet-parcel">
            <SheetHeader className="flex shrink-0 flex-row items-center gap-1 space-y-0 border-b border-border px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-left">
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => setSelected(null)} aria-label="Voltar às parcelas" data-testid="button-parcel-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <SheetTitle className="min-w-0 flex-1 truncate">{sel && header(sel)}</SheetTitle>
              <SheetDescription className="sr-only">Meta, submetas, histórico e definições da parcela</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 px-4">{detail}</div>
          </SheetContent>
        </Sheet>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova parcela</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ex.: Obrigações"
                aria-label="Nome da nova parcela"
                data-testid="input-new-parcel-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select
                value={draft.typeId ? `t:${draft.typeId}` : draft.kind}
                onValueChange={(v) => {
                  if (v === "__new__") return setNewTypeFor({ parcelId: null });
                  if (v.startsWith("t:")) {
                    const t = (data.parcelTypes ?? []).find((x) => x.id === Number(v.slice(2)));
                    setDraft({ ...draft, typeId: Number(v.slice(2)), kind: t?.baseKind ?? draft.kind });
                  } else setDraft({ ...draft, kind: v, typeId: null });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                  {(data.parcelTypes ?? []).filter((t) => !t.archived).map((t) => (
                    <SelectItem key={t.id} value={`t:${t.id}`}>{t.name}</SelectItem>
                  ))}
                  <SelectItem value="__new__">Criar tipo…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Plataformas</Label>
              <PlatformPicker state={data} value={draftPlatforms} onChange={setDraftPlatforms} testId="input-draft-platforms" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cor</Label>
              <div className="flex flex-wrap gap-1.5">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDraft({ ...draft, color: c })}
                    className={`h-11 w-11 shrink-0 rounded-full border-2 ${draft.color === c ? "border-foreground" : "border-transparent"}`}
                    aria-pressed={draft.color === c}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button
              disabled={!draft.name.trim()}
              data-testid="button-create-parcel"
              onClick={() => {
                save.createParcel.mutate(
                  { ...draft, platformIds: draftPlatforms, sortOrder: d.allParcels.length, defaultMode: "fixo", defaultValue: 0 } as any,
                  {
                    onSuccess: (created: any) => {
                      if (created?.id) { setSelected(created.id); setTab("definicoes"); }
                      toast({ title: "Parcela criada", description: draft.name });
                      setDraft({ name: "", kind: "investimento", color: PALETTE[0], typeId: null });
                      setDraftPlatforms([]);
                      setAdding(false);
                    },
                  },
                );
              }}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {newTypeFor && (
        <CreateTypeDialog
          kind="parcel"
          open
          onOpenChange={(o) => !o && setNewTypeFor(null)}
          onCreated={(t) => {
            if (newTypeFor.parcelId != null) save.parcel.mutate({ id: newTypeFor.parcelId, patch: { typeId: t.id } });
            else setDraft((dr) => ({ ...dr, typeId: t.id, kind: t.baseKind }));
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as alocações desta parcela são removidas do histórico. Se só queres deixar de a usar, arquiva-a.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleting) save.deleteParcel.mutate(deleting.id, { onError: (e: any) => toast({ title: "Não foi possível eliminar a parcela", description: e?.message, variant: "destructive" }) });
                setDeleting(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
