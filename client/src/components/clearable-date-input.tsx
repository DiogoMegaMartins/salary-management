import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  type?: "date" | "month";
  "aria-label": string;
  className?: string;
  "data-testid"?: string;
  /** Called after a value is cleared with the button (to persist immediately). */
  onClear?: () => void;
  onBlur?: (value: string) => void;
};

/** Date/month input with a button that removes the value (optional dates). */
export function ClearableDateInput({ value, onChange, type = "month", className, onClear, onBlur, ...rest }: Props) {
  const label = rest["aria-label"];
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur ? (e) => onBlur(e.target.value) : undefined}
        aria-label={label}
        data-testid={rest["data-testid"]}
        className={cn("min-w-0 flex-1", className)}
      />
      {value !== "" && (
        <button
          type="button"
          aria-label={`Limpar ${label.toLowerCase()}`}
          title="Limpar"
          data-testid={rest["data-testid"] ? `${rest["data-testid"]}-clear` : undefined}
          onClick={() => { onChange(""); onClear?.(); }}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-foreground [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
