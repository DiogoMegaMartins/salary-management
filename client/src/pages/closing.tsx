import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { MonthInput } from "@/components/month-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/confirm";
import { useToast } from "@/hooks/use-toast";
import { useAppState, useDerived } from "@/lib/app";
import { apiRequest } from "@/lib/queryClient";
import { errMsg } from "@/components/catalogs";
import { goalCtx } from "@/components/goal-panel";
import { fmtEur, goalBreakdown, monthKeyOf } from "@shared/calc";
import { composeTotal, executionOfMonth, simulateGoal, suggestedContribution, ymOf } from "@shared/evo08";

const num = (s: string) => { const t = s.trim().replace(",", "."); return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null; };
const NONE = "__none__";
const refresh = (qc: ReturnType<typeof useQueryClient>) => { qc.invalidateQueries({ queryKey: ["/api/state"] }); qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/") }); };

export default function ClosingPage() {
  return (
    <AppShell title="Fecho e planeamento" subtitle="Fecho mensal, recorrências, reservas, simulador e composição dos totais">
      <Tabs defaultValue="fecho" className="space-y-4" data-testid="page-closing">
        <TabsList className="sticky top-0 z-10 -mx-4 w-auto bg-background px-4 md:-mx-6 md:px-6">
          <TabsTrigger value="fecho" data-testid="tab-fecho">Fecho mensal</TabsTrigger>
          <TabsTrigger value="recorrencias" data-testid="tab-recorrencias">Recorrências e reservas</TabsTrigger>
          <TabsTrigger value="simulador" data-testid="tab-simulador">Simulador de metas</TabsTrigger>
          <TabsTrigger value="composicao" data-testid="tab-composicao">Composição dos totais</TabsTrigger>
        </TabsList>
        <TabsContent value="fecho"><MonthClosing /></TabsContent>
        <TabsContent value="recorrencias"><Recurring /></TabsContent>
        <TabsContent value="simulador"><Simulator /></TabsContent>
        <TabsContent value="composicao"><Composition /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ fecho mensal */
function MonthClosing() {
  const { data } = useAppState();
  const d = useDerived(data);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { ask, dialog } = useConfirm();
  const sorted = useMemo(() => [...(data?.months ?? [])].sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month)), [data?.months]);
  const [sel, setSel] = useState("");
  const [dest, setDest] = useState("manter");
  const [target, setTarget] = useState(NONE);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const month = sorted.find((m) => String(m.id) === sel) ?? sorted[0];
  const summary = useQuery<any>({ queryKey: ["/api/months", month?.id ?? 0, "summary"], enabled: !!month, staleTime: 0 });
  const history = useQuery<any[]>({ queryKey: ["/api/closures"], staleTime: 0 });
  const pend = useQuery<any[]>({ queryKey: ["/api/recurring/pending"], staleTime: 0 });
  const verify = useQuery<any>({ queryKey: ["/api/verify"], staleTime: 0 });
  if (data && d && !month)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground" data-testid="closing-empty">
        Ainda não há meses. Cria um mês em <a className="underline" href="#/meses">Meses</a> para fazer o fecho.
      </p>
    );
  if (!data || !d || !month) return <Skeleton className="h-64 rounded-lg" />;

  const txs = data.transactions.filter((t) => t.monthId === month.id);
  const spending = new Set(data.parcels.filter((p) => p.kind === "gastos").map((p) => p.id));
  const computed = d.allComputed.find((c) => c.month.id === month.id)!;
  const exec = executionOfMonth(computed.available, data.allocations.filter((a) => a.monthId === month.id) as any, txs as any, spending);
  const s = summary.data;
  const closed = month.status === "fechado";
  const pendingHere = (pend.data ?? []).filter((p) => p.monthId === month.id);
  const blocking = (verify.data?.issues ?? []).filter((i: any) => i.severity === "erro").length;
  const run = async (fn: () => Promise<any>, ok: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast({ title: ok }); refresh(qc); } catch (e) { toast({ title: "Não foi possível concluir", description: errMsg(e), variant: "destructive" }); } finally { setBusy(false); }
  };
  const close = async () => {
    const rem = s?.remainder ?? 0;
    const label = dest === "transportar" ? "transportar para o mês seguinte" : dest === "reforcar" ? "reforçar a parcela escolhida" : "manter como não atribuído";
    if (!(await ask(`Fechar ${month.label} ${month.year}? Restante ${fmtEur(rem)}: ${label}. Um mês fechado não aceita alterações até ser reaberto.`))) return;
    await run(() => apiRequest("POST", `/api/months/${month.id}/close`, { destination: dest, targetParcelId: target === NONE ? null : Number(target), note }), "Mês fechado");
  };
  const reopen = async () => {
    if (!note.trim()) return toast({ title: "Indica o motivo da reabertura", variant: "destructive" });
    if (!(await ask(`Reabrir ${month.label} ${month.year}? A decisão de transporte será desfeita e a reabertura fica no histórico.`))) return;
    await run(() => apiRequest("POST", `/api/months/${month.id}/reopen`, { note }), "Mês reaberto");
  };
  const row = (l: string, v: number, strong = false) => (
    <div className={`flex justify-between gap-3 py-1 text-sm ${strong ? "border-t border-border font-semibold" : ""}`}><span className="min-w-0">{l}</span><span className="tnum shrink-0">{fmtEur(v)}</span></div>
  );

  return (
    <div className="space-y-4" data-testid="month-closing">
      {dialog}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <Select value={String(month.id)} onValueChange={setSel}>
            <SelectTrigger className="h-9 w-52 text-sm" data-testid="select-closing-month"><SelectValue /></SelectTrigger>
            <SelectContent>{sorted.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.label} {m.year}{m.status === "fechado" ? " (fechado)" : ""}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${closed ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`} data-testid="closing-status">{closed ? "Fechado" : "Aberto"}</span>
      </div>

      <section className="rounded-lg border border-card-border bg-card p-4" aria-label="1. Rendimentos">
        <h3 className="mb-1 text-sm font-semibold">1. Rendimentos</h3>
        {row("Rendimento disponível", computed.available)}
        {(s?.carryIn ?? 0) > 0 && row("Transporte recebido (não é rendimento)", s.carryIn)}
      </section>
      <section className="rounded-lg border border-card-border bg-card p-4" aria-label="2. Despesas">
        <h3 className="mb-1 text-sm font-semibold">2. Despesas e movimentos</h3>
        {row("Executado (despesas e retiradas)", exec.executado)}
        {row("Transferências internas (não são despesas)", exec.transferenciasInternas)}
      </section>
      <section className="rounded-lg border border-card-border bg-card p-4" aria-label="3. Distribuições">
        <h3 className="mb-1 text-sm font-semibold">3. Distribuições</h3>
        {row("Planeado", exec.planeado)}
        {row("Alocado (inclui aportes)", exec.alocado)}
        {row("Por executar nas parcelas de gastos", exec.porExecutar)}
      </section>
      <section className="rounded-lg border border-card-border bg-card p-4" aria-label="4. Pendências">
        <h3 className="mb-1 text-sm font-semibold">4. Pendências</h3>
        <ul className="space-y-1 text-sm" data-testid="closing-pending">
          <li>{pendingHere.length === 0 ? "Sem recorrências pendentes." : `${pendingHere.length} recorrência(s) por confirmar (separador Recorrências).`}</li>
          <li>{blocking === 0 ? "Verificação de dados sem erros bloqueantes." : `${blocking} erro(s) na verificação de dados: corrige-os em Definições.`}</li>
          <li>{(s?.remainder ?? 0) > 0.004 ? `Restante por decidir: ${fmtEur(s.remainder)}.` : "Sem restante positivo."}</li>
        </ul>
      </section>
      <section className="rounded-lg border border-card-border bg-card p-4" aria-label="5. Fecho">
        <h3 className="mb-2 text-sm font-semibold">5. Montante restante e fecho</h3>
        {row("Restante do mês", s?.remainder ?? 0, true)}
        {!closed ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Destino do restante</Label>
              <Select value={dest} onValueChange={setDest}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-closing-dest"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manter">Manter como não atribuído</SelectItem>
                  <SelectItem value="transportar">Transportar para o mês seguinte</SelectItem>
                  <SelectItem value="reforcar">Reforçar parcela/meta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dest === "reforcar" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Parcela/meta</Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-closing-target"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={NONE}>Escolher…</SelectItem>{data.parcels.filter((p) => !p.archived).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Nota (opcional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-9 text-sm" aria-label="Nota do fecho" />
            </div>
            <div className="sm:col-span-2"><Button disabled={busy || (dest === "reforcar" && target === NONE)} onClick={close} data-testid="button-close-month">{busy ? "A fechar…" : "Fechar mês"}</Button></div>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo da reabertura (obrigatório)" aria-label="Motivo da reabertura" className="h-9 text-sm" data-testid="input-reopen-note" />
            <Button variant="outline" disabled={busy} onClick={reopen} data-testid="button-reopen-month">Reabrir mês</Button>
          </div>
        )}
      </section>
      <section className="rounded-lg border border-card-border bg-card p-4" aria-label="Histórico de fechos">
        <h3 className="mb-2 text-sm font-semibold">Histórico de abertura e fecho</h3>
        {(history.data ?? []).filter((c) => c.monthId === month.id).length === 0 ? <p className="text-sm text-muted-foreground">Sem registos para este mês.</p> : (
          <ul className="space-y-1 text-sm" data-testid="closing-history">
            {(history.data ?? []).filter((c) => c.monthId === month.id).map((c) => (
              <li key={c.id}>{c.at.slice(0, 16).replace("T", " ")} · {c.action === "fecho" ? `Fecho (restante ${fmtEur(c.remainder)}, ${c.destination})` : "Reabertura"}{c.note ? ` · ${c.note}` : ""}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ recorrências e reservas */
function Recurring() {
  const { data } = useAppState();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { ask, dialog } = useConfirm();
  const recs = useQuery<any[]>({ queryKey: ["/api/recurring"], staleTime: 0 });
  const pend = useQuery<any[]>({ queryKey: ["/api/recurring/pending"], staleTime: 0 });
  const res = useQuery<any[]>({ queryKey: ["/api/reserves"], staleTime: 0 });
  const [r, setR] = useState({ name: "", value: "", category: "", day: "1", start: "", end: "" });
  const [v, setV] = useState({ name: "", target: "", due: "", reserved: "0" });
  const [busy, setBusy] = useState(false);
  if (!data) return <Skeleton className="h-64 rounded-lg" />;
  const nowYm = new Date().toISOString().slice(0, 7);
  const fail = (e: unknown) => toast({ title: "Não foi possível concluir", description: errMsg(e), variant: "destructive" });
  const act = async (fn: () => Promise<any>, ok: string) => { if (busy) return; setBusy(true); try { await fn(); toast({ title: ok }); refresh(qc); } catch (e) { fail(e); } finally { setBusy(false); } };

  return (
    <div className="space-y-4" data-testid="recurring">
      {dialog}
      <section className="rounded-lg border border-card-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Ocorrências pendentes de confirmação</h3>
        {(pend.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground" data-testid="pending-empty">Sem ocorrências pendentes.</p> : (
          <ul className="space-y-1.5" data-testid="pending-list">
            {(pend.data ?? []).map((p) => (
              <li key={p.key} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{p.date} · {p.name}{p.category ? ` · ${p.category}` : ""}</span>
                <span className="tnum font-medium">{fmtEur(p.value)}</span>
                <Button size="sm" disabled={busy} onClick={() => act(() => apiRequest("POST", "/api/recurring/confirm", { key: p.key }), "Despesa criada")} data-testid={`button-confirm-${p.key}`}>Confirmar</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => apiRequest("POST", "/api/recurring/skip", { key: p.key }), "Ocorrência ignorada")}>Ignorar</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-lg border border-card-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Despesas recorrentes</h3>
        <div className="responsive-form" onKeyDown={(e) => e.key === "Enter" && document.getElementById("btn-add-rec")?.click()}>
          <Input placeholder="Nome" aria-label="Nome" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} className="h-9 text-sm" data-testid="input-rec-name" />
          <Input placeholder="Valor" aria-label="Valor" inputMode="decimal" value={r.value} onChange={(e) => setR({ ...r, value: e.target.value })} className="tnum h-9 text-sm" data-testid="input-rec-value" />
          <Input placeholder="Categoria" aria-label="Categoria" value={r.category} onChange={(e) => setR({ ...r, category: e.target.value })} className="h-9 text-sm" />
          <Input placeholder="Dia" aria-label="Dia do mês" inputMode="numeric" value={r.day} onChange={(e) => setR({ ...r, day: e.target.value })} className="h-9 text-sm" />
          <MonthInput aria-label="Início" value={r.start} onChange={(x) => setR({ ...r, start: x })} className="h-9 text-sm" data-testid="input-rec-start" />
          <MonthInput clearable aria-label="Fim (opcional)" value={r.end} onChange={(x) => setR({ ...r, end: x })} className="h-9 text-sm" />
          <Button id="btn-add-rec" size="sm" disabled={busy} data-testid="button-add-rec" onClick={() => {
            const value = num(r.value);
            if (!r.name.trim() || value == null || value <= 0 || !r.start) return toast({ title: "Preenche nome, valor e mês de início", variant: "destructive" });
            act(async () => { await apiRequest("POST", "/api/recurring", { name: r.name, value, category: r.category, dayOfMonth: Number(r.day) || 1, startMonth: r.start, endMonth: r.end || null }); setR({ name: "", value: "", category: "", day: "1", start: r.start, end: "" }); }, "Recorrência criada");
          }}>Adicionar</Button>
        </div>
        <ul className="mt-3 space-y-1 text-sm">
          {(recs.data ?? []).map((x) => (
            <li key={x.id} className="flex items-center gap-2 border-b border-border/50 py-1">
              <span className="min-w-0 flex-1 truncate">{x.name} · dia {x.dayOfMonth} · {x.startMonth}{x.endMonth ? ` a ${x.endMonth}` : " em diante"}</span>
              <span className="tnum">{fmtEur(x.value)}</span>
              <Button size="sm" variant="ghost" className="hover:text-destructive" onClick={async () => (await ask(`Eliminar a recorrência "${x.name}"? Os movimentos já criados mantêm-se.`)) && act(() => apiRequest("DELETE", `/api/recurring/${x.id}`), "Recorrência eliminada")}>Eliminar</Button>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-lg border border-card-border bg-card p-4">
        <h3 className="mb-1 text-sm font-semibold">Reservas para despesas futuras</h3>
        <p className="mb-2 text-xs text-muted-foreground">Uma reserva não é uma despesa paga: só cria a despesa quando marcas como paga. A sugestão considera o valor já reservado e os meses até ao prazo.</p>
        <div className="responsive-form" onKeyDown={(e) => e.key === "Enter" && document.getElementById("btn-add-res")?.click()}>
          <Input placeholder="Nome (ex.: seguro anual)" aria-label="Nome da reserva" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className="h-9 text-sm" data-testid="input-res-name" />
          <Input placeholder="Valor-alvo" aria-label="Valor-alvo" inputMode="decimal" value={v.target} onChange={(e) => setV({ ...v, target: e.target.value })} className="tnum h-9 text-sm" data-testid="input-res-target" />
          <MonthInput aria-label="Prazo" value={v.due} onChange={(x) => setV({ ...v, due: x })} className="h-9 text-sm" data-testid="input-res-due" />
          <Input placeholder="Já reservado" aria-label="Já reservado" inputMode="decimal" value={v.reserved} onChange={(e) => setV({ ...v, reserved: e.target.value })} className="tnum h-9 text-sm" />
          <Button id="btn-add-res" size="sm" disabled={busy} data-testid="button-add-res" onClick={() => {
            const target = num(v.target); const reserved = num(v.reserved || "0");
            if (!v.name.trim() || target == null || target <= 0 || !v.due || reserved == null || reserved < 0) return toast({ title: "Preenche nome, valor-alvo e prazo", variant: "destructive" });
            act(async () => { await apiRequest("POST", "/api/reserves", { name: v.name, target, dueMonth: v.due, reserved }); setV({ name: "", target: "", due: v.due, reserved: "0" }); }, "Reserva criada");
          }}>Adicionar</Button>
        </div>
        <ul className="mt-3 space-y-2 text-sm" data-testid="reserve-list">
          {(res.data ?? []).map((x) => {
            const sg = suggestedContribution(x, nowYm);
            return (
              <li key={x.id} className="rounded-md border border-border/60 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{x.name} · até {x.dueMonth} · {x.status}</span>
                  <span className="tnum">{fmtEur(x.reserved)} / {fmtEur(x.target)}</span>
                </div>
                {x.status === "ativa" && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span data-testid={`reserve-suggest-${x.id}`}>{sg.overdue ? `Prazo ultrapassado: faltam ${fmtEur(sg.missing)}.` : `Faltam ${fmtEur(sg.missing)} em ${sg.monthsLeft} mês(es): sugestão ${fmtEur(sg.perMonth)} por mês.`}</span>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                      const first = [...data.months].sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month)).find((m) => m.status !== "fechado");
                      if (!first) return toast({ title: "Não há mês aberto para registar o pagamento", variant: "destructive" });
                      act(() => apiRequest("POST", `/api/reserves/${x.id}/pay`, { monthId: first.id, date: `${ymOf(first.year, first.month)}-01` }), "Reserva paga e despesa criada");
                    }}>Marcar como paga</Button>
                    <Button size="sm" variant="ghost" className="hover:text-destructive" onClick={async () => (await ask(`Eliminar a reserva "${x.name}"?`)) && act(() => apiRequest("DELETE", `/api/reserves/${x.id}`), "Reserva eliminada")}>Eliminar</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ simulador */
function Simulator() {
  const { data } = useAppState();
  const d = useDerived(data);
  const [pid, setPid] = useState("");
  const [f, setF] = useState({ monthly: "100", extraAt: "", extraAmt: "", pauseFrom: "", pauseLen: "", deadline: "" });
  if (!data || !d) return <Skeleton className="h-64 rounded-lg" />;
  const goals = d.allParcels.filter((p) => p.targetAmount && p.targetAmount > 0);
  if (goals.length === 0) return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Define uma meta em Parcelas e metas para a poder simular.</p>;
  const p = goals.find((x) => String(x.id) === pid) ?? goals[0];
  const monthly = d.allComputed.map((x) => ({ key: monthKeyOf(x.month.year, x.month.month), amount: x.byParcel[p.id] ?? 0 }));
  const current = goalBreakdown(goalCtx(data, p, monthly), p.id).total;
  const n = (s: string) => (s.trim() === "" ? null : num(s));
  const res = simulateGoal({
    current, target: p.targetAmount ?? 0, monthlyContribution: n(f.monthly) ?? 0,
    extra: n(f.extraAt) && n(f.extraAmt) ? [{ atMonth: Math.round(n(f.extraAt)!), amount: n(f.extraAmt)! }] : [],
    pause: n(f.pauseFrom) && n(f.pauseLen) ? { from: Math.round(n(f.pauseFrom)!), months: Math.round(n(f.pauseLen)!) } : undefined,
    deadlineMonths: n(f.deadline) != null ? Math.round(n(f.deadline)!) : null,
  });
  const fld = (k: keyof typeof f, label: string, ph = "") => (
    <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label><Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph} inputMode="decimal" className="tnum h-9 text-sm" data-testid={`sim-${k}`} /></div>
  );
  return (
    <div className="space-y-4" data-testid="simulator">
      <p className="text-xs text-muted-foreground">Simulação sem alterar dados reais. Pressupostos: sem rentabilidade nem inflação.</p>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Meta</Label>
        <Select value={String(p.id)} onValueChange={setPid}><SelectTrigger className="h-9 w-64 text-sm"><SelectValue /></SelectTrigger><SelectContent>{goals.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {fld("monthly", "Contribuição mensal (€)", "100")}
        {fld("extraAt", "Reforço no mês nº", "ex.: 3")}
        {fld("extraAmt", "Valor do reforço (€)")}
        {fld("pauseFrom", "Pausa a partir do mês nº")}
        {fld("pauseLen", "Duração da pausa (meses)")}
        {fld("deadline", "Prazo (meses a partir de agora)")}
      </div>
      <section className="rounded-lg border border-card-border bg-card p-4 text-sm" data-testid="sim-result">
        <p>Acumulado atual: <span className="tnum font-medium">{fmtEur(current)}</span> de {fmtEur(p.targetAmount ?? 0)}.</p>
        <p className="mt-1" data-testid="sim-outcome">{res.reachable ? `Meta atingida em ${res.monthsToReach} mês(es).` : "A meta não é atingível com estes pressupostos."}{res.reason ? ` ${res.reason}` : ""}</p>
        {res.finalAtDeadline != null && <p className="mt-1">No prazo: {fmtEur(res.finalAtDeadline)}{res.shortfallAtDeadline ? ` (faltam ${fmtEur(res.shortfallAtDeadline)})` : ""}.</p>}
        {res.requiredMonthly != null && <p className="mt-1">Contribuição mensal necessária para cumprir o prazo: <span className="tnum font-medium">{fmtEur(res.requiredMonthly)}</span>.</p>}
        <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">{res.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ composição */
function Composition() {
  const { data } = useAppState();
  const d = useDerived(data);
  const [open, setOpen] = useState<number | null>(null);
  if (!data || !d) return <Skeleton className="h-64 rounded-lg" />;
  const periodLabels = new Set(d.computed.map((c) => `${String(c.month.month).padStart(2, "0")}/${c.month.year}`));
  return (
    <div className="space-y-3" data-testid="composition">
      <p className="text-xs text-muted-foreground">Acumulado = saldo inicial + alocações + aportes/retiradas + ajustes + submetas. O fluxo do período ({d.periodLabel}) é apenas o que entrou nesses meses e não substitui o acumulado.</p>
      {d.allParcels.filter((p) => !p.archived).map((p) => {
        const monthly = d.allComputed.map((x) => ({ key: monthKeyOf(x.month.year, x.month.month), amount: x.byParcel[p.id] ?? 0 }));
        const b = goalBreakdown(goalCtx(data, p, monthly), p.id);
        const labels = d.allComputed.map((x) => ({ label: `${String(x.month.month).padStart(2, "0")}/${x.month.year}`, amount: x.byParcel[p.id] ?? 0 }));
        const c = composeTotal(b, labels, periodLabels, (data.goalEntries ?? []).filter((e) => e.parcelId === p.id) as any, data.transactions.filter((t) => t.parcelId === p.id) as any);
        return (
          <section key={p.id} className="rounded-lg border border-card-border bg-card p-3" data-testid={`composition-${p.id}`}>
            <button type="button" className="flex w-full items-center justify-between text-left text-sm" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>
              <span className="font-medium">{p.name}</span>
              <span className="tnum"><span className="text-xs text-muted-foreground">período {fmtEur(c.periodFlow)} · </span><span className="font-semibold">{fmtEur(c.accumulated)}</span></span>
            </button>
            {open === p.id && (
              <div className="mt-2 space-y-2 text-sm">
                {c.lines.map((l, i) => (
                  <div key={i}>
                    <div className="flex justify-between"><span>{l.label}</span><span className="tnum">{fmtEur(l.amount)}</span></div>
                    {l.sources.length > 0 && (
                      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Registos de origem ({l.sources.length})</summary>
                        <ul className="mt-1 space-y-0.5">{l.sources.slice(0, 60).map((s, j) => <li key={j} className="flex justify-between"><span>{s.date ? `${s.date} · ` : ""}{s.label}</span><span className="tnum">{fmtEur(s.amount)}</span></li>)}</ul>
                      </details>
                    )}
                  </div>
                ))}
                <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Acumulado</span><span className="tnum">{fmtEur(c.accumulated)}</span></div>
                {b.incomplete && <p className="text-xs text-amber-700 dark:text-amber-400">Falta taxa de conversão ({b.missing.join(", ")}): total incompleto.</p>}
                {c.check !== 0 && <p className="text-xs text-destructive" data-testid="composition-mismatch">Diferença de composição: {fmtEur(c.check)}.</p>}
              </div>
            )}
          </section>
        );
      })}
      <p className="text-xs text-muted-foreground">Valores arredondados ao cêntimo; as somas são feitas em cêntimos inteiros.</p>
    </div>
  );
}
