import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatNumberForInput, isValidDecimalDraft, parseDecimalDraft } from "@/components/months/number-field";

/**
 * Campo numérico que aceita vírgula ou ponto. Mostra sempre o valor de fora (também enquanto se mexe num cursor) e só
 * guarda o que escreveste quando sais do campo ou carregas em Enter.
 */
export function NumberInput({ value, onCommit, label, testId, className, decimals = 2 }: {
  value: number; onCommit: (v: number) => void; label: string; testId?: string; className?: string; decimals?: number;
}) {
  const fmt = (n: number) => (decimals === 2 ? formatNumberForInput(n) : String(Math.round(n * 10 ** decimals) / 10 ** decimals));
  const [draft, setDraft] = useState(() => fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setDraft(fmt(value)); }, [value, focused]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = (raw: string) => {
    const parsed = raw === "" ? 0 : parseDecimalDraft(raw);
    const v = parsed === null ? value : Math.max(0, parsed);
    setDraft(fmt(v));
    if (v !== value) onCommit(v);
  };
  return (
    <Input
      type="text" inputMode="decimal" aria-label={label} value={draft}
      onFocus={(e) => { setFocused(true); e.currentTarget.select(); }}
      onChange={(e) => { if (isValidDecimalDraft(e.target.value)) setDraft(e.target.value); }}
      onBlur={(e) => { setFocused(false); commit(e.target.value); }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit((e.target as HTMLInputElement).value); } }}
      className={cn("tnum text-right", className)}
      data-testid={testId}
    />
  );
}
