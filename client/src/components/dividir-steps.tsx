import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DividirStep, StepKey } from "@shared/dividir";

/** Os 3 passos do mês, em coluna: onde estás e qual é o passo seguinte. Cada passo pode ser aberto. */
export function DividirSteps({ steps, shown, onShow }: { steps: DividirStep[]; shown: string | null; onShow: (k: StepKey) => void }) {
  return (
    <ol className="flex flex-col gap-1" aria-label="O teu mês em 3 passos" data-testid="dividir-steps">
      {steps.map((s, i) => (
        <li key={s.key}>
          <button
            type="button"
            onClick={() => onShow(s.key)}
            aria-current={s.state === "now" ? "step" : undefined}
            data-testid={`step-${s.key}`}
            data-state={s.state}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl px-3.5 py-3 text-left transition-colors hover:bg-muted/60",
              (shown === s.key || (shown == null && s.state === "now")) && "bg-accent",
            )}
          >
            <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", s.state === "done" ? "bg-success text-background" : "bg-accent text-primary ring-1 ring-primary/20")}>
              {s.state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{s.label}</span>
              <span className="block text-xs leading-snug text-muted-foreground">{s.text}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
