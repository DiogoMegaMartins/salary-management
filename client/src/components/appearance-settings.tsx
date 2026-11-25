import { SectionCard } from "@/components/kpi";
import { useAppearance } from "@/lib/appearance";
import { COLOR_MODES, MODE_LABELS, PALETTES, PALETTE_LABELS, type Palette } from "@shared/appearance";

/** Cores de amostra (fundo, cartão, destaque) de cada paleta, em modo claro. Só para mostrar; as cores reais vêm do CSS. */
const SWATCH: Record<Palette, [string, string, string]> = {
  ceu: ["#eff4fa", "#ffffff", "#2563b0"],
  salvia: ["#eef3ef", "#ffffff", "#1f7a54"],
  pessego: ["#fbf3ee", "#ffffff", "#c4512f"],
  lavanda: ["#f3f1fa", "#ffffff", "#5b45c4"],
  mare: ["#f2f6f4", "#ffffff", "#0e7c86"],
};

const opcao =
  "relative flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring";

/** Escolha da cor da app e do modo claro/escuro. Fica guardada na conta. */
export function AppearanceSettings() {
  const { palette, mode, setPalette, setMode } = useAppearance();
  return (
    <div className="space-y-4" data-testid="appearance-settings">
      <SectionCard title="Cor da app" description="Escolhe a cor que achas mais agradável. A cor e o modo ficam guardados na tua conta.">
        <div role="radiogroup" aria-label="Cor da app" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PALETTES.map((p) => {
            const { nome, descricao } = PALETTE_LABELS[p];
            const [fundo, cartao, destaque] = SWATCH[p];
            return (
              <label key={p} className={opcao} data-testid={`palette-${p}`}>
                <input
                  type="radio"
                  name="palette"
                  value={p}
                  className="peer sr-only"
                  checked={palette === p}
                  onChange={() => setPalette(p)}
                  aria-label={nome}
                  aria-describedby={`palette-${p}-desc`}
                />
                <span aria-hidden className="flex h-10 w-14 shrink-0 items-end gap-1 rounded-md p-1.5" style={{ background: fundo }}>
                  <span className="h-full w-4 rounded-sm" style={{ background: cartao, boxShadow: "0 0 0 1px rgb(0 0 0 / 0.08)" }} />
                  <span className="h-1/2 w-4 rounded-sm" style={{ background: destaque }} />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{nome}</span>
                  <span id={`palette-${p}-desc`} className="block text-xs text-muted-foreground">{descricao}</span>
                </span>
              </label>
            );
          })}
        </div>
      </SectionCard>
      <SectionCard title="Modo" description="Automático segue o claro ou escuro do teu telemóvel ou computador.">
        <div role="radiogroup" aria-label="Modo" className="grid gap-3 sm:grid-cols-3">
          {COLOR_MODES.map((m) => (
            <label key={m} className={opcao} data-testid={`mode-${m}`}>
              <input type="radio" name="color-mode" value={m} className="sr-only" checked={mode === m} onChange={() => setMode(m)} aria-label={MODE_LABELS[m]} />
              <span className="font-medium">{MODE_LABELS[m]}</span>
            </label>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
