import { localToday } from "@/lib/utils";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/confirm";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useAppState, useDerived, useSave } from "@/lib/app";
import { useUiMode } from "@/lib/ui-mode";
import { SectionCard } from "@/components/kpi";
import { AnomaliesCard } from "@/components/insights";
import { errMsg } from "@/components/catalogs";
import { UNCLASSIFIED, expenseView, fmtEur } from "@shared/calc";
import type { Transaction } from "@shared/schema";

const ALL = "__all__";
const NONE = "__none__";
const NEW = "__new__";
const num = (s: string) => {
  const t = s.trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};
/** Estado persistente no navegador (filtros mantêm-se entre visitas). */
function usePersisted<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw == null ? initial : (JSON.parse(raw) as T); } catch { return initial; }
  });
  const set = (n: T) => { setV(n); try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* sem armazenamento */ } };
  return [v, set];
}
const pad = (n: number) => String(n).padStart(2, "0");
const dayLabel = (iso: string, withYear = false) => {
  const [y, m, d] = iso.split("-").map(Number);
  // calendário puro: sem Date/fuso horário
  const wd = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${pad(d)}/${pad(m)}${withYear ? `/${y}` : ""} · ${wd}`;
};

type Draft = { id?: number; date: string; value: string; category: string; parcelId: string; note: string };

export default function ExpensesPage() {
  const detailed = useUiMode() === "detalhado";
  const { data, isLoading } = useAppState();
  const derived = useDerived(data);
  const save = useSave();
  const { toast } = useToast();
  const { ask, dialog: confirmDialog } = useConfirm();
  const [newCat, setNewCat] = useState<string | null>(null);
  const sorted = useMemo(() => [...(data?.months ?? [])].sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month)), [data?.months]);
  const [monthSel, setMonthSel] = usePersisted("sm.exp.month", "");
  const [cat, setCat] = usePersisted("sm.exp.cat", ALL);
  const [parcel, setParcel] = usePersisted("sm.exp.parcel", ALL);
  const [platformSaved, setPlatform] = usePersisted("sm.exp.platform", ALL);
  const platform = detailed ? platformSaved : ALL; // no Básico não há filtro por plataforma, por isso nunca fica um filtro escondido
  const [search, setSearch] = usePersisted("sm.exp.search", "");
  const [allMonths, setAllMonths] = usePersisted("sm.exp.all", false); // pesquisar em todo o histórico
  const [favs, setFavs] = usePersisted<string[]>("sm.exp.favs", []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false); // protege contra duplo envio
  const [saved, setSaved] = useState<string | null>(null); // feedback visível de gravação

  const month = sorted.find((m) => String(m.id) === monthSel) ?? sorted[0];
  const parcels = (data?.parcels ?? []).filter((p) => !p.archived);

  const view = useMemo(() => {
    if (!data || !month) return null;
    const platformParcels =
      platform === ALL ? undefined : (data.parcelPlatforms ?? []).filter((l) => String(l.platformId) === platform).map((l) => l.parcelId);
    return expenseView(data.transactions, allMonths ? null : month.id, {
      categoryKey: cat === ALL ? undefined : cat,
      parcelId: parcel === ALL ? undefined : Number(parcel),
      parcelIds: platformParcels,
      search,
    });
  }, [data, month, cat, parcel, platform, search, allMonths]);

  if (data && !isLoading && sorted.length === 0) {
    return (
      <AppShell title="Despesas" subtitle="Despesas por mês e dia">
        <div className="flex h-[50vh] flex-col items-center justify-center gap-2 text-center" data-testid="expenses-empty">
          <p className="text-sm font-medium">Ainda não há meses</p>
          <p className="text-xs text-muted-foreground">Cria um mês em <a className="underline" href="#/meses">Meses</a> para registar despesas.</p>
        </div>
      </AppShell>
    );
  }
  if (isLoading || !data || !month || !view) {
    return (
      <AppShell title="Despesas" subtitle="Despesas por mês e dia">
        <Skeleton className="h-[320px] rounded-lg" />
      </AppShell>
    );
  }
  const ym = `${month.year}-${pad(month.month)}`;
  const last = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  const today = localToday();
  const defaultDate = today.startsWith(ym) ? today : `${ym}-01`;
  const categories = data.categories.filter((c) => c.active).map((c) => c.name);
  const usedCats = Array.from(new Set(data.transactions.filter((t) => t.monthId === month.id).map((t) => t.category.trim()).filter(Boolean)));
  const catOptions = Array.from(new Set([...categories, ...usedCats]));
  const recentCats = Array.from(new Set([...data.transactions].sort((a, b) => b.id - a.id).map((t) => t.category.trim()).filter(Boolean)));
  const parcelName = (id: number | null) => data.parcels.find((p) => p.id === id)?.name;
  const fail = (title: string) => (e: unknown) => toast({ title, description: errMsg(e), variant: "destructive" });

  const createCategory = () => {
    const name = (newCat ?? "").trim().replace(/\s+/g, " ");
    if (!name) return toast({ title: "Indica o nome da categoria", variant: "destructive" });
    const existing = data.categories.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
    const done = (n: string) => { setDraft((d) => (d ? { ...d, category: n } : d)); setNewCat(null); };
    if (existing) {
      if (!existing.active) save.updateCategory.mutate({ id: existing.id, patch: { active: 1 } as any });
      return done(existing.name);
    }
    save.createCategory.mutate({ name } as any, { onSuccess: () => done(name), onError: fail("Não foi possível criar a categoria") });
  };

  const submit = (keepOpen = true) => {
    if (!draft || saving) return;
    const value = num(draft.value);
    if (value == null || value <= 0) return toast({ title: "Valor inválido", description: "Indica um valor maior que zero.", variant: "destructive" });
    const body = {
      date: draft.date,
      value,
      category: draft.category === NONE ? "" : draft.category,
      parcelId: draft.parcelId === NONE || draft.parcelId === "" ? null : Number(draft.parcelId),
      note: draft.note,
    };
    if (draft.id != null) {
      save.updateTransaction.mutate({ id: draft.id, patch: body as any }, {
        onSuccess: (t: Transaction) => {
          setDraft(null);
          const moved = t.monthId !== month.id;
          toast({ title: moved ? "Despesa movida para outro mês" : "Despesa atualizada", description: moved ? "A data pertence a outro mês." : undefined });
        },
        onError: fail("Não foi possível guardar"),
      });
    } else {
      setSaving(true);
      save.createTransaction.mutate({ ...body, monthId: month.id, type: "expense" } as any, {
        onSuccess: () => {
          setSaving(false);
          setSaved(`${fmtEur(value)} guardado`);
          setTimeout(() => setSaved(null), 2500);
          setDraft(keepOpen ? { date: draft.date, value: "", category: draft.category, parcelId: draft.parcelId, note: "" } : null);
        },
        onError: (e) => { setSaving(false); fail("Não foi possível adicionar")(e); },
      });
    }
  };

  return (
    <AppShell title="Despesas" subtitle="Os mesmos movimentos dos Meses, agrupados por dia">
      <div className="space-y-4" data-testid="page-expenses">
        {confirmDialog}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Mês</Label>
            <Select value={String(month.id)} onValueChange={setMonthSel}>
              <SelectTrigger aria-label="Mês" className="h-9 w-48 text-sm" data-testid="select-expense-month"><SelectValue /></SelectTrigger>
              <SelectContent>{sorted.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.label} {m.year}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="rounded-xl border border-card-border bg-card px-4 py-2" data-testid="expense-month-total">
            <p className="text-xs text-muted-foreground">{allMonths ? "Total de despesas (todos os meses)" : "Total de despesas do mês"}</p>
            <p className="tnum text-lg font-semibold">{fmtEur(view.monthTotal)}</p>
          </div>
          {view.filteredCount !== view.count && (
            <div className="rounded-xl border border-card-border bg-card px-4 py-2" data-testid="expense-filtered-total">
              <p className="text-xs text-muted-foreground">Filtrado ({view.filteredCount})</p>
              <p className="tnum text-lg font-semibold">{fmtEur(view.filteredTotal)}</p>
            </div>
          )}
          <Button size="sm" className="ml-auto gap-1.5" onClick={() => setDraft({ date: defaultDate, value: "", category: NONE, parcelId: NONE, note: "" })} data-testid="button-new-expense">
            <Plus className="h-4 w-4" />Nova despesa
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Inclui despesas e retiradas (como nos Meses). {view.excludedTransfers > 0 ? `${view.excludedTransfers} transferência(s) e ` : ""}aportes não entram no total.
          Reembolsos não são compensados automaticamente: regista-os como ajuste no mês, se necessário.
        </p>
        {view.unclassifiedCount > 0 && (
          <button type="button" className="text-xs text-warning underline" onClick={() => setCat(UNCLASSIFIED)} data-testid="button-show-unclassified">
            {view.unclassifiedCount} despesa(s) sem categoria ({fmtEur(view.unclassifiedTotal)}): ver
          </button>
        )}

        <div className="flex flex-wrap gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar descrição" aria-label="Pesquisar descrição" className="h-9 w-56 text-sm" data-testid="input-expense-search" />
          <Button
            variant={allMonths ? "default" : "outline"}
            size="sm"
            className="h-9"
            aria-pressed={allMonths}
            title="Procura em todos os meses, não só no escolhido"
            onClick={() => setAllMonths(!allMonths)}
            data-testid="button-all-months"
          >
            Todos os meses
          </Button>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="h-9 w-44 text-xs" aria-label="Categoria" data-testid="select-expense-category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as categorias</SelectItem>
              <SelectItem value={UNCLASSIFIED}>Sem categoria</SelectItem>
              {catOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={parcel} onValueChange={setParcel}>
            <SelectTrigger className="h-9 w-44 text-xs" aria-label="Parcela"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as parcelas</SelectItem>
              {parcels.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {detailed && <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="h-9 w-44 text-xs" aria-label="Plataforma"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as plataformas</SelectItem>
              {data.platforms.filter((p) => !p.archived).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>}
          {(cat !== ALL || parcel !== ALL || platform !== ALL || search) && (
            <Button variant="ghost" size="sm" onClick={() => { setCat(ALL); setParcel(ALL); setPlatform(ALL); setSearch(""); }}>Limpar filtros</Button>
          )}
        </div>

        {draft && (
          <div className="responsive-form rounded-xl border border-card-border bg-card p-3" data-testid="expense-form"
            onKeyDown={(e) => { if (e.key === "Enter") submit(true); if (e.key === "Escape") setDraft(null); }}>
            <Input type="date" value={draft.date} min={`${ym}-01`} max={draft.id != null ? undefined : `${ym}-${pad(last)}`} onChange={(e) => setDraft({ ...draft, date: e.target.value })} aria-label="Data" className="h-9 text-sm" data-testid="input-expense-date" />
            <Input value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} inputMode="decimal" placeholder="valor" aria-label="Valor" autoFocus className="tnum h-9 text-sm" data-testid="input-expense-value" />
            {newCat !== null ? (
              <div className="flex gap-1" onKeyDown={(e) => e.stopPropagation()}>
                <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nova categoria" aria-label="Nome da nova categoria" autoFocus className="h-9 min-w-0 text-xs" data-testid="input-new-category"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); createCategory(); } if (e.key === "Escape") { e.stopPropagation(); setNewCat(null); } }} />
                <Button size="sm" className="h-9 px-2 text-xs" onClick={createCategory} data-testid="button-create-category">Criar</Button>
              </div>
            ) : (
              <Select value={draft.category || NONE} onValueChange={(v) => (v === NEW ? setNewCat("") : setDraft({ ...draft, category: v }))}>
                <SelectTrigger className="h-9 text-xs" aria-label="Categoria do lançamento" data-testid="select-expense-form-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem categoria</SelectItem>
                  {catOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value={NEW}>+ Nova categoria…</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={draft.parcelId || NONE} onValueChange={(v) => setDraft({ ...draft, parcelId: v })}>
              <SelectTrigger className="h-9 text-xs" aria-label="Parcela do lançamento"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem parcela</SelectItem>
                {parcels.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="descrição" aria-label="Descrição" className="h-9 text-sm" data-testid="input-expense-note" />
            <div className="form-actions">
              <Button size="sm" disabled={saving} onClick={() => submit(true)} data-testid="button-save-expense">{saving ? "A guardar…" : draft.id != null ? "Guardar" : "Guardar e adicionar outra"}</Button>
              {draft.id == null && <Button size="sm" variant="outline" disabled={saving} onClick={() => submit(false)} data-testid="button-save-close-expense">Guardar</Button>}
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Fechar</Button>
            </div>
          </div>
        )}

        {draft && draft.id == null && (
          <div className="flex flex-wrap items-center gap-1.5" data-testid="quick-categories">
            <span className="text-xs text-muted-foreground">Rápidas:</span>
            {Array.from(new Set([...favs, ...recentCats])).slice(0, 8).map((c) => (
              <button key={c} type="button" onClick={() => setDraft({ ...draft, category: c })} className={`rounded-full border px-2.5 py-1 text-xs ${draft.category === c ? "border-primary bg-primary/10" : "border-border"}`} data-testid={`chip-category-${c}`}>
                {favs.includes(c) ? "★ " : ""}{c}
              </button>
            ))}
            {draft.category && draft.category !== NONE && (
              <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setFavs(favs.includes(draft.category) ? favs.filter((x) => x !== draft.category) : [...favs, draft.category])} data-testid="button-toggle-fav">
                {favs.includes(draft.category) ? "Remover favorita" : "Marcar favorita"}
              </button>
            )}
          </div>
        )}
        {saved && <p role="status" className="text-xs text-success" data-testid="save-feedback">{saved}</p>}
        {view.days.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-testid="expenses-empty">
            {view.count === 0 ? "Sem despesas neste mês." : "Nenhuma despesa corresponde aos filtros."}
          </p>
        ) : (
          <div className="space-y-3">
            {view.days.map((d) => (
              <section key={d.date} data-testid={`day-${d.date}`}>
                <div className="flex items-baseline justify-between border-b border-border pb-1 text-xs">
                  <h3 className="font-semibold">{dayLabel(d.date, allMonths)}</h3>
                  <span className="tnum font-semibold" data-testid={`day-total-${d.date}`}>{fmtEur(d.total)}</span>
                </div>
                {d.items.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 border-b border-border/50 py-1.5 text-sm" data-testid={`row-expense-${t.id}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{t.note || <span className="text-muted-foreground">sem descrição</span>}{t.type === "withdrawal" && <span className="ml-1.5 text-xs text-muted-foreground">(retirada)</span>}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.category || "sem categoria"}{parcelName(t.parcelId) ? ` · ${parcelName(t.parcelId)}` : ""}</p>
                    </div>
                    <span className="tnum font-medium">{fmtEur(t.value)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Editar" data-testid={`button-edit-expense-${t.id}`}
                      onClick={() => setDraft({ id: t.id, date: t.date.slice(0, 10), value: String(t.value).replace(".", ","), category: t.category || NONE, parcelId: t.parcelId != null ? String(t.parcelId) : NONE, note: t.note })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" aria-label="Remover" data-testid={`button-delete-expense-${t.id}`}
                      onClick={() => ask(`Remover a despesa de ${fmtEur(t.value)}${t.note ? ` (${t.note})` : ""}?`).then((ok) => ok && save.deleteTransaction.mutate(t.id, {
                        onError: fail("Não foi possível remover"),
                        onSuccess: () => toast({
                          title: "Despesa removida",
                          description: `${fmtEur(t.value)}${t.note ? ` · ${t.note}` : ""}`,
                          action: (
                            <ToastAction
                              altText="Desfazer a remoção"
                              data-testid="button-undo-delete"
                              onClick={() => save.createTransaction.mutate(
                                { monthId: t.monthId, date: t.date.slice(0, 10), type: t.type, value: t.value, parcelId: t.parcelId, targetParcelId: t.targetParcelId, category: t.category, note: t.note } as any,
                                { onError: fail("Não foi possível desfazer") },
                              )}
                            >
                              Desfazer
                            </ToastAction>
                          ),
                        }),
                      }))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
        {detailed && derived && (
          <SectionCard className="min-h-0" title="Despesas fora do padrão" description={`${month.label} ${month.year} contra o habitual de cada categoria`}>
            <AnomaliesCard d={derived} monthId={month.id} />
          </SectionCard>
        )}
      </div>
    </AppShell>
  );
}
