import { useMemo } from "react";
import { CalendarRange, Info, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Derived } from "@/lib/app";
import { useYoYSelection, DEFAULT_YOY_SELECTION, type YoYSelection } from "@/lib/yoy-selection";
import { cn } from "@/lib/utils";
import {
  MONTH_NAMES,
  categoryYearOverYear,
  compareMonthSets,
  fmtEur,
  fmtPct,
  parcelYearOverYear,
  yearMonthKey,
  yearOverYear,
} from "@shared/calc";
import { pctSigned } from "@/components/insights";

const GOOD = "text-emerald-700 dark:text-emerald-400";
const BAD = "text-destructive";
/** Cor da variação: `upIsGood` indica se subir é bom (rendimento, poupança) ou mau (gastos, descontos). */
const tone = (x: number | null, upIsGood: boolean) => (x == null || Math.abs(x) < 0.0005 ? "text-muted-foreground" : (x > 0) === upIsGood ? GOOD : BAD);
const pp = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1).replace(".", ",")} p.p.`;

/** Meses e ano de referência em uso: a escolha guardada ou, sem ela, os meses do filtro. */
export function useYoYComparison(d: Derived) {
  const [sel, setSel] = useYoYSelection();
  const chosen = useMemo(() => {
    if (sel.mode !== "manual") return { months: d.months, computed: d.computed };
    const keys = new Set(sel.months);
    const months: Derived["allMonths"] = [];
    const computed: Derived["allComputed"] = [];
    d.allMonths.forEach((m, i) => {
      if (keys.has(yearMonthKey(m.year, m.month))) {
        months.push(m);
        computed.push(d.allComputed[i]);
      }
    });
    return { months, computed };
  }, [sel, d.months, d.computed, d.allMonths, d.allComputed]);
  const free = sel.refYear === "meses";
  const refYear = typeof sel.refYear === "number" ? sel.refYear : null;
  const base = useMemo(() => {
    const keys = new Set(sel.compareMonths);
    const months: Derived["allMonths"] = [];
    const computed: Derived["allComputed"] = [];
    d.allMonths.forEach((m, i) => {
      if (keys.has(yearMonthKey(m.year, m.month))) {
        months.push(m);
        computed.push(d.allComputed[i]);
      }
    });
    return { months, computed };
  }, [sel.compareMonths, d.allMonths, d.allComputed]);
  const yoy = useMemo(
    () =>
      free
        ? compareMonthSets(chosen.months, chosen.computed, base.months, base.computed)
        : yearOverYear(chosen.months, chosen.computed, d.allMonths, d.allComputed, refYear),
    [free, chosen, base, d.allMonths, d.allComputed, refYear],
  );
  return { sel, setSel, yoy, refYear, free, chosenCount: free ? Math.min(chosen.months.length, base.months.length) : chosen.months.length };
}

/* ------------------------------------------------------------------ controlos */

type ByYear = (readonly [number, number[]])[];

/** Seletor de meses com uma única ação "Selecionar todos / Limpar seleção". */
function MonthPicker({
  byYear,
  checked,
  allKeys,
  onChange,
  label,
  ariaLabel,
  testid,
}: {
  byYear: ByYear;
  checked: (key: string) => boolean;
  allKeys: string[];
  onChange: (keys: string[]) => void;
  label: string;
  ariaLabel: string;
  testid: string;
}) {
  const current = allKeys.filter(checked);
  const all = allKeys.length > 0 && current.length === allKeys.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" data-testid={`${testid}-trigger`} aria-label={ariaLabel}>
          <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3" data-testid={`${testid}-panel`}>
        <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" data-testid={`${testid}-toggle-all`} onClick={() => onChange(all ? [] : allKeys)}>
          {all ? "Limpar seleção" : "Selecionar todos"}
        </Button>
        <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
          {byYear.map(([year, months]) => (
            <fieldset key={year}>
              <legend className="mb-1 text-xs font-semibold text-muted-foreground">{year}</legend>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {months.map((m) => {
                  const key = yearMonthKey(year, m);
                  const id = `${testid}-m-${key}`;
                  return (
                    <label key={key} htmlFor={id} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        id={id}
                        data-testid={`${testid}-month-${key}`}
                        checked={checked(key)}
                        onCheckedChange={(v) => onChange(v === true ? Array.from(new Set(current.concat(key))) : current.filter((k) => k !== key))}
                      />
                      {MONTH_NAMES[m - 1]}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const countLabel = (n: number) => (n === 0 ? "Nenhum mês" : `${n} ${n === 1 ? "mês" : "meses"}`);

export function YoYControls({ d, sel, setSel }: { d: Derived; sel: YoYSelection; setSel: (s: YoYSelection) => void }) {
  // um mês por ano e mês (dois dezembros contam como um)
  const byYear = useMemo<ByYear>(() => {
    const out = new Map<number, number[]>();
    for (const m of d.allMonths) {
      const list = out.get(m.year) ?? [];
      if (!list.includes(m.month)) list.push(m.month);
      out.set(m.year, list);
    }
    return Array.from(out.entries()).sort((a, b) => b[0] - a[0]).map(([y, ms]) => [y, ms.sort((a, b) => a - b)] as const);
  }, [d.allMonths]);
  const years = byYear.map(([y]) => y);
  const allKeys = byYear.flatMap(([y, ms]) => ms.map((m) => yearMonthKey(y, m)));
  const filterKeys = Array.from(new Set(d.months.map((m) => yearMonthKey(m.year, m.month))));
  const free = sel.refYear === "meses";

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="yoy-controls">
      <MonthPicker
        byYear={byYear}
        allKeys={allKeys}
        checked={(key) => (sel.mode === "manual" ? sel.months.includes(key) : filterKeys.includes(key))}
        onChange={(keys) => setSel({ ...sel, mode: "manual", months: keys })}
        label={sel.mode === "manual" ? countLabel(sel.months.length) : countLabel(filterKeys.length)}
        ariaLabel="Escolher meses a comparar"
        testid="yoy-months"
      />

      <Select value={String(sel.refYear)} onValueChange={(v) => setSel({ ...sel, refYear: v === "auto" ? "auto" : v === "meses" ? "meses" : Number(v) })}>
        <SelectTrigger className="h-8 w-auto min-w-44 gap-2 text-xs" data-testid="yoy-ref-select" aria-label="Comparar com">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">Comparar com o ano anterior</SelectItem>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              Comparar com {y}
            </SelectItem>
          ))}
          <SelectItem value="meses">Comparar com outros meses</SelectItem>
        </SelectContent>
      </Select>

      {free && (
        <MonthPicker
          byYear={byYear}
          allKeys={allKeys}
          checked={(key) => sel.compareMonths.includes(key)}
          onChange={(keys) => setSel({ ...sel, compareMonths: keys })}
          label={`Base: ${countLabel(sel.compareMonths.length).toLowerCase()}`}
          ariaLabel="Escolher meses de comparação"
          testid="yoy-base"
        />
      )}

      {(sel.mode !== "filtro" || sel.refYear !== "auto") && (
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs" data-testid="yoy-reset" onClick={() => setSel(DEFAULT_YOY_SELECTION)}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Repor
        </Button>
      )}
    </div>
  );
}

function Empty({ manual, noMonths, free }: { manual: boolean; noMonths: boolean; free?: boolean }) {
  return (
    <p className="flex items-start gap-2 py-3 text-xs text-muted-foreground" data-testid="yoy-empty">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {free && noMonths
        ? "Escolhe pelo menos um mês de cada lado: os meses a comparar e os meses da base."
        : noMonths
        ? "Não há meses escolhidos. Escolhe pelo menos um mês."
        : manual
          ? "Nenhum dos meses escolhidos tem o mesmo mês no ano de comparação. Muda o ano ou os meses."
          : "Sem os mesmos meses do ano anterior para comparar neste período. A comparação aparece quando houver pelo menos um mês com o seu par um ano antes."}
    </p>
  );
}

function summary(n: number, refYear: number | null, yoy?: { kind?: string; divisor?: { current: number; previous: number }; pairs: { current: unknown[]; previous: unknown[] }[] }) {
  if (yoy?.kind === "livre") {
    const p = yoy.pairs[0];
    const base = `${p.current.length} ${p.current.length === 1 ? "mês" : "meses"} face a ${p.previous.length} ${p.previous.length === 1 ? "mês" : "meses"} da base.`;
    return yoy.divisor ? `${base} Como os lados têm tamanhos diferentes, os valores são médias mensais.` : base;
  }
  const meses = n === 1 ? "mês comparado" : "meses comparados";
  const com = refYear == null ? (n === 1 ? "o mesmo mês do ano anterior" : "os mesmos meses do ano anterior") : n === 1 ? `o mesmo mês de ${refYear}` : `os mesmos meses de ${refYear}`;
  return `${n} ${meses} com ${com}. Meses sem par ficam de fora.`;
}

/* ---------------------------------------------------------------------- cartões */

export function YearOverYearCard({ d }: { d: Derived }) {
  const { sel, setSel, yoy, refYear, chosenCount, free } = useYoYComparison(d);
  const parcels = useMemo(() => (yoy ? parcelYearOverYear(d.allParcels, yoy) : []), [d.allParcels, yoy]);
  return (
    <div data-testid="yoy-card" className="space-y-3">
      <YoYControls d={d} sel={sel} setSel={setSel} />
      {!yoy ? (
        <Empty manual={sel.mode === "manual"} noMonths={chosenCount === 0} free={free} />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{summary(yoy.pairs.length, refYear, yoy)}</p>
          <MetricsTable yoy={yoy} />
          {parcels.length > 0 && (
            <div data-testid="yoy-parcels">
              <h4 className="mb-1 text-xs font-semibold text-muted-foreground">Total alocado por parcela</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1 pr-3 font-medium">Parcela</th>
                      <th className="py-1 pr-3 text-right font-medium">Agora</th>
                      <th className="py-1 pr-3 text-right font-medium">Comparação</th>
                      <th className="py-1 text-right font-medium">Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcels.map((r) => (
                      <tr key={r.id} className="border-t border-border" data-testid={`yoy-parcel-${r.id}`}>
                        <td className="py-1.5 pr-3">
                          <span className="inline-flex items-center gap-2">
                            {r.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />}
                            {r.name}
                          </span>
                        </td>
                        <td className="tnum py-1.5 pr-3 text-right">{fmtEur(r.current)}</td>
                        <td className="tnum py-1.5 pr-3 text-right text-muted-foreground">{fmtEur(r.previous)}</td>
                        <td className="tnum py-1.5 text-right font-medium text-muted-foreground">
                          {r.delta >= 0 ? "+" : ""}
                          {fmtEur(r.delta)}
                          {r.deltaPct != null && ` (${pctSigned(r.deltaPct)})`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricsTable({ yoy }: { yoy: NonNullable<ReturnType<typeof useYoYComparison>["yoy"]> }) {
  type Row = { id: string; label: string; cur: string; prev: string; delta: number | null; text?: string; upIsGood: boolean };
  const rows: Row[] = [
    { id: "net", label: "Líquido", cur: fmtEur(yoy.current.net), prev: fmtEur(yoy.previous.net), delta: yoy.delta.net, upIsGood: true },
    { id: "gross", label: "Rendimento bruto", cur: fmtEur(yoy.current.gross), prev: fmtEur(yoy.previous.gross), delta: yoy.delta.gross, upIsGood: true },
    { id: "descontos", label: "Descontos (IRS e SS)", cur: fmtEur(yoy.current.descontos), prev: fmtEur(yoy.previous.descontos), delta: yoy.delta.descontos, upIsGood: false },
    { id: "tax", label: "Carga fiscal efetiva", cur: fmtPct(yoy.current.taxRate), prev: fmtPct(yoy.previous.taxRate), delta: yoy.taxRateDeltaPP, text: pp(yoy.taxRateDeltaPP), upIsGood: false },
    { id: "spent", label: "Gastos", cur: fmtEur(yoy.current.spent), prev: fmtEur(yoy.previous.spent), delta: yoy.delta.spent, upIsGood: false },
    { id: "saved", label: "Poupança e investimento", cur: fmtEur(yoy.current.saved), prev: fmtEur(yoy.previous.saved), delta: yoy.delta.saved, upIsGood: true },
    { id: "rate", label: "Taxa de poupança", cur: fmtPct(yoy.current.savingsRate), prev: fmtPct(yoy.previous.savingsRate), delta: yoy.savingsRateDeltaPP, text: pp(yoy.savingsRateDeltaPP), upIsGood: true },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1 pr-3 font-medium">Indicador</th>
            <th className="py-1 pr-3 text-right font-medium">Agora</th>
            <th className="py-1 pr-3 text-right font-medium">Comparação</th>
            <th className="py-1 text-right font-medium">Variação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border" data-testid={`yoy-row-${r.id}`}>
              <td className="py-1.5 pr-3">{r.label}</td>
              <td className="tnum py-1.5 pr-3 text-right">{r.cur}</td>
              <td className="tnum py-1.5 pr-3 text-right text-muted-foreground">{r.prev}</td>
              <td className={cn("tnum py-1.5 text-right font-medium", tone(r.delta, r.upIsGood))}>{r.text ?? pctSigned(r.delta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Despesa por categoria face ao ano de comparação (Orçamento); usa a mesma escolha do Painel. */
export function CategoryYearOverYear({ d }: { d: Derived }) {
  const { sel, setSel, yoy, refYear, chosenCount, free } = useYoYComparison(d);
  const rows = useMemo(() => (yoy ? categoryYearOverYear(d.allTransactions, yoy).slice(0, 10) : []), [d.allTransactions, yoy]);
  return (
    <div className="space-y-3" data-testid="yoy-categories-card">
      <YoYControls d={d} sel={sel} setSel={setSel} />
      {!yoy ? (
        <Empty manual={sel.mode === "manual"} noMonths={chosenCount === 0} free={free} />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{summary(yoy.pairs.length, refYear, yoy)}</p>
          {rows.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">Sem despesas com categoria nos meses comparados.</p>
          ) : (
            <div className="overflow-x-auto" data-testid="yoy-categories">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">Categoria</th>
                    <th className="py-1 pr-3 text-right font-medium">Agora</th>
                    <th className="py-1 pr-3 text-right font-medium">Comparação</th>
                    <th className="py-1 text-right font-medium">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name} className="border-t border-border">
                      <td className="py-1.5 pr-3">{r.name}</td>
                      <td className="tnum py-1.5 pr-3 text-right">{fmtEur(r.current)}</td>
                      <td className="tnum py-1.5 pr-3 text-right text-muted-foreground">{fmtEur(r.previous)}</td>
                      <td className={cn("tnum py-1.5 text-right font-medium", tone(r.delta, false))}>
                        {r.delta >= 0 ? "+" : ""}
                        {fmtEur(r.delta)}
                        {r.deltaPct != null && ` (${pctSigned(r.deltaPct)})`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
