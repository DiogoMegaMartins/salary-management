import { useMemo, useState } from "react";
import { Archive, Pencil, Plus, Trash2, TrendingUp, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonthInput } from "@/components/month-input";
import { useConfirm } from "@/components/confirm";
import { useToast } from "@/hooks/use-toast";
import { useSave, type AppState, type Derived } from "@/lib/app";
import { PlatformPicker, errMsg } from "@/components/catalogs";
import { goalCtx } from "@/components/goal-panel";
import { ValuationDialog } from "@/components/valuations";
import { formatGoalMoney } from "@/components/dashboard-subgoals";
import { isValidDecimalDraft, parseDecimalDraft } from "@/components/months/number-field";
import { cn, localToday } from "@/lib/utils";
import { KINDS, fmtPct, goalBreakdown, monthKeyOf, parcelReturn } from "@shared/calc";
import type { Parcel, Subgoal } from "@shared/schema";
import { MovementDialog, type MovementTarget } from "./movement-dialog";
import { SubgoalDialog } from "./subgoal-dialog";

export type ParcelTab = "definicoes" | "meta" | "submetas" | "historico";
const fmtDate = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const fmtMonth = (ym: string) => ym.split("-").reverse().join("/");

/** Números de uma parcela usados na lista e no painel: acumulado, ritmo e valor de mercado. */
export function parcelFigures(state: AppState, d: Derived, p: Parcel) {
  const monthly = d.allComputed.map((x) => ({ key: monthKeyOf(x.month.year, x.month.month), amount: x.byParcel[p.id] ?? 0 }));
  const br = goalBreakdown(goalCtx(state, p, monthly), p.id);
  const recent = d.allComputed.slice(-3);
  const pace = recent.length ? recent.reduce((a, x) => a + (x.byParcel[p.id] ?? 0), 0) / recent.length : 0;
  const hist = d.allComputed.reduce((a, x) => a + (x.byParcel[p.id] ?? 0), 0);
  // como na Carteira: o que está para além do histórico (saldo inicial, ajustes, submetas) é a base
  const ret = parcelReturn(br.total - hist, d.allComputed, p.id, state.valuations ?? []);
  const target = p.targetAmount ?? 0;
  const missing = Math.max(0, target - br.total);
  return {
    br,
    pace,
    ret,
    target,
    pct: target > 0 ? Math.min(1, br.total / target) : 0,
    missing,
    monthsLeft: pace > 0 && missing > 0 ? Math.ceil(missing / pace) : null,
  };
}

function Row({ label, value, strong, className, testid }: { label: string; value: string; strong?: boolean; className?: string; testid?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1.5 text-sm", strong && "font-semibold", className)} data-testid={testid}>
      <span className="min-w-0">{label}</span>
      <span className="tnum shrink-0 text-right">{value}</span>
    </div>
  );
}

/** Campo de texto que guarda ao sair (ou com Enter), sem guardar a cada tecla. */
function BlurInput({ value, onSave, ...rest }: { value: string; onSave: (v: string) => void } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "onBlur">) {
  const [v, setV] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) { setSeen(value); setV(value); }
  return <Input {...rest} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />;
}

