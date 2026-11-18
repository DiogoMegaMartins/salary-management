import { useFilters, PERIOD_PRESETS, type Derived } from "@/lib/app";
import { MONTH_NAMES, KINDS } from "@shared/calc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, RotateCcw } from "lucide-react";
import { useState } from "react";

export function FilterBar({ d, showParcels = true }: { d: Derived; showParcels?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const f = useFilters();
  const activeParcels = f.parcelIds === null ? d.allParcels.filter((p) => !p.archived).length : f.parcelIds.length;
  const dirty =
    f.preset !== "custom" ||
    f.year !== new Date().getFullYear() ||
    f.fromMonth !== 1 ||
    f.toMonth !== 12 ||
    f.parcelIds !== null ||
    f.kinds !== null;

  return (
    <div>
    <Button variant="outline" size="sm" className="mb-2 w-full justify-between md:hidden" aria-expanded={mobileOpen} onClick={() => setMobileOpen(v => !v)} data-testid="button-mobile-filters">
      <span>Filtros · {f.year === "todos" ? "Todos os anos" : f.year}{f.preset === "custom" ? ` · ${MONTH_NAMES[f.fromMonth - 1]} a ${MONTH_NAMES[f.toMonth - 1]}` : ""}</span><ChevronDown className="ml-2 h-4 w-4 shrink-0" />
    </Button>
    <div className={`${mobileOpen ? "flex" : "hidden"} flex-wrap items-center gap-2 md:flex`}>
      <Select value={f.preset} onValueChange={(v) => f.setPreset(v as any)}>
        <SelectTrigger className="h-8 w-[168px] text-xs" data-testid="select-period-preset">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(f.year)}
        onValueChange={(v) => f.setYear(v === "todos" ? "todos" : Number(v))}
        disabled={f.preset !== "custom"}
      >
        <SelectTrigger className="h-8 w-[116px] text-xs" data-testid="select-year">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os anos</SelectItem>
          {d.years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1.5">
        <Select
          value={String(f.fromMonth)}
          onValueChange={(v) => f.setRange(Number(v), Math.max(f.toMonth, Number(v)))}
          disabled={f.preset !== "custom"}
        >
          <SelectTrigger className="h-8 w-[112px] text-xs" data-testid="select-from-month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">até</span>
        <Select
          value={String(f.toMonth)}
          onValueChange={(v) => f.setRange(Math.min(f.fromMonth, Number(v)), Number(v))}
          disabled={f.preset !== "custom"}
        >
          <SelectTrigger className="h-8 w-[112px] text-xs" data-testid="select-to-month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" data-testid="button-filter-kinds">
            Tipo
            {f.kinds && <Badge variant="secondary" className="h-4 px-1 text-[11px]">{f.kinds.length}</Badge>}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44 p-2">
          {KINDS.map((k) => {
            const checked = f.kinds === null || f.kinds.includes(k.value);
            return (
              <DropdownMenuCheckboxItem
                key={k.value}
                checked={checked}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(v) => {
                  const current = f.kinds ?? KINDS.map((x) => x.value as string);
                  const next = v ? [...current, k.value] : current.filter((x) => x !== k.value);
                  f.setKinds(next.length === KINDS.length ? null : next);
                }}
              >
                {k.label}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {showParcels && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" data-testid="button-filter-parcels">
              Parcelas
              <Badge variant="secondary" className="h-4 px-1 text-[11px]">{activeParcels}</Badge>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60 p-2">
            {d.allParcels
              .filter((p) => !p.archived)
              .map((p) => {
                const checked = f.parcelIds === null || f.parcelIds.includes(p.id);
                return (
                  <DropdownMenuCheckboxItem
                    key={p.id}
                    checked={checked}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(v) => {
                      const all = d.allParcels.filter((x) => !x.archived).map((x) => x.id);
                      const current = f.parcelIds ?? all;
                      const next = v ? [...current, p.id] : current.filter((x) => x !== p.id);
                      f.setParcelIds(next.length === all.length ? null : next);
                    }}
                  >
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {dirty && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={f.reset}
          data-testid="button-reset-filters"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Limpar
        </Button>
      )}

      <span
        className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium tnum"
        data-testid="text-applied-period"
      >
        {d.periodLabel}
        <span className="text-muted-foreground font-normal">
          · {d.months.length} {d.months.length === 1 ? "mês" : "meses"}
        </span>
      </span>
    </div>
    </div>
  );
}
