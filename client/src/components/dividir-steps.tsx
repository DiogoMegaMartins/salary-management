import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DividirStep, StepKey } from "@shared/dividir";

/** Cartão "O teu mês em 3 passos": onde estás e qual é o passo seguinte. Cada passo pode ser aberto. */
export function DividirSteps({ steps, shown, onShow }: { steps: DividirStep[]; shown: StepKey | null; onShow: (k: StepKey) => void }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-3" aria-label="O teu mês em 3 passos" data-testid="dividir-steps">
      {steps.map((s, i) => (
        <li key={s.key}>
          <button
            type="button"
            onClick={() => onShow(s.key)}
            aria-current={s.state === "now" ? "step" : undefined}
            data-testid={`step-${s.key}`}
            data-state={s.state}
            className={cn(
              "flex h-full w-full flex-col gap-1 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
              s.state === "now" && "border-primary ring-2 ring-primary/25",
              shown === s.key && s.state !== "now" && "border-primary/60",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]", s.state === "done" ? "bg-success text-background" : "bg-accent text-primary")}>
                {s.state === "done" ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
              </span>
              {s.label}
            </span>
            <span className="text-xs text-muted-foreground">{s.text}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
