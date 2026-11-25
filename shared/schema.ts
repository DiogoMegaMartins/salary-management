import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
export { TRANSACTION_TYPES, TX_NATURES } from "./constants";

/* ---------------------------------------------------------------- parcelas */

export const parcels = sqliteTable("parcels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("investimento"), // gastos | poupanca | investimento
  color: text("color").notNull().default("#2f9e8f"),
  platforms: text("platforms").notNull().default(""),
  defaultMode: text("default_mode").notNull().default("fixo"), // fixo | percentagem
  defaultValue: real("default_value").notNull().default(0),
  targetAmount: real("target_amount"),
  targetDate: text("target_date"),
  sortOrder: integer("sort_order").notNull().default(0),
  archived: integer("archived").notNull().default(0),
  typeId: integer("type_id"), // tipo personalizado (EVO-02); `kind` mantém o comportamento base
  currency: text("currency").notNull().default("EUR"), // moeda de referência da meta (EVO-04)
  defaultIncluded: integer("default_included").notNull().default(1), // modelo: a parcela entra por defeito nos meses novos
});

export type Parcel = typeof parcels.$inferSelect;

/* ------------------------------------------------------------------- meses */

export const months = sqliteTable("months", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  label: text("label").notNull(), // "Dezembro (SF)" etc.
  sortOrder: integer("sort_order").notNull().default(0),

  // vencimento
  base: real("base").notNull().default(0),
  extraordinaria: real("extraordinaria").notNull().default(0),
  outrosIrsSs: real("outros_irs_ss").notNull().default(0),
  outrosIrs: real("outros_irs").notNull().default(0),
  isentos: real("isentos").notNull().default(0),

  // taxas
  taxaIrsBase: real("taxa_irs_base").notNull().default(0),
  taxaIrsExtra: real("taxa_irs_extra").notNull().default(0),
  taxaSs: real("taxa_ss").notNull().default(0.11),
  irsJovem: text("irs_jovem").notNull().default(""),

  // descontos: auto (formula) ou manual (valor do recibo)
  descontosMode: text("descontos_mode").notNull().default("auto"), // auto | manual
  descontosManual: real("descontos_manual").notNull().default(0),

  // subsidio de alimentacao
  mealDaily: real("meal_daily").notNull().default(0),
  mealDays: real("meal_days").notNull().default(0),

  // reconciliacao (SM-001)
  deficitReason: text("deficit_reason").notNull().default(""), // reducao_saldo | movimento_parcela | credito | correcao
  deficitNote: text("deficit_note").notNull().default(""),

  notes: text("notes").notNull().default(""),

  // fecho mensal (EVO-08): aberto/fechado, transporte recebido do mês anterior (não é rendimento)
  status: text("status").notNull().default("aberto"), // aberto | fechado
  carryIn: real("carry_in").notNull().default(0),
});

export type Month = typeof months.$inferSelect;

/* -------------------------------------------------------------- alocacoes */

export const allocations = sqliteTable("allocations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  monthId: integer("month_id").notNull(),
  parcelId: integer("parcel_id").notNull(),
  mode: text("mode").notNull().default("fixo"), // fixo | percentagem
  value: real("value").notNull().default(0),
  included: integer("included").notNull().default(1), // 0 = parcela fora deste mês (valor e detalhe ficam guardados)
});

export type Allocation = typeof allocations.$inferSelect;

