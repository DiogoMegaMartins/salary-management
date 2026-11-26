/** Escolha e estado visual das metas no Início: a meta em destaque e a etiqueta de cada uma. */
export type PaceStatus = "sem_objetivo" | "atingida" | "sem_prazo" | "prazo_passado" | "sem_ritmo" | "no_ritmo" | "atrasada";
export type GoalLike = { id: number; status: PaceStatus | string; pct: number };

/** Estados que pedem atenção, do mais urgente para o menos. */
const ATENCAO: string[] = ["prazo_passado", "sem_ritmo", "atrasada"];

/**
 * A meta em destaque: a que mais precisa de atenção (prazo passado, sem ritmo, atrasada); se nenhuma,
 * a mais adiantada que ainda não está concluída; se todas estão concluídas, a primeira.
 */
export function featuredGoalId(goals: GoalLike[]): number | null {
  if (!goals.length) return null;
  for (const s of ATENCAO) {
    const g = goals.find((x) => x.status === s);
    if (g) return g.id;
  }
  const open = goals.filter((g) => g.status !== "atingida").sort((a, b) => b.pct - a.pct);
  return (open[0] ?? goals[0]).id;
}

export type GoalChip = { text: string; tone: "ok" | "warn" | "bad" } | null;

/** Etiqueta curta do estado da meta; sem etiqueta quando não há objetivo ou prazo para comparar. */
export function goalChip(status: string): GoalChip {
  switch (status) {
    case "no_ritmo": return { text: "No ritmo", tone: "ok" };
    case "atingida": return { text: "Concluída", tone: "ok" };
    case "atrasada": return { text: "Atrasada", tone: "warn" };
    case "sem_ritmo": return { text: "Sem ritmo", tone: "bad" };
    case "prazo_passado": return { text: "Prazo passado", tone: "bad" };
    default: return null;
  }
}
