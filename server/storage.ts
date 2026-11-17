import { allocations, months, parcels, settings, transactions, categories, platforms, parcelPlatforms, parcelTypes, txTypes, allocationPlatforms, allocationAssets, subgoals, goalEntries, contributionLinks, fxRates, monthClosures, changeLog, recurringExpenses, recurrenceSkips, reserves, importBatches, normName } from "@shared/schema";
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
  Subgoal,
  GoalEntry,
  ContributionLink,
  FxRate,
  ParcelType,
  TxType,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and } from "drizzle-orm";
import seedData from "./seed.json";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { availableOf, allocationAmount, distribute, distributeAssets, type DistLine } from "@shared/calc";

/** Pasta dos dados: DATA_DIR (ex.: um volume persistente) ou a pasta de trabalho. */
export const dataDir = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : process.cwd();
mkdirSync(dataDir, { recursive: true });
export const dbPath = process.env.DB_PATH ? resolve(process.env.DB_PATH) : join(dataDir, "data.db");
export const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

sqlite.exec(`
CREATE TABLE IF NOT EXISTS parcels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'investimento',
  color TEXT NOT NULL DEFAULT '#2f9e8f',
  platforms TEXT NOT NULL DEFAULT '',
  default_mode TEXT NOT NULL DEFAULT 'fixo',
  default_value REAL NOT NULL DEFAULT 0,
  target_amount REAL,
  target_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS months (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  base REAL NOT NULL DEFAULT 0,
  extraordinaria REAL NOT NULL DEFAULT 0,
  outros_irs_ss REAL NOT NULL DEFAULT 0,
  outros_irs REAL NOT NULL DEFAULT 0,
  isentos REAL NOT NULL DEFAULT 0,
  taxa_irs_base REAL NOT NULL DEFAULT 0,
  taxa_irs_extra REAL NOT NULL DEFAULT 0,
  taxa_ss REAL NOT NULL DEFAULT 0.11,
  irs_jovem TEXT NOT NULL DEFAULT '',
  descontos_mode TEXT NOT NULL DEFAULT 'auto',
  descontos_manual REAL NOT NULL DEFAULT 0,
  meal_daily REAL NOT NULL DEFAULT 0,
  meal_days REAL NOT NULL DEFAULT 0,
  deficit_reason TEXT NOT NULL DEFAULT '',
  deficit_note TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_id INTEGER NOT NULL,
  parcel_id INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'fixo',
  value REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  default_meal_daily REAL NOT NULL DEFAULT 10.2,
  include_meal INTEGER NOT NULL DEFAULT 0,
  exclude_outros_irs_from_net INTEGER NOT NULL DEFAULT 1,
  default_taxa_ss REAL NOT NULL DEFAULT 0.11,
  default_taxa_irs_base REAL NOT NULL DEFAULT 0.0424,
  default_taxa_irs_extra REAL NOT NULL DEFAULT 0,
  last_backup_at TEXT NOT NULL DEFAULT '',
  backup_reminder_days INTEGER NOT NULL DEFAULT 30,
  access_code TEXT NOT NULL DEFAULT '',
  last_restore_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 0,
  parcel_id INTEGER,
  target_parcel_id INTEGER,
  category TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  monthly_budget REAL NOT NULL DEFAULT 0,
  essential INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
`);

/* migracoes leves para bases de dados criadas antes destas colunas */
for (const stmt of [
  "ALTER TABLE settings ADD COLUMN access_code TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE settings ADD COLUMN last_restore_at TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE months ADD COLUMN deficit_reason TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE months ADD COLUMN deficit_note TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE settings ADD COLUMN annual_savings_goal REAL NOT NULL DEFAULT 0",
  "ALTER TABLE settings ADD COLUMN emergency_parcel_ids TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE settings ADD COLUMN runway_months_window INTEGER NOT NULL DEFAULT 3",
  "ALTER TABLE settings ADD COLUMN surplus_suggestion_threshold REAL NOT NULL DEFAULT 50",
  "ALTER TABLE settings ADD COLUMN page_layouts TEXT NOT NULL DEFAULT '{}'",
  "ALTER TABLE parcels ADD COLUMN type_id INTEGER",
  "ALTER TABLE transactions ADD COLUMN type_id INTEGER",
  "ALTER TABLE parcels ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR'",
  "ALTER TABLE months ADD COLUMN status TEXT NOT NULL DEFAULT 'aberto'",
  "ALTER TABLE months ADD COLUMN carry_in REAL NOT NULL DEFAULT 0",
  "ALTER TABLE transactions ADD COLUMN recurrence_id INTEGER",
  "ALTER TABLE transactions ADD COLUMN occurrence_key TEXT",
  "ALTER TABLE transactions ADD COLUMN import_batch_id INTEGER",
]) {
  try {
    sqlite.exec(stmt);
  } catch {
    /* coluna ja existe */
  }
}

