import { allocations, months, parcels, settings, transactions, categories, platforms, parcelPlatforms, parcelTypes, txTypes, allocationPlatforms, allocationAssets, rulePlatforms, ruleAssets, subgoals, goalEntries, contributionLinks, fxRates, valuations, monthClosures, changeLog, recurringExpenses, recurrenceSkips, reserves, importBatches, normName } from "@shared/schema";
import type {
  Allocation,
  Month,
  Parcel,
  Settings,
  Transaction,
  Category,
  Platform,
  ParcelPlatform,
  AllocationPlatform,
  AllocationAsset,
  RulePlatform,
  RuleAsset,
  Subgoal,
  GoalEntry,
  ContributionLink,
  FxRate,
  Valuation,
  ParcelType,
  TxType,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import seedData from "./seed.json";
import { availableOf, allocationAmount, distribute, distributeAssets, type DistLine } from "@shared/calc";
import { db, sqlite, httpError, dataDir } from "./db";
import { secretCode } from "./access";
import { catalogMethods } from "./storage-catalogs";
import { goalMethods } from "./storage-goals";

// reexportados: o resto da aplicação importa daqui
export { dataDir, sqlite, db, httpError };

/** Divide o texto legado "A | B" em nomes. */
function splitPlatformText(text: string): string[] {
  return String(text ?? "")
    .split(/[|,;]/)
    .map((x) => x.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

/**
 * Migração idempotente: converte `parcels.platforms` (texto) em catálogo + ligações por ID.
 * Mantém a coluna de texto (usada pela Carteira) e não apaga nada.
 */
export function migratePlatformsFromText() {
  const run = sqlite.transaction(() => {
    const byNorm = new Map<string, number>();
    for (const pl of db.select().from(platforms).all()) byNorm.set(normName(pl.name), pl.id);
    const linked = new Set(db.select().from(parcelPlatforms).all().map((l) => `${l.parcelId}:${l.platformId}`));
    for (const p of db.select().from(parcels).all()) {
      for (const name of splitPlatformText(p.platforms)) {
        const key = normName(name);
        let id = byNorm.get(key);
        if (id == null) {
          id = db.insert(platforms).values({ name }).returning().get().id;
          byNorm.set(key, id);
        }
        if (!linked.has(`${p.id}:${id}`)) {
          db.insert(parcelPlatforms).values({ parcelId: p.id, platformId: id }).run();
          linked.add(`${p.id}:${id}`);
        }
      }
    }
  });
  run();
}

export type FullState = {
  monthClosures?: any[]; recurringExpenses?: any[]; recurrenceSkips?: any[]; reserves?: any[]; importBatches?: any[]; changeLog?: any[];
  subgoals: Subgoal[];
  goalEntries: GoalEntry[];
  contributionLinks: ContributionLink[];
  fxRates: FxRate[];
  valuations: Valuation[];
  allocationPlatforms: AllocationPlatform[];
  allocationAssets: AllocationAsset[];
  rulePlatforms: RulePlatform[];
  ruleAssets: RuleAsset[];
  platforms: Platform[];
  parcelPlatforms: ParcelPlatform[];
  parcelTypes: ParcelType[];
  txTypes: TxType[];
  settings: Settings;
  parcels: Parcel[];
  months: Month[];
  allocations: Allocation[];
  transactions: Transaction[];
  categories: Category[];
};

function seedIfEmpty() {
  const existing = db.select().from(settings).all();
  if (existing.length === 0) {
    db.insert(settings).values({ uiMode: "basico" }).run();
  }
  if (db.select().from(months).all().length > 0) return;
  if (db.select().from(parcels).all().length > 0) return;

  const seed = seedData as any;

  const parcelIds: number[] = [];
  for (const p of seed.parcels) {
    const row = db.insert(parcels).values(p).returning().get();
    parcelIds.push(row.id);
  }
  for (const m of seed.months) {
    const { allocations: allocs, ...rest } = m;
    const row = db.insert(months).values(rest).returning().get();
    for (const a of allocs) {
      db.insert(allocations)
        .values({ monthId: row.id, parcelId: parcelIds[a.parcelIndex], mode: a.mode, value: a.value })
        .run();
    }
  }
}

seedIfEmpty();

const MIG_ID = "evo02-platforms-from-text";
if (!sqlite.prepare("SELECT 1 FROM schema_migrations WHERE id = ?").get(MIG_ID)) {
  migratePlatformsFromText();
  sqlite.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(MIG_ID, new Date().toISOString());
}


export const storage = {
  getState(): FullState {
    const s = db.select().from(settings).all()[0] ?? db.insert(settings).values({ uiMode: "basico" }).returning().get();
    return {
      settings: s,
      parcels: db.select().from(parcels).all(),
      months: db.select().from(months).all(),
      allocations: db.select().from(allocations).all(),
      transactions: db.select().from(transactions).all(),
      categories: db.select().from(categories).all(),
      platforms: db.select().from(platforms).all(),
      parcelPlatforms: db.select().from(parcelPlatforms).all(),
      parcelTypes: db.select().from(parcelTypes).all(),
      txTypes: db.select().from(txTypes).all(),
      allocationPlatforms: db.select().from(allocationPlatforms).all(),
      allocationAssets: db.select().from(allocationAssets).all(),
      rulePlatforms: db.select().from(rulePlatforms).all(),
      ruleAssets: db.select().from(ruleAssets).all(),
      subgoals: db.select().from(subgoals).all(),
      goalEntries: db.select().from(goalEntries).all(),
      contributionLinks: db.select().from(contributionLinks).all(),
      fxRates: db.select().from(fxRates).all(),
      valuations: db.select().from(valuations).all(),
      monthClosures: db.select().from(monthClosures).all(),
      recurringExpenses: db.select().from(recurringExpenses).all(),
      recurrenceSkips: db.select().from(recurrenceSkips).all(),
      reserves: db.select().from(reserves).all(),
      importBatches: db.select().from(importBatches).all(),
      changeLog: db.select().from(changeLog).all(),
    };
  },

  ...catalogMethods,

  /** Valor guardado do código de acesso (hash, ou texto em bases antigas). Leitura direta e barata. */
  getAccessCode(): string {
    const secret = secretCode();
    if (secret) return secret; // Worker: o segredo ACCESS_CODE manda (ver server/access.ts)
    return (sqlite.prepare("SELECT access_code FROM settings ORDER BY id LIMIT 1").pluck().get() as string | undefined) ?? "";
  },
  updateSettings(patch: Partial<Settings>): Settings {
    const s = db.select().from(settings).all()[0];
    return db.update(settings).set(patch).where(eq(settings.id, s.id)).returning().get();
  },

  createParcel(data: Partial<Parcel>): Parcel {
    return db.insert(parcels).values(data as any).returning().get();
  },
  updateParcel(id: number, patch: Partial<Parcel>): Parcel {
    return db.update(parcels).set(patch).where(eq(parcels.id, id)).returning().get();
  },
  /** Executa várias escritas como uma só transação (tudo ou nada). */
  transaction<T>(fn: () => T): T {
    return sqlite.transaction(fn)();
  },
  deleteParcel(id: number) {
    const used =
      db.select().from(transactions).where(eq(transactions.parcelId, id)).all().length +
      db.select().from(transactions).where(eq(transactions.targetParcelId, id)).all().length +
      db.select().from(recurringExpenses).where(eq(recurringExpenses.parcelId, id)).all().length +
      db.select().from(reserves).where(eq(reserves.parcelId, id)).all().length;
    if (used > 0)
      throw httpError(409, `A parcela tem ${used} movimento(s), recorrência(s) ou reserva(s) associados. Arquiva-a em vez de eliminar.`);
    const closedWithValue = db
      .select()
      .from(allocations)
      .where(eq(allocations.parcelId, id))
      .all()
      .filter((a) => Number(a.value) > 0 && db.select().from(months).where(eq(months.id, a.monthId)).get()?.status === "fechado").length;
    if (closedWithValue > 0)
      throw httpError(409, `A parcela tem alocação em ${closedWithValue} mês(es) fechado(s). Arquiva-a em vez de eliminar, ou reabre esses meses.`);
    for (const a of db.select().from(allocations).where(eq(allocations.parcelId, id)).all()) {
      db.delete(allocationAssets).where(eq(allocationAssets.allocationId, a.id)).run();
      db.delete(allocationPlatforms).where(eq(allocationPlatforms.allocationId, a.id)).run();
    }
    for (const sg of db.select().from(subgoals).where(eq(subgoals.parcelId, id)).all())
      db.delete(contributionLinks).where(eq(contributionLinks.subgoalId, sg.id)).run();
    db.delete(subgoals).where(eq(subgoals.parcelId, id)).run();
    db.delete(goalEntries).where(eq(goalEntries.parcelId, id)).run();
    db.delete(valuations).where(eq(valuations.parcelId, id)).run();
    db.delete(allocations).where(eq(allocations.parcelId, id)).run();
    db.delete(parcelPlatforms).where(eq(parcelPlatforms.parcelId, id)).run();
    db.delete(parcels).where(eq(parcels.id, id)).run();
  },

  createMonth(data: Partial<Month>): Month {
    const row = db.insert(months).values(data as any).returning().get();
    for (const p of db.select().from(parcels).all()) {
      if (p.archived) continue;
      db.insert(allocations)
        .values({ monthId: row.id, parcelId: p.id, mode: p.defaultMode, value: p.defaultValue })
        .run();
    }
    return row;
  },
  updateMonth(id: number, patch: Partial<Month>): Month {
    return db.update(months).set(patch).where(eq(months.id, id)).returning().get();
  },
  deleteMonth(id: number) {
    for (const t of db.select().from(transactions).where(eq(transactions.monthId, id)).all())
      db.delete(contributionLinks).where(eq(contributionLinks.transactionId, t.id)).run();
    for (const a of db.select().from(allocations).where(eq(allocations.monthId, id)).all()) {
      db.delete(allocationAssets).where(eq(allocationAssets.allocationId, a.id)).run();
      db.delete(allocationPlatforms).where(eq(allocationPlatforms.allocationId, a.id)).run();
    }
    db.delete(allocations).where(eq(allocations.monthId, id)).run();
    db.delete(transactions).where(eq(transactions.monthId, id)).run();
    db.delete(monthClosures).where(eq(monthClosures.monthId, id)).run();
    db.update(monthClosures).set({ carryToMonthId: null }).where(eq(monthClosures.carryToMonthId, id)).run();
    db.delete(months).where(eq(months.id, id)).run();
  },

  /* -------------------------------------------------------- movimentos */
  listTransactions(monthId: number): Transaction[] {
    return db.select().from(transactions).where(eq(transactions.monthId, monthId)).all();
  },
  /**
   * Normaliza e valida data/valor/mês de um movimento (EVO-05). Datas são texto AAAA-MM-DD, nunca
   * interpretadas como instante (sem efeito de fuso horário). Se a data pertence a outro mês, o
   * movimento é movido para esse mês; se esse mês não existir, devolve 409 (nada é alterado).
   */
  normalizeTransaction(data: Partial<Transaction>, current?: Transaction): Partial<Transaction> {
    const out = { ...data };
    if (out.value !== undefined && Number.isFinite(Number(out.value))) out.value = Math.round((Number(out.value) + Number.EPSILON) * 100) / 100; // cêntimos
    if (out.value !== undefined && !(Number.isFinite(Number(out.value)) && Number(out.value) > 0))
      throw httpError(400, "O valor tem de ser maior que zero.");
    if (out.parcelId != null && !db.select().from(parcels).where(eq(parcels.id, Number(out.parcelId))).get())
      throw httpError(400, "Parcela inexistente.");
    if (out.targetParcelId != null && !db.select().from(parcels).where(eq(parcels.id, Number(out.targetParcelId))).get())
      throw httpError(400, "Parcela de destino inexistente.");
    if (out.monthId !== undefined && !db.select().from(months).where(eq(months.id, Number(out.monthId))).get())
      throw httpError(400, "Mês inexistente.");
    if (out.type !== undefined && !["expense", "transfer", "withdrawal", "contribution"].includes(String(out.type)))
      throw httpError(400, "Tipo de movimento inválido.");
    {
      const type = out.type ?? current?.type;
      const origin = out.parcelId !== undefined ? out.parcelId : current?.parcelId;
      const dest = out.targetParcelId !== undefined ? out.targetParcelId : current?.targetParcelId;
      if (type === "transfer" && (origin == null || dest == null || Number(origin) === Number(dest)))
        throw httpError(400, "Transferência exige origem e destino diferentes.");
    }
    if (out.date !== undefined) {
      const d = String(out.date).slice(0, 10);
      const ok = /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d + "T00:00:00Z")) && new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d;
      if (!ok) throw httpError(400, "Data inválida (AAAA-MM-DD).");
      out.date = d;
      const monthId = out.monthId ?? current?.monthId;
      const m = monthId != null ? db.select().from(months).where(eq(months.id, Number(monthId))).get() : undefined;
      if (!m) throw httpError(400, "Mês inexistente.");
      const [y, mo] = d.split("-").map(Number);
      if (m.year !== y || m.month !== mo) {
        // com meses repetidos (ex.: "Dezembro" e "Dezembro (subsídio)") prefere-se um aberto, depois o mais antigo
        const target = db.select().from(months).where(and(eq(months.year, y), eq(months.month, mo))).all()
          .sort((a, b) => Number(a.status === "fechado") - Number(b.status === "fechado") || a.id - b.id)[0];
        if (!target) throw httpError(409, `Não existe o mês ${String(mo).padStart(2, "0")}/${y}. Cria esse mês antes de usar esta data.`);
        // a data pode deslocar o movimento para outro mês: esse mês também tem de estar aberto
        if (target.status === "fechado") throw httpError(423, "O mês da data indicada está fechado. Reabre-o para alterar valores.");
        out.monthId = target.id;
      }
    }
    return out;
  },
  createTransaction(data: Partial<Transaction>): Transaction {
    data = this.normalizeTransaction(data);
    return db
      .insert(transactions)
      .values({ ...data, createdAt: new Date().toISOString() } as any)
      .returning()
      .get();
  },
  updateTransaction(id: number, patch: Partial<Transaction>): Transaction {
    const cur = db.select().from(transactions).where(eq(transactions.id, id)).get();
    if (!cur) throw httpError(404, "Movimento não encontrado.");
    patch = this.normalizeTransaction(patch, cur);
    // um aporte/retirada com valor atribuído a submetas tem de continuar a cobrir essa atribuição
    const links = db.select().from(contributionLinks).where(eq(contributionLinks.transactionId, id)).all();
    if (links.length) {
      const used = links.reduce((a, l) => a + Math.round(l.amount * 100), 0);
      const type = patch.type ?? cur.type;
      const value = patch.value ?? cur.value;
      const parcel = patch.parcelId !== undefined ? patch.parcelId : cur.parcelId;
      if (!["contribution", "withdrawal"].includes(type) || parcel !== cur.parcelId)
        throw httpError(409, "O movimento tem valor atribuído a submetas. Remove essas atribuições antes de mudar o tipo ou a parcela.");
      if (Math.round(value * 100) < used)
        throw httpError(409, `O movimento tem ${(used / 100).toFixed(2)} € atribuídos a submetas. Reduz as atribuições antes de baixar o valor.`);
    }
    return db.update(transactions).set(patch).where(eq(transactions.id, id)).returning().get();
  },
  deleteTransaction(id: number) {
    db.delete(contributionLinks).where(eq(contributionLinks.transactionId, id)).run();
    db.delete(transactions).where(eq(transactions.id, id)).run();
  },

  /* --------------------------------------------------------- categorias */
  listCategories(): Category[] {
    return db.select().from(categories).all();
  },
  createCategory(data: Partial<Category>): Category {
    return db.insert(categories).values(data as any).returning().get();
  },
  updateCategory(id: number, patch: Partial<Category>): Category {
    return db.update(categories).set(patch).where(eq(categories.id, id)).returning().get();
  },
  deleteCategory(id: number) {
    // nunca apagar categorias com historico; arquivar em vez disso via updateCategory({active:0})
    db.delete(categories).where(eq(categories.id, id)).run();
  },

  ...goalMethods,

  /** Total (€) da parcela no mês guardado, ou null se a alocação não existe. */
  allocationTotal(monthId: number, parcelId: number): number | null {
    const m = db.select().from(months).where(eq(months.id, monthId)).get();
    const a = db.select().from(allocations).where(and(eq(allocations.monthId, monthId), eq(allocations.parcelId, parcelId))).get();
    const st = db.select().from(settings).all()[0];
    if (!m || !a || !st) return null;
    return allocationAmount(a, availableOf(m, st));
  },
  getDistribution(monthId: number, parcelId: number): AllocationPlatform[] {
    const a = db.select().from(allocations).where(and(eq(allocations.monthId, monthId), eq(allocations.parcelId, parcelId))).get();
    return a ? db.select().from(allocationPlatforms).where(eq(allocationPlatforms.allocationId, a.id)).all() : [];
  },
  /** Substitui a distribuição por plataformas de uma parcela num mês. Planeamento: não toca em movimentos nem saldos. */
  setDistribution(monthId: number, parcelId: number, lines: DistLine[]): AllocationPlatform[] {
    const a = db.select().from(allocations).where(and(eq(allocations.monthId, monthId), eq(allocations.parcelId, parcelId))).get();
    const total = storage.allocationTotal(monthId, parcelId);
    if (!a || total == null) throw httpError(404, "Guarda o mês e a divisão antes de distribuir por plataformas.");
    const clean: DistLine[] = lines.map((l) => ({ platformId: Number(l.platformId), mode: l.mode === "percentagem" ? "percentagem" : "fixo", value: Number(l.value) }));
    const existing = new Set(storage.getDistribution(monthId, parcelId).map((l) => l.platformId));
    const catalog = new Map(db.select().from(platforms).all().map((p) => [p.id, p] as const));
    for (const l of clean) {
      const pl = catalog.get(l.platformId);
      if (!pl) throw httpError(400, "Plataforma inexistente.");
      if (pl.archived && !existing.has(l.platformId)) throw httpError(400, `A plataforma "${pl.name}" está arquivada.`);
    }
    const r = distribute(total, clean);
    if (!r.ok) throw httpError(409, r.error ?? "Distribuição inválida.");
    sqlite.transaction(() => {
      // ativos só existem dentro de plataformas ainda distribuídas; os das plataformas removidas saem com elas
      const keep = new Set(clean.map((l) => l.platformId));
      for (const x of db.select().from(allocationAssets).where(eq(allocationAssets.allocationId, a.id)).all())
        if (!keep.has(x.platformId)) db.delete(allocationAssets).where(eq(allocationAssets.id, x.id)).run();
      db.delete(allocationPlatforms).where(eq(allocationPlatforms.allocationId, a.id)).run();
      for (const l of clean) db.insert(allocationPlatforms).values({ allocationId: a.id, platformId: l.platformId, mode: l.mode, value: l.value }).run();
    })();
    return storage.getDistribution(monthId, parcelId);
  },

  getAssets(monthId: number, parcelId: number, platformId: number): AllocationAsset[] {
    const a = db.select().from(allocations).where(and(eq(allocations.monthId, monthId), eq(allocations.parcelId, parcelId))).get();
    if (!a) return [];
    return db.select().from(allocationAssets).where(and(eq(allocationAssets.allocationId, a.id), eq(allocationAssets.platformId, platformId))).all().sort((x, y) => x.position - y.position);
  },
  /** Substitui os ativos de uma plataforma numa alocação mensal. Só planeamento: não cria movimentos nem posições. */
  setAssets(monthId: number, parcelId: number, platformId: number, lines: { name: string; percent: number; note?: string }[]): AllocationAsset[] {
    const a = db.select().from(allocations).where(and(eq(allocations.monthId, monthId), eq(allocations.parcelId, parcelId))).get();
    const total = storage.allocationTotal(monthId, parcelId);
    if (!a || total == null) throw httpError(404, "Guarda o mês e a divisão antes.");
    const dist = storage.getDistribution(monthId, parcelId);
    const r0 = distribute(total, dist.map((l) => ({ platformId: l.platformId, mode: l.mode as any, value: l.value })));
    const idx = dist.findIndex((l) => l.platformId === platformId);
    if (!r0.ok) throw httpError(409, r0.error ?? "A distribuição guardada desta parcela é inválida.");
    if (idx < 0) throw httpError(409, "A plataforma tem de estar na distribuição guardada desta parcela.");
    const clean = (Array.isArray(lines) ? lines : []).map((l) => ({ name: String(l.name ?? "").trim().replace(/\s+/g, " "), percent: Number(l.percent), note: String(l.note ?? "").trim() }));
    const r = distributeAssets(r0.amountsCents[idx] / 100, clean);
    if (!r.ok) throw httpError(409, r.error ?? "Distribuição por ativos inválida.");
    sqlite.transaction(() => {
      db.delete(allocationAssets).where(and(eq(allocationAssets.allocationId, a.id), eq(allocationAssets.platformId, platformId))).run();
      clean.forEach((l, i) => db.insert(allocationAssets).values({ allocationId: a.id, platformId, name: l.name, percent: l.percent, note: l.note, position: i }).run());
    })();
    return storage.getAssets(monthId, parcelId, platformId);
  },

  setAllocation(monthId: number, parcelId: number, mode: string, value: number, included?: number): Allocation {
    if (mode === "fixo") value = Math.round((value + Number.EPSILON) * 100) / 100; // valores fixos em cêntimos; percentagens ficam como estão
    // não permitir reduzir o total abaixo do que já está distribuído por valor
    const lines = storage.getDistribution(monthId, parcelId);
    if (lines.length) {
      const m = db.select().from(months).where(eq(months.id, monthId)).get();
      const st = db.select().from(settings).all()[0];
      if (m && st) {
        const newTotal = allocationAmount({ mode, value } as any, availableOf(m, st));
        const r = distribute(newTotal, lines.map((l) => ({ platformId: l.platformId, mode: l.mode as any, value: l.value })));
        if (!r.ok) throw httpError(409, `Corrige primeiro a distribuição por plataformas: ${r.error}`);
      }
    }
    const existing = db
      .select()
      .from(allocations)
      .where(and(eq(allocations.monthId, monthId), eq(allocations.parcelId, parcelId)))
      .get();
    if (existing) {
      return db
        .update(allocations)
        .set(included === undefined ? { mode, value } : { mode, value, included })
        .where(eq(allocations.id, existing.id))
        .returning()
        .get();
    }
    return db.insert(allocations).values({ monthId, parcelId, mode, value, included: included ?? 1 }).returning().get();
  },

  /** A parcela tem modelo (regra de valor, fora por defeito, ou plataformas guardadas)? */
  parcelHasModel(p: Parcel): boolean {
    return p.defaultValue !== 0 || p.defaultIncluded === 0 || db.select().from(rulePlatforms).where(eq(rulePlatforms.parcelId, p.id)).all().length > 0;
  },

  /**
   * Guarda a divisão do mês como modelo: por parcela, se entra, o modo e o valor, as plataformas e os ativos.
   * Só as parcelas que têm alocação nesse mês.
   */
  saveAsModel(monthId: number): void {
    storage.transaction(() => {
      for (const a of db.select().from(allocations).where(eq(allocations.monthId, monthId)).all()) {
        storage.updateParcel(a.parcelId, { defaultMode: a.mode, defaultValue: a.value, defaultIncluded: a.included });
        db.delete(ruleAssets).where(eq(ruleAssets.parcelId, a.parcelId)).run();
        db.delete(rulePlatforms).where(eq(rulePlatforms.parcelId, a.parcelId)).run();
        for (const l of db.select().from(allocationPlatforms).where(eq(allocationPlatforms.allocationId, a.id)).all())
          db.insert(rulePlatforms).values({ parcelId: a.parcelId, platformId: l.platformId, mode: l.mode, value: l.value }).run();
        for (const x of db.select().from(allocationAssets).where(eq(allocationAssets.allocationId, a.id)).all())
          db.insert(ruleAssets).values({ parcelId: a.parcelId, platformId: x.platformId, name: x.name, percent: x.percent, note: x.note, position: x.position }).run();
      }
    });
  },

  /**
   * Aplica o modelo a um mês: só as parcelas ativas que têm modelo (as outras ficam como estão). Se o detalhe de
   * plataformas do modelo não couber no valor deste mês, a parcela fica sem detalhe e devolve-se o seu id.
   */
  applyModel(monthId: number): { semDetalhe: number[] } {
    const semDetalhe: number[] = [];
    storage.transaction(() => {
      const m = db.select().from(months).where(eq(months.id, monthId)).get();
      const st = db.select().from(settings).all()[0];
      for (const p of db.select().from(parcels).all().filter((x) => !x.archived && storage.parcelHasModel(x))) {
        const lines = db.select().from(rulePlatforms).where(eq(rulePlatforms.parcelId, p.id)).all();
        const old = db.select().from(allocations).where(and(eq(allocations.monthId, monthId), eq(allocations.parcelId, p.id))).get();
        // só se o modelo tiver plataformas é que substitui o detalhe do mês; sem elas, o detalhe existente fica
        // e, se o novo valor não o comportar, a gravação falha e nada muda (tudo ou nada)
        if (old && lines.length) {
          db.delete(allocationAssets).where(eq(allocationAssets.allocationId, old.id)).run();
          db.delete(allocationPlatforms).where(eq(allocationPlatforms.allocationId, old.id)).run();
        }
        const a = storage.setAllocation(monthId, p.id, p.defaultMode, p.defaultValue, p.defaultIncluded);
        if (!lines.length) continue;
        const total = m && st ? allocationAmount({ mode: a.mode, value: a.value } as any, availableOf(m, st)) : 0;
        const ok = distribute(total, lines.map((l) => ({ platformId: l.platformId, mode: l.mode as any, value: l.value }))).ok;
        if (!ok) { semDetalhe.push(p.id); continue; }
        for (const l of lines) db.insert(allocationPlatforms).values({ allocationId: a.id, platformId: l.platformId, mode: l.mode, value: l.value }).run();
        for (const x of db.select().from(ruleAssets).where(eq(ruleAssets.parcelId, p.id)).all())
          db.insert(allocationAssets).values({ allocationId: a.id, platformId: x.platformId, name: x.name, percent: x.percent, note: x.note, position: x.position }).run();
      }
    });
    return { semDetalhe };
  },

  /** Substitui todo o estado numa única transação: se algo falhar, nada é alterado. */
  replaceAll(state: {
    settings?: Partial<Settings>;
    parcels: Parcel[];
    months: Month[];
    allocations: Allocation[];
    transactions?: Transaction[];
    categories?: Category[];
    platforms?: Platform[];
    parcelPlatforms?: ParcelPlatform[];
    parcelTypes?: ParcelType[];
    txTypes?: TxType[];
    allocationPlatforms?: AllocationPlatform[];
    allocationAssets?: AllocationAsset[];
    rulePlatforms?: RulePlatform[];
    ruleAssets?: RuleAsset[];
    subgoals?: Subgoal[];
    goalEntries?: GoalEntry[];
    contributionLinks?: ContributionLink[];
    fxRates?: FxRate[];
    valuations?: Valuation[];
    monthClosures?: any[];
    recurringExpenses?: any[];
    recurrenceSkips?: any[];
    reserves?: any[];
    importBatches?: any[];
    changeLog?: any[];
  }) {
    sqlite.transaction(() => {
      db.delete(monthClosures).run();
      db.delete(recurringExpenses).run();
      db.delete(recurrenceSkips).run();
      db.delete(reserves).run();
      db.delete(importBatches).run();
      db.delete(changeLog).run();
      for (const x of state.monthClosures ?? []) db.insert(monthClosures).values(x).run();
      for (const x of state.recurringExpenses ?? []) db.insert(recurringExpenses).values(x).run();
      for (const x of state.recurrenceSkips ?? []) db.insert(recurrenceSkips).values(x).run();
      for (const x of state.reserves ?? []) db.insert(reserves).values(x).run();
      for (const x of state.importBatches ?? []) db.insert(importBatches).values(x).run();
      for (const x of state.changeLog ?? []) db.insert(changeLog).values(x).run();
      db.delete(contributionLinks).run();
      db.delete(goalEntries).run();
      db.delete(subgoals).run();
      db.delete(fxRates).run();
      db.delete(valuations).run();
      db.delete(allocationAssets).run();
      db.delete(allocationPlatforms).run();
      db.delete(ruleAssets).run();
      db.delete(rulePlatforms).run();
      db.delete(allocations).run();
      db.delete(transactions).run();
      db.delete(months).run();
      db.delete(parcels).run();
      db.delete(categories).run();
      db.delete(parcelPlatforms).run();
      db.delete(platforms).run();
      db.delete(parcelTypes).run();
      db.delete(txTypes).run();
      for (const t of state.parcelTypes ?? []) db.insert(parcelTypes).values(t as any).run();
      for (const t of state.txTypes ?? []) db.insert(txTypes).values(t as any).run();
      for (const p of state.platforms ?? []) db.insert(platforms).values(p as any).run();
      for (const p of state.parcels) db.insert(parcels).values(p as any).run();
      for (const l of state.parcelPlatforms ?? []) db.insert(parcelPlatforms).values(l as any).run();
      for (const m of state.months) db.insert(months).values(m as any).run();
      for (const a of state.allocations) db.insert(allocations).values(a as any).run();
      for (const l of state.allocationPlatforms ?? []) db.insert(allocationPlatforms).values(l as any).run();
      for (const x of state.allocationAssets ?? []) db.insert(allocationAssets).values(x as any).run();
      for (const l of state.rulePlatforms ?? []) db.insert(rulePlatforms).values(l as any).run();
      for (const x of state.ruleAssets ?? []) db.insert(ruleAssets).values(x as any).run();
      for (const x of state.fxRates ?? []) db.insert(fxRates).values(x as any).run();
      for (const x of state.valuations ?? []) db.insert(valuations).values(x as any).run();
      for (const x of state.subgoals ?? []) db.insert(subgoals).values(x as any).run();
      for (const x of state.goalEntries ?? []) db.insert(goalEntries).values(x as any).run();
      for (const t of state.transactions ?? []) db.insert(transactions).values(t as any).run();
      for (const c of state.categories ?? []) db.insert(categories).values(c as any).run();
      for (const x of state.contributionLinks ?? []) db.insert(contributionLinks).values(x as any).run();
      if (state.settings) {
        const { id, ...rest } = state.settings as any;
        storage.updateSettings(rest);
      }
      // backups antigos (sem catálogo): reconstrói plataformas a partir do texto
      if (!state.platforms) migratePlatformsFromText();
      else storage.syncParcelPlatformText();
    })();
  },

  /** Copia de seguranca automatica antes de substituir tudo (SM-003). */
  snapshotState(): FullState {
    return storage.getState();
  },
};
