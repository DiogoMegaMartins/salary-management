import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAppState, useSave, type AppState } from "@/lib/app";
import { featuresFromProfile, profileFromFeatures, type Profile } from "@shared/features";
import { errMsg } from "@/components/catalogs";

const OPTIONS: { key: keyof Profile; label: string; help: string }[] = [
  { key: "invest", label: "Também invisto", help: "Plataformas, carteira e valor de mercado." },
  { key: "goals", label: "Tenho metas e poupanças", help: "Parcelas, submetas e prazos." },
  { key: "irsJovem", label: "Tenho IRS Jovem", help: "Mostra os campos de isenção no vencimento." },
];

/**
 * Arranque no primeiro uso: uma pergunta, e a app liga só as funcionalidades certas. Aparece enquanto
 * `settings.onboardingDone` for 0 (uma base que já tinha meses conta como feito). Não se fecha por engano:
 * há sempre uma saída explícita ("Continuar" ou "Ligar tudo").
 */
export function Onboarding() {
  const { data } = useAppState();
  if (!data || data.settings.onboardingDone !== 0) return null;
  return <OnboardingDialog settings={data.settings} />;
}

function OnboardingDialog({ settings }: { settings: AppState["settings"] }) {
  const save = useSave();
  const { toast } = useToast();
  // primeira vez: nada marcado (só salário e despesas); ao repetir, parte do que está ligado agora
  const [profile, setProfile] = useState<Profile>(() =>
    settings.features && settings.features !== "{}" ? profileFromFeatures(settings.features) : { invest: false, goals: false, irsJovem: false },
  );
  const finish = (features: string, title: string) =>
    save.settings.mutate(
      { features, onboardingDone: 1 },
      {
        onSuccess: () => toast({ title, description: "Podes mudar tudo em Definições › Funcionalidades." }),
        onError: (e) => toast({ title: "Não foi possível guardar", description: errMsg(e), variant: "destructive" }),
      },
    );

  return (
    <Dialog open>
      <DialogContent
        className="max-w-md [&>button.absolute]:hidden"
        data-testid="onboarding"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Bem-vindo ao Personal Salary Management</DialogTitle>
          <DialogDescription>O que queres acompanhar? Escolhe o que se aplica. Podes mudar tudo mais tarde em Definições › Funcionalidades.</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2" aria-label="O que queres acompanhar">
          <label className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
            <Checkbox checked disabled aria-label="Só o meu salário e despesas (sempre incluído)" className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Só o meu salário e despesas</span>
              <span className="block text-xs text-muted-foreground">O essencial: quanto recebo e para onde vai. Está sempre incluído.</span>
            </span>
          </label>
          {OPTIONS.map((o) => (
            <label key={o.key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-checked:border-primary/40 has-checked:bg-primary/5">
              <Checkbox
                checked={profile[o.key]}
                onCheckedChange={(v) => setProfile({ ...profile, [o.key]: v === true })}
                data-testid={`onboarding-${o.key}`}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.help}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <DialogFooter className="gap-2 sm:flex-col sm:space-x-0">
          <Button disabled={save.settings.isPending} onClick={() => finish(featuresFromProfile(profile), "Funcionalidades escolhidas")} data-testid="onboarding-continue">
            Continuar
          </Button>
          <Button variant="outline" disabled={save.settings.isPending} onClick={() => finish("{}", "Tudo ligado")} data-testid="onboarding-all">
            Ligar tudo (modo completo)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
