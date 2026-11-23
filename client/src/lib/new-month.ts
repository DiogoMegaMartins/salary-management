import type { Month, Settings } from "@shared/schema";
import { MONTH_NAMES } from "@shared/calc";

/** Mês em branco (ainda não guardado, `id` -1), com as taxas e o valor diário das definições. */
export function blankMonth(settings: Settings, year: number, month: number, base = 0): Month {
  return {
    id: -1,
    year,
    month,
    label: MONTH_NAMES[month - 1],
    sortOrder: 0,
    base,
    extraordinaria: 0,
    outrosIrsSs: 0,
    outrosIrs: 0,
    isentos: 0,
    taxaIrsBase: settings.defaultTaxaIrsBase,
    taxaIrsExtra: settings.defaultTaxaIrsExtra,
    taxaSs: settings.defaultTaxaSs,
    irsJovem: "",
    descontosMode: "auto",
    descontosManual: 0,
    mealDaily: settings.defaultMealDaily,
    mealDays: 0,
    deficitReason: "",
    deficitNote: "",
    notes: "",
  } as unknown as Month;
}
