/** Regras puras do menu Organizar: linhas das listas, pesquisa, nomes válidos e uso de cada item. */
export type ManageRow = { id: number; name: string; archived: boolean; uses: number };

const norm = (s: string) => s.trim().replace(/\s+/g, " ");
const same = (a: string, b: string) => norm(a).toLowerCase() === norm(b).toLowerCase();

/** Quantos movimentos usam cada categoria (comparação sem maiúsculas nem espaços a mais). */
export function categoryRows(
  categories: { id: number; name: string; active: number }[],
  transactions: { category: string }[],
): ManageRow[] {
  return categories.map((c) => ({ id: c.id, name: c.name, archived: c.active === 0, uses: transactions.filter((t) => same(t.category, c.name)).length }));
}

/** Quantas parcelas usam cada plataforma (pelas ligações parcela-plataforma). */
export function platformRows(
  platforms: { id: number; name: string; archived: number }[],
  links: { platformId: number }[],
): ManageRow[] {
  return platforms.map((p) => ({ id: p.id, name: p.name, archived: p.archived === 1, uses: links.filter((l) => l.platformId === p.id).length }));
}

/**
 * Quantas coisas usam cada parcela: movimentos (como origem ou destino), recorrências e reservas.
 * É o mesmo critério do servidor para recusar eliminar uma parcela.
 */
export function parcelRows(
  parcels: { id: number; name: string; archived: number }[],
  transactions: { parcelId?: number | null; targetParcelId?: number | null }[],
  recurring: { parcelId?: number | null }[] = [],
  reserves: { parcelId?: number | null }[] = [],
): ManageRow[] {
  return parcels.map((p) => ({
    id: p.id,
    name: p.name,
    archived: p.archived === 1,
    uses:
      transactions.filter((t) => t.parcelId === p.id || t.targetParcelId === p.id).length +
      recurring.filter((r) => r.parcelId === p.id).length +
      reserves.filter((r) => r.parcelId === p.id).length,
  }));
}

/** Pesquisa por nome (sem acentos nem maiúsculas) e, por defeito, sem as arquivadas. Ordem: ativas por nome, depois arquivadas. */
export function filterRows(rows: ManageRow[], query: string, showArchived: boolean): ManageRow[] {
  const strip = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const q = strip(query.trim());
  return rows
    .filter((r) => (showArchived || !r.archived) && (!q || strip(r.name).includes(q)))
    .sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, "pt"));
}

export type NameCheck = { ok: true; name: string } | { ok: false; error: string };

/** Nome novo ou renomeado: obrigatório, até 60 caracteres e sem repetir outro (ignorando o próprio). */
export function checkName(input: string, rows: ManageRow[], selfId?: number): NameCheck {
  const name = norm(input);
  if (!name) return { ok: false, error: "Indica um nome." };
  if (name.length > 60) return { ok: false, error: "O nome pode ter no máximo 60 caracteres." };
  const dup = rows.find((r) => r.id !== selfId && same(r.name, name));
  if (dup) return { ok: false, error: dup.archived ? `Já existe "${dup.name}", arquivada. Restaura-a em vez de criar outra.` : `Já existe "${dup.name}".` };
  return { ok: true, name };
}

/** Texto de uso ("12 movimentos", "sem uso"). */
export function usesText(uses: number, singular: string, plural: string): string {
  return uses === 0 ? "sem uso" : `${uses} ${uses === 1 ? singular : plural}`;
}
