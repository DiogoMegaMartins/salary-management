import { useState } from "react";
import { useLocation } from "wouter";
import { CalendarPlus, Copy, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAppState, useDerived, useSave } from "@/lib/app";
import { useFeatures } from "@/lib/features";
import { blankMonth } from "@/lib/new-month";
import type { Month } from "@shared/schema";
import { MONTH_NAMES, computeMonth, fmtEur, fmtPct } from "@shared/calc";
import { MonthEditor } from "@/components/months/month-editor";

export default function Months() {
  const features = useFeatures();
  const [, navigate] = useLocation();
  const { data, isLoading } = useAppState();
  const d = useDerived(data);
  const save = useSave();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Month | null>(null);
  const [deleting, setDeleting] = useState<Month | null>(null);
  const [creating, setCreating] = useState(false);

  if (isLoading || !d || !data) {
    return (
      <AppShell title="Meses" subtitle="A carregar…">
        <Skeleton className="h-[420px] rounded-lg" />
      </AppShell>
    );
  }

  const rows = d.months.map((m) => computeMonth(m, data.allocations, data.parcels, data.settings));
  const totals = rows.reduce(
    (a, r) => ({
      gross: a.gross + r.gross,
      descontos: a.descontos + r.descontos,
      net: a.net + r.net,
      meal: a.meal + r.meal,
      available: a.available + r.available,
      allocated: a.allocated + r.allocated,
      remaining: a.remaining + r.remaining,
    }),
    { gross: 0, descontos: 0, net: 0, meal: 0, available: 0, allocated: 0, remaining: 0 },
  );

  const nextMonth = () => {
    const last = d.allMonths[d.allMonths.length - 1];
    const year = last ? (last.month === 12 ? last.year + 1 : last.year) : new Date().getFullYear();
    const month = last ? (last.month === 12 ? 1 : last.month + 1) : new Date().getMonth() + 1;
    return { year, month };
  };

  return (
    <AppShell
      title="Meses"
      subtitle="Vencimento, subsídio de alimentação e divisão em parcelas"
      filters={<FilterBar d={d} showParcels={false} />}
      actions={
        <Button
          size="sm"
          className="gap-1.5"
          data-testid="button-new-month"
          onClick={() => {
            const { year, month } = nextMonth();
            // SM: não persiste ainda — só cria o mês na base de dados quando o utilizador guardar.
            setCreating(true);
            setEditing(blankMonth(data.settings, year, month));
          }}
        >
          <CalendarPlus className="h-4 w-4" />
          Novo mês
        </Button>
      }
    >
      {rows.length === 0 ? (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm font-medium">Sem meses neste período</p>
          <p className="text-xs text-muted-foreground">Ajusta os filtros ou cria um mês novo.</p>
        </div>
      ) : (
        <>
        <div className="space-y-3 md:hidden" data-testid="mobile-months">
          {rows.map((r) => <article key={r.month.id} className="rounded-2xl border border-card-border bg-card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <button className="min-w-0 text-left font-semibold" data-testid={`button-mobile-edit-${r.month.id}`} onClick={() => { setCreating(false); setEditing(r.month); }}>
                {r.month.label} <span className="text-muted-foreground">{r.month.year}</span>
              </button>
              <Badge variant="secondary">{r.month.status === "fechado" ? "Fechado" : "Aberto"}</Badge>
            </div>
            <dl className="my-3 grid grid-cols-2 gap-3 text-sm">
              {[["Disponível", r.available], ["Alocado", r.allocated], ["Líquido", r.net], ["Restante", r.remaining]].map(([label, value]) =>
                <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="tnum font-medium">{fmtEur(Number(value))}</dd></div>)}
            </dl>
            <div className="flex flex-wrap gap-2">
              {(features.divisao || features.movimentos) && <Button variant="outline" size="sm" onClick={() => navigate(`/divisao/${r.month.id}`)} data-testid={`button-mobile-division-${r.month.id}`}>Dividir valores</Button>}
              <Button variant="ghost" size="icon" aria-label={`Duplicar ${r.month.label}`} onClick={() => {
                const month = r.month.month === 12 ? 1 : r.month.month + 1;
                save.duplicateMonth.mutate({ id: r.month.id, year: r.month.year + (r.month.month === 12 ? 1 : 0), month, label: MONTH_NAMES[month - 1] });
              }}><Copy className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" disabled={r.month.status === "fechado"} aria-label={`Eliminar ${r.month.label}`} onClick={() => setDeleting(r.month)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </article>)}
          <p className="text-sm text-muted-foreground">Total de {rows.length} meses: <span className="tnum">{fmtEur(totals.available)}</span> disponível.</p>
        </div>
        <div className="hidden overflow-x-auto rounded-lg border border-card-border bg-card md:block">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 z-1 bg-card">
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Mês</th>
                <th className="px-3 py-2.5 text-right font-medium">Bruto</th>
                <th className="px-3 py-2.5 text-right font-medium">Descontos</th>
                <th className="px-3 py-2.5 text-right font-medium">Líquido</th>
                <th className="px-3 py-2.5 text-right font-medium">Subsídio</th>
                <th className="px-3 py-2.5 text-right font-medium">Disponível</th>
                <th className="px-3 py-2.5 text-right font-medium">Alocado</th>
                <th className="px-3 py-2.5 text-right font-medium">Restante</th>
                <th className="px-3 py-2.5 text-right font-medium">Poupança</th>
                <th className="px-2 py-2.5"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.month.id}
                  className="border-b border-border/60 last:border-0 hover:bg-accent/40"
                  data-testid={`row-month-${r.month.id}`}
                >
                  <td className="px-4 py-2.5">
                    <button
                      className="-my-1.5 py-1.5 text-left font-medium hover:text-primary"
                      onClick={() => {
                        setCreating(false);
                        setEditing(r.month);
                      }}
                      data-testid={`button-edit-${r.month.id}`}
                    >
                      {r.month.label}
                      <span className="ml-1.5 text-xs text-muted-foreground">{r.month.year}</span>
                    </button>
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-muted-foreground">{fmtEur(r.gross)}</td>
                  <td className="tnum px-3 py-2.5 text-right text-muted-foreground">
                    {fmtEur(r.descontos)}
                    {r.month.descontosMode === "manual" && (
                      <span className="ml-1 rounded-sm bg-muted px-1 py-0.5 text-[10px] font-medium uppercase text-muted-foreground" title="Descontos introduzidos à mão (não calculados)">manual</span>
                    )}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right font-medium">{fmtEur(r.net)}</td>
                  <td className="tnum px-3 py-2.5 text-right text-muted-foreground">{fmtEur(r.meal)}</td>
                  <td className="tnum px-3 py-2.5 text-right">{fmtEur(r.available)}</td>
                  <td className="tnum px-3 py-2.5 text-right text-muted-foreground">{fmtEur(r.allocated)}</td>
                  <td
                    className={`tnum px-3 py-2.5 text-right font-medium ${
                      r.remaining < -0.01 ? "text-destructive" : r.remaining > 0.01 ? "text-success" : ""
                    }`}
                  >
                    {fmtEur(r.remaining)}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-muted-foreground">{fmtPct(r.savingsRate, 0)}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Editar"
                        onClick={() => {
                          setCreating(false);
                          setEditing(r.month);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Duplicar para o mês seguinte"
                        data-testid={`button-duplicate-${r.month.id}`}
                        onClick={() => {
                          const month = r.month.month === 12 ? 1 : r.month.month + 1;
                          const year = r.month.month === 12 ? r.month.year + 1 : r.month.year;
                          save.duplicateMonth.mutate(
                            { id: r.month.id, year, month, label: MONTH_NAMES[month - 1] },
                            {
                              onSuccess: () =>
                                toast({
                                  title: "Mês duplicado",
                                  description: `${MONTH_NAMES[month - 1]} ${year} criado com os mesmos valores.`,
                                }),
                            },
                          );
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Eliminar"
                        data-testid={`button-delete-${r.month.id}`}
                        onClick={() => setDeleting(r.month)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/70 text-sm font-semibold">
                <td className="px-4 py-2.5">Total ({rows.length})</td>
                <td className="tnum px-3 py-2.5 text-right">{fmtEur(totals.gross)}</td>
                <td className="tnum px-3 py-2.5 text-right">{fmtEur(totals.descontos)}</td>
                <td className="tnum px-3 py-2.5 text-right">{fmtEur(totals.net)}</td>
                <td className="tnum px-3 py-2.5 text-right">{fmtEur(totals.meal)}</td>
                <td className="tnum px-3 py-2.5 text-right">{fmtEur(totals.available)}</td>
                <td className="tnum px-3 py-2.5 text-right">{fmtEur(totals.allocated)}</td>
                <td className="tnum px-3 py-2.5 text-right">{fmtEur(totals.remaining)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
        </>
      )}

      {editing && (
        <MonthEditor
          key={editing.id}
          month={d.allMonths.find((m) => m.id === editing.id) ?? editing}
          isNew={creating}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar {deleting?.label} {deleting?.year}?</AlertDialogTitle>
            <AlertDialogDescription>
              O mês e as respetivas alocações são removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
              disabled={save.deleteMonth.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!deleting) return;
                const target = deleting;
                save.deleteMonth.mutate(target.id, {
                  onSuccess: () => {
                    toast({ title: "Mês eliminado", description: `${target.label} ${target.year}` });
                    setDeleting(null);
                  },
                  onError: (err: any) => {
                    toast({
                      title: "Erro ao eliminar o mês",
                      description: err?.message ?? "Não foi possível eliminar. Tenta novamente.",
                      variant: "destructive",
                    });
                  },
                });
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
