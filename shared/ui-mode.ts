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