export function ParcelDetail({
  state,
  d,
  parcel: p,
  tab,
  onTab,
  onNewType,
  onDelete,
}: {
  state: AppState;
  d: Derived;
  parcel: Parcel;
  tab: ParcelTab;
  onTab: (t: ParcelTab) => void;
  onNewType: () => void;
  onDelete: () => void;
}) {
  const save = useSave();
  const { toast } = useToast();
  const { ask, dialog: confirmDialog } = useConfirm();
  const fail = (title: string) => (e: unknown) => toast({ title, description: errMsg(e), variant: "destructive" });
  const cur = p.currency || "EUR";
  const money = (n: number, c = cur) => formatGoalMoney(n, c);
  const f = useMemo(() => parcelFigures(state, d, p), [state, d, p]);
  const { br } = f;
  const subs = (state.subgoals ?? []).filter((s) => s.parcelId === p.id);
  const entries = (state.goalEntries ?? []).filter((e) => e.parcelId === p.id);
  const opening = entries.find((e) => e.kind === "inicial" && e.subgoalId == null) ?? null;
  const subName = (id: number | null) => (id == null ? "Meta principal" : subs.find((s) => s.id === id)?.name ?? "Submeta removida");

  const [movement, setMovement] = useState<{ subgoalId: number | null } | null>(null);
  const [valuing, setValuing] = useState(false);
  const [subDialog, setSubDialog] = useState<{ editing: Subgoal | null } | null>(null);
  const targets: MovementTarget[] = [
    { subgoalId: null, label: subs.length ? "Meta principal (não distribuído)" : "Meta principal", currency: cur, current: subs.length ? br.unallocated : br.total },
    ...br.subs.map((s) => ({ subgoalId: s.sub.id, label: s.sub.name, currency: s.sub.currency, current: s.balance })),
  ];

  return (
    <div className="min-w-0" data-testid={`parcel-detail-${p.id}`}>
      {confirmDialog}
      <Tabs value={tab} onValueChange={(v) => onTab(v as ParcelTab)}>
        <TabsList className="grid h-auto w-full grid-cols-4 gap-0.5 [&>button]:min-h-10 [&>button]:px-1 [&>button]:text-[13px] sm:[&>button]:px-3 sm:[&>button]:text-sm">
          <TabsTrigger value="meta" data-testid="tab-parcel-meta">Meta</TabsTrigger>
          <TabsTrigger value="submetas" data-testid="tab-parcel-submetas" className="gap-1">
            Submetas
            {subs.length > 0 && <span className="rounded-full bg-muted-foreground/15 px-1.5 text-[11px] leading-5" aria-label={`${subs.length} submetas`}>{subs.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="historico" data-testid="tab-parcel-historico">Histórico</TabsTrigger>
          <TabsTrigger value="definicoes" data-testid="tab-parcel-definicoes">Definições</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------------ Meta */}
        <TabsContent value="meta" className="space-y-4 pt-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Acumulado (o que puseste)</p>
              <p className="tnum text-2xl font-semibold" data-testid={`goal-total-${p.id}`}>{money(br.total)}</p>
            </div>
            {f.target > 0 && (
              <div className="text-right text-sm">
                <p className="text-xs text-muted-foreground">Meta</p>
                <p className="tnum">{money(f.target)}{p.targetDate ? ` · ${fmtMonth(p.targetDate)}` : ""}</p>
              </div>
            )}
          </div>
          {br.incomplete && <p className="text-xs text-destructive">Total incompleto: falta a taxa {br.missing.join(", ")}. Define-a em Submetas.</p>}
          {f.target > 0 && (
            <div>
              <Progress value={f.pct * 100} className="h-2" />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {fmtPct(f.pct, 0)} da meta
                {f.missing > 0 ? ` · faltam ${money(f.missing)}${f.monthsLeft ? ` · ~${f.monthsLeft} ${f.monthsLeft === 1 ? "mês" : "meses"} ao ritmo atual` : " · sem contribuições recentes"}` : " · concluída"}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 min-[420px]:flex min-[420px]:flex-wrap">
            <Button size="sm" className="min-h-11 gap-1.5 min-[420px]:min-h-9" onClick={() => setMovement({ subgoalId: null })} data-testid={`button-movement-${p.id}`}>
              <ArrowLeftRight className="h-3.5 w-3.5" />Registar entrada/saída
            </Button>
            {p.kind !== "gastos" && (
              <Button size="sm" variant="outline" className="min-h-11 gap-1.5 min-[420px]:min-h-9" onClick={() => setValuing(true)} data-testid={`button-market-${p.id}`}>
                <TrendingUp className="h-3.5 w-3.5" />Registar valor de mercado
              </Button>
            )}
          </div>
          <div className="divide-y divide-border/60 border-t border-border">
            {br.hasOpening && <Row label={`Saldo inicial (${fmtDate(opening!.date)})`} value={money(br.opening)} />}
            <Row label={br.hasOpening ? "Alocações dos meses desde o saldo inicial" : "Alocações dos meses"} value={money(br.flows)} />
            {br.txNet !== 0 && <Row label="Aportes e retiradas das Despesas" value={money(br.txNet)} />}
            {br.adjustments !== 0 && <Row label="Entradas e saídas fora dos meses" value={`${br.adjustments > 0 ? "+" : ""}${money(br.adjustments)}`} />}
            {subs.length > 0 && <Row label="Submetas (convertidas)" value={money(br.total - br.unallocated)} />}
            <Row label="Acumulado" value={money(br.total)} strong />
          </div>
          {f.ret.latest && (
            <div
              className={cn("rounded-md border p-3", f.ret.gain! > 0.004 ? "border-emerald-600/30 bg-emerald-500/5" : f.ret.gain! < -0.004 ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30")}
              data-testid={`market-${p.id}`}
            >
              <p className="text-xs text-muted-foreground">Valor de mercado em {fmtDate(f.ret.latest.date)}</p>
              <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="tnum text-lg font-semibold">{money(f.ret.latest.value)}</span>
                <span className={cn("tnum text-sm font-medium", f.ret.gain! > 0.004 ? "text-emerald-700 dark:text-emerald-400" : f.ret.gain! < -0.004 ? "text-destructive" : "text-muted-foreground")}>
                  {f.ret.gain! > 0.004 ? "Ganho " : f.ret.gain! < -0.004 ? "Perda " : "Sem ganho nem perda "}
                  {Math.abs(f.ret.gain!) > 0.004 ? `${f.ret.gain! > 0 ? "+" : "−"}${money(Math.abs(f.ret.gain!))}` : ""}
                </span>
              </div>
            </div>
          )}
          {f.ret.latest && <p className="text-[11px] text-muted-foreground">O ganho compara o valor de mercado com o que puseste até essa data. Não altera o acumulado.</p>}

          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`target-${p.id}`} className="text-xs text-muted-foreground">Meta ({cur})</Label>
              <BlurInput
                id={`target-${p.id}`}
                inputMode="decimal"
                placeholder="Sem meta"
                value={p.targetAmount != null ? String(p.targetAmount).replace(".", ",") : ""}
                onSave={(v) => {
                  const n = v.trim() === "" ? null : parseDecimalDraft(v);
                  if (v.trim() !== "" && (n == null || n < 0)) return toast({ title: "Meta inválida", description: "Usa um número (ex.: 15000) ou deixa vazio.", variant: "destructive" });
                  save.parcel.mutate({ id: p.id, patch: { targetAmount: n } });
                }}
                className="tnum h-9 text-sm"
                data-testid={`input-target-${p.id}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data alvo</Label>
              <MonthInput clearable aria-label="Data alvo" value={p.targetDate ?? ""} onChange={(v) => v !== (p.targetDate ?? "") && save.parcel.mutate({ id: p.id, patch: { targetDate: v || null } })} className="h-9 text-sm" data-testid={`input-target-date-${p.id}`} />
            </div>
          </div>

        </TabsContent>

        {/* -------------------------------------------------------------- Submetas */}
        <TabsContent value="submetas" className="space-y-3 pt-2">
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none py-1">O que são submetas?</summary>
            <p className="mt-1">
              Partes da parcela com saldo próprio: objetivos (ex.: Casa) ou o que está em cada plataforma (ex.: XTB). As alocações dos meses entram em "não distribuído"; usa "Transferir" para as passar para uma submeta.
            </p>
          </details>
          {br.subs.map((s) => {
            const platform = state.platforms.find((x) => x.id === s.sub.platformId);
            const rate = s.sub.currency !== cur ? latestRate(state, s.sub.currency, cur) : null;
            const full = subs.find((x) => x.id === s.sub.id)!;
            return (
              <div key={s.sub.id} className="space-y-2 rounded-md border border-border p-3" data-testid={`subgoal-${s.sub.id}`}>
                <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <p className="wrap-break-word font-medium">{s.sub.name}</p>
                    <p className="mt-0.5 flex flex-wrap gap-1 text-[11px]">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{platform ? `Plataforma · ${platform.name}` : "Objetivo"}</span>
                      {s.sub.currency !== cur && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{s.sub.currency}</span>}
                      {s.sub.deadline && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">até {fmtMonth(s.sub.deadline)}</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tnum font-semibold">{money(s.balance, s.sub.currency)}</p>
                    {s.sub.currency !== cur && s.converted != null && <p className="tnum text-xs text-muted-foreground">≈ {money(s.converted)}</p>}
                  </div>
                </div>
                {s.sub.target != null && s.sub.target > 0 && (
                  <>
                    <Progress value={(s.progress ?? 0) * 100} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">{Math.round((s.progress ?? 0) * 100)}% de {money(s.sub.target, s.sub.currency)} · faltam {money(s.remaining ?? 0, s.sub.currency)}</p>
                  </>
                )}
                {s.sub.currency !== cur && <RateLine state={state} from={s.sub.currency} to={cur} rate={rate} testid={`rate-${s.sub.id}`} />}
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-xs pointer-coarse:h-11" onClick={() => setMovement({ subgoalId: s.sub.id })} data-testid={`button-sub-movement-${s.sub.id}`}>
                    <ArrowLeftRight className="h-3 w-3" />Entrada/saída
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs pointer-coarse:h-11" onClick={() => setSubDialog({ editing: full })} data-testid={`button-edit-subgoal-${s.sub.id}`}>
                    <Pencil className="h-3 w-3" />Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 text-xs text-muted-foreground hover:text-destructive pointer-coarse:h-11"
                    data-testid={`button-delete-subgoal-${s.sub.id}`}
                    onClick={() => ask(`Eliminar a submeta "${s.sub.name}"?`, "Só é possível se não tiver entradas, saídas ou aportes atribuídos.").then((ok) => ok && save.deleteSubgoal.mutate(s.sub.id, { onError: fail("Não foi possível eliminar") }))}
                  >
                    <Trash2 className="h-3 w-3" />Eliminar
                  </Button>
                </div>
              </div>
            );
          })}
          {subs.length > 0 && <Row label="Não distribuído (meta principal)" value={money(br.unallocated)} className="text-muted-foreground" />}
          <Button size="sm" variant="outline" className="min-h-11 w-full gap-1.5 min-[420px]:min-h-9 min-[420px]:w-auto" onClick={() => setSubDialog({ editing: null })} data-testid={`button-new-subgoal-${p.id}`}>
            <Plus className="h-3.5 w-3.5" />Nova submeta
          </Button>
          {subs.length > 0 && <AssignContributions state={state} parcelId={p.id} cur={cur} subs={subs} />}
        </TabsContent>

        {/* ------------------------------------------------------------- Histórico */}
        <TabsContent value="historico" className="pt-2">
          <History state={state} parcelId={p.id} cur={cur} subName={subName} ask={ask} />
        </TabsContent>

        {/* ------------------------------------------------------------ Definições */}
        <TabsContent value="definicoes" className="space-y-4 pt-2">
          <div className="grid grid-cols-[auto_1fr] items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cor</Label>
              <input type="color" value={p.color} onChange={(e) => save.parcel.mutate({ id: p.id, patch: { color: e.target.value } })} className="block h-9 w-11 cursor-pointer rounded-sm border border-border bg-transparent p-0" aria-label={`Cor de ${p.name}`} data-testid={`input-color-${p.id}`} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`name-${p.id}`} className="text-xs text-muted-foreground">Nome</Label>
              <BlurInput id={`name-${p.id}`} value={p.name} onSave={(v) => v.trim() && save.parcel.mutate({ id: p.id, patch: { name: v.trim() } })} className="h-9 text-sm" data-testid={`input-name-${p.id}`} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select
                value={p.typeId ? `t:${p.typeId}` : p.kind}
                onValueChange={(v) => {
                  if (v === "__new__") return onNewType();
                  if (v.startsWith("t:")) save.parcel.mutate({ id: p.id, patch: { typeId: Number(v.slice(2)) } });
                  else save.parcel.mutate({ id: p.id, patch: { kind: v, typeId: null } });
                }}
              >
                <SelectTrigger className="h-9 text-sm" data-testid={`select-kind-${p.id}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                  {(state.parcelTypes ?? []).filter((t) => !t.archived || t.id === p.typeId).map((t) => (
                    <SelectItem key={t.id} value={`t:${t.id}`}>{t.name}{t.archived ? " (arquivado)" : ""}</SelectItem>
                  ))}
                  <SelectItem value="__new__">Criar tipo…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Regra de divisão por omissão</Label>
              <div className="flex gap-1.5">
                <Select value={p.defaultMode} onValueChange={(v) => save.parcel.mutate({ id: p.id, patch: { defaultMode: v } })}>
                  <SelectTrigger className="h-9 w-32 shrink-0 text-sm" aria-label={`Modo da regra de ${p.name}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixo">€ fixo</SelectItem>
                    <SelectItem value="percentagem">% do disponível</SelectItem>
                  </SelectContent>
                </Select>
                <BlurInput
                  inputMode="decimal"
                  value={String(p.defaultValue).replace(".", ",")}
                  onSave={(v) => {
                    const n = parseDecimalDraft(v);
                    if (n == null || n < 0) return toast({ title: "Valor inválido", variant: "destructive" });
                    save.parcel.mutate({ id: p.id, patch: { defaultValue: n } });
                  }}
                  className="tnum h-9 text-sm"
                  aria-label={`Valor da regra de alocação de ${p.name}`}
                  data-testid={`input-rule-${p.id}`}
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Plataformas</Label>
            <PlatformPicker
              state={state}
              value={(state.parcelPlatforms ?? []).filter((l) => l.parcelId === p.id).map((l) => l.platformId)}
              onChange={(ids) => save.parcel.mutate({ id: p.id, patch: { platformIds: ids } as any })}
              testId={`input-platforms-${p.id}`}
            />
          </div>
          <OpeningBalance parcelId={p.id} cur={cur} opening={opening} ask={ask} />
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => save.parcel.mutate({ id: p.id, patch: { archived: 1 } })} data-testid={`button-archive-parcel-${p.id}`}>
              <Archive className="h-3.5 w-3.5" />Arquivar
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={onDelete} data-testid={`button-delete-parcel-${p.id}`}>
              <Trash2 className="h-3.5 w-3.5" />Eliminar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Arquivar mantém o histórico e tira a parcela dos meses novos. Eliminar apaga também as alocações.</p>
        </TabsContent>
      </Tabs>

      <MovementDialog parcelId={p.id} targets={targets} initial={movement?.subgoalId ?? null} open={!!movement} onOpenChange={(o) => !o && setMovement(null)} />
      <ValuationDialog parcels={[p]} parcelId={p.id} open={valuing} onOpenChange={setValuing} />
      <SubgoalDialog state={state} parcelId={p.id} refCurrency={cur} editing={subDialog?.editing ?? null} open={!!subDialog} onOpenChange={(o) => !o && setSubDialog(null)} />
    </div>
  );
}

function latestRate(state: AppState, from: string, to: string) {
  const all = (state.fxRates ?? []).filter((r) => r.rate > 0 && ((r.fromCurrency === from && r.toCurrency === to) || (r.fromCurrency === to && r.toCurrency === from)));
  const r = all.sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!r) return null;
  return { date: r.date, value: r.fromCurrency === from ? r.rate : 1 / r.rate };
}

/** Taxa da moeda da submeta, mostrada junto dela, com forma de a atualizar. */
function RateLine({ state, from, to, rate, testid }: { state: AppState; from: string; to: string; rate: { date: string; value: number } | null; testid: string }) {
  const save = useSave();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState("");
  void state;
  const submit = () => {
    const n = parseDecimalDraft(v);
    if (n == null || n <= 0) return toast({ title: "A taxa tem de ser positiva", variant: "destructive" });
    save.createFxRate.mutate(
      { fromCurrency: from, toCurrency: to, rate: n, date: localToday() },
      { onSuccess: () => { setEditing(false); setV(""); toast({ title: "Taxa atualizada" }); }, onError: (e) => toast({ title: "Não foi possível guardar a taxa", description: errMsg(e), variant: "destructive" }) },
    );
  };
  return (
    <div className="text-xs" data-testid={testid}>
      {editing ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">1 {from} =</span>
          <Input autoFocus inputMode="decimal" value={v} onChange={(e) => isValidDecimalDraft(e.target.value) && setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className="tnum h-8 w-24 text-xs" aria-label={`Taxa ${from} para ${to}`} data-testid={`${testid}-input`} />
          <span className="text-muted-foreground">{to} (hoje)</span>
          <Button size="sm" className="h-8 text-xs" onClick={submit} data-testid={`${testid}-save`}>Guardar</Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditing(false)}>Cancelar</Button>
        </div>
      ) : rate ? (
        <p className="text-muted-foreground">
          Taxa: 1 {from} = {rate.value.toFixed(4).replace(".", ",")} {to} ({fmtDate(rate.date)}) ·{" "}
          <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => setEditing(true)}>atualizar</button>
        </p>
      ) : (
        <p className="text-amber-700 dark:text-amber-400">
          Sem taxa {from}→{to}: não entra no total.{" "}
          <button type="button" className="font-medium underline underline-offset-2" onClick={() => setEditing(true)} data-testid={`${testid}-set`}>Definir taxa</button>
        </p>
      )}
    </div>
  );
}

/** Saldo inicial da parcela: o que já lá tinhas antes de usares a app. */
function OpeningBalance({ parcelId, cur, opening, ask }: { parcelId: number; cur: string; opening: { id: number; amount: number; date: string } | null; ask: (t: string, d?: string) => Promise<boolean> }) {
  const save = useSave();
  const { toast } = useToast();
  const [v, setV] = useState(opening ? String(opening.amount).replace(".", ",") : "");
  const [date, setDate] = useState(opening?.date ?? localToday());
  const key = opening ? `${opening.id}:${opening.amount}:${opening.date}` : "none";
  const [seen, setSeen] = useState(key);
  if (seen !== key) { setSeen(key); setV(opening ? String(opening.amount).replace(".", ",") : ""); setDate(opening?.date ?? localToday()); }
  const n = parseDecimalDraft(v);
  const changed = opening ? n !== opening.amount || date !== opening.date : v.trim() !== "";
  return (
    <div className="space-y-1.5 rounded-md bg-muted/30 p-3" data-testid={`opening-${parcelId}`}>
      <Label className="text-xs font-semibold">Saldo inicial</Label>
      <p className="text-[11px] text-muted-foreground">O que a parcela já tinha antes desta data. A partir do mês da data, contam as alocações dos meses; as anteriores ficam incluídas neste saldo.</p>
      <div className="flex flex-wrap gap-1.5">
        <Input inputMode="decimal" value={v} onChange={(e) => isValidDecimalDraft(e.target.value) && setV(e.target.value)} placeholder={`Valor (${cur})`} aria-label="Saldo inicial" className="tnum h-9 min-w-0 flex-1 basis-28 text-sm" data-testid={`input-opening-${parcelId}`} />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data do saldo inicial" className="h-9 min-w-0 flex-1 basis-36 text-sm" />
        <Button
          size="sm"
          className="h-9"
          disabled={!changed || n == null || n < 0}
          data-testid={`button-save-opening-${parcelId}`}
          onClick={() =>
            (opening
              ? save.updateGoalEntry.mutateAsync({ id: opening.id, patch: { amount: n!, date } })
              : save.createGoalEntry.mutateAsync({ parcelId, subgoalId: null, kind: "inicial", amount: n!, date, note: "" })
            ).then(() => toast({ title: "Saldo inicial guardado" }), (e) => toast({ title: "Não foi possível guardar", description: errMsg(e), variant: "destructive" }))
          }
        >
          Guardar
        </Button>
        {opening && (
          <Button size="sm" variant="ghost" className="h-9 text-muted-foreground hover:text-destructive" onClick={() => ask("Remover o saldo inicial?", "O acumulado volta a contar todas as alocações dos meses.").then((ok) => ok && save.deleteGoalEntry.mutate(opening.id))}>
            Remover
          </Button>
        )}
      </div>
    </div>
  );
}

/** Entradas, saídas, saldos iniciais e valores de mercado desta parcela, do mais recente para o mais antigo. */
function History({ state, parcelId, cur, subName, ask }: { state: AppState; parcelId: number; cur: string; subName: (id: number | null) => string; ask: (t: string, d?: string) => Promise<boolean> }) {
  const save = useSave();
  const { toast } = useToast();
  const [editing, setEditing] = useState<number | null>(null);
  const [ee, setEe] = useState({ amount: "", date: "", note: "" });
  type Item = { key: string; date: string; title: string; where: string; amount: string; tone?: string; note?: string | null; entryId?: number; valuationId?: number };
  const items: Item[] = [
    ...(state.goalEntries ?? []).filter((e) => e.parcelId === parcelId).map((e) => ({
      key: `e${e.id}`,
      date: e.date,
      title: e.kind === "inicial" ? "Saldo inicial" : e.amount >= 0 ? "Entrada" : "Saída",
      where: subName(e.subgoalId),
      amount: `${e.kind === "ajuste" && e.amount > 0 ? "+" : e.amount < 0 ? "−" : ""}${formatGoalMoney(Math.abs(e.amount), e.currency || cur)}`,
      tone: e.kind === "ajuste" ? (e.amount >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive") : undefined,
      note: e.note,
      entryId: e.id,
    })),
    ...(state.valuations ?? []).filter((v) => v.parcelId === parcelId).map((v) => ({
      key: `v${v.id}`,
      date: v.date,
      title: "Valor de mercado",
      where: "não muda o acumulado",
      amount: formatGoalMoney(v.value, cur),
      note: v.note,
      valuationId: v.id,
    })),
  ].sort((a, b) => (a.date === b.date ? b.key.localeCompare(a.key) : b.date.localeCompare(a.date)));

  if (!items.length) return <p className="py-6 text-center text-xs text-muted-foreground">Ainda sem saldos, entradas, saídas ou valores de mercado. As alocações de cada mês estão em Meses.</p>;
  return (
    <ul className="divide-y divide-border/60 text-sm" data-testid={`history-${parcelId}`}>
      {items.map((it) => (
        <li key={it.key} className="py-2" data-testid={`history-item-${it.key}`}>
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium">{it.title}</span>
                <span className={cn("tnum font-medium", it.tone)}>{it.amount}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="tnum">{fmtDate(it.date)}</span> · {it.where}{it.note ? ` · ${it.note}` : ""}
              </p>
            </div>
            <div className="-my-1 flex shrink-0 items-center">
              {it.entryId != null && (
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 pointer-coarse:h-11 pointer-coarse:w-11" aria-label="Editar registo" data-testid={`button-edit-entry-${it.entryId}`}
                  onClick={() => {
                    const e = state.goalEntries.find((x) => x.id === it.entryId)!;
                    if (editing === e.id) return setEditing(null);
                    setEe({ amount: String(e.amount).replace(".", ","), date: e.date, note: e.note ?? "" });
                    setEditing(e.id);
                  }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive pointer-coarse:h-11 pointer-coarse:w-11" aria-label="Remover registo"
                onClick={() =>
                  ask("Remover este registo?").then((ok) => {
                    if (!ok) return;
                    if (it.entryId != null) save.deleteGoalEntry.mutate(it.entryId);
                    else if (it.valuationId != null) save.deleteValuation.mutate(it.valuationId);
                  })
                }>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {editing === it.entryId && it.entryId != null && (
            <div className="mt-2 flex flex-wrap gap-1.5 rounded-md bg-muted/30 p-2" data-testid={`form-edit-entry-${it.entryId}`}>
              <Input value={ee.amount} onChange={(e) => isValidDecimalDraft(e.target.value) && setEe({ ...ee, amount: e.target.value })} inputMode="decimal" aria-label="Valor (negativo para saída)" className="tnum h-8 w-28 text-xs" data-testid={`input-edit-entry-amount-${it.entryId}`} />
              <Input type="date" value={ee.date} onChange={(e) => setEe({ ...ee, date: e.target.value })} aria-label="Data" className="h-8 w-36 text-xs" />
              <Input value={ee.note} onChange={(e) => setEe({ ...ee, note: e.target.value })} placeholder="Nota" aria-label="Nota" className="h-8 min-w-0 flex-1 text-xs" />
              <Button size="sm" className="h-8 text-xs" data-testid={`button-save-entry-${it.entryId}`}
                onClick={() => {
                  const n = parseDecimalDraft(ee.amount);
                  if (n == null) return toast({ title: "Valor inválido", variant: "destructive" });
                  save.updateGoalEntry.mutate({ id: it.entryId!, patch: { amount: n, date: ee.date, note: ee.note } }, { onSuccess: () => setEditing(null), onError: (e) => toast({ title: "Não foi possível guardar", description: errMsg(e), variant: "destructive" }) });
                }}>
                Guardar
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Aportes e retiradas registados nas Despesas, para repartir pelas submetas. */
function AssignContributions({ state, parcelId, cur, subs }: { state: AppState; parcelId: number; cur: string; subs: Subgoal[] }) {
  const save = useSave();
  const { toast } = useToast();
  const [lk, setLk] = useState<Record<number, { sub: string; amount: string }>>({});
  const txs = state.transactions.filter((t) => t.parcelId === parcelId && (t.type === "contribution" || t.type === "withdrawal"));
  const own = subs.filter((s) => s.currency === cur);
  if (!txs.length || !own.length) return null;
  const subName = (id: number) => subs.find((s) => s.id === id)?.name ?? "—";
  return (
    <details className="rounded-md border border-border p-3 text-xs">
      <summary className="cursor-pointer font-medium">Repartir aportes e retiradas pelas submetas ({txs.length})</summary>
      <div className="mt-2 space-y-2">
        {txs.map((t) => {
          const links = (state.contributionLinks ?? []).filter((l) => l.transactionId === t.id);
          const used = links.reduce((a, l) => a + l.amount, 0);
          const f = lk[t.id] ?? { sub: "", amount: "" };
          return (
            <div key={t.id} className="space-y-1 border-b border-border/50 pb-2 last:border-0">
              <div className="flex gap-2"><span className="text-muted-foreground">{fmtDate(t.date)}</span><span>{t.type === "withdrawal" ? "Retirada" : "Aporte"} {formatGoalMoney(t.value, cur)}</span><span className="ml-auto text-muted-foreground">por repartir {formatGoalMoney(t.value - used, cur)}</span></div>
              {links.map((l) => (
                <div key={l.id} className="flex items-center gap-2 pl-3 text-muted-foreground">
                  <span className="min-w-0 flex-1">{subName(l.subgoalId)}: {formatGoalMoney(l.amount, cur)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Remover atribuição" onClick={() => save.deleteLink.mutate(l.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
              <div className="flex gap-1.5 pl-3">
                <Select value={f.sub} onValueChange={(v) => setLk({ ...lk, [t.id]: { ...f, sub: v } })}>
                  <SelectTrigger className="h-8 w-40 text-xs" aria-label="Submeta"><SelectValue placeholder="Submeta" /></SelectTrigger>
                  <SelectContent>{own.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={f.amount} onChange={(e) => isValidDecimalDraft(e.target.value) && setLk({ ...lk, [t.id]: { ...f, amount: e.target.value } })} placeholder="montante" inputMode="decimal" aria-label="Montante a atribuir" className="tnum h-8 w-24 text-xs" data-testid={`input-link-amount-${t.id}`} />
                <Button size="sm" className="h-8 text-xs" disabled={!f.sub || !f.amount} data-testid={`button-link-${t.id}`}
                  onClick={() => {
                    const n = parseDecimalDraft(f.amount);
                    if (n == null || n <= 0) return toast({ title: "Montante inválido", variant: "destructive" });
                    save.createLink.mutate({ transactionId: t.id, subgoalId: Number(f.sub), amount: n }, { onSuccess: () => setLk({ ...lk, [t.id]: { sub: f.sub, amount: "" } }), onError: (e) => toast({ title: "Não foi possível atribuir", description: errMsg(e), variant: "destructive" }) });
                  }}>
                  Atribuir
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