/* ---- EVO-02: catálogos (tabelas novas, aditivas; nada existente é alterado ou apagado) ---- */
sqlite.exec(`
CREATE TABLE IF NOT EXISTS platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS parcel_platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parcel_id INTEGER NOT NULL,
  platform_id INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS parcel_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  base_kind TEXT NOT NULL DEFAULT 'investimento',
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tx_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  nature TEXT NOT NULL DEFAULT 'despesa',
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS allocation_platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  allocation_id INTEGER NOT NULL,
  platform_id INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'fixo',
  value REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS subgoals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parcel_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  platform_id INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  target REAL,
  deadline TEXT
);
CREATE TABLE IF NOT EXISTS goal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parcel_id INTEGER NOT NULL,
  subgoal_id INTEGER,
  kind TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS contribution_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  subgoal_id INTEGER NOT NULL,
  amount REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS fx_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate REAL NOT NULL,
  date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual'
);
CREATE TABLE IF NOT EXISTS allocation_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  allocation_id INTEGER NOT NULL,
  platform_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  percent REAL NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS month_closures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  remainder REAL NOT NULL DEFAULT 0,
  destination TEXT NOT NULL DEFAULT 'manter',
  target_parcel_id INTEGER,
  carry_to_month_id INTEGER,
  note TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS change_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  action TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  value REAL NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  parcel_id INTEGER,
  day_of_month INTEGER NOT NULL DEFAULT 1,
  start_month TEXT NOT NULL,
  end_month TEXT,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS recurrence_skips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurrence_key TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reserves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  target REAL NOT NULL,
  due_month TEXT NOT NULL,
  reserved REAL NOT NULL DEFAULT 0,
  parcel_id INTEGER,
  status TEXT NOT NULL DEFAULT 'ativa',
  paid_transaction_id INTEGER
);
CREATE TABLE IF NOT EXISTS import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  rows INTEGER NOT NULL DEFAULT 0,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`);

