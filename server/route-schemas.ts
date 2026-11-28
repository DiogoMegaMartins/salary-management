/**
 * Esquemas (zod) das rotas de catálogos, metas, recorrências e reservas.
 *
 * O esquema valida a forma do pedido: tipos, limites, valores permitidos e campos desconhecidos
 * (recusados). As regras de domínio (nome obrigatório, duplicados, unicidade, moedas, etc.)
 * continuam na camada de armazenamento, com as suas mensagens em português.
 */
import { z } from "zod";

const bool01 = z.union([z.boolean(), z.literal(0), z.literal(1)]).transform((v) => (v ? 1 : 0));
const name = z.string().max(100);
const text = (n: number) => z.string().max(n);
const id = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
// o arredondamento a cêntimos é feito no armazenamento (meios-cêntimos arredondam para longe de zero)
const money = z.number().min(-1e9).max(1e9);
const isoDate = z.string().max(10);
const yearMonth = z.string().max(7);

/** Identificador numérico de uma rota (`/:id`). */
export const idParamSchema = z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER);

/* ----------------------------------------------------------------- catálogos */
export const platformCreateSchema = z.strictObject({
  name,
  currency: text(10).optional(),
  notes: text(1000).optional(),
});
export const platformPatchSchema = z.strictObject({ name, archived: bool01, currency: text(10), notes: text(1000) }).partial();

const parcelBase = z.enum(["gastos", "poupanca", "investimento"], { error: "Comportamento base inválido." });
export const parcelTypeCreateSchema = z.strictObject({ name, baseKind: parcelBase });
export const parcelTypePatchSchema = z.strictObject({ name, archived: bool01 }).partial();

const txNature = z.enum(["entrada", "despesa", "transferencia", "ajuste"], { error: "Natureza inválida." });
export const txTypeCreateSchema = z.strictObject({ name, nature: txNature });
export const txTypePatchSchema = z.strictObject({ name, archived: bool01 }).partial();

/* ----------------------------------------------------- metas: saldos, submetas, taxas */
export const goalEntryCreateSchema = z.strictObject({
  parcelId: id,
  subgoalId: id.nullable().optional(),
  kind: z.enum(["inicial", "ajuste"], { error: "Tipo inválido." }),
  amount: money,
  date: isoDate,
  note: text(500).optional(),
});
export const goalEntryPatchSchema = z.strictObject({ amount: money, date: isoDate, note: text(500) }).partial();

export const subgoalCreateSchema = z.strictObject({
  parcelId: id,
  name,
  platformId: id.nullable().optional(),
  currency: text(10).optional(),
  target: z.number().min(0).max(1e12).nullable().optional(),
  deadline: text(10).nullable().optional(),
});
export const subgoalPatchSchema = z.strictObject({
  name,
  platformId: id.nullable(),
  currency: text(10),
  target: z.number().min(0).max(1e12).nullable(),
  deadline: text(10).nullable(),
}).partial();

export const contributionLinkCreateSchema = z.strictObject({
  transactionId: id,
  subgoalId: id,
  amount: z.number().min(0).max(1e9),
});

export const fxRateCreateSchema = z.strictObject({
  fromCurrency: text(10),
  toCurrency: text(10),
  rate: z.number().min(0).max(1e9),
  date: isoDate,
});

export const valuationCreateSchema = z.strictObject({
  parcelId: id,
  date: isoDate,
  value: z.number().min(0).max(1e10),
  note: text(200).optional(),
});

/* ------------------------------------------------------ recorrências e reservas */
export const recurringSchema = z.strictObject({
  name,
  value: z.number().min(0).max(1e9),
  category: text(100).optional(),
  parcelId: id.nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  startMonth: yearMonth,
  endMonth: yearMonth.nullable().optional(),
  active: z.boolean().optional(),
});

export const reserveSchema = z.strictObject({
  name,
  target: z.number().min(0).max(1e9),
  dueMonth: yearMonth,
  reserved: z.number().min(0).max(1e9).optional(),
  parcelId: id.nullable().optional(),
});
export const reservePaySchema = z.strictObject({ monthId: id, date: isoDate, category: text(100).optional() });

export const occurrenceKeySchema = z.strictObject({ key: text(100) });

export const closeMonthSchema = z.strictObject({
  destination: z.enum(["transportar", "reforcar", "manter"]).optional(),
  targetParcelId: id.nullable().optional(),
  note: text(2000).optional(),
});
export const reopenMonthSchema = z.strictObject({ note: text(2000).optional() });

/* ------------------------------------------------- movimentos em lote (Organizar) */
/** Vários movimentos de uma vez: mudar a categoria ou a parcela, ou eliminar. Tudo ou nada. */
export const bulkTransactionsSchema = z.strictObject({
  ids: z.array(id).min(1, "Escolhe pelo menos um movimento.").max(500, "No máximo 500 movimentos de cada vez."),
  action: z.enum(["update", "delete"]),
  patch: z.strictObject({ category: text(100).optional(), parcelId: id.nullable().optional() }).optional(),
}).refine((v) => v.action === "delete" || (v.patch && Object.keys(v.patch).length > 0), { message: "Indica o que mudar.", path: ["patch"] });
