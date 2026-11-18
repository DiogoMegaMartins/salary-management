import { localToday } from "@/lib/utils";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClearableDateInput } from "@/components/clearable-date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/confirm";
import { useToast } from "@/hooks/use-toast";
import { useSave, type AppState } from "@/lib/app";
import { errMsg } from "@/components/catalogs";
import { fmtEur, goalBreakdown, monthKeyOf, type GoalBreakdown } from "@shared/calc";
import type { Parcel } from "@shared/schema";

const today = () => localToday();
/** Aceita "1250,5" e "1250.5"; devolve null se inválido (nunca converte em silêncio para 0). */
const num = (s: string): number | null => {
  const t = s.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
};
const money = (n: number, cur: string) => (cur === "EUR" ? fmtEur(n) : `${n.toFixed(2).replace(".", ",")} ${cur}`);

export function goalCtx(state: AppState, parcel: Parcel, monthly: { key: number; amount: number }[]) {
  return {
    monthly,
    entries: state.goalEntries ?? [],
    subgoals: state.subgoals ?? [],
    links: state.contributionLinks ?? [],
    rates: state.fxRates ?? [],
    transactions: state.transactions,
    refCurrency: parcel.currency || "EUR",
  } as any;
}

/** Acumulado de uma meta (histórico + saldo inicial + ajustes + submetas): fonte única para Painel, Parcelas e Orçamento. */
export function goalTotalOf(state: AppState, parcel: Parcel, allComputed: { month: { year: number; month: number }; byParcel: Record<number, number> }[]): number {
  const monthly = allComputed.map((x) => ({ key: monthKeyOf(x.month.year, x.month.month), amount: x.byParcel[parcel.id] ?? 0 }));
  return goalBreakdown(goalCtx(state, parcel, monthly), parcel.id).total;
}

/** Formulário comum a metas e submetas: saldo inicial, ajuste ou total corrigido. */
function EntryForm({ parcelId, subgoalId, currentTotal, currency }: { parcelId: number; subgoalId: number | null; currentTotal: number; currency: string }) {
  const save = useSave();
  const { toast } = useToast();
  const [kind, setKind] = useState("ajuste");
  const [val, setVal] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const submit = () => {
    const n = num(val);
    if (n == null) return toast({ title: "Valor inválido", description: "Introduz um número (ex.: 1250,50).", variant: "destructive" });
    let amount = n;
    let k = kind;
    if (kind === "corrigir") {
      amount = Math.round((n - currentTotal) * 100) / 100;
      k = "ajuste";
      if (amount === 0) return toast({ title: "Sem diferença", description: "O total corrigido é igual ao atual." });
    }
    save.createGoalEntry.mutate(
      { parcelId, subgoalId, kind: k, amount, date, note: kind === "corrigir" ? note || `Correção do total para ${n}` : note },
      {
        onSuccess: () => {
          setVal("");
          setNote("");
          toast({ title: k === "inicial" ? "Saldo inicial definido" : `Ajuste de ${amount > 0 ? "+" : ""}${amount.toFixed(2)} ${currency} registado` });
        },
        onError: (e) => toast({ title: "Não foi possível guardar", description: errMsg(e), variant: "destructive" }),
      },
    );
  };
  return (
    <div className="responsive-form">
      <Select value={kind} onValueChange={setKind}>
        <SelectTrigger className="h-8 text-xs" aria-label="Operação"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ajuste">Ajuste (+/−)</SelectItem>
          <SelectItem value="corrigir">Corrigir total</SelectItem>
          <SelectItem value="inicial">Saldo inicial</SelectItem>
        </SelectContent>
      </Select>
      <Input value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal" placeholder={kind === "corrigir" ? "novo total" : "valor"} aria-label="Valor" className="tnum h-8 text-xs" data-testid={`input-entry-value-${parcelId}-${subgoalId ?? "m"}`} />
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" className="h-8 text-xs" />
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="nota / motivo (opcional)" aria-label="Nota" className="h-8 text-xs" />
      <Button size="sm" className="h-8 text-xs" onClick={submit} disabled={!val.trim()} data-testid={`button-entry-${parcelId}-${subgoalId ?? "m"}`}>Registar</Button>
    </div>
  );
}

