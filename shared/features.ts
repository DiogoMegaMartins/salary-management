/**
 * Funcionalidades que a pessoa pode ligar e desligar em Definições › Funcionalidades.
 * Guardadas em `settings.features` como JSON só com o que está desligado (`{"parcelas":false}`).
 * Chave em falta, JSON inválido ou valor que não é booleano = ligada, por isso dados e backups antigos ficam "tudo ligado".
 */
export type FeatureKey = "divisao" | "movimentos" | "parcelas" | "plataformas" | "irsJovem" | "reconciliacao";

export const FEATURES: { key: FeatureKey; label: string; help: string; requires?: FeatureKey }[] = [
  { key: "divisao", label: "Divisão do salário", help: "Repartir o vencimento por parcelas" },
  { key: "movimentos", label: "Movimentos", help: "Entradas, saídas e transferências" },
  { key: "parcelas", label: "Parcelas e metas", help: "Objetivos, submetas e prazos" },
  { key: "plataformas", label: "Plataformas e carteira", help: "Investimentos e valor de mercado" },
  { key: "irsJovem", label: "IRS Jovem", help: "Campos de isenção no vencimento" },
  { key: "reconciliacao", label: "Reconciliação", help: "Comparar com o extrato do banco", requires: "movimentos" },
];

function rawOff(json: string | null | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function parseFeatures(json: string | null | undefined): Record<FeatureKey, boolean> {
  const raw = rawOff(json);
  const out = {} as Record<FeatureKey, boolean>;
  for (const f of FEATURES) out[f.key] = raw[f.key] !== false;
  for (const f of FEATURES) if (f.requires && !out[f.requires]) out[f.key] = false;
  return out;
}

export function isFeatureOn(json: string | null | undefined, key: FeatureKey): boolean {
  return parseFeatures(json)[key];
}

/** JSON novo com a funcionalidade ligada ou desligada; só guarda as desligadas. */
export function featuresPatch(json: string | null | undefined, key: FeatureKey, on: boolean): string {
  const raw = rawOff(json);
  const off: Record<string, false> = {};
  for (const f of FEATURES) if (raw[f.key] === false) off[f.key] = false;
  if (on) delete off[key];
  else off[key] = false;
  return JSON.stringify(off);
}
