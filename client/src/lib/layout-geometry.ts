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
