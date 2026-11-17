import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Aceita dígitos, "," e "." enquanto o utilizador escreve; rejeita mais de um separador decimal. */
export function isValidDecimalDraft(raw: string): boolean {
  if (raw === "") return true;
  return /^\d*[.,]?\d*$/.test(raw);
}

/** Converte um rascunho de texto (com "," ou ".") num número válido, ou null se inválido/vazio. */
export function parseDecimalDraft(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const normalized = trimmed.replace(",", ".");
  if (!/^\d*\.?\d*$/.test(normalized)) return null;
  if (normalized === "." || normalized === "") return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function formatNumberForInput(value: number): string {
  if (!Number.isFinite(value)) return "0";
  // evita notação científica e zeros redundantes, mantendo precisão razoável
  return String(Math.round(value * 100) / 100);
}

export function NumberField({
  label,
  value,
  onChange,
  suffix = "€",
  step = 0.01,
  testId,
  hint,
  allowNegative = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
  testId?: string;
  hint?: string;
  allowNegative?: boolean;
}) {
  // Mantém o valor como string enquanto o utilizador digita, para permitir vazio,
  // apagar o "0" inicial e usar "," ou "." como separador decimal sem conversão a cada tecla.
  const [draft, setDraft] = useState<string>(() => formatNumberForInput(value));
  const [focused, setFocused] = useState(false);

  // Sincroniza o rascunho com o valor externo quando o campo não está a ser editado
  // (ex.: ao abrir o editor com outro registo, ou após um guardar bem-sucedido).
  useEffect(() => {
    if (!focused) setDraft(formatNumberForInput(value));
  }, [value, focused]);

  const commit = (raw: string) => {
    if (raw === "") {
      onChange(0);
      return;
    }
    const parsed = parseDecimalDraft(raw);
    if (parsed === null) {
      setDraft(formatNumberForInput(value));
      return;
    }
    const final = !allowNegative && parsed < 0 ? 0 : parsed;
    onChange(final);
    setDraft(formatNumberForInput(final));
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="text"
          inputMode="decimal"
          value={draft}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            const raw = e.target.value;
            if (!isValidDecimalDraft(raw)) return;
            setDraft(raw);
            // Keep the form current even when a mobile keyboard does not blur
            // before the footer's save action. The raw draft stays visible.
            const parsed = parseDecimalDraft(raw);
            if (parsed !== null) onChange(!allowNegative && parsed < 0 ? 0 : parsed);
          }}
          onBlur={(e) => {
            setFocused(false);
            commit(e.target.value);
          }}
          className="tnum h-9 pr-8 text-sm"
          data-testid={testId}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
