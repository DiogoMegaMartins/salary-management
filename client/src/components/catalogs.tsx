import { useState } from "react";
import { Archive, ArchiveRestore, Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/components/confirm";
import { useToast } from "@/hooks/use-toast";
import { useSave, type AppState } from "@/lib/app";
import { KINDS } from "@shared/calc";
import { TX_NATURES } from "@shared/constants";

/** Extrai a mensagem útil de erros do tipo `409: {"message":"..."}`. */
export function errMsg(err: any): string {
  const raw = String(err?.message ?? "Erro inesperado");
  const i = raw.indexOf("{");
  if (i >= 0) {
    try {
      const j = JSON.parse(raw.slice(i));
      return j.message ?? j.error ?? raw;
    } catch {
      /* usa texto cru */
    }
  }
  return raw;
}

/* ------------------------------------------------------------------ dropdown de plataformas */

/**
 * Seleção múltipla reutilizável a partir do catálogo.
 * Plataformas arquivadas só aparecem se já estiverem selecionadas (histórico).
 */
export function PlatformPicker({
  state,
  value,
  onChange,
  testId,
}: {
  state: AppState;
  value: number[];
  onChange: (ids: number[]) => void;
  testId?: string;
}) {
  const save = useSave();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const all = state.platforms ?? [];
  const options = all.filter((p) => !p.archived || value.includes(p.id));
  const selected = all.filter((p) => value.includes(p.id));
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  const create = () => {
    save.createPlatform.mutate(
      { name },
      {
        onSuccess: (p: any) => {
          setName("");
          onChange([...value, p.id]);
        },
        onError: (e) => toast({ title: "Não foi possível criar", description: errMsg(e), variant: "destructive" }),
      },
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-auto min-h-9 w-full justify-between whitespace-normal px-2 py-2 text-left text-xs font-normal" data-testid={testId} aria-label="Plataformas">
          <span className="flex min-w-0 max-w-full flex-1 flex-wrap gap-1">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">Sem plataformas</span>
            ) : (
              selected.map((p) => (
                <Badge key={p.id} variant="secondary" className="min-w-0 max-w-full whitespace-normal text-[11px]">
                  <span className="min-w-0 wrap-anywhere">{p.name}{p.archived ? " (arquivada)" : ""}</span>
                </Badge>
              ))
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 p-2" align="start">
        {options.length === 0 && (
          <p className="px-1 py-2 text-xs text-muted-foreground">Ainda não há plataformas. Cria a primeira abaixo.</p>
        )}
        <div className="max-h-48 space-y-0.5 overflow-auto">
          {options.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className="flex w-full items-center gap-2 whitespace-normal rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted"
              aria-pressed={value.includes(p.id)}
              data-testid={`option-platform-${p.id}`}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border" aria-hidden="true">
                {value.includes(p.id) && <Check className="h-3 w-3" />}
              </span>
              <span className="min-w-0 wrap-anywhere">{p.name}</span>
              {p.archived ? <span className="text-muted-foreground">(arquivada)</span> : null}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 border-t pt-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Criar plataforma…"
            className="h-8 text-xs"
            aria-label="Nome da nova plataforma"
            onKeyDown={(e) => e.key === "Enter" && name.trim() && create()}
          />
          <Button size="sm" className="h-8" disabled={!name.trim() || save.createPlatform.isPending} onClick={create} aria-label="Criar plataforma">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ criar tipo (dialog) */

export function CreateTypeDialog({
  kind,
  open,
  onOpenChange,
  onCreated,
}: {
  kind: "parcel" | "tx";
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: (type: any) => void;
}) {
  const save = useSave();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [base, setBase] = useState(kind === "parcel" ? "investimento" : "despesa");
  const submit = () => {
    const opts = {
      onSuccess: (t: any) => {
        toast({ title: "Tipo criado" });
        setName("");
        onOpenChange(false);
        onCreated?.(t);
      },
      onError: (e: unknown) => toast({ title: "Não foi possível criar", description: errMsg(e), variant: "destructive" }),
    };
    if (kind === "parcel") save.createParcelType.mutate({ name, baseKind: base }, opts);
    else save.createTxType.mutate({ name, nature: base }, opts);
  };
  const options = kind === "parcel" ? KINDS.map((k) => ({ value: k.value as string, label: k.label })) : TX_NATURES.map((n) => ({ value: n.value as string, label: n.label }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{kind === "parcel" ? "Novo tipo de parcela/meta" : "Novo tipo de movimento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-type-name">Nome</Label>
            <Input id="new-type-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-new-type-name" />
          </div>
          <div className="space-y-1.5">
            <Label>{kind === "parcel" ? "Comportamento base" : "Natureza"}</Label>
            <Select value={base} onValueChange={setBase}>
              <SelectTrigger data-testid="select-new-type-base"><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!name.trim()} data-testid="button-create-type">Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ gestão central (Definições) */

type Row = { id: number; name: string; archived: number; sub: string };

function CatalogList({
  title,
  rows,
  onAdd,
  addLabel,
  onRename,
  onArchive,
  onDelete,
  testPrefix,
}: {
  title: string;
  rows: Row[];
  onAdd: () => void;
  addLabel: string;
  onRename: (id: number, name: string) => void;
  onArchive: (id: number, archived: boolean) => void;
  onDelete: (id: number) => void;
  testPrefix: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onAdd} data-testid={`button-add-${testPrefix}`}>
          <Plus className="h-3 w-3" />
          {addLabel}
        </Button>
      </div>
      {rows.length === 0 && <p className="text-xs text-muted-foreground">Ainda não há itens.</p>}
      {rows.map((r) => (
        <div key={r.id} className="catalog-row grid items-center gap-1.5" data-testid={`row-${testPrefix}-${r.id}`}>
          <Input
            defaultValue={r.name}
            aria-label={`Nome: ${r.name}`}
            className={`h-8 text-xs ${r.archived ? "text-muted-foreground" : ""}`}
            onBlur={(e) => e.target.value.trim() !== r.name && onRename(r.id, e.target.value)}
          />
          {r.sub && <Badge variant="outline" className="shrink-0 text-[11px]">{r.sub}</Badge>}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            title={r.archived ? "Reativar" : "Arquivar"}
            aria-label={r.archived ? "Reativar" : "Arquivar"}
            onClick={() => onArchive(r.id, !r.archived)}
          >
            {r.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            title="Eliminar"
            aria-label="Eliminar"
            onClick={() => onDelete(r.id)}
            data-testid={`button-delete-${testPrefix}-${r.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function CatalogsSection({ state }: { state: AppState }) {
  const save = useSave();
  const { toast } = useToast();
  const [newType, setNewType] = useState<null | "parcel" | "tx">(null);
  const [newPlatform, setNewPlatform] = useState("");
  const fail = (title: string) => (e: unknown) => toast({ title, description: errMsg(e), variant: "destructive" });
  const { ask, dialog: confirmDialog } = useConfirm();
  const confirmDelete = (what: string, run: () => void) =>
    ask(`Eliminar ${what}?`, "Só é possível se não estiver em uso.").then((ok) => ok && run());
  const natureLabel = (n: string) => TX_NATURES.find((x) => x.value === n)?.label ?? n;
  const kindLabel = (k: string) => KINDS.find((x) => x.value === k)?.label ?? k;

  return (
    <div className="catalog-grid grid gap-6" data-testid="section-catalogs">
      {confirmDialog}
      <div className="space-y-2">
        <CatalogList
          title="Plataformas"
          testPrefix="platform"
          addLabel="Nova"
          rows={(state.platforms ?? []).map((p) => ({ id: p.id, name: p.name, archived: p.archived, sub: p.archived ? "arquivada" : "" }))}
          onAdd={() => document.getElementById("new-platform-name")?.focus()}
          onRename={(id, name) => save.updatePlatform.mutate({ id, patch: { name } }, { onError: fail("Não foi possível renomear") })}
          onArchive={(id, archived) => save.updatePlatform.mutate({ id, patch: { archived: archived ? 1 : 0 } })}
          onDelete={(id) => confirmDelete("esta plataforma", () => save.deletePlatform.mutate(id, { onError: fail("Não foi possível eliminar") }))}
        />
        <div className="flex gap-1.5">
          <Input
            id="new-platform-name"
            value={newPlatform}
            onChange={(e) => setNewPlatform(e.target.value)}
            placeholder="Nome da plataforma"
            className="h-8 text-xs"
            aria-label="Nome da nova plataforma"
            data-testid="input-new-platform"
            onKeyDown={(e) => e.key === "Enter" && document.getElementById("btn-new-platform")?.click()}
          />
          <Button
            id="btn-new-platform"
            size="sm"
            className="h-8"
            disabled={!newPlatform.trim()}
            data-testid="button-create-platform"
            onClick={() => save.createPlatform.mutate({ name: newPlatform }, { onSuccess: () => setNewPlatform(""), onError: fail("Não foi possível criar") })}
          >
            Adicionar
          </Button>
        </div>
      </div>

      <CatalogList
        title="Tipos de parcela/meta"
        testPrefix="parcel-type"
        addLabel="Novo tipo"
        rows={(state.parcelTypes ?? []).map((t) => ({ id: t.id, name: t.name, archived: t.archived, sub: kindLabel(t.baseKind) }))}
        onAdd={() => setNewType("parcel")}
        onRename={(id, name) => save.updateParcelType.mutate({ id, patch: { name } }, { onError: fail("Não foi possível renomear") })}
        onArchive={(id, archived) => save.updateParcelType.mutate({ id, patch: { archived: archived ? 1 : 0 } })}
        onDelete={(id) => confirmDelete("este tipo", () => save.deleteParcelType.mutate(id, { onError: fail("Não foi possível eliminar") }))}
      />

      <CatalogList
        title="Tipos de movimento"
        testPrefix="tx-type"
        addLabel="Novo tipo"
        rows={(state.txTypes ?? []).map((t) => ({ id: t.id, name: t.name, archived: t.archived, sub: natureLabel(t.nature) }))}
        onAdd={() => setNewType("tx")}
        onRename={(id, name) => save.updateTxType.mutate({ id, patch: { name } }, { onError: fail("Não foi possível renomear") })}
        onArchive={(id, archived) => save.updateTxType.mutate({ id, patch: { archived: archived ? 1 : 0 } })}
        onDelete={(id) => confirmDelete("este tipo", () => save.deleteTxType.mutate(id, { onError: fail("Não foi possível eliminar") }))}
      />

      {newType && <CreateTypeDialog key={newType} kind={newType} open onOpenChange={(o) => !o && setNewType(null)} />}
    </div>
  );
}
