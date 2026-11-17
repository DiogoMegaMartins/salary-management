import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAppState, useSave } from "@/lib/app";
import type { Transaction } from "@shared/schema";
import { TRANSACTION_TYPES, TX_NATURES } from "@shared/schema";
import { CreateTypeDialog } from "@/components/catalogs";
import { fmtEur } from "@shared/calc";
import { Plus, ArrowRightLeft } from "lucide-react";
import { NumberField } from "@/components/months/number-field";

export function TransactionsPanel({
  monthId,
  parcels,
  transactions,
}: {
  monthId: number;
  parcels: { id: number; name: string }[];
  transactions: Transaction[];
}) {
  const save = useSave();
  const { toast } = useToast();
  const { data } = useAppState();
  const categories = (data?.categories ?? []).filter((c) => c.active);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<string>("expense");
  const [txTypeId, setTxTypeId] = useState<number | null>(null);
  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const customTypes = (data?.txTypes ?? []).filter((t) => !t.archived && t.nature !== "ajuste");
  const natureBase = (n: string) => TX_NATURES.find((x) => x.value === n)?.baseType ?? "expense";
  const [value, setValue] = useState(0);
  const [parcelId, setParcelId] = useState<number | "">("");
  const [targetParcelId, setTargetParcelId] = useState<number | "">("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState(false);
  const [note, setNote] = useState("");
  // data por omissão: hoje, se cair no mês que se está a editar; senão o dia 1 desse mês
  const [date, setDate] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    const m = data?.months.find((x) => x.id === monthId);
    if (!m) return today;
    const prefix = `${m.year}-${String(m.month).padStart(2, "0")}`;
    return today.startsWith(prefix) ? today : `${prefix}-01`;
  });

  const reset = () => {
    setAdding(false);
    setType("expense");
    setTxTypeId(null);
    setValue(0);
    setParcelId("");
    setTargetParcelId("");
    setCategory("");
    setCustomCategory(false);
    setNote("");
  };

  const submit = () => {
    if (type === "transfer" && (!parcelId || !targetParcelId)) {
      toast({
        title: "Falta origem ou destino",
        description: "Transferências exigem parcela de origem e de destino.",
        variant: "destructive",
      });
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast({
        title: "Valor inválido",
        description: "Indica um valor válido e maior que zero para o lançamento.",
        variant: "destructive",
      });
      return;
    }
    if (!monthId || monthId < 0) {
      toast({
        title: "Guarda o mês primeiro",
        description: "Guarda o mês antes de adicionar lançamentos.",
        variant: "destructive",
      });
      return;
    }
    save.createTransaction.mutate(
      {
        monthId,
        date,
        type,
        typeId: txTypeId,
        value,
        parcelId: parcelId === "" ? null : Number(parcelId),
        targetParcelId: targetParcelId === "" ? null : Number(targetParcelId),
        category,
        note,
      } as any,
      {
        onSuccess: () => {
          toast({ title: "Lançamento adicionado" });
          reset();
        },
        onError: (err: any) => {
          toast({
            title: "Erro ao adicionar lançamento",
            description: err?.message ?? "Não foi possível guardar. Tenta novamente.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      {newTypeOpen && (
        <CreateTypeDialog
          kind="tx"
          open
          onOpenChange={setNewTypeOpen}
          onCreated={(t) => {
            setTxTypeId(t.id);
            setType(natureBase(t.nature));
          }}
        />
      )}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lançamentos deste mês</p>
        {!adding && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setAdding(true)} data-testid="button-add-transaction">
            <Plus className="h-3.5 w-3.5" />
            Novo lançamento
          </Button>
        )}
      </div>

      {adding && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select
                value={txTypeId ? `t:${txTypeId}` : type}
                onValueChange={(v) => {
                  if (v === "__new__") return setNewTypeOpen(true);
                  if (v.startsWith("t:")) {
                    const t = customTypes.find((x) => x.id === Number(v.slice(2)));
                    setTxTypeId(Number(v.slice(2)));
                    if (t) setType(natureBase(t.nature));
                  } else {
                    setTxTypeId(null);
                    setType(v);
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs" data-testid="select-tx-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                  {customTypes.map((t) => (
                    <SelectItem key={t.id} value={`t:${t.id}`}>{t.name}</SelectItem>
                  ))}
                  <SelectItem value="__new__">Criar tipo…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <NumberField label="Valor" value={value} onChange={setValue} testId="input-tx-value" />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              {customCategory || categories.length === 0 ? (
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-9 text-sm"
                  placeholder="Ex.: mercado"
                  data-testid="input-tx-category-custom"
                />
              ) : (
                <Select
                  value={category}
                  onValueChange={(v) => (v === "__custom__" ? setCustomCategory(true) : setCategory(v))}
                >
                  <SelectTrigger className="h-9 text-xs" data-testid="select-tx-category">
                    <SelectValue placeholder="Seleciona ou escreve" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">Escrever outra…</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {customCategory && categories.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => {
                    setCustomCategory(false);
                    setCategory("");
                  }}
                >
                  Escolher da lista
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{type === "transfer" ? "Origem" : "Parcela"}</Label>
              <Select value={String(parcelId)} onValueChange={(v) => setParcelId(Number(v))}>
                <SelectTrigger className="h-9 text-xs" data-testid="select-tx-parcel">
                  <SelectValue placeholder="Seleciona" />
                </SelectTrigger>
                <SelectContent>
                  {parcels.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {type === "transfer" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Destino</Label>
                <Select value={String(targetParcelId)} onValueChange={(v) => setTargetParcelId(Number(v))}>
                  <SelectTrigger className="h-9 text-xs" data-testid="select-tx-target">
                    <SelectValue placeholder="Seleciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {parcels.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Nota</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-9 text-sm" placeholder="Opcional" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={reset}>Cancelar</Button>
            <Button size="sm" onClick={submit} data-testid="button-save-transaction">Adicionar</Button>
          </div>
        </div>
      )}

      {transactions.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem lançamentos individuais neste mês.</p>
      ) : (
        <div className="space-y-1.5">
          {transactions.map((t) => {
            const label = TRANSACTION_TYPES.find((x) => x.value === t.type)?.label ?? t.type;
            const origin = parcels.find((p) => p.id === t.parcelId)?.name;
            const target = parcels.find((p) => p.id === t.targetParcelId)?.name;
            return (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm"
                data-testid={`row-transaction-${t.id}`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {t.type === "transfer" && <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {label}
                      {t.category && <span className="ml-1.5 text-xs text-muted-foreground">· {t.category}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.date}
                      {origin && ` · ${origin}`}
                      {target && ` → ${target}`}
                      {t.note && ` · ${t.note}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tnum text-sm font-medium">{fmtEur(t.value)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => save.deleteTransaction.mutate(t.id)}
                    data-testid={`button-delete-transaction-${t.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
