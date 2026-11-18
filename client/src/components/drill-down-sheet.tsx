import { useMemo, useState } from "react";
import { Download, Pencil, Trash2, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSave } from "@/lib/app";
import { fmtEur } from "@shared/calc";
import { TRANSACTION_TYPES } from "@shared/constants";
import type { Transaction } from "@shared/schema";

/**
 * SM-009: painel lateral de drill-down. Recebe um subconjunto de transações
 * já filtrado pelo chamador (ex.: gastos do período filtrado, ou de uma
 * parcela específica) e permite investigar, editar, apagar e exportar esse
 * subconjunto sem saír do contexto onde o KPI foi clicado.
 */
export function DrillDownSheet({
  open,
  onOpenChange,
  title,
  description,
  transactions,
  parcels,
  months,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  transactions: Transaction[];
  parcels: { id: number; name: string }[];
  months: { id: number; label: string }[];
}) {
  const save = useSave();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<Transaction>>({});

  const sorted = useMemo(
    () => [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [transactions],
  );
  const total = sorted.reduce((a, t) => a + t.value, 0);

  const monthLabel = (monthId: number) => months.find((m) => m.id === monthId)?.label ?? `#${monthId}`;
  const parcelName = (id: number | null | undefined) => (id != null ? parcels.find((p) => p.id === id)?.name : undefined);

  const startEdit = (t: Transaction) => {
    setEditingId(t.id);
    setDraft({ ...t });
  };

  const saveEdit = () => {
    if (editingId == null) return;
    save.updateTransaction.mutate(
      { id: editingId, patch: draft },
      { onSuccess: () => setEditingId(null) },
    );
  };

  const doDelete = (id: number) => {
    save.deleteTransaction.mutate(id, { onSuccess: () => setConfirmDeleteId(null) });
  };

  const exportCsv = () => {
    const header = ["Data", "Mês", "Tipo", "Categoria", "Parcela", "Destino", "Valor", "Nota"];
    const rows = sorted.map((t) => [
      t.date,
      monthLabel(t.monthId),
      TRANSACTION_TYPES.find((x) => x.value === t.type)?.label ?? t.type,
      t.category,
      parcelName(t.parcelId) ?? "",
      parcelName(t.targetParcelId) ?? "",
      t.value.toFixed(2).replace(".", ","),
      t.note,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg" data-testid="sheet-drilldown">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {sorted.length} {sorted.length === 1 ? "movimento" : "movimentos"}
          </span>
          <span className="tnum text-sm font-semibold">{fmtEur(total)}</span>
        </div>

        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={exportCsv}
            disabled={sorted.length === 0}
            data-testid="button-export-drilldown"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV deste subconjunto
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sem lançamentos individuais para este valor. Pode tratar-se de meses históricos, cujos
              dados existem apenas como alocação agregada por parcela (sem detalhe de movimentos).
            </p>
          )}

          {sorted.map((t) => {
            const label = TRANSACTION_TYPES.find((x) => x.value === t.type)?.label ?? t.type;
            const isEditing = editingId === t.id;
            return (
              <div
                key={t.id}
                className="rounded-md border border-border/60 bg-card p-3 text-sm"
                data-testid={`row-drilldown-${t.id}`}
              >
                {!isEditing ? (
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-[1_1_10rem]">
                      <p className="truncate font-medium">
                        {label}
                        {t.category && <span className="ml-1.5 text-xs text-muted-foreground">· {t.category}</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.date} · {monthLabel(t.monthId)}
                        {parcelName(t.parcelId) && ` · ${parcelName(t.parcelId)}`}
                        {parcelName(t.targetParcelId) && ` → ${parcelName(t.targetParcelId)}`}
                        {t.note && ` · ${t.note}`}
                      </p>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      <span className="tnum mr-1 text-sm font-medium">{fmtEur(t.value)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        aria-label="Editar movimento"
                        onClick={() => startEdit(t)}
                        data-testid={`button-edit-drilldown-${t.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        aria-label="Eliminar movimento"
                        onClick={() => setConfirmDeleteId(t.id)}
                        data-testid={`button-delete-drilldown-${t.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="responsive-form">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Data</Label>
                        <Input
                          type="date"
                          value={draft.date ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Valor</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={draft.value ?? 0}
                          onChange={(e) => setDraft((d) => ({ ...d, value: Number(e.target.value) }))}
                          className="h-8 text-sm tnum"
                          data-testid="input-edit-drilldown-value"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Parcela</Label>
                      <Select
                        value={draft.parcelId != null ? String(draft.parcelId) : ""}
                        onValueChange={(v) => setDraft((d) => ({ ...d, parcelId: Number(v) }))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Seleciona" />
                        </SelectTrigger>
                        <SelectContent>
                          {parcels.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Categoria</Label>
                      <Input
                        value={draft.category ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nota</Label>
                      <Input
                        value={draft.note ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                        <X className="mr-1 h-3.5 w-3.5" />
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={saveEdit} data-testid="button-save-edit-drilldown">
                        Guardar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>

      <AlertDialog open={confirmDeleteId != null} onOpenChange={(v) => !v && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar movimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o lançamento permanentemente e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteId != null && doDelete(confirmDeleteId)}
              data-testid="button-confirm-delete-drilldown"
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
