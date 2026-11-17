import { useEffect, useState } from "react";
import { fmtEur, fmtPct } from "@shared/calc";

/**
 * Mede o container pai e devolve o maior lado quadrado que cabe nele,
 * respeitando tanto a largura como a altura disponíveis (ex.: donut que
 * partilha espaço horizontal com uma legenda, mas deve crescer com a
 * altura do widget ao ser redimensionado na grelha editável).
 */
export function useSquareFit(maxWidthRatio = 1) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState(0);
  const ref = (el: HTMLDivElement | null) => setNode(el);
  useEffect(() => {
    const parent = node?.parentElement;
    if (!parent) return;
    const measure = () => {
      const rect = parent.getBoundingClientRect();
      const availableWidth = rect.width * maxWidthRatio;
      const availableHeight = rect.height;
      setSize(Math.max(0, Math.min(availableWidth, availableHeight)));
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(parent);
    return () => obs.disconnect();
  }, [node, maxWidthRatio]);
  return { ref, size };
}

export const axisProps = {
  stroke: "hsl(var(--muted-foreground))",
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;

export const gridProps = {
  stroke: "hsl(var(--border))",
  strokeDasharray: "3 3",
  vertical: false,
} as const;

export function eurAxis(v: number) {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

export function ChartTooltip({
  active,
  payload,
  label,
  kind = "eur",
  total = false,
}: any) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p: any) => p.value !== 0 && p.value != null);
  const sum = rows.reduce((a: number, p: any) => a + (p.value ?? 0), 0);
  return (
    <div className="max-w-[calc(100vw-2rem)] rounded-md border border-popover-border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      <p className="mb-1.5 font-semibold text-popover-foreground">{label}</p>
      <div className="space-y-1">
        {rows.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color ?? p.fill }} />
            <span className="mr-3 text-muted-foreground">{p.name}</span>
            <span className="tnum ml-auto font-medium text-popover-foreground">
              {p.unit === "%" || kind === "pct" ? fmtPct(p.value) : fmtEur(p.value)}
            </span>
          </div>
        ))}
        {total && rows.length > 1 && (
          <div className="mt-1 flex items-center gap-2 border-t border-border pt-1">
            <span className="text-muted-foreground">Total</span>
            <span className="tnum ml-auto font-semibold text-popover-foreground">{fmtEur(sum)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function LegendDots({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((i) => (
        <span key={i.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: i.color }} />
          {i.name}
        </span>
      ))}
    </div>
  );
}
