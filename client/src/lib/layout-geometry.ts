export type SectionGeometry = { x: number; y: number; w: number; h: number };

/** Keep persisted/custom layouts within the twelve-column canvas. Never mutates saved data. */
export function normalizeSectionGeometry(
  value: Partial<SectionGeometry> | null | undefined,
  fallback: SectionGeometry,
  min: { w: number; h: number } = { w: 3, h: 4 },
): SectionGeometry {
  const integer = (v: unknown, otherwise: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : otherwise;
  const w = Math.max(min.w, Math.min(12, integer(value?.w, fallback.w)));
  return {
    w,
    h: Math.max(min.h, integer(value?.h, fallback.h)),
    x: Math.max(0, Math.min(12 - w, integer(value?.x, fallback.x))),
    y: Math.max(0, integer(value?.y, fallback.y)),
  };
}

/** Measured usable width, not device name: tablets and narrow panes must stack. */
export function shouldStackSections(containerWidth: number) {
  return containerWidth < 900;
}

type MigratableSection = { id: string; group?: string; defaultLayout: SectionGeometry };

/**
 * Layout guardado de antes de existir uma secção nova num grupo (ex.: o resumo do mês ao lado dos cartões pequenos):
 * o grupo volta às posições por omissão e as secções que estavam por baixo descem o que for preciso. Sem isto,
 * a secção nova e os cartões antigos ficam desencontrados. Secções novas fora de grupos ficam como estão.
 * Não altera o que está guardado.
 */
export function migrateSavedLayout(
  sections: MigratableSection[],
  saved: Record<string, SectionGeometry> | undefined,
): Record<string, SectionGeometry> | undefined {
  if (!saved || Object.keys(saved).length === 0) return saved;
  const groups = new Set(sections.filter((s) => !saved[s.id] && s.group).map((s) => s.group as string));
  if (groups.size === 0) return saved;
  const out: Record<string, SectionGeometry> = { ...saved };
  for (const g of groups) {
    const members = sections.filter((s) => s.group === g);
    const oldBottom = Math.max(0, ...members.filter((s) => saved[s.id]).map((s) => saved[s.id].y + saved[s.id].h));
    const newBottom = Math.max(...members.map((s) => s.defaultLayout.y + s.defaultLayout.h));
    const delta = newBottom - oldBottom;
    for (const s of members) out[s.id] = { ...s.defaultLayout };
    if (delta !== 0) {
      for (const s of sections) {
        if (s.group === g || !saved[s.id] || saved[s.id].y < oldBottom) continue;
        out[s.id] = { ...saved[s.id], y: saved[s.id].y + delta };
      }
    }
  }
  return out;
}
