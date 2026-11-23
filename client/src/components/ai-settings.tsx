import { SectionCard } from "@/components/kpi";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSave, type AppState } from "@/lib/app";
import { useAiStatus, AI_STATUS_KEY } from "@/lib/ai";
import { queryClient } from "@/lib/queryClient";

/**
 * Assistente com IA (frases livres). Só aparece se o servidor tiver uma chave de API; sem ela, não há opção nenhuma.
 * Desligado por defeito. A frase que escreves sai da app para a Anthropic, com os nomes das categorias.
 */
export function AiSettings({ settings }: { settings: AppState["settings"] }) {
  const { data: st } = useAiStatus();
  const save = useSave();
  const { toast } = useToast();
  if (!st?.configured) return null;
  const done = (title: string) => ({ onSuccess: () => { void queryClient.invalidateQueries({ queryKey: AI_STATUS_KEY }); toast({ title }); } });
  return (
    <SectionCard className="mt-4" title="Assistente com IA" description="Escreve frases como “gastei 40 no supermercado ontem” em vez de seguir as perguntas. A IA só interpreta a frase: nunca vê os teus valores nem grava nada sem confirmares.">
      <div className="space-y-4" data-testid="ai-settings">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <label htmlFor="ai-enabled" className="block text-sm font-medium">Ligar o assistente com IA</label>
            <p id="ai-enabled-help" className="text-xs text-muted-foreground">
              Atenção: a frase que escreves sai da app para a Anthropic (com os nomes das tuas categorias e a data de hoje) para ser interpretada.
              Desligado por defeito.
            </p>
          </div>
          <Switch
            id="ai-enabled"
            aria-describedby="ai-enabled-help"
            data-testid="switch-ai-enabled"
            checked={settings.aiEnabled === 1}
            onCheckedChange={(v) => save.settings.mutate({ aiEnabled: v ? 1 : 0 }, done(v ? "Assistente com IA ligado" : "Assistente com IA desligado"))}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Modelo</p>
            <p className="text-xs text-muted-foreground">O Haiku é mais barato e chega para frases curtas; o Sonnet percebe melhor frases confusas.</p>
          </div>
          <Select value={settings.aiModel === "sonnet" ? "sonnet" : "haiku"} onValueChange={(v) => save.settings.mutate({ aiModel: v }, done("Modelo guardado"))}>
            <SelectTrigger className="h-9 w-44 text-sm" aria-label="Modelo de IA" data-testid="select-ai-model"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="haiku">Haiku (mais barato)</SelectItem>
              <SelectItem value="sonnet">Sonnet (mais esperto)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="ai-usage">Hoje: {st.used} de {st.limit} pedidos.</p>
      </div>
    </SectionCard>
  );
}