/* ------------------------------------------------------------ configuracao */

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  defaultMealDaily: real("default_meal_daily").notNull().default(10.2),
  includeMeal: integer("include_meal").notNull().default(0),
  excludeOutrosIrsFromNet: integer("exclude_outros_irs_from_net").notNull().default(1),
  defaultTaxaSs: real("default_taxa_ss").notNull().default(0.11),
  defaultTaxaIrsBase: real("default_taxa_irs_base").notNull().default(0.0424),
  defaultTaxaIrsExtra: real("default_taxa_irs_extra").notNull().default(0),
  lastBackupAt: text("last_backup_at").notNull().default(""),
  lastRestoreAt: text("last_restore_at").notNull().default(""),
  backupReminderDays: integer("backup_reminder_days").notNull().default(30),
  accessCode: text("access_code").notNull().default(""),

  // SM-005: projeção de final de ano
  annualSavingsGoal: real("annual_savings_goal").notNull().default(0),

  // SM-006: reserva de emergência / runway
  emergencyParcelIds: text("emergency_parcel_ids").notNull().default(""), // csv de ids
  runwayMonthsWindow: integer("runway_months_window").notNull().default(3), // 3 | 6 | 12
  surplusSuggestionThreshold: real("surplus_suggestion_threshold").notNull().default(50), // SM-007: só sugere acima deste valor

  // layouts personalizados (arrastar/redimensionar) por página, serializados em JSON
  pageLayouts: text("page_layouts").notNull().default("{}"),

  // funcionalidades desligadas (JSON só com o que está desligado, ex.: {"parcelas":false}); vazio = tudo ligado
  features: text("features").notNull().default("{}"),

  // arranque no primeiro uso já feito (0 = ainda por fazer)
  onboardingDone: integer("onboarding_done").notNull().default(0),

  // assistente com IA para frases livres: desligado por defeito; modelo "haiku" ou "sonnet"
  aiEnabled: integer("ai_enabled").notNull().default(0),
  aiModel: text("ai_model").notNull().default("haiku"),

  // aparência: cor da app ("ceu", "salvia", "pessego", "lavanda", "mare") e modo ("auto", "claro", "escuro")
  palette: text("palette").notNull().default("ceu"),
  colorMode: text("color_mode").notNull().default("auto"),

  // modo de utilização: "basico" (o essencial) ou "detalhado" (tudo); quem já usa a app fica no detalhado
  uiMode: text("ui_mode").notNull().default("detalhado"),
});

export type Settings = typeof settings.$inferSelect;

/* ------------------------------------------------------------- movimentos */

/**
 * Lançamentos individuais a partir de agora (SM-001/SM-002). O histórico
 * anterior continua representado apenas por `allocations`; não é migrado
 * retroativamente para transações.
 */
export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  monthId: integer("month_id").notNull(),
  date: text("date").notNull(), // ISO 8601
  type: text("type").notNull(), // expense | transfer | withdrawal | contribution
  value: real("value").notNull().default(0),
  parcelId: integer("parcel_id"), // origem (expense/withdrawal/contribution) ou origem da transferência
  targetParcelId: integer("target_parcel_id"), // destino, só para transfer
  category: text("category").notNull().default(""),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(""),
  typeId: integer("type_id"), // tipo de movimento personalizado (EVO-02); `type` mantém o comportamento base
  recurrenceId: integer("recurrence_id"), // origem recorrente (EVO-08)
  occurrenceKey: text("occurrence_key"), // "<recurrenceId>:AAAA-MM": evita duplicar a mesma ocorrência
  importBatchId: integer("import_batch_id"), // lote de importação CSV
});

export type Transaction = typeof transactions.$inferSelect;


/* ---------------------------------------------------------------- categorias (SM-004) */

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  monthlyBudget: real("monthly_budget").notNull().default(0),
  essential: integer("essential").notNull().default(0),
  active: integer("active").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type Category = typeof categories.$inferSelect;

/* ------------------------------------------------ catálogos (EVO-02) */

export const platforms = sqliteTable("platforms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  archived: integer("archived").notNull().default(0),
  currency: text("currency").notNull().default(""),
  notes: text("notes").notNull().default(""),
});
export type Platform = typeof platforms.$inferSelect;

/** Ligação parcela ↔ plataforma por IDs estáveis. */
export const parcelPlatforms = sqliteTable("parcel_platforms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  parcelId: integer("parcel_id").notNull(),
  platformId: integer("platform_id").notNull(),
});
export type ParcelPlatform = typeof parcelPlatforms.$inferSelect;

