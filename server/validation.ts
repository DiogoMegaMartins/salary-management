import { z } from "zod";
import { MIN_CODE_LENGTH } from "./access";
import { round2 } from "@shared/evo08";
import { FEATURES } from "@shared/features";
import { PALETTES, COLOR_MODES } from "@shared/appearance";
import { UI_MODES } from "@shared/ui-mode";

const cents = round2;
const num = z.number();
const bool01 = z.union([z.boolean(), z.literal(0), z.literal(1)]).transform((v) => (v ? 1 : 0));
const parsesToObject = (s: string) => {
  try { const v = JSON.parse(s); return v !== null && typeof v === "object" && !Array.isArray(v); } catch { return false; }
};

/** `features`: objeto só com chaves conhecidas e valores booleanos. */
const isFeaturesJson = (s: string) => {
  try {
    const v = JSON.parse(s);
    if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
    const keys = new Set<string>(FEATURES.map((f) => f.key));
    return Object.entries(v).every(([k, x]) => keys.has(k) && typeof x === "boolean");
  } catch { return false; }
};

/** Campos de definições que o cliente pode alterar. Desconhecidos (ex.: id) são recusados. */
export const settingsPatchSchema = z.strictObject({
  defaultMealDaily: num.min(0).max(1000).transform(cents),
  includeMeal: bool01,
  excludeOutrosIrsFromNet: bool01,
  defaultTaxaSs: num.min(0).max(1),
  defaultTaxaIrsBase: num.min(0).max(1),
  defaultTaxaIrsExtra: num.min(0).max(1),
  lastBackupAt: z.string().max(40),
  lastRestoreAt: z.string().max(40),
  backupReminderDays: z.number().int().min(1).max(3650),
  accessCode: z.string().max(200).refine((v) => v === "" || v.length >= MIN_CODE_LENGTH, `O código tem de ter pelo menos ${MIN_CODE_LENGTH} caracteres.`),
  annualSavingsGoal: num.min(0).max(1e9).transform(cents),
  emergencyParcelIds: z.string().max(500).regex(/^[\d,]*$/, "Lista de parcelas inválida."),
  runwayMonthsWindow: z.number().int().min(1).max(60),
  surplusSuggestionThreshold: num.min(0).max(1e9).transform(cents),
  pageLayouts: z.string().max(100_000).refine(parsesToObject, "Layout inválido."),
  features: z.string().max(500).refine(isFeaturesJson, "Funcionalidades inválidas."),
  onboardingDone: bool01,
  aiEnabled: bool01,
  aiModel: z.enum(["haiku", "sonnet"]),
  palette: z.enum(PALETTES),
  colorMode: z.enum(COLOR_MODES),
  uiMode: z.enum(UI_MODES),
}).partial();

export const issueMessage = (e: z.ZodError) => {
  const i = e.issues[0];
  return i ? `${i.path.join(".") || "pedido"}: ${i.message}` : "Pedido inválido.";
};

/* ---------------------------------------------------------------- meses, parcelas, categorias */
/** Valores em euros: guardados sempre com 2 casas decimais (sem restos de vírgula flutuante). */
const money = z.number().min(0).max(1e9).transform(cents);
const rate = z.number().min(0).max(1);
const short = (n: number) => z.string().max(n);

const monthFields = {
  year: z.number().int().min(1900).max(2200),
  month: z.number().int().min(1).max(12),
  label: z.string().trim().min(1, "A etiqueta é obrigatória.").max(100),
  sortOrder: z.number().int().min(-1e6).max(1e6),
  base: money, extraordinaria: money, outrosIrsSs: money, outrosIrs: money, isentos: money,
  taxaIrsBase: rate, taxaIrsExtra: rate, taxaSs: rate,
  irsJovem: short(50),
  descontosMode: z.enum(["auto", "manual"]),
  descontosManual: money,
  mealDaily: z.number().min(0).max(1000).transform(cents), mealDays: z.number().min(0).max(31),
  deficitReason: short(100), deficitNote: short(2000), notes: short(5000),
};
/** `status` e `carryIn` não fazem parte: só mudam pelo fecho/reabertura. Campos desconhecidos são ignorados. */
export const monthCreateSchema = z.object(monthFields).partial().required({ year: true, month: true, label: true });
export const monthPatchSchema = z.object(monthFields).partial();

const parcelFields = {
  name: z.string().trim().min(1, "O nome é obrigatório.").max(100),
  kind: z.enum(["gastos", "poupanca", "investimento"]),
  color: z.string().max(20),
  defaultMode: z.enum(["fixo", "percentagem"]),
  defaultValue: money,
  targetAmount: money.nullable(),
  targetDate: z.string().max(10).nullable(),
  sortOrder: z.number().int().min(-1e6).max(1e6),
  archived: bool01,
  typeId: z.number().int().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Moeda inválida (ex.: EUR)."),
};
export const parcelCreateSchema = z.object(parcelFields).partial().required({ name: true });
export const parcelPatchSchema = z.object(parcelFields).partial();

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "O nome é obrigatório.").max(100),
});