/** Divide o texto legado "A | B" em nomes. */
export function splitPlatformText(text: string): string[] {
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
  allocationPlatforms: AllocationPlatform[];
  allocationAssets: AllocationAsset[];
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
    db.insert(settings).values({}).run();
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

/** Arredonda a cêntimos, com meios-cêntimos para longe de zero (Math.round(-1234.5) daria -1234). */
export function roundCents(n: number): number {
  return (Math.sign(n) * Math.round((Math.abs(n) + Number.EPSILON) * 100)) / 100;
}

export function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

export const storage = {
  getState(): FullState {
    const s = db.select().from(settings).all()[0] ?? db.insert(settings).values({}).returning().get();
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
      subgoals: db.select().from(subgoals).all(),
      goalEntries: db.select().from(goalEntries).all(),
      contributionLinks: db.select().from(contributionLinks).all(),
      fxRates: db.select().from(fxRates).all(),
      monthClosures: db.select().from(monthClosures).all(),
      recurringExpenses: db.select().from(recurringExpenses).all(),
      recurrenceSkips: db.select().from(recurrenceSkips).all(),
      reserves: db.select().from(reserves).all(),
      importBatches: db.select().from(importBatches).all(),
      changeLog: db.select().from(changeLog).all(),
    };
  },

  /* ------------------------------------------------ catálogos (EVO-02) */
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
    storage.syncParcelPlatformText();
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
    storage.syncParcelPlatformText();
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

  /** Valor guardado do código de acesso (hash, ou texto em bases antigas). Leitura direta e barata. */
  getAccessCode(): string {
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
    for (const a of db.select().from(allocations).where(eq(allocations.parcelId, id)).all()) {
      db.delete(allocationAssets).where(eq(allocationAssets.allocationId, a.id)).run();
      db.delete(allocationPlatforms).where(eq(allocationPlatforms.allocationId, a.id)).run();
    }
    for (const sg of db.select().from(subgoals).where(eq(subgoals.parcelId, id)).all())
      db.delete(contributionLinks).where(eq(contributionLinks.subgoalId, sg.id)).run();
    db.delete(subgoals).where(eq(subgoals.parcelId, id)).run();
    db.delete(goalEntries).where(eq(goalEntries.parcelId, id)).run();
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
        const target = db.select().from(months).where(and(eq(months.year, y), eq(months.month, mo))).get();
        if (!target) throw httpError(409, `Não existe o mês ${String(mo).padStart(2, "0")}/${y}. Cria esse mês antes de usar esta data.`);
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

  /* ---------------------------------------------- metas: saldos, ajustes, submetas (EVO-04) */
  createGoalEntry(d: { parcelId: number; subgoalId?: number | null; kind: string; amount: number; currency?: string; date: string; note?: string }): GoalEntry {
    const parcel = db.select().from(parcels).where(eq(parcels.id, Number(d.parcelId))).get();
    if (!parcel) throw httpError(404, "Meta não encontrada.");
    if (!["inicial", "ajuste"].includes(d.kind)) throw httpError(400, "Tipo inválido.");
    if (!Number.isFinite(Number(d.amount))) throw httpError(400, "Valor inválido.");
    d = { ...d, amount: roundCents(Number(d.amount)) };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date))) throw httpError(400, "Data inválida (AAAA-MM-DD).");
    let currency = parcel.currency || "EUR";
    const subgoalId = d.subgoalId == null ? null : Number(d.subgoalId);
    if (subgoalId != null) {
      const sg = db.select().from(subgoals).where(eq(subgoals.id, subgoalId)).get();
      if (!sg || sg.parcelId !== parcel.id) throw httpError(400, "Submeta inválida.");
      currency = sg.currency;
    }
    if (d.kind === "inicial" && Number(d.amount) < 0) throw httpError(400, "O saldo inicial não pode ser negativo.");
    if (d.kind === "ajuste" && Number(d.amount) === 0) throw httpError(400, "Um ajuste de 0 não altera nada.");
    return sqlite.transaction(() => {
      if (d.kind === "inicial") {
        // um único saldo inicial por meta/submeta: substitui, mantendo ajustes
        const prev = db.select().from(goalEntries).where(eq(goalEntries.parcelId, parcel.id)).all()
          .filter((e) => e.kind === "inicial" && (e.subgoalId ?? null) === subgoalId);
        for (const e of prev) db.delete(goalEntries).where(eq(goalEntries.id, e.id)).run();
      }
      return db.insert(goalEntries).values({ parcelId: parcel.id, subgoalId, kind: d.kind, amount: Number(d.amount), currency, date: d.date, note: String(d.note ?? "") }).returning().get();
    })();
  },
  /** Edita valor, data e nota de um saldo inicial ou ajuste (o tipo e a meta/submeta não mudam). */
  updateGoalEntry(id: number, patch: { amount?: number; date?: string; note?: string }): GoalEntry {
    const cur = db.select().from(goalEntries).where(eq(goalEntries.id, id)).get();
    if (!cur) throw httpError(404, "Registo não encontrado.");
    const set: Partial<GoalEntry> = {};
    if (patch.amount !== undefined) {
      const n = Number(patch.amount);
      if (!Number.isFinite(n)) throw httpError(400, "Valor inválido.");
      const amount = roundCents(n);
      if (cur.kind === "inicial" && amount < 0) throw httpError(400, "O saldo inicial não pode ser negativo.");
      if (cur.kind === "ajuste" && amount === 0) throw httpError(400, "Um ajuste de 0 não altera nada.");
      set.amount = amount;
    }
    if (patch.date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(patch.date))) throw httpError(400, "Data inválida (AAAA-MM-DD).");
      set.date = String(patch.date);
    }
    if (patch.note !== undefined) set.note = String(patch.note).slice(0, 500);
    if (!Object.keys(set).length) return cur;
    return db.update(goalEntries).set(set).where(eq(goalEntries.id, id)).returning().get();
  },
  deleteGoalEntry(id: number) {
    db.delete(goalEntries).where(eq(goalEntries.id, id)).run();
  },

  createSubgoal(d: { parcelId: number; name: string; platformId?: number | null; currency?: string; target?: number | null; deadline?: string | null }): Subgoal {
    const name = String(d.name ?? "").trim().replace(/\s+/g, " ");
    if (!name) throw httpError(400, "O nome da submeta é obrigatório.");
    const parcel = db.select().from(parcels).where(eq(parcels.id, Number(d.parcelId))).get();
    if (!parcel) throw httpError(404, "Meta não encontrada.");
    if (db.select().from(subgoals).where(eq(subgoals.parcelId, parcel.id)).all().some((x) => normName(x.name) === normName(name)))
      throw httpError(409, `Já existe uma submeta "${name}" nesta meta.`);
    const currency = String(d.currency || parcel.currency || "EUR").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw httpError(400, "Moeda inválida (ex.: EUR, USD).");
    if (d.platformId != null && !db.select().from(platforms).where(eq(platforms.id, Number(d.platformId))).get())
      throw httpError(400, "Plataforma inexistente.");
    const target = d.target == null || d.target === ("" as any) ? null : Number(d.target);
    if (target != null && (!Number.isFinite(target) || target < 0)) throw httpError(400, "Objetivo inválido.");
    return db.insert(subgoals).values({ parcelId: parcel.id, name, platformId: d.platformId ?? null, currency, target, deadline: d.deadline || null }).returning().get();
  },
  updateSubgoal(id: number, patch: Partial<Subgoal>): Subgoal {
    const cur = db.select().from(subgoals).where(eq(subgoals.id, id)).get();
    if (!cur) throw httpError(404, "Submeta não encontrada.");
    const set: Partial<Subgoal> = {};
    if (patch.name != null) {
      const name = String(patch.name).trim().replace(/\s+/g, " ");
      if (!name) throw httpError(400, "O nome da submeta é obrigatório.");
      if (db.select().from(subgoals).where(eq(subgoals.parcelId, cur.parcelId)).all().some((x) => x.id !== id && normName(x.name) === normName(name)))
        throw httpError(409, `Já existe uma submeta "${name}" nesta meta.`);
      set.name = name;
    }
    if (patch.platformId !== undefined) set.platformId = patch.platformId;
    if (patch.target !== undefined) set.target = patch.target == null ? null : Number(patch.target);
    if (patch.deadline !== undefined) set.deadline = patch.deadline || null;
    if (patch.currency != null && patch.currency !== cur.currency) {
      const used = db.select().from(goalEntries).where(eq(goalEntries.subgoalId, id)).all().length;
      if (used) throw httpError(409, "Não é possível mudar a moeda de uma submeta com saldos registados.");
      set.currency = String(patch.currency).toUpperCase();
    }
    return db.update(subgoals).set(set).where(eq(subgoals.id, id)).returning().get();
  },
  /** Bloqueia se houver movimentos atribuídos ou saldos/ajustes: nunca apaga silenciosamente. */
  deleteSubgoal(id: number) {
    const links = db.select().from(contributionLinks).where(eq(contributionLinks.subgoalId, id)).all().length;
    const entries = db.select().from(goalEntries).where(eq(goalEntries.subgoalId, id)).all().length;
    if (links || entries)
      throw httpError(409, `A submeta tem ${links} movimento(s) atribuído(s) e ${entries} saldo(s)/ajuste(s). Remove-os ou reatribui antes de eliminar.`);
    db.delete(subgoals).where(eq(subgoals.id, id)).run();
  },

  /** Atribui parte de um aporte/retirada a uma submeta; a soma atribuída nunca excede o valor do movimento. */
  createContributionLink(d: { transactionId: number; subgoalId: number; amount: number }): ContributionLink {
    const tx = db.select().from(transactions).where(eq(transactions.id, Number(d.transactionId))).get();
    const sg = db.select().from(subgoals).where(eq(subgoals.id, Number(d.subgoalId))).get();
    if (!tx || !sg) throw httpError(404, "Movimento ou submeta inexistente.");
    if (!["contribution", "withdrawal"].includes(tx.type) || tx.parcelId !== sg.parcelId)
      throw httpError(400, "Só aportes/retiradas da mesma meta podem ser atribuídos a uma submeta.");
    if (sg.currency !== (db.select().from(parcels).where(eq(parcels.id, sg.parcelId)).get()?.currency ?? "EUR"))
      throw httpError(400, "Os movimentos estão em moeda da meta; usa saldo inicial/ajustes em submetas de outra moeda.");
    const amount = Number(d.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw httpError(400, "Montante inválido.");
    const used = db.select().from(contributionLinks).where(eq(contributionLinks.transactionId, tx.id)).all().reduce((a, l) => a + Math.round(l.amount * 100), 0);
    if (used + Math.round(amount * 100) > Math.round(tx.value * 100))
      throw httpError(409, `Só restam ${((Math.round(tx.value * 100) - used) / 100).toFixed(2)} € por atribuir neste movimento.`);
    return db.insert(contributionLinks).values({ transactionId: tx.id, subgoalId: sg.id, amount }).returning().get();
  },
  deleteContributionLink(id: number) {
    db.delete(contributionLinks).where(eq(contributionLinks.id, id)).run();
  },

  createFxRate(d: { fromCurrency: string; toCurrency: string; rate: number; date: string }): FxRate {
    const from = String(d.fromCurrency ?? "").toUpperCase();
    const to = String(d.toCurrency ?? "").toUpperCase();
    if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || from === to) throw httpError(400, "Moedas inválidas.");
    const rate = Number(d.rate);
    if (!Number.isFinite(rate) || rate <= 0) throw httpError(400, "A taxa tem de ser positiva.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date))) throw httpError(400, "Data inválida (AAAA-MM-DD).");
    return db.insert(fxRates).values({ fromCurrency: from, toCurrency: to, rate, date: d.date, source: "manual" }).returning().get();
  },
  deleteFxRate(id: number) {
    db.delete(fxRates).where(eq(fxRates.id, id)).run();
  },

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
    if (idx < 0 || !r0.ok) throw httpError(409, "A plataforma tem de estar na distribuição guardada desta parcela.");
    const clean = (Array.isArray(lines) ? lines : []).map((l) => ({ name: String(l.name ?? "").trim().replace(/\s+/g, " "), percent: Number(l.percent), note: String(l.note ?? "").trim() }));
    const r = distributeAssets(r0.amountsCents[idx] / 100, clean);
    if (!r.ok) throw httpError(409, r.error ?? "Distribuição por ativos inválida.");
    sqlite.transaction(() => {
      db.delete(allocationAssets).where(and(eq(allocationAssets.allocationId, a.id), eq(allocationAssets.platformId, platformId))).run();
      clean.forEach((l, i) => db.insert(allocationAssets).values({ allocationId: a.id, platformId, name: l.name, percent: l.percent, note: l.note, position: i }).run());
    })();
    return storage.getAssets(monthId, parcelId, platformId);
  },

  setAllocation(monthId: number, parcelId: number, mode: string, value: number): Allocation {
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
        .set({ mode, value })
        .where(eq(allocations.id, existing.id))
        .returning()
        .get();
    }
    return db.insert(allocations).values({ monthId, parcelId, mode, value }).returning().get();
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
    subgoals?: Subgoal[];
    goalEntries?: GoalEntry[];
    contributionLinks?: ContributionLink[];
    fxRates?: FxRate[];
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
      db.delete(allocationAssets).run();
      db.delete(allocationPlatforms).run();
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
      for (const x of state.fxRates ?? []) db.insert(fxRates).values(x as any).run();
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
