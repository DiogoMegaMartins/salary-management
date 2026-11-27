import { useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { checkName, filterRows, type ManageRow } from "@shared/organizar";

/**
 * Lista de gestão com o mesmo gesto para tudo (categorias, plataformas): pesquisar, criar, renomear, arquivar e eliminar.
 * Só se elimina o que não está em uso; o resto arquiva-se (deixa de aparecer nas escolhas, mas o histórico mantém-se).
 */
export function ManageList({
  testPrefix, noun, rows, usesLabel, placeholderNew, onCreate, onRename, onArchive, onDelete,
}: {
  testPrefix: string;
  noun: string;
  rows: ManageRow[];
  usesLabel: (uses: number) => string;
  placeholderNew: string;
  onCreate: (name: string) => void;
  onRename: (id: number, name: string) => void;
  onArchive: (id: number, archived: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const shown = filterRows(rows, query, showArchived);
  const archivedCount = rows.filter((r) => r.archived).length;

  const create = () => {
    const c = checkName(newName, rows);
    if (!c.ok) return setError(c.error);
    onCreate(c.name);
    setNewName(""); setAdding(false); setError(null);
  };
  const rename = (id: number) => {
    const c = checkName(editName, rows, id);
    if (!c.ok) return setError(c.error);
    onRename(id, c.name);
    setEditing(null); setError(null);
  };

  return (
    <div className="space-y-4" data-testid={`${testPrefix}-manage`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Procurar ${noun}…`} aria-label={`Procurar ${noun}`} className="h-10 pl-9" data-testid={`${testPrefix}-search`} />
        </div>
        <Button onClick={() => { setAdding(true); setError(null); }} className="min-h-10 gap-1.5" data-testid={`${testPrefix}-add`}>
          <Plus className="h-4 w-4" aria-hidden /> Nova
        </Button>
      </div>

      {adding && (
        <div className="rounded-2xl border border-card-border bg-card p-4" data-testid={`${testPrefix}-new`}>
          <label htmlFor={`${testPrefix}-new-name`} className="text-sm font-medium">Nome</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Input
              id={`${testPrefix}-new-name`} autoFocus value={newName} maxLength={80} placeholder={placeholderNew} className="h-10 min-w-0 flex-1 basis-48"
              onChange={(e) => { setNewName(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } if (e.key === "Escape") { setAdding(false); setError(null); } }}
              data-testid={`${testPrefix}-new-input`}
            />
            <Button onClick={create} className="min-h-10" data-testid={`${testPrefix}-new-save`}>Criar</Button>
            <Button variant="ghost" onClick={() => { setAdding(false); setError(null); }} className="min-h-10">Cancelar</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive" data-testid={`${testPrefix}-error`}>{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
        {shown.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground" data-testid={`${testPrefix}-empty`}>
            {query ? "Nada encontrado para esta pesquisa." : rows.length === 0 ? `Ainda não há ${noun}. Carrega em "Nova" para criar a primeira.` : `Não há ${noun} para mostrar.`}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((r) => (
              <li key={r.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5", r.archived && "bg-muted/30")} data-testid={`${testPrefix}-row-${r.id}`} data-archived={r.archived}>
                {editing === r.id ? (
                  <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                    <Input
                      autoFocus value={editName} maxLength={80} aria-label={`Novo nome de ${r.name}`} className="h-10 min-w-0 flex-1 basis-48"
                      onChange={(e) => { setEditName(e.target.value); setError(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); rename(r.id); } if (e.key === "Escape") { setEditing(null); setError(null); } }}
                      data-testid={`${testPrefix}-rename-input`}
                    />
                    <Button onClick={() => rename(r.id)} className="min-h-10" data-testid={`${testPrefix}-rename-save`}>Guardar</Button>
                    <Button variant="ghost" onClick={() => { setEditing(null); setError(null); }} className="min-h-10">Cancelar</Button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className={cn("break-words text-sm font-medium", r.archived && "text-muted-foreground")}>{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.archived ? "Arquivada · " : ""}{usesLabel(r.uses)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-10 w-10" aria-label={`Renomear ${r.name}`} title="Renomear" onClick={() => { setEditing(r.id); setEditName(r.name); setError(null); }} data-testid={`${testPrefix}-rename-${r.id}`}>
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-10 w-10" aria-label={`${r.archived ? "Restaurar" : "Arquivar"} ${r.name}`} title={r.archived ? "Restaurar" : "Arquivar"} onClick={() => onArchive(r.id, !r.archived)} data-testid={`${testPrefix}-archive-${r.id}`}>
                        {r.archived ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:text-destructive" disabled={r.uses > 0}
                        aria-label={`Eliminar ${r.name}`} title={r.uses > 0 ? "Está em uso: arquiva em vez de eliminar" : "Eliminar"}
                        onClick={() => onDelete(r.id)} data-testid={`${testPrefix}-delete-${r.id}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {archivedCount > 0 && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} aria-label="Mostrar arquivadas" data-testid={`${testPrefix}-show-archived`} />
          Mostrar arquivadas ({archivedCount})
        </label>
      )}
    </div>
  );
}
