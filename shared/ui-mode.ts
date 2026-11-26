/** Modo de utilização: Básico (o essencial) ou Detalhado (tudo). Guardado nas definições da conta. */
export const UI_MODES = ["basico", "detalhado"] as const;
export type UiMode = (typeof UI_MODES)[number];

/** Quem já usa a app (e backups antigos) fica no Detalhado; só as instalações novas começam no Básico. */
export const DEFAULT_UI_MODE: UiMode = "detalhado";

export const UI_MODE_LABELS: Record<UiMode, { nome: string; descricao: string }> = {
  basico: { nome: "Básico", descricao: "Só o essencial, com o botão Registar despesa sempre à mão" },
  detalhado: { nome: "Detalhado", descricao: "Tudo à vista, para quem quer controlar cada pormenor" },
};

export function parseUiMode(v: unknown): UiMode {
  return (UI_MODES as readonly unknown[]).includes(v) ? (v as UiMode) : DEFAULT_UI_MODE;
}

/** Secções que o modo Básico mantém em cada página com secções arrastáveis. O Detalhado mostra todas. */
export const BASIC_SECTIONS = {
  orcamento: ["orc-categorias"],
  carteira: ["valor-carteira"],
} as const;

export function visibleSections<T extends { id: string }>(page: keyof typeof BASIC_SECTIONS, sections: T[], mode: UiMode): T[] {
  if (mode === "detalhado") return sections;
  const keep: readonly string[] = BASIC_SECTIONS[page];
  return sections.filter((s) => keep.includes(s.id));
}

/** Separadores das Definições que o Básico mantém. */
export const BASIC_SETTINGS_TABS = ["funcionalidades", "aparencia", "backups", "seguranca"] as const;

export function visibleSettingsTabs(all: string[], mode: UiMode): string[] {
  return mode === "detalhado" ? all : all.filter((t) => (BASIC_SETTINGS_TABS as readonly string[]).includes(t));
}
