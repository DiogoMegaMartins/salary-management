import { useAppState } from "@/lib/app";
import { parseFeatures, type FeatureKey } from "@shared/features";

/** Funcionalidades ligadas (enquanto o estado carrega, tudo ligado para não piscar o menu). */
export function useFeatures(): Record<FeatureKey, boolean> {
  const { data } = useAppState();
  return parseFeatures(data?.settings.features);
}

export function useFeature(key: FeatureKey): boolean {
  return useFeatures()[key];
}