/** Tipo personalizado de parcela/meta; `baseKind` = gastos | poupanca | investimento. */
export const parcelTypes = sqliteTable("parcel_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  baseKind: text("base_kind").notNull().default("investimento"),
  archived: integer("archived").notNull().default(0),
});
export type ParcelType = typeof parcelTypes.$inferSelect;

/** Tipo personalizado de movimento; `nature` = entrada | despesa | transferencia | ajuste. */
export const txTypes = sqliteTable("tx_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nature: text("nature").notNull().default("despesa"),
  archived: integer("archived").notNull().default(0),
});
export type TxType = typeof txTypes.$inferSelect;


/** Linha da distribuição mensal de uma parcela por plataforma (planeamento; não cria movimentos). */
export const allocationPlatforms = sqliteTable("allocation_platforms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  allocationId: integer("allocation_id").notNull(),
  platformId: integer("platform_id").notNull(),
  mode: text("mode").notNull().default("fixo"), // fixo | percentagem
  value: real("value").notNull().default(0),
});
export type AllocationPlatform = typeof allocationPlatforms.$inferSelect;

/** Modelo: plataformas por defeito de uma parcela (espelho de `allocation_platforms`, para os meses novos). */
export const rulePlatforms = sqliteTable("rule_platforms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  parcelId: integer("parcel_id").notNull(),
  platformId: integer("platform_id").notNull(),
  mode: text("mode").notNull().default("fixo"), // fixo | percentagem
  value: real("value").notNull().default(0),
});
export type RulePlatform = typeof rulePlatforms.$inferSelect;

/** Modelo: ativos por defeito dentro de uma plataforma de uma parcela (espelho de `allocation_assets`). */
export const ruleAssets = sqliteTable("rule_assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  parcelId: integer("parcel_id").notNull(),
  platformId: integer("platform_id").notNull(),
  name: text("name").notNull(),
  percent: real("percent").notNull(),
  note: text("note").notNull().default(""),
  position: integer("position").notNull().default(0),
});
export type RuleAsset = typeof ruleAssets.$inferSelect;

/** Distribuição opcional por ativos/classes dentro da plataforma de uma alocação (EVO-06). Só nome, % e nota: o valor é derivado. */
export const allocationAssets = sqliteTable("allocation_assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  allocationId: integer("allocation_id").notNull(),
  platformId: integer("platform_id").notNull(),
  name: text("name").notNull(),
  percent: real("percent").notNull(),
  note: text("note").notNull().default(""),
  position: integer("position").notNull().default(0),
});
export type AllocationAsset = typeof allocationAssets.$inferSelect;

/* ------------------------------------------------ acumulados e submetas (EVO-04) */

/** Submeta (um único nível) de uma meta/parcela. */
export const subgoals = sqliteTable("subgoals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  parcelId: integer("parcel_id").notNull(),
  name: text("name").notNull(),
  platformId: integer("platform_id"),
  currency: text("currency").notNull().default("EUR"),
  target: real("target"),
  deadline: text("deadline"),
});
export type Subgoal = typeof subgoals.$inferSelect;

/** Saldo inicial (kind=inicial) ou ajuste assinado (kind=ajuste) de uma meta ou submeta. */
export const goalEntries = sqliteTable("goal_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  parcelId: integer("parcel_id").notNull(),
  subgoalId: integer("subgoal_id"),
  kind: text("kind").notNull(), // inicial | ajuste
  amount: real("amount").notNull().default(0),
  currency: text("currency").notNull().default("EUR"),
  date: text("date").notNull(), // YYYY-MM-DD (data de calendário)
  note: text("note").notNull().default(""),
});
export type GoalEntry = typeof goalEntries.$inferSelect;

/** Atribuição de (parte de) um movimento realizado a uma submeta. Não cria movimentos novos. */
export const contributionLinks = sqliteTable("contribution_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  transactionId: integer("transaction_id").notNull(),
  subgoalId: integer("subgoal_id").notNull(),
  amount: real("amount").notNull(),
});
export type ContributionLink = typeof contributionLinks.$inferSelect;

