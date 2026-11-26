import { useAppState } from "@/lib/app";
import { parseUiMode, type UiMode } from "@shared/ui-mode";

/** Modo de utilização (Básico/Detalhado). Enquanto o estado carrega, assume o Detalhado para não esconder nada por engano. */
export function useUiMode(): UiMode {
  const { data } = useAppState();
  return parseUiMode(data?.settings.uiMode);
}
