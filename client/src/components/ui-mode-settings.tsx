import { SectionCard } from "@/components/kpi";
import { useToast } from "@/hooks/use-toast";
import { useSave, type AppState } from "@/lib/app";
import { UI_MODES, UI_MODE_LABELS, parseUiMode } from "@shared/ui-mode";

const opcao =
  "relative flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring";

/** Modo de utilização: Básico (o essencial, com o botão Registar despesa) ou Detalhado (tudo). Guardado na conta. */
export function UiModeSettings({ settings }: { settings: AppState["settings"] }) {
  const save = useSave();
  const { toast } = useToast();
  const mode = parseUiMode(settings.uiMode);
  return (
    <SectionCard className="mb-4" title="Modo de utilização" description="Básico mostra só o essencial. Detalhado mostra tudo. Podes mudar quando quiseres; não apaga dados.">
      <div role="radiogroup" aria-label="Modo de utilização" className="grid gap-3 sm:grid-cols-2" data-testid="ui-mode-settings">
        {UI_MODES.map((m) => (
          <label key={m} className={opcao} data-testid={`ui-mode-${m}`}>
            <input
              type="radio"
              name="ui-mode"
              value={m}
              className="sr-only"
              checked={mode === m}
              aria-label={UI_MODE_LABELS[m].nome}
              aria-describedby={`ui-mode-${m}-desc`}
              onChange={() => save.settings.mutate({ uiMode: m } as any, { onSuccess: () => toast({ title: `Modo ${UI_MODE_LABELS[m].nome.toLowerCase()}` }) })}
            />
            <span className="min-w-0">
              <span className="block font-medium">{UI_MODE_LABELS[m].nome}</span>
              <span id={`ui-mode-${m}-desc`} className="block text-xs text-muted-foreground">{UI_MODE_LABELS[m].descricao}</span>
            </span>
          </label>
        ))}
      </div>
    </SectionCard>
  );
}
