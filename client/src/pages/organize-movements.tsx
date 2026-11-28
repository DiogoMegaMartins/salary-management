import { useMemo, useState } from "react";
import { Search, Tags, Layers, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errMsg } from "@/components/catalogs";
import { useConfirm } from "@/components/confirm";
import { useToast } from "@/hooks/use-toast";
import { useAppState, useSave } from "@/lib/app";
import { fmtEur } from "@shared/calc";
import { TRANSACTION_TYPES } from "@shared/constants";
import { NO_CATEGORY, filterMovements, selectionSummary } from "@shared/organizar";

const ALL = "__todos__";
const LIMIT = 100;
const dia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/**
 * Organizar › Movimentos: ver os movimentos de todos os meses, filtrar, escolher vários e mudar a categoria ou a
 * parcela de uma vez, ou eliminá-los. Tudo ou nada: se um estiver num mês fechado, nenhum muda.
 */
export function MovementsManager() {
  const { data } = useAppState();
  const save = useSave();
  const { toast } = useToast();
  const { ask, dialog } = useConfirm();
  const [month, setMonth] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [parcel, setParcel] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [limit, setLimit] = useState(LIMIT);
  const [change, setChange] = useState<"category" | "parcel" | null>(null);
  const [choice, setChoice] = useState("");

  const months = useMemo(() => [...(data?.months ?? [])].sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month)), [data?.months]);
  const rows = useMemo(
    () => filterMovements(data?.transactions ?? [], {
      monthId: month === ALL ? null : Number(month),
      category: category === ALL ? "" : category,
      parcelId: parcel === ALL ? null : Number(parcel),
      type: type === ALL ? "" : type,
      search,
    }),
    [data?.transactions, month, category, parcel, type, search],
  );
  if (!data) return null;

  const monthLabel = (id: number) => { const m = data.months.find((x) => x.id === id); return m ? `${m.label} ${m.year}` : ""; };
  const parcelName = (id: number | null) => data.parcels.find((p) => p.id === id)?.name ?? "—";
  const typeLabel = (t: string) => TRANSACTION_TYPES.find((x) => x.value === t)?.label ?? t;
  const categoryNames = Array.from(new Set([...data.categories.filter((c) => c.active).map((c) => c.name), ...data.transactions.map((t) => t.category.trim()).filter(Boolean)])).sort((a, b) => a.localeCompare(b, "pt"));
  const parcels = data.parcels.filter((p) => !p.archived);
  const shown = rows.slice(0, limit);
  const ids = rows.map((t) => t.id);
  const chosen = ids.filter((i) => selected.has(i));
  const sum = selectionSummary(rows, selected);
  const allChosen = rows.length > 0 && chosen.length === rows.length;

  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(allChosen ? new Set() : new Set(ids));
  const fail = (title: string) => (e: unknown) => toast({ title, description: errMsg(e), variant: "destructive" });
  const done = (text: string) => ({ onSuccess: (r: { count: number }) => { setSelected(new Set()); toast({ title: `${r.count} ${r.count === 1 ? "movimento" : "movimentos"} ${text}` }); } });

  const apply = () => {
    const patch = change === "category" ? { category: choice === NO_CATEGORY ? "" : choice } : { parcelId: Number(choice) };
    save.bulkTransactions.mutate({ ids: chosen, action: "update", patch }, {
      ...done(change === "category" ? "com a categoria mudada" : "passaram para outra parcela"),
      onError: fail("Não foi possível mudar"),
      onSettled: () => setChange(null),
    });
  };
  const remove = async () => {
    if (!(await ask(`Eliminar ${chosen.length} ${chosen.length === 1 ? "movimento" : "movimentos"}?`, "Esta ação não se desfaz. Se algum estiver num mês fechado, nenhum é eliminado."))) return;
    save.bulkTransactions.mutate({ ids: chosen, action: "delete" }, { ...done("eliminados"), onError: fail("Não foi possível eliminar") });
  };
  const open = (kind: "category" | "parcel") => { setChoice(kind === "category" ? (categoryNames[0] ?? NO_CATEGORY) : String(parcels[0]?.id ?? "")); setChange(kind); };

  const select = (label: string, value: string, set: (v: string) => void, options: { value: string; label: string }[], testId: string) => (
    <Select value={value} onValueChange={(v) => { set(v); setSelected(new Set()); setLimit(LIMIT); }}>
      <SelectTrigger aria-label={label} className="h-10 w-full sm:w-44" data-testid={testId}><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4" data-testid="mov-manage">
      {dialog}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setSelected(new Set()); setLimit(LIMIT); }} placeholder="Procurar por nota, categoria ou valor…" aria-label="Procurar movimentos" className="h-10 pl-9" data-testid="mov-search" />
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:contents">
        {select("Mês", month, setMonth, [{ value: ALL, label: "Todos os meses" }, ...months.map((m) => ({ value: String(m.id), label: `${m.label} ${m.year}` }))], "mov-month")}
        {select("Categoria", category, setCategory, [{ value: ALL, label: "Todas as categorias" }, { value: NO_CATEGORY, label: "Sem categoria" }, ...categoryNames.map((c) => ({ value: c, label: c }))], "mov-category")}
        {select("Parcela", parcel, setParcel, [{ value: ALL, label: "Todas as parcelas" }, ...parcels.map((p) => ({ value: String(p.id), label: p.name }))], "mov-parcel")}
        {select("Tipo", type, setType, [{ value: ALL, label: "Todos os tipos" }, ...TRANSACTION_TYPES.map((t) => ({ value: t.value, label: t.label }))], "mov-type")}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-card-border bg-card px-4 py-3" data-testid="mov-bar">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={allChosen} onCheckedChange={toggleAll} disabled={rows.length === 0} aria-label="Escolher todos os movimentos da lista" data-testid="mov-select-all" />
          {chosen.length === 0 ? `${rows.length} ${rows.length === 1 ? "movimento" : "movimentos"}` : `${chosen.length} escolhidos`}
        </label>
        {chosen.length > 0 && (
          <>
            <span className="text-xs text-muted-foreground" data-testid="mov-summary">
              {sum.out > 0 && `Saídas ${fmtEur(sum.out)}`}{sum.out > 0 && sum.into > 0 && " · "}{sum.into > 0 && `Entradas ${fmtEur(sum.into)}`}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" className="min-h-10 gap-1.5" onClick={() => open("category")} data-testid="mov-change-category"><Tags className="h-4 w-4" aria-hidden />Mudar categoria</Button>
              <Button variant="outline" className="min-h-10 gap-1.5" onClick={() => open("parcel")} data-testid="mov-change-parcel"><Layers className="h-4 w-4" aria-hidden />Mudar parcela</Button>
              <Button variant="outline" className="min-h-10 gap-1.5 text-destructive hover:text-destructive" onClick={remove} data-testid="mov-delete"><Trash2 className="h-4 w-4" aria-hidden />Eliminar</Button>
            </div>
          </>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground" data-testid="mov-empty">
            {data.transactions.length === 0 ? "Ainda não há movimentos. Regista a primeira despesa com o botão Registar." : "Nenhum movimento com estes filtros."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-5" data-testid={`mov-row-${t.id}`}>
                <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} aria-label={`Escolher movimento de ${dia(t.date)}${t.note ? `: ${t.note}` : ""}`} data-testid={`mov-check-${t.id}`} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{t.note || t.category || typeLabel(t.type)}</p>
                  <p className="text-xs text-muted-foreground">
                    {dia(t.date)} · {t.category || "sem categoria"} · {parcelName(t.parcelId)}{t.targetParcelId ? ` → ${parcelName(t.targetParcelId)}` : ""}
                    {month === ALL ? ` · ${monthLabel(t.monthId)}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums">{t.type === "expense" || t.type === "withdrawal" ? "−" : ""}{fmtEur(t.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {rows.length > shown.length && (
        <Button variant="ghost" onClick={() => setLimit((l) => l + LIMIT)} className="min-h-10" data-testid="mov-more">Mostrar mais ({rows.length - shown.length})</Button>
      )}

      <Dialog open={change !== null} onOpenChange={(o) => !o && setChange(null)}>
        <DialogContent data-testid="mov-dialog">
          <DialogHeader>
            <DialogTitle>{change === "category" ? "Mudar a categoria" : "Mudar a parcela"}</DialogTitle>
            <DialogDescription>Aplica-se a {chosen.length} {chosen.length === 1 ? "movimento" : "movimentos"}. Se algum estiver num mês fechado, nenhum muda.</DialogDescription>
          </DialogHeader>
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger aria-label={change === "category" ? "Nova categoria" : "Nova parcela"} className="h-10" data-testid="mov-choice"><SelectValue /></SelectTrigger>
            <SelectContent>
              {change === "category"
                ? [<SelectItem key={NO_CATEGORY} value={NO_CATEGORY}>Sem categoria</SelectItem>, ...categoryNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)]
                : parcels.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChange(null)}>Cancelar</Button>
            <Button onClick={apply} disabled={!choice || save.bulkTransactions.isPending} data-testid="mov-apply">Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
