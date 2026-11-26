import { fmtEur } from "./calc";

/**
 * Os três passos do mês na página Plano do mês: Quanto entra (o salário do mês e o que veio do mês anterior), Para onde vai (a divisão pelas parcelas) e Fechar o mês.
 * O passo em curso é o primeiro que ainda não está feito.
 */
export type StepKey = "salario" | "repartir" | "fechar";
export type StepState = "done" | "now" | "todo";
export type DividirStep = { key: StepKey; label: string; state: StepState; text: string };

const EPS = 0.005;

export function dividirSteps(input: { available: number; remaining: number; closed: boolean; carryIn?: number }): { steps: DividirStep[]; current: StepKey } {
  const hasSalary = input.available > EPS;
  const split = hasSalary && Math.abs(input.remaining) < EPS;
  const raw: { key: StepKey; label: string; done: boolean; text: string }[] = [
    {
      key: "salario", label: "Quanto entra", done: hasSalary,
      text: !hasSalary ? "Falta o salário deste mês" : (input.carryIn ?? 0) > EPS ? `${fmtEur(input.available)} + ${fmtEur(input.carryIn!)} do mês anterior` : `${fmtEur(input.available)} definido`,
    },
    {
      key: "repartir", label: "Para onde vai", done: split,
      text: !hasSalary ? "Depois do salário" : split ? "Tudo repartido" : input.remaining > 0 ? `Faltam ${fmtEur(input.remaining)} por distribuir` : `Excede ${fmtEur(-input.remaining)}`,
    },
    { key: "fechar", label: "Fechar o mês", done: input.closed, text: input.closed ? "Mês fechado" : split ? "Pronto para fechar quando o mês acabar" : "Quando o mês acabar" },
  ];
  const firstOpen = raw.findIndex((s) => !s.done);
  const steps = raw.map<DividirStep>((s, i) => ({ key: s.key, label: s.label, text: s.text, state: s.done ? "done" : i === firstOpen ? "now" : "todo" }));
  return { steps, current: firstOpen === -1 ? "fechar" : raw[firstOpen].key };
}
