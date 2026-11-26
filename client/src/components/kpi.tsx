import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, HelpCircle } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { fmtEur, fmtPct } from "@shared/calc";

function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const initial = from.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(initial + (target - initial) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export function Kpi({
  label,
  value,
  kind = "eur",
  delta,
  hint,
  tone = "neutral",
  testId,
  onClick,
  helpSlug,
  deltaTone = "up-good",
}: {
  label: string;
  value: number;
  kind?: "eur" | "pct" | "raw";
  delta?: number | null;
  onClick?: () => void;
  hint?: string;
  tone?: "neutral" | "positive" | "negative" | "primary";
  testId?: string;
  /** SM-011: slug da secção de ajuda para o link "Saber mais" no canto do KPI. */
  helpSlug?: string;
  /** "up-bad": subir é desfavorável (ex.: gastos) e fica a âmbar em vez de verde. */
  deltaTone?: "up-good" | "up-bad";
}) {
  const animated = useCountUp(value);
  const shown =
    kind === "eur" ? fmtEur(animated) : kind === "pct" ? fmtPct(animated) : animated.toFixed(0);
  const DeltaIcon = delta == null ? ArrowRight : delta > 0.0001 ? ArrowUpRight : delta < -0.0001 ? ArrowDownRight : ArrowRight;
  return (
    <div
      className={cn(
        "relative h-full min-w-0 rounded-2xl border border-card-border bg-card p-3 sm:p-4",
        onClick && "cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/40",
      )}
      onClick={onClick}
    >
      {/* a ligação de ajuda fica fora da zona que se carrega, para não haver controlos dentro de controlos */}
      <div
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        className={onClick ? "rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-ring" : undefined}
        onKeyDown={onClick ? (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        } : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          {/* duas linhas reservadas: com títulos de uma e de duas linhas, os valores ficam alinhados entre cartões */}
          <p className={cn("min-h-8 text-xs font-medium uppercase leading-4 tracking-wide text-muted-foreground", helpSlug && "pr-7")}>{label}</p>
        </div>
      <p
        className={cn(
          "tnum mt-2 text-lg font-semibold",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
          tone === "primary" && "text-primary",
        )}
        data-testid={testId}
      >
        {shown}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        {delta != null && (
          <span
            className={cn(
              "tnum inline-flex items-center gap-0.5 font-medium",
              delta > 0.0001
                ? deltaTone === "up-bad" ? "text-warning" : "text-success"
                : delta < -0.0001
                  ? deltaTone === "up-bad" ? "text-success" : "text-destructive"
                  : "text-muted-foreground",
            )}
          >
            <DeltaIcon className="h-3 w-3" />
            {fmtPct(Math.abs(delta))}
          </span>
        )}
        {hint && <span className="min-w-0 sm:truncate">{hint}</span>}
      </div>
      </div>
        {helpSlug && (
          <Link
            href={`/ajuda/${helpSlug}`}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-1.5 top-1.5 inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Saber mais sobre ${label}`}
            data-testid={`link-help-${testId}`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </Link>
        )}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  /** Sem título, só a descrição (quando o separador já diz o nome). */
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("section-card flex h-full min-w-0 min-h-[280px] flex-col rounded-2xl border border-card-border bg-card in-[.grid-widget]:min-h-0", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border px-5 py-3.5">
        <div className="min-w-0 wrap-break-word">
          {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto p-4 sm:p-5">{children}</div>
    </section>
  );
}