/** Taxa manual: 1 unidade de `fromCurrency` = `rate` unidades de `toCurrency`. */
export const fxRates = sqliteTable("fx_rates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromCurrency: text("from_currency").notNull(),
  toCurrency: text("to_currency").notNull(),
  rate: real("rate").notNull(),
  date: text("date").notNull(),
  source: text("source").notNull().default("manual"),
});
export type FxRate = typeof fxRates.$inferSelect;

/** Valor de mercado de uma parcela numa data, escrito à mão (para calcular o ganho ou a perda face ao que se pôs lá). */
export const valuations = sqliteTable("valuations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  parcelId: integer("parcel_id").notNull(),
  date: text("date").notNull(), // AAAA-MM-DD
  value: real("value").notNull(),
  note: text("note").notNull().default(""),
});
export type Valuation = typeof valuations.$inferSelect;

/** Normaliza nomes para comparar duplicados (espaços e maiúsculas/minúsculas). */
export function normName(s: string): string {
  return String(s ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-PT");
}

/* ------------------------------------------------------- tipos compostos */

export type MonthWithAllocations = Month & { allocations: Allocation[] };

/* ------------------------------------------------------------ EVO-08 */

/** Fecho mensal: decisão sobre o montante restante e histórico de abertura/fecho. */
export const monthClosures = sqliteTable("month_closures", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  monthId: integer("month_id").notNull(),
  action: text("action").notNull(), // fecho | reabertura
  remainder: real("remainder").notNull().default(0),
  destination: text("destination").notNull().default("manter"), // transportar | reforcar | manter
  targetParcelId: integer("target_parcel_id"),
  carryToMonthId: integer("carry_to_month_id"),
  note: text("note").notNull().default(""),
  at: text("at").notNull().default(""),
});
export type MonthClosure = typeof monthClosures.$inferSelect;

/** Histórico de alterações financeiras relevantes (sem dados sensíveis). */
export const changeLog = sqliteTable("change_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  at: text("at").notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  action: text("action").notNull(), // criar | alterar | eliminar | fechar | reabrir | importar
  summary: text("summary").notNull().default(""),
});
export type ChangeLogEntry = typeof changeLog.$inferSelect;

/** Despesa recorrente: gera ocorrências pendentes de confirmação. */
export const recurringExpenses = sqliteTable("recurring_expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  value: real("value").notNull(),
  category: text("category").notNull().default(""),
  parcelId: integer("parcel_id"),
  dayOfMonth: integer("day_of_month").notNull().default(1), // 1-31 (ajustado ao último dia do mês)
  startMonth: text("start_month").notNull(), // AAAA-MM
  endMonth: text("end_month"), // AAAA-MM ou nulo
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});
export type RecurringExpense = typeof recurringExpenses.$inferSelect;

/** Ocorrências ignoradas (para não voltarem a ficar pendentes). */
export const recurrenceSkips = sqliteTable("recurrence_skips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  occurrenceKey: text("occurrence_key").notNull(),
});
export type RecurrenceSkip = typeof recurrenceSkips.$inferSelect;

/** Reserva para despesa futura: separada de despesas pagas. */
export const reserves = sqliteTable("reserves", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  target: real("target").notNull(),
  dueMonth: text("due_month").notNull(), // AAAA-MM
  reserved: real("reserved").notNull().default(0),
  parcelId: integer("parcel_id"),
  status: text("status").notNull().default("ativa"), // ativa | paga | cancelada
  paidTransactionId: integer("paid_transaction_id"),
});
export type Reserve = typeof reserves.$inferSelect;

/** Lotes de importação CSV (impressão digital evita reimportação acidental). */
export const importBatches = sqliteTable("import_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fingerprint: text("fingerprint").notNull(),
  fileName: text("file_name").notNull().default(""),
  rows: integer("rows").notNull().default(0),
  at: text("at").notNull(),
});
export type ImportBatch = typeof importBatches.$inferSelect;
