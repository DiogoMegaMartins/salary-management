import { fmtEur } from "./calc";

/**
 * Os três passos do mês na página Dividir: Salário (vem do mês criado), Repartir (pelas parcelas) e Fechar.
 * O passo em curso é o primeiro que ainda não está feito.
 */
export type StepKey = "salario" | "repartir" | "fechar";
export type StepState = "done" | "now" | "todo";
export type DividirStep = { key: StepKey; label: string; state: StepState; text: string };

const EPS = 0.005;

export function dividirSteps(input: { available: number; remaining: number; closed: boolean }): { steps: DividirStep[]; current: StepKey } {
  const hasSalary = input.available > EPS;
  const split = hasSalary && Math.abs(input.remaining) < EPS;
  const raw: { key: StepKey; label: string; done: boolean; text: string }[] = [
    { key: "salario", label: "Salário", done: hasSalary, text: hasSalary ? `${fmtEur(input.available)} definido` : "Falta o salário deste mês" },
    {
      key: "repartir", label: "Repartir", done: split,
      text: !hasSalary ? "Depois do salário" : split ? "Tudo repartido" : input.remaining > 0 ? `Faltam ${fmtEur(input.remaining)} por distribuir` : `Excede ${fmtEur(-input.remaining)}`,
    },
    { key: "fechar", label: "Fechar", done: input.closed, text: input.closed ? "Mês fechado" : split ? "Pronto para fechar quando o mês acabar" : "Quando o mês acabar" },
  ];
  const firstOpen = raw.findIndex((s) => !s.done);
  const steps = raw.map<DividirStep>((s, i) => ({ key: s.key, label: s.label, text: s.text, state: s.done ? "done" : i === firstOpen ? "now" : "todo" }));
  return { steps, current: firstOpen === -1 ? "fechar" : raw[firstOpen].key };
}
