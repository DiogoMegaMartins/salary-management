import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

type Props = {
  /** `AAAA-MM` ou "" (sem valor). */
  value: string;
  /** Chamado só com um valor completo (`AAAA-MM`) ou "" quando se limpa. */
  onChange: (value: string) => void;
  "aria-label": string;
  /** Mostra o botão de limpar quando há valor (datas opcionais). */
  clearable?: boolean;
  className?: string;
  "data-testid"?: string;
};

/**
 * Escolha de mês e ano sempre em português, com o mesmo aspeto em todos os navegadores. O campo nativo
 * `type="month"` mostra "----" ou "mm/aaaa" conforme o idioma do navegador e não se pode traduzir.
 */
export function MonthInput({ value, onChange, clearable, className, ...rest }: Props) {
  const label = rest["aria-label"];
  const tid = rest["data-testid"];
  const [y, m] = /^\d{4}-\d{2}$/.test(value) ? value.split("-") : ["", ""];
  const [month, setMonth] = useState(m);
  const [year, setYear] = useState(y);
  useEffect(() => { setMonth(m); setYear(y); }, [m, y]);

  const emit = (mm: string, yy: string) => {
    if (mm && /^\d{4}$/.test(yy)) onChange(`${yy}-${mm}`);
  };
  return (
    <div className="flex min-w-0 items-center gap-1.5" role="group" aria-label={label} data-testid={tid}>
      <Select value={month} onValueChange={(v) => { setMonth(v); emit(v, year); }}>
        <SelectTrigger className={cn("min-w-0 flex-1", className)} aria-label={`${label}: mês`} data-testid={tid ? `${tid}-month` : undefined}>
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((name, i) => (
            <SelectItem key={name} value={String(i + 1).padStart(2, "0")}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        inputMode="numeric"
        maxLength={4}
        placeholder="Ano"
        value={year}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          setYear(v);
          emit(month, v);
        }}
        aria-label={`${label}: ano`}
        data-testid={tid ? `${tid}-year` : undefined}
        className={cn("tnum w-[4.5rem] shrink-0", className)}
      />
      {clearable && (value !== "" || month || year) && (
        <button
          type="button"
          aria-label={`Limpar ${label.toLowerCase()}`}
          title="Limpar"
          data-testid={tid ? `${tid}-clear` : undefined}
          onClick={() => { setMonth(""); setYear(""); onChange(""); }}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-foreground [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
