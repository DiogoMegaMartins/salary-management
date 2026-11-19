import { useState } from "react";
import { Archive, ArchiveRestore, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout";
import { SectionCard } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useAppState, useDerived, useSave } from "@/lib/app";
import type { Parcel } from "@shared/schema";
import { KINDS, fmtEur, fmtPct, goalBreakdown, monthKeyOf } from "@shared/calc";
import { EditableSectionGrid, type SectionSpec } from "@/components/editable-section-grid";
import { usePageLayout } from "@/lib/page-layout";
import { PlatformPicker, CreateTypeDialog } from "@/components/catalogs";
import { GoalPanel, goalCtx } from "@/components/goal-panel";
import { ClearableDateInput } from "@/components/clearable-date-input";

function ParcelTargetDate({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) { setSeen(value); setV(value); }
  return <ClearableDateInput type="month" aria-label="Data alvo" value={v} onChange={setV} onBlur={(x) => { if (x !== value) onSave(x); }} onClear={() => onSave("")} className="h-8 text-xs" />;
}

const PALETTE = ["#2f9e8f", "#3b7dd8", "#7a5cd0", "#c9a227", "#d97757", "#c2477f", "#2aa7c0", "#4b9c5c"];

export default function Parcels() {
  const { data, isLoading } = useAppState();
  const d = useDerived(data);
  const save = useSave();
  const pageLayout = usePageLayout(data?.settings ?? ({} as any), "parcelas");
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<Parcel | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", kind: "investimento", color: PALETTE[0], typeId: null as number | null });
  const [draftPlatforms, setDraftPlatforms] = useState<number[]>([]);
  const [newTypeFor, setNewTypeFor] = useState<null | { parcelId: number | null }>(null);

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

  const monthlyOf = (id: number) => d.allComputed.map((x) => ({ key: monthKeyOf(x.month.year, x.month.month), amount: x.byParcel[id] ?? 0 }));
  // acumulado = histórico atual quando não há saldo inicial/ajustes/submetas (saldos existentes preservados)
  const accOf = (id: number) => {
    const p = d.allParcels.find((x) => x.id === id);
    return p ? goalBreakdown(goalCtx(data, p, monthlyOf(id)), id).total : 0;
  };
  const paceOf = (id: number) => {
    const recent = d.allComputed.slice(-3);
    return recent.length ? recent.reduce((a, x) => a + (x.byParcel[id] ?? 0), 0) / recent.length : 0;
  };

  return (
    <AppShell
      title="Parcelas e metas"
      subtitle="Regras de divisão, plataformas e objetivos por parcela"
      actions={
        <Button size="sm" className="gap-1.5" onClick={() => setAdding(true)} data-testid="button-new-parcel">
          <Plus className="h-4 w-4" />
          Nova parcela
        </Button>
      }
    >
      <div className="space-y-4">
        {(() => {
          const parcelSections: SectionSpec[] = active.map((p, idx) => {
            const acc = accOf(p.id);
            const pace = paceOf(p.id);
            const target = p.targetAmount ?? 0;
            const pct = target > 0 ? Math.min(1, acc / target) : 0;
            const missing = Math.max(0, target - acc);
            const monthsLeft = pace > 0 && missing > 0 ? Math.ceil(missing / pace) : null;
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            return {
              id: `parcel-${p.id}`,
              title: p.name,
              defaultLayout: { x: col * 6, y: 3 + row * 12, w: 6, h: 12 },
              node: (
                <div className="parcel-card flex h-full min-w-0 flex-col overflow-y-auto rounded-lg border border-card-border bg-card p-4 [.grid-widget_&]:h-full" data-testid={`card-parcel-${p.id}`}>
                  <div className="parcel-heading flex items-start gap-2">
                    <input
                      type="color"
                      value={p.color}
                      onChange={(e) => save.parcel.mutate({ id: p.id, patch: { color: e.target.value } })}
                      className="mt-0.5 h-11 w-11 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
                      aria-label={`Cor de ${p.name}`}
                      title="Cor"
                      data-testid={`input-color-${p.id}`}
                    />
                    <Input
                      defaultValue={p.name}
                      aria-label={`Nome da parcela ${p.name}`}
                      onBlur={(e) => e.target.value !== p.name && save.parcel.mutate({ id: p.id, patch: { name: e.target.value } })}
                      className="h-8 flex-1 border-transparent bg-transparent px-1 text-sm font-semibold hover:border-border focus:border-border"
                      data-testid={`input-name-${p.id}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      title="Arquivar"
                      aria-label={`Arquivar ${p.name}`}
                      onClick={() => save.parcel.mutate({ id: p.id, patch: { archived: 1 } })}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      title="Eliminar"
                      aria-label={`Eliminar ${p.name}`}
                      onClick={() => setDeleting(p)}
                      data-testid={`button-delete-parcel-${p.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="parcel-fields mt-3 grid gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Tipo</Label>
                      <Select
                        value={p.typeId ? `t:${p.typeId}` : p.kind}
                        onValueChange={(v) => {
                          if (v === "__new__") return setNewTypeFor({ parcelId: p.id });
                          if (v.startsWith("t:")) save.parcel.mutate({ id: p.id, patch: { typeId: Number(v.slice(2)) } });
                          else save.parcel.mutate({ id: p.id, patch: { kind: v, typeId: null } });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`select-kind-${p.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {KINDS.map((k) => (
                            <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                          ))}
                          {(data.parcelTypes ?? [])
                            .filter((t) => !t.archived || t.id === p.typeId)
                            .map((t) => (
                              <SelectItem key={t.id} value={`t:${t.id}`}>{t.name}{t.archived ? " (arquivado)" : ""}</SelectItem>
                            ))}
                          <SelectItem value="__new__">Criar tipo…</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Regra por omissão</Label>
                      <div className="flex gap-1.5">
                        <Select
                          value={p.defaultMode}
                          onValueChange={(v) => save.parcel.mutate({ id: p.id, patch: { defaultMode: v } })}
                        >
                          <SelectTrigger className="h-8 w-[104px] shrink-0 text-xs" aria-label={`Modo da regra de ${p.name}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixo">€ fixo</SelectItem>
                            <SelectItem value="percentagem">% disp.</SelectItem>

                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step={0.01}
                          defaultValue={p.defaultValue}
                          onBlur={(e) =>
                            Number(e.target.value) !== p.defaultValue &&
                            save.parcel.mutate({ id: p.id, patch: { defaultValue: Number(e.target.value) } })
                          }
                          className="tnum h-8 text-xs"
                          aria-label={`Valor da regra de alocação de ${p.name}`}
                          data-testid={`input-rule-${p.id}`}
                        />
                      </div>
                    </div>
                    <div className="col-span-full space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Plataformas</Label>
                      <PlatformPicker
                        state={data}
                        value={(data.parcelPlatforms ?? []).filter((l) => l.parcelId === p.id).map((l) => l.platformId)}
                        onChange={(ids) => save.parcel.mutate({ id: p.id, patch: { platformIds: ids } as any })}
                        testId={`input-platforms-${p.id}`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Meta (€)</Label>
                      <Input
                        type="number"
                        step={100}
                        defaultValue={p.targetAmount ?? ""}
                        placeholder="sem meta"
                        onBlur={(e) =>
                          save.parcel.mutate({
                            id: p.id,
                            patch: { targetAmount: e.target.value === "" ? null : Number(e.target.value) },
                          })
                        }
                        className="tnum h-8 text-xs"
                        aria-label={`Meta de ${p.name} (€)`}
                        data-testid={`input-target-${p.id}`}
                      />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Data alvo</Label>
                      <ParcelTargetDate value={p.targetDate ?? ""} onSave={(v) => save.parcel.mutate({ id: p.id, patch: { targetDate: v || null } })} />
                    </div>
                  </div>

                  <div className="mt-3 border-t border-border pt-3">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground">Acumulado no histórico</span>
                      <span className="tnum font-semibold" data-testid={`text-acc-${p.id}`}>{fmtEur(acc)}</span>
                    </div>
                    {target > 0 && (
                      <>
                        <Progress value={pct * 100} className="mt-2 h-2" />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {fmtPct(pct, 0)} da meta de {fmtEur(target, 0)}
                          {missing > 0
                            ? monthsLeft
                              ? ` · ~${monthsLeft} ${monthsLeft === 1 ? "mês" : "meses"} ao ritmo atual`
                              : " · sem contribuições recentes"
                            : " · concluída"}
                        </p>
                      </>
                    )}
                  </div>
                  <GoalPanel state={data} parcel={p} monthly={monthlyOf(p.id)} />
                </div>
              ),
            };
          });

          const archivedSection: SectionSpec[] =
            archived.length > 0
              ? [
                  {
                    id: "arquivadas",
                    title: "Arquivadas",
                    defaultLayout: { x: 0, y: 3 + Math.ceil(active.length / 2) * 12, w: 12, h: 8 },
                    node: (
                      <SectionCard title="Arquivadas" description="Mantêm o histórico mas não aparecem em novos meses">
                        <div className="flex flex-wrap gap-2">
                          {archived.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
                            >
                              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                              {p.name}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                title="Reativar"
                                onClick={() => save.parcel.mutate({ id: p.id, patch: { archived: 0 } })}
                              >
                                <ArchiveRestore className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </SectionCard>
                    ),
                  },
                ]
              : [];

          const rulesSection: SectionSpec = {
            id: "regras-omissao",
            title: "Regras por omissão",
            minH: 2,
            defaultLayout: { x: 0, y: 0, w: 12, h: 3 },
            node: (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-card-border bg-card px-4 py-3 text-xs">
          <span className="text-muted-foreground">Regras por omissão:</span>
          <Badge variant="secondary" className="tnum">
            {fmtPct(percentSum / 100, 1)} do disponível
          </Badge>
          <Badge variant="secondary" className="tnum">
            {fmtEur(fixedSum)} fixos
          </Badge>
          {percentSum > 100 && (
            <span className="text-destructive">A soma das percentagens passa dos 100% do disponível.</span>
          )}
          <span className="ml-auto text-muted-foreground">
            Usa “Aplicar regras das parcelas” no editor de cada mês para preencher automaticamente.
          </span>
        </div>
            ),
          };
          const sections: SectionSpec[] = [rulesSection, ...parcelSections, ...archivedSection];

          return (
            <EditableSectionGrid
              pageKey="parcelas"
              sections={sections}
              savedLayout={pageLayout.savedLayout}
              isSaving={pageLayout.isSaving}
              onSave={pageLayout.onSave}
            />
          );
        })()}
      </div>

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
                    onSuccess: () => {
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
