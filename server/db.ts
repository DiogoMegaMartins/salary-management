/** Ligação à base de dados SQLite (Drizzle), criação/migração do esquema e erros HTTP partilhados. */
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

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
CREATE TABLE IF NOT EXISTS valuations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parcel_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  value REAL NOT NULL,
  note TEXT NOT NULL DEFAULT ''
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
CREATE TABLE IF NOT EXISTS auth_failures (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  n INTEGER NOT NULL,
  first INTEGER NOT NULL,
  PRIMARY KEY (scope, key)
);
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`);

/** Arredonda a cêntimos, com meios-cêntimos para longe de zero (Math.round(-1234.5) daria -1234). */
export function roundCents(n: number): number {
  return (Math.sign(n) * Math.round((Math.abs(n) + Number.EPSILON) * 100)) / 100;
}

export function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}
