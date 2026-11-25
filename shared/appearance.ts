/** Cor da app e modo claro/escuro: valores permitidos e resolução. Partilhado entre cliente e servidor. */

export const PALETTES = ["ceu", "salvia", "pessego", "lavanda", "mare"] as const;
export type Palette = (typeof PALETTES)[number];

export const COLOR_MODES = ["auto", "claro", "escuro"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

export const DEFAULT_PALETTE: Palette = "ceu";
export const DEFAULT_COLOR_MODE: ColorMode = "auto";

export const PALETTE_LABELS: Record<Palette, { nome: string; descricao: string }> = {
  ceu: { nome: "Céu", descricao: "Azul claro, fresco" },
  salvia: { nome: "Sálvia", descricao: "Verde suave, calmo" },
  pessego: { nome: "Pêssego", descricao: "Coral e areia, caloroso" },
  lavanda: { nome: "Lavanda", descricao: "Lilás suave, delicado" },
  mare: { nome: "Maré", descricao: "Turquesa, leve" },
};

export const MODE_LABELS: Record<ColorMode, string> = { auto: "Automático", claro: "Claro", escuro: "Escuro" };

export function parsePalette(v: unknown): Palette {
  return (PALETTES as readonly unknown[]).includes(v) ? (v as Palette) : DEFAULT_PALETTE;
}

export function parseColorMode(v: unknown): ColorMode {
  return (COLOR_MODES as readonly unknown[]).includes(v) ? (v as ColorMode) : DEFAULT_COLOR_MODE;
}

/** Automático segue o sistema; claro e escuro ignoram-no. */
export function resolveDark(mode: ColorMode, systemPrefersDark: boolean): boolean {
  return mode === "auto" ? systemPrefersDark : mode === "escuro";
}

export type AppearanceCache = { palette: Palette; mode: ColorMode };
export const APPEARANCE_KEY = "sm.appearance";
export const LEGACY_THEME_KEY = "sm.theme";

/** Lê a cache local (JSON) e, se não existir, o tema antigo ("light"/"dark"). Nunca falha: lixo cai nos defeitos. */
export function readAppearanceCache(raw: string | null, legacyTheme: string | null): AppearanceCache {
  if (raw) {
    try {
      const v = JSON.parse(raw);
      if (v && typeof v === "object") return { palette: parsePalette(v.palette), mode: parseColorMode(v.mode) };
    } catch { /* cache estragada: usa os defeitos */ }
    return { palette: DEFAULT_PALETTE, mode: DEFAULT_COLOR_MODE };
  }
  const mode: ColorMode = legacyTheme === "dark" ? "escuro" : legacyTheme === "light" ? "claro" : DEFAULT_COLOR_MODE;
  return { palette: DEFAULT_PALETTE, mode };
}