export function GoalPanel({ state, parcel, monthly }: { state: AppState; parcel: Parcel; monthly: { key: number; amount: number }[] }) {
  const save = useSave();
  const { toast } = useToast();
  const { ask, dialog: confirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const ctx = useMemo(() => goalCtx(state, parcel, monthly), [state, parcel, monthly]);
  const br: GoalBreakdown = useMemo(() => goalBreakdown(ctx, parcel.id), [ctx, parcel.id]);
  const cur = parcel.currency || "EUR";
  const entries = (state.goalEntries ?? []).filter((e) => e.parcelId === parcel.id).sort((a, b) => b.date.localeCompare(a.date));
  const subs = (state.subgoals ?? []).filter((s) => s.parcelId === parcel.id);
  const txs = state.transactions.filter((t) => t.parcelId === parcel.id && (t.type === "contribution" || t.type === "withdrawal"));
  const fail = (title: string) => (e: unknown) => toast({ title, description: errMsg(e), variant: "destructive" });
  const [editing, setEditing] = useState<number | null>(null);
  const [ed, setEd] = useState({ name: "", platformId: "", target: "", deadline: "" });
  const startEdit = (s: (typeof subs)[number]) => {
    setEd({ name: s.name, platformId: s.platformId != null ? String(s.platformId) : "", target: s.target != null ? String(s.target).replace(".", ",") : "", deadline: s.deadline ?? "" });
    setEditing(s.id);
  };
  const saveEdit = (id: number) => {
    const t = ed.target.trim() === "" ? null : num(ed.target);
    if (ed.target.trim() !== "" && (t == null || t < 0)) return toast({ title: "Objetivo inválido", description: "Usa um número maior ou igual a zero ou deixa vazio.", variant: "destructive" });
    if (!ed.name.trim()) return toast({ title: "O nome é obrigatório", variant: "destructive" });
    save.updateSubgoal.mutate(
      { id, patch: { name: ed.name, platformId: ed.platformId ? Number(ed.platformId) : null, target: t, deadline: ed.deadline || null } },
      { onSuccess: () => { setEditing(null); toast({ title: "Submeta atualizada" }); }, onError: fail("Não foi possível guardar") },
    );
  };
  const [editingEntry, setEditingEntry] = useState<number | null>(null);
  const [ee, setEe] = useState({ amount: "", date: "", note: "" });
  const startEditEntry = (e: (typeof entries)[number]) => {
    setEe({ amount: String(e.amount).replace(".", ","), date: e.date, note: e.note ?? "" });
    setEditingEntry(e.id);
  };
  const saveEditEntry = (id: number) => {
    const n = num(ee.amount);
    if (n == null) return toast({ title: "Valor inválido", description: "Introduz um número (ex.: 1250,50).", variant: "destructive" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ee.date)) return toast({ title: "Data inválida", variant: "destructive" });
    save.updateGoalEntry.mutate(
      { id, patch: { amount: n, date: ee.date, note: ee.note } },
      { onSuccess: () => { setEditingEntry(null); toast({ title: "Registo atualizado" }); }, onError: fail("Não foi possível guardar") },
    );
  };
  const [sg, setSg] = useState({ name: "", platformId: "", currency: cur, target: "", deadline: "" });
  const [lk, setLk] = useState<Record<number, { sub: string; amount: string }>>({});
  const [fx, setFx] = useState({ from: "USD", to: cur, rate: "", date: today() });
  const label = (e: (typeof entries)[number]) => (e.kind === "inicial" ? "Saldo inicial" : "Ajuste");
  const subName = (id: number | null) => (id == null ? "Não distribuído" : subs.find((s) => s.id === id)?.name ?? "—");

  return (
    <div className="mt-3 border-t border-border pt-2">
      {confirmDialog}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={`goal-panel-${parcel.id}`} className="-my-1 flex w-full flex-wrap items-center gap-1 whitespace-normal py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground" data-testid={`button-goal-panel-${parcel.id}`}>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Saldos, ajustes e submetas{subs.length ? ` (${subs.length} submetas)` : ""}
        {br.incomplete && <span className="ml-2 text-destructive">total incompleto: falta taxa {br.missing.join(", ")}</span>}
      </button>
      {open && (
        <div id={`goal-panel-${parcel.id}`} className="mt-2 min-w-0 space-y-4 text-xs" data-testid={`goal-panel-${parcel.id}`}>
          <div className="goal-summary grid gap-1 rounded-md bg-muted/30 p-2.5">
            {br.hasOpening && <div className="flex justify-between"><span>Saldo inicial</span><span>{money(br.opening, cur)}</span></div>}
            <div className="flex justify-between"><span>{br.hasOpening ? "Contribuições após o saldo inicial" : "Histórico de alocações"}</span><span>{money(br.flows, cur)}</span></div>
            {br.hasOpening && br.txNet !== 0 && <div className="flex justify-between"><span>Aportes/retiradas registados</span><span>{money(br.txNet, cur)}</span></div>}
            <div className="flex justify-between"><span>Ajustes</span><span>{money(br.adjustments, cur)}</span></div>
            {subs.length > 0 && <div className="flex justify-between"><span>Saldo não distribuído</span><span>{money(br.unallocated, cur)}</span></div>}
            {subs.length > 0 && <div className="flex justify-between"><span>Submetas (convertidas)</span><span>{money(br.total - br.unallocated, cur)}</span></div>}
            <div className="flex justify-between border-t pt-1 font-semibold" data-testid={`goal-total-${parcel.id}`}><span>Acumulado{br.incomplete ? " (incompleto)" : ""}</span><span>{money(br.total, cur)}</span></div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Planeamento não altera acumulados. Com saldo inicial, só contam contribuições do mês da data de referência em diante (corte inclusivo).
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Meta principal ({cur})</Label>
            <EntryForm parcelId={parcel.id} subgoalId={null} currentTotal={subs.length ? br.unallocated : br.total} currency={cur} />
          </div>

          {entries.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Histórico de saldos e ajustes</Label>
              {entries.map((e) => (
                <div key={e.id} className="space-y-1.5 rounded-md border border-border p-2.5" data-testid={`entry-${e.id}`}>
                <div className="goal-subheading flex flex-wrap items-center gap-x-2 gap-y-1">
                  <div className="w-full min-w-0 text-left sm:w-auto sm:flex-1">
                    <p className="break-words font-medium">{label(e)}</p>
                    <p className="break-words text-muted-foreground">{e.date} · {subName(e.subgoalId)}</p>
                  </div>
                  <span className="tnum mr-auto whitespace-nowrap font-semibold sm:mr-0">{e.kind === "ajuste" && e.amount > 0 ? "+" : ""}{money(e.amount, e.currency)}</span>
                  <Button variant="ghost" size="icon" className="-my-1 h-8 w-8 shrink-0" aria-label="Editar registo" data-testid={`button-edit-entry-${e.id}`} onClick={() => (editingEntry === e.id ? setEditingEntry(null) : startEditEntry(e))}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="-my-1 h-8 w-8 shrink-0" aria-label="Remover registo" onClick={() => ask("Remover este registo do histórico?").then((ok) => ok && save.deleteGoalEntry.mutate(e.id, { onError: fail("Não foi possível remover") }))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {e.note && <p className="break-words text-left text-muted-foreground">{e.note}</p>}
                {editingEntry === e.id && (
                  <div className="responsive-form rounded-md bg-muted/30 p-2" data-testid={`form-edit-entry-${e.id}`}
                    onKeyDown={(ev) => { if (ev.key === "Enter") saveEditEntry(e.id); if (ev.key === "Escape") setEditingEntry(null); }}>
                    <Input value={ee.amount} onChange={(ev) => setEe({ ...ee, amount: ev.target.value })} inputMode="decimal" aria-label="Valor" className="tnum h-8 text-xs" data-testid={`input-edit-entry-amount-${e.id}`} />
                    <Input type="date" value={ee.date} onChange={(ev) => setEe({ ...ee, date: ev.target.value })} aria-label="Data" className="h-8 text-xs" />
                    <Input value={ee.note} onChange={(ev) => setEe({ ...ee, note: ev.target.value })} placeholder="nota / motivo (opcional)" aria-label="Nota" className="h-8 text-xs" />
                    <div className="form-actions">
                      <Button size="sm" className="h-8 text-xs" onClick={() => saveEditEntry(e.id)} data-testid={`button-save-entry-${e.id}`}>Guardar</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingEntry(null)}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Submetas</Label>
            {br.subs.map((s) => (
              <div key={s.sub.id} className="space-y-1.5 rounded-md border border-border p-2.5" data-testid={`subgoal-${s.sub.id}`}>
                <div className="goal-subheading flex flex-wrap items-center gap-x-2 gap-y-1">
                  <div className="w-full min-w-0 text-left sm:w-auto sm:flex-1">
                    <p className="break-words font-medium">{s.sub.name}</p>
                    <p className="break-words text-muted-foreground">{state.platforms.find((p) => p.id === s.sub.platformId)?.name ?? "sem plataforma"} · {s.sub.currency}{s.sub.deadline ? ` · até ${s.sub.deadline}` : ""}</p>
                  </div>
                  <span className="tnum mr-auto whitespace-nowrap font-semibold sm:mr-0">{money(s.balance, s.sub.currency)}</span>
                  <Button variant="ghost" size="icon" className="-my-1 h-8 w-8 shrink-0" aria-label="Editar submeta" data-testid={`button-edit-subgoal-${s.sub.id}`} onClick={() => { const full = subs.find((x) => x.id === s.sub.id); if (editing === s.sub.id || !full) setEditing(null); else startEdit(full); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="-my-1 h-8 w-8 shrink-0" aria-label="Eliminar submeta" data-testid={`button-delete-subgoal-${s.sub.id}`}
                    onClick={() => ask(`Eliminar a submeta "${s.sub.name}"?`, "Só é possível se não tiver movimentos, saldos ou ajustes.").then((ok) => ok && save.deleteSubgoal.mutate(s.sub.id, { onError: fail("Não foi possível eliminar") }))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {editing === s.sub.id && (
                  <div className="responsive-form rounded-md bg-muted/30 p-2" data-testid={`form-edit-subgoal-${s.sub.id}`}
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(s.sub.id); if (e.key === "Escape") setEditing(null); }}>
                    <Input value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} aria-label="Nome da submeta" className="h-8 text-xs" data-testid={`input-edit-subgoal-name-${s.sub.id}`} />
                    <Select value={ed.platformId || "none"} onValueChange={(v) => setEd({ ...ed, platformId: v === "none" ? "" : v })}>
                      <SelectTrigger className="h-8 text-xs" aria-label="Plataforma"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem plataforma</SelectItem>
                        {state.platforms.filter((p) => !p.archived || String(p.id) === ed.platformId).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input value={ed.target} onChange={(e) => setEd({ ...ed, target: e.target.value })} placeholder="objetivo" inputMode="decimal" aria-label="Objetivo" className="tnum h-8 text-xs" data-testid={`input-edit-subgoal-target-${s.sub.id}`} />
                    <ClearableDateInput type="month" value={ed.deadline} onChange={(v) => setEd({ ...ed, deadline: v })} aria-label="Prazo" className="h-8 text-xs" />
                    <div className="form-actions">
                      <Button size="sm" className="h-8 text-xs" onClick={() => saveEdit(s.sub.id)} data-testid={`button-save-subgoal-${s.sub.id}`}>Guardar</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditing(null)}>Cancelar</Button>
                    </div>
                  </div>
                )}
                {s.sub.currency !== cur && <p className="text-muted-foreground">{s.converted != null ? `≈ ${money(s.converted, cur)} (taxa manual)` : `Sem taxa ${s.sub.currency}→${cur}: não entra no total`}</p>}
                {s.sub.target != null && s.sub.target > 0 && (
                  <>
                    <Progress value={(s.progress ?? 0) * 100} className="h-1.5" />
                    <p className="text-muted-foreground">{Math.round((s.progress ?? 0) * 100)}% de {money(s.sub.target, s.sub.currency)} · restante {money(s.remaining ?? 0, s.sub.currency)}</p>
                  </>
                )}
                <p className="text-muted-foreground">Inicial {money(s.opening, s.sub.currency)} · atribuído {money(s.linked, s.sub.currency)} · ajustes {money(s.adjustments, s.sub.currency)}</p>
                <EntryForm parcelId={parcel.id} subgoalId={s.sub.id} currentTotal={s.balance} currency={s.sub.currency} />
              </div>
            ))}
            <div className="responsive-form">
              <Input value={sg.name} onChange={(e) => setSg({ ...sg, name: e.target.value })} placeholder="Nova submeta" aria-label="Nome da submeta" className="h-8 text-xs" data-testid={`input-subgoal-name-${parcel.id}`} />
              <Select value={sg.platformId || "none"} onValueChange={(v) => setSg({ ...sg, platformId: v === "none" ? "" : v })}>
                <SelectTrigger className="h-8 text-xs" aria-label="Plataforma"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem plataforma</SelectItem>
                  {state.platforms.filter((p) => !p.archived).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={sg.currency} onChange={(e) => setSg({ ...sg, currency: e.target.value.toUpperCase().slice(0, 3) })} aria-label="Moeda" className="h-8 text-xs" />
              <Input value={sg.target} onChange={(e) => setSg({ ...sg, target: e.target.value })} placeholder="objetivo" inputMode="decimal" aria-label="Objetivo" className="tnum h-8 text-xs" />
              <ClearableDateInput type="month" value={sg.deadline} onChange={(v) => setSg({ ...sg, deadline: v })} aria-label="Prazo" className="h-8 text-xs" />
              <Button size="sm" className="h-8 gap-1 text-xs" disabled={!sg.name.trim()} data-testid={`button-add-subgoal-${parcel.id}`}
                onClick={() => {
                  const t = sg.target.trim() === "" ? null : num(sg.target);
                  if (sg.target.trim() !== "" && t == null) return toast({ title: "Objetivo inválido", variant: "destructive" });
                  save.createSubgoal.mutate(
                    { parcelId: parcel.id, name: sg.name, platformId: sg.platformId ? Number(sg.platformId) : null, currency: sg.currency, target: t, deadline: sg.deadline || null },
                    { onSuccess: () => setSg({ ...sg, name: "", target: "", deadline: "" }), onError: fail("Não foi possível criar") },
                  );
                }}>
                <Plus className="h-3 w-3" />Criar
              </Button>
            </div>
            {subs.length > 0 && br.hasOpening === false && br.unallocated !== 0 && (
              <p className="text-muted-foreground">O saldo existente da meta ({money(br.unallocated, cur)}) fica em "Saldo não distribuído" até o reatribuíres, sem duplicação.</p>
            )}
          </div>

          {subs.length > 0 && txs.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Atribuir aportes/retiradas a submetas</Label>
              {txs.map((t) => {
                const links = (state.contributionLinks ?? []).filter((l) => l.transactionId === t.id);
                const used = links.reduce((a, l) => a + l.amount, 0);
                const f = lk[t.id] ?? { sub: "", amount: "" };
                return (
                  <div key={t.id} className="space-y-1 border-b border-border/50 pb-1.5">
                    <div className="flex gap-2"><span className="text-muted-foreground">{t.date.slice(0, 10)}</span><span>{t.type === "withdrawal" ? "Retirada" : "Aporte"} {fmtEur(t.value)}</span><span className="ml-auto text-muted-foreground">por atribuir {fmtEur(t.value - used)}</span></div>
                    {links.map((l) => (
                      <div key={l.id} className="flex items-center gap-2 pl-3 text-left text-muted-foreground">
                        <span className="min-w-0 flex-1 break-words">{subName(l.subgoalId)}: {fmtEur(l.amount)}</span>
                        <Button variant="ghost" size="icon" className="-my-1.5 h-8 w-8 shrink-0" aria-label="Remover atribuição" onClick={() => save.deleteLink.mutate(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    ))}
                    <div className="flex gap-1.5 pl-3">
                      <Select value={f.sub} onValueChange={(v) => setLk({ ...lk, [t.id]: { ...f, sub: v } })}>
                        <SelectTrigger className="h-7 w-40 text-xs" aria-label="Submeta"><SelectValue placeholder="Submeta" /></SelectTrigger>
                        <SelectContent>{subs.filter((s) => s.currency === cur).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input value={f.amount} onChange={(e) => setLk({ ...lk, [t.id]: { ...f, amount: e.target.value } })} placeholder="montante" inputMode="decimal" aria-label="Montante a atribuir" className="tnum h-7 w-24 text-xs" data-testid={`input-link-amount-${t.id}`} />
                      <Button size="sm" className="h-7 text-xs" disabled={!f.sub || !f.amount} data-testid={`button-link-${t.id}`}
                        onClick={() => {
                          const n = num(f.amount);
                          if (n == null || n <= 0) return toast({ title: "Montante inválido", variant: "destructive" });
                          save.createLink.mutate({ transactionId: t.id, subgoalId: Number(f.sub), amount: n }, { onSuccess: () => setLk({ ...lk, [t.id]: { sub: f.sub, amount: "" } }), onError: fail("Não foi possível atribuir") });
                        }}>
                        Atribuir
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Taxas de conversão manuais (1 origem = taxa × destino)</Label>
            {(state.fxRates ?? []).map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-left text-muted-foreground">
                <span className="min-w-0 flex-1 break-words">{r.date} · 1 {r.fromCurrency} = {r.rate} {r.toCurrency} · {r.source}</span>
                <Button variant="ghost" size="icon" className="-my-1.5 h-8 w-8 shrink-0" aria-label="Remover taxa" onClick={() => save.deleteFxRate.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5">
              <Input value={fx.from} onChange={(e) => setFx({ ...fx, from: e.target.value.toUpperCase().slice(0, 3) })} aria-label="Moeda origem" className="h-8 w-16 text-xs" />
              <span className="self-center">→</span>
              <Input value={fx.to} onChange={(e) => setFx({ ...fx, to: e.target.value.toUpperCase().slice(0, 3) })} aria-label="Moeda destino" className="h-8 w-16 text-xs" />
              <Input value={fx.rate} onChange={(e) => setFx({ ...fx, rate: e.target.value })} placeholder="taxa" inputMode="decimal" aria-label="Taxa" className="tnum h-8 w-24 text-xs" data-testid={`input-fx-rate-${parcel.id}`} />
              <Input type="date" value={fx.date} onChange={(e) => setFx({ ...fx, date: e.target.value })} aria-label="Data da taxa" className="h-8 w-36 text-xs" />
              <Button size="sm" className="h-8 text-xs" disabled={!fx.rate.trim()} data-testid={`button-add-fx-${parcel.id}`}
                onClick={() => {
                  const n = num(fx.rate);
                  if (n == null || n <= 0) return toast({ title: "A taxa tem de ser positiva", variant: "destructive" });
                  save.createFxRate.mutate({ fromCurrency: fx.from, toCurrency: fx.to, rate: n, date: fx.date }, { onSuccess: () => setFx({ ...fx, rate: "" }), onError: fail("Não foi possível guardar a taxa") });
                }}>
                Guardar taxa
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
