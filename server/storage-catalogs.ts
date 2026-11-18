/** Plataformas, tipos de parcela e tipos de movimento (EVO-02). */
import type { Platform, ParcelType, TxType, Subgoal, GoalEntry, ContributionLink, FxRate } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { allocations, months, parcels, settings, transactions, platforms, parcelPlatforms, parcelTypes, txTypes, allocationPlatforms, subgoals, goalEntries, contributionLinks, fxRates, normName } from "@shared/schema";
import { db, sqlite, httpError } from "./db";

export const catalogMethods = {
  /** Lança Error com `.status` 400/409 para validação. */
  createPlatform(data: { name: string; currency?: string; notes?: string }): Platform {
    const name = String(data.name ?? "").trim().replace(/\s+/g, " ");
    if (!name) throw httpError(400, "O nome da plataforma é obrigatório.");
    if (db.select().from(platforms).all().some((p) => normName(p.name) === normName(name)))
      throw httpError(409, `Já existe uma plataforma chamada "${name}".`);
    return db.insert(platforms).values({ name, currency: data.currency ?? "", notes: data.notes ?? "" }).returning().get();
  },
  updatePlatform(id: number, patch: Partial<Platform>): Platform {
    const cur = db.select().from(platforms).where(eq(platforms.id, id)).get();
    if (!cur) throw httpError(404, "Plataforma não encontrada.");
    const set: Partial<Platform> = {};
    if (patch.name != null) {
      const name = String(patch.name).trim().replace(/\s+/g, " ");
      if (!name) throw httpError(400, "O nome da plataforma é obrigatório.");
      if (db.select().from(platforms).all().some((p) => p.id !== id && normName(p.name) === normName(name)))
        throw httpError(409, `Já existe uma plataforma chamada "${name}".`);
      set.name = name;
    }
    if (patch.archived != null) set.archived = patch.archived ? 1 : 0;
    if (patch.currency != null) set.currency = String(patch.currency);
    if (patch.notes != null) set.notes = String(patch.notes);
    const row = db.update(platforms).set(set).where(eq(platforms.id, id)).returning().get();
    catalogMethods.syncParcelPlatformText();
    return row;
  },
  deletePlatform(id: number) {
    const used =
      db.select().from(parcelPlatforms).where(eq(parcelPlatforms.platformId, id)).all().length +
      db.select().from(allocationPlatforms).where(eq(allocationPlatforms.platformId, id)).all().length +
      db.select().from(subgoals).where(eq(subgoals.platformId, id)).all().length;
    if (used > 0)
      throw httpError(409, `Plataforma em uso (${used} referência(s)). Arquiva-a em vez de eliminar.`);
    db.delete(platforms).where(eq(platforms.id, id)).run();
  },
  /** Define as plataformas de uma parcela (por IDs) e mantém o texto legado em sincronia. */
  setParcelPlatforms(parcelId: number, platformIds: number[]) {
    const ids = Array.from(new Set(platformIds.map(Number).filter(Number.isFinite)));
    const known = new Set(db.select().from(platforms).all().map((p) => p.id));
    if (ids.some((i) => !known.has(i))) throw httpError(400, "Plataforma inexistente.");
    sqlite.transaction(() => {
      db.delete(parcelPlatforms).where(eq(parcelPlatforms.parcelId, parcelId)).run();
      for (const platformId of ids) db.insert(parcelPlatforms).values({ parcelId, platformId }).run();
    })();
    catalogMethods.syncParcelPlatformText();
  },
  /** `parcels.platforms` (texto, lido pela Carteira) deriva sempre do catálogo. */
  syncParcelPlatformText() {
    const names = new Map(db.select().from(platforms).all().map((p) => [p.id, p.name] as const));
    const links = db.select().from(parcelPlatforms).all();
    for (const p of db.select().from(parcels).all()) {
      const text = links
        .filter((l) => l.parcelId === p.id)
        .map((l) => names.get(l.platformId))
        .filter(Boolean)
        .join(" | ");
      if (text !== p.platforms) db.update(parcels).set({ platforms: text }).where(eq(parcels.id, p.id)).run();
    }
  },

  createParcelType(data: { name: string; baseKind: string }): ParcelType {
    const name = String(data.name ?? "").trim().replace(/\s+/g, " ");
    if (!name) throw httpError(400, "O nome do tipo é obrigatório.");
    if (!["gastos", "poupanca", "investimento"].includes(data.baseKind)) throw httpError(400, "Comportamento base inválido.");
    const builtin = ["gastos", "poupança", "poupanca", "investimento"];
    if (builtin.includes(normName(name)) || db.select().from(parcelTypes).all().some((t) => normName(t.name) === normName(name)))
      throw httpError(409, `Já existe um tipo chamado "${name}".`);
    return db.insert(parcelTypes).values({ name, baseKind: data.baseKind }).returning().get();
  },
  updateParcelType(id: number, patch: Partial<ParcelType>): ParcelType {
    const set: Partial<ParcelType> = {};
    if (patch.name != null) {
      const name = String(patch.name).trim().replace(/\s+/g, " ");
      if (!name) throw httpError(400, "O nome do tipo é obrigatório.");
      if (db.select().from(parcelTypes).all().some((t) => t.id !== id && normName(t.name) === normName(name)))
        throw httpError(409, `Já existe um tipo chamado "${name}".`);
      set.name = name;
    }
    if (patch.archived != null) set.archived = patch.archived ? 1 : 0;
    return db.update(parcelTypes).set(set).where(eq(parcelTypes.id, id)).returning().get();
  },
  deleteParcelType(id: number) {
    const used = db.select().from(parcels).where(eq(parcels.typeId, id)).all().length;
    if (used > 0) throw httpError(409, `Tipo em uso por ${used} parcela(s). Arquiva-o em vez de eliminar.`);
    db.delete(parcelTypes).where(eq(parcelTypes.id, id)).run();
  },

  createTxType(data: { name: string; nature: string }): TxType {
    const name = String(data.name ?? "").trim().replace(/\s+/g, " ");
    if (!name) throw httpError(400, "O nome do tipo é obrigatório.");
    if (!["entrada", "despesa", "transferencia", "ajuste"].includes(data.nature)) throw httpError(400, "Natureza inválida.");
    if (db.select().from(txTypes).all().some((t) => normName(t.name) === normName(name)))
      throw httpError(409, `Já existe um tipo chamado "${name}".`);
    return db.insert(txTypes).values({ name, nature: data.nature }).returning().get();
  },
  updateTxType(id: number, patch: Partial<TxType>): TxType {
    const set: Partial<TxType> = {};
    if (patch.name != null) {
      const name = String(patch.name).trim().replace(/\s+/g, " ");
      if (!name) throw httpError(400, "O nome do tipo é obrigatório.");
      if (db.select().from(txTypes).all().some((t) => t.id !== id && normName(t.name) === normName(name)))
        throw httpError(409, `Já existe um tipo chamado "${name}".`);
      set.name = name;
    }
    if (patch.archived != null) set.archived = patch.archived ? 1 : 0;
    return db.update(txTypes).set(set).where(eq(txTypes.id, id)).returning().get();
  },
  deleteTxType(id: number) {
    const used = db.select().from(transactions).where(eq(transactions.typeId, id)).all().length;
    if (used > 0) throw httpError(409, `Tipo em uso por ${used} movimento(s). Arquiva-o em vez de eliminar.`);
    db.delete(txTypes).where(eq(txTypes.id, id)).run();
  },
};
