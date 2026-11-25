/** Regras puras do fecho mensal: quando é preciso escolher destino e qual é o destino por defeito. */

export type ClosingDest = "transportar" | "reforcar" | "manter";

/**
 * - Sem restante (0, a menos de 1 cêntimo): fecha-se sem escolher nada (`needsDestination` falso).
 * - Em défice (restante negativo): só se pode manter, por isso também não há nada a escolher.
 * - Com restante positivo: escolhe-se; por defeito transporta-se para o mês seguinte, se ele existir e estiver aberto.
 */
export function closingPlan(remainder: number, nextMonthOpen: boolean): {
  kind: "zero" | "deficit" | "positive";
  needsDestination: boolean;
  defaultDest: ClosingDest;
  canCarry: boolean;
} {
  if (Math.abs(remainder) < 0.005) return { kind: "zero", needsDestination: false, defaultDest: "manter", canCarry: false };
  if (remainder < 0) return { kind: "deficit", needsDestination: false, defaultDest: "manter", canCarry: false };
  return { kind: "positive", needsDestination: true, defaultDest: nextMonthOpen ? "transportar" : "manter", canCarry: nextMonthOpen };
}
