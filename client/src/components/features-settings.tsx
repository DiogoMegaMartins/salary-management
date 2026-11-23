import { SectionCard } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useSave, type AppState } from "@/lib/app";
import { FEATURES, featuresPatch, parseFeatures } from "@shared/features";

/** Interruptores de funcionalidades. Desligar esconde; não apaga dados. */
export function FeaturesSettings({ settings }: { settings: AppState["settings"] }) {
  const save = useSave();
  const { toast } = useToast();
  const on = parseFeatures(settings.features);
  return (
    <SectionCard description="Liga só o que usas. Desligar esconde; não apaga dados, e ao ligar de novo tudo volta.">
      <ul className="divide-y" data-testid="features-list">
        {FEATURES.map((f) => {
          const blocked = !!f.requires && !on[f.requires];
          const id = `feature-${f.key}`;
          return (
            <li key={f.key} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <label htmlFor={id} className="block text-sm font-medium">{f.label}</label>
                <p id={`${id}-help`} className="text-xs text-muted-foreground">
                  {blocked ? `Precisa de ${FEATURES.find((x) => x.key === f.requires)?.label}` : f.help}
                </p>
              </div>
              <Switch
                id={id}
                aria-describedby={`${id}-help`}
                data-testid={`feature-switch-${f.key}`}
                checked={on[f.key]}
                disabled={blocked}
                onCheckedChange={(v) =>
                  save.settings.mutate(
                    { features: featuresPatch(settings.features, f.key, v) },
                    { onSuccess: () => toast({ title: v ? `${f.label}: ligada` : `${f.label}: desligada` }) },
                  )
                }
              />
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p className="text-xs text-muted-foreground">Não sabes o que ligar? Repete as perguntas do arranque.</p>
        <Button variant="outline" size="sm" onClick={() => save.settings.mutate({ onboardingDone: 0 })} data-testid="button-repeat-onboarding">
          Repetir o arranque
        </Button>
      </div>
    </SectionCard>
  );
}
