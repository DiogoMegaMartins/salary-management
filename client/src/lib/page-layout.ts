import type { Settings } from "@shared/schema";
import type { PageLayoutMap } from "@/components/editable-section-grid";
import { useSave } from "@/lib/app";

/**
 * SM-012: lê/grava o layout personalizado (arrastar/redimensionar) de uma
 * página específica dentro de `settings.pageLayouts`, que guarda um JSON
 * com uma chave por página (ex.: { painel: {...}, carteira: {...} }).
 */
export function usePageLayout(settings: Settings, pageKey: string) {
  const save = useSave();

  let all: Record<string, PageLayoutMap> = {};
  try {
    all = JSON.parse(settings.pageLayouts || "{}");
  } catch {
    all = {};
  }

  const savedLayout = all[pageKey];

  const onSave = (layout: PageLayoutMap) => {
    save.settings.mutate({ pageLayouts: JSON.stringify({ ...all, [pageKey]: layout }) });
  };

  return { savedLayout, onSave, isSaving: save.settings.isPending };
}
