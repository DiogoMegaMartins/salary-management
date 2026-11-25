import { useMemo, type ReactNode } from "react";
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

const GOOD = "text-success";
const BAD = "text-destructive";
/** Cor da variação: `upIsGood` indica se subir é bom (rendimento, poupança) ou mau (gastos, descontos). */
const tone = (x: number | null, upIsGood: boolean) => (x == null || Math.abs(x) < 0.0005 ? "text-muted-foreground" : (x > 0) === upIsGood ? GOOD : BAD);
const eurSigned = (x: number) => (Math.abs(x) < 0.005 ? fmtEur(0) : `${x > 0 ? "+" : "−"}${fmtEur(Math.abs(x))}`);
/** Variação em euros e em percentagem: "+143,00 € (+20,0%)" */
const eurPct = (delta: number, pct: number | null) => `${eurSigned(delta)}${pct != null ? ` (${pctSigned(pct)})` : ""}`;
const pp = (x: number) => {
  const v = Math.round(x * 1000) / 10;
  return `${v > 0 ? "+" : ""}${(v === 0 ? 0 : v).toFixed(1).replace(".", ",")} p.p.`;
};

/** Meses e ano de referência em uso: a escolha guardada ou, sem ela, os meses do filtro. */
function useYoYComparison(d: Derived) {
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
        : refYear == null
          ? null // o ano de comparação escolhe-se sempre à mão (sem ano anterior por omissão)
          : yearOverYear(chosen.months, chosen.computed, d.allMonths, d.allComputed, refYear),
    [free, chosen, base, d.allMonths, d.allComputed, refYear],
  );
  return { sel, setSel, yoy, refYear, free, chosenCount: free ? Math.min(chosen.months.length, base.months.length) : chosen.months.length, noRef: !free && refYear == null };
}

const NO_DATA = { months: [], computed: [], allMonths: [], allComputed: [] } as unknown as Derived;
/** true quando o cartão de comparação não tem tabela para mostrar (para o encolher na grelha). */
export function useYoYEmpty(d: Derived | null) {
  return !useYoYComparison(d ?? NO_DATA).yoy;
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
  header,
}: {
  byYear: ByYear;
  checked: (key: string) => boolean;
  allKeys: string[];
  onChange: (keys: string[]) => void;
  label: string;
  ariaLabel: string;
  testid: string;
  /** conteúdo acima da lista (ex.: escolha do ano) */
  header?: ReactNode;
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
        {header}
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

function YoYControls({ d, sel, setSel }: { d: Derived; sel: YoYSelection; setSel: (s: YoYSelection) => void }) {
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
  const filterKeys = Array.from(new Set(d.months.map((m) => yearMonthKey(m.year, m.month))));
  const free = sel.refYear === "meses";
  // ano mostrado no painel de meses: o escolhido ou, sem escolha, o mais recente
  const year = sel.year != null && years.includes(sel.year) ? sel.year : years[0];
  const yearOnly = useMemo<ByYear>(() => byYear.filter(([y]) => y === year), [byYear, year]);
  const yearKeys = yearOnly.flatMap(([y, ms]) => ms.map((m) => yearMonthKey(y, m)));
  const setType = (v: string) =>
    v === "mes"
      ? setSel({ ...sel, mode: "manual", months: [], compareMonths: [], refYear: "meses", year })
      : setSel({ ...sel, refYear: "auto", compareMonths: [], months: sel.mode === "manual" ? sel.months.filter((k) => yearKeys.includes(k)) : [] });
  const setYear = (v: string) => setSel({ ...sel, mode: "manual", months: [], compareMonths: [], year: Number(v) });
  /** ano de comparação: nunca o próprio ano escolhido */
  const otherYears = years.filter((y) => y !== year);
  const refValue = typeof sel.refYear === "number" && sel.refYear !== year ? String(sel.refYear) : "";
  const pickYear = (y: number) =>
    setSel({
      ...sel,
      mode: "manual",
      year: y,
      months: byYear.filter(([yy]) => yy === y).flatMap(([yy, ms]) => ms.map((m) => yearMonthKey(yy, m))),
      refYear: sel.refYear === y ? "auto" : sel.refYear,
    });
  const yearChips = (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ano" data-testid="yoy-months-years">
      {years.map((y) => (
        <Button
          key={y}
          type="button"
          size="sm"
          variant={y === year ? "default" : "outline"}
          aria-pressed={y === year}
          className="h-7 px-2.5 text-xs"
          data-testid={`yoy-months-year-${y}`}
          onClick={() => pickYear(y)}
        >
          {y}
        </Button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="yoy-controls">
      <Select value={free ? "mes" : "ano"} onValueChange={setType}>
        <SelectTrigger className="h-8 w-auto min-w-44 gap-2 text-xs" data-testid="yoy-type-select" aria-label="Tipo de comparação">
          <SelectValue placeholder="Tipo de comparação" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ano">Comparar com ano</SelectItem>
          <SelectItem value="mes">Comparar com mês</SelectItem>
        </SelectContent>
      </Select>

      {free ? (
        <>
          <Select value={String(year)} onValueChange={setYear}>
            <SelectTrigger className="h-8 w-auto min-w-24 gap-2 text-xs" data-testid="yoy-year-select" aria-label="Ano dos meses">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <MonthPicker
            byYear={yearOnly}
            allKeys={yearKeys}
            checked={(key) => sel.compareMonths.includes(key)}
            onChange={(keys) => setSel({ ...sel, compareMonths: keys })}
            label={`Base (inicial): ${countLabel(sel.compareMonths.length).toLowerCase()}`}
            ariaLabel="Escolher os meses de base (iniciais)"
            testid="yoy-base"
          />
          <MonthPicker
            byYear={yearOnly}
            allKeys={yearKeys}
            checked={(key) => sel.months.includes(key)}
            onChange={(keys) => setSel({ ...sel, mode: "manual", months: keys })}
            label={`Comparação (final): ${countLabel(sel.mode === "manual" ? sel.months.length : 0).toLowerCase()}`}
            ariaLabel="Escolher os meses de comparação (finais)"
            testid="yoy-months"
          />
        </>
      ) : (
        <>
          <MonthPicker
            byYear={yearOnly}
            allKeys={yearKeys}
            checked={(key) => (sel.mode === "manual" ? sel.months.includes(key) : filterKeys.includes(key))}
            onChange={(keys) => setSel({ ...sel, mode: "manual", year, months: keys })}
            label={sel.mode === "manual" ? `${year}: ${countLabel(sel.months.length).toLowerCase()}` : countLabel(filterKeys.length)}
            ariaLabel="Escolher o ano e os meses a comparar"
            testid="yoy-months"
            header={yearChips}
          />
          <Select value={refValue} onValueChange={(v) => setSel({ ...sel, refYear: Number(v) })}>
            <SelectTrigger className="h-8 w-auto min-w-44 gap-2 text-xs" data-testid="yoy-ref-select" aria-label="Ano de comparação">
              <SelectValue placeholder="Ano de comparação" />
            </SelectTrigger>
            <SelectContent>
              {otherYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  Comparar com {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
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

function Empty({ manual, noMonths, free, noRef }: { manual: boolean; noMonths: boolean; free?: boolean; noRef?: boolean }) {
  return (
    <p className="flex items-start gap-2 py-3 text-xs text-muted-foreground" data-testid="yoy-empty">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {noRef && !noMonths
        ? "Escolhe o ano de comparação para ver a tabela."
        : free && noMonths
        ? "Escolhe pelo menos um mês de cada lado: os meses de base (iniciais) e os de comparação (finais)."
        : noMonths
        ? "Não há meses escolhidos. Escolhe pelo menos um mês."
        : manual
          ? "Nenhum dos meses escolhidos tem o mesmo mês no ano de comparação. Muda o ano ou os meses."
          : "Os meses escolhidos não existem no ano de comparação. Muda o ano ou os meses."}
    </p>
  );
}

function summary(n: number, refYear: number | null, yoy?: { kind?: string; divisor?: { current: number; previous: number }; pairs: { current: unknown[]; previous: unknown[] }[] }) {
  if (yoy?.kind === "livre") {
    const p = yoy.pairs[0];
    const base = `${p.current.length} ${p.current.length === 1 ? "mês" : "meses"} de comparação face a ${p.previous.length} ${p.previous.length === 1 ? "mês" : "meses"} de base.`;
    return yoy.divisor ? `${base} Como os lados têm tamanhos diferentes, os valores são médias mensais.` : base;
  }
  const meses = n === 1 ? "mês comparado" : "meses comparados";
  const com = refYear == null ? (n === 1 ? "o mesmo mês do ano anterior" : "os mesmos meses do ano anterior") : n === 1 ? `o mesmo mês de ${refYear}` : `os mesmos meses de ${refYear}`;
  return `${n} ${meses} com ${com}. Meses sem par ficam de fora.`;
}

/* ---------------------------------------------------------------------- cartões */

type YoYData = NonNullable<ReturnType<typeof useYoYComparison>["yoy"]>;
const yearsLabel = (ms: { year: number }[]) => Array.from(new Set(ms.map((m) => m.year))).sort().join(", ");
/** Cabeçalhos e ordem das colunas: base (inicial) antes da comparação (final); no modo ano, cada coluna é o seu ano. */
function colsOf(yoy: YoYData) {
  if (yoy.kind === "livre") return { swap: true, first: "Base", second: "Comparação" };
  return { swap: false, first: yearsLabel(yoy.pairs.flatMap((p) => p.current)), second: yearsLabel(yoy.pairs.flatMap((p) => p.previous)) };
}


export function YearOverYearCard({ d }: { d: Derived }) {
  const { sel, setSel, yoy, refYear, chosenCount, free, noRef } = useYoYComparison(d);
  const parcels = useMemo(() => (yoy ? parcelYearOverYear(d.allParcels, yoy) : []), [d.allParcels, yoy]);
  return (
    <div data-testid="yoy-card" className="space-y-3">
      <YoYControls d={d} sel={sel} setSel={setSel} />
      {!yoy ? (
        <Empty manual={sel.mode === "manual"} noMonths={chosenCount === 0} free={free} noRef={noRef} />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{summary(yoy.pairs.length, refYear, yoy)}</p>
          <MetricsTable yoy={yoy} parcels={parcels} />
        </>
      )}
    </div>
  );
}

function MetricsTable({ yoy, parcels }: { yoy: YoYData; parcels: ReturnType<typeof parcelYearOverYear> }) {
  const cols = colsOf(yoy);
  type Row = { id: string; label: string; cur: string; prev: string; delta: number | null; text?: string; upIsGood: boolean };
  const withText = (cur: number, prev: number, pct: number | null) => eurPct(Math.round((cur - prev) * 100) / 100, pct);
  const rows: Row[] = [
    { id: "net", label: "Líquido", cur: fmtEur(yoy.current.net), prev: fmtEur(yoy.previous.net), delta: yoy.delta.net, text: withText(yoy.current.net, yoy.previous.net, yoy.delta.net), upIsGood: true },
    { id: "gross", label: "Rendimento bruto", cur: fmtEur(yoy.current.gross), prev: fmtEur(yoy.previous.gross), delta: yoy.delta.gross, text: withText(yoy.current.gross, yoy.previous.gross, yoy.delta.gross), upIsGood: true },
    { id: "descontos", label: "Descontos (IRS e SS)", cur: fmtEur(yoy.current.descontos), prev: fmtEur(yoy.previous.descontos), delta: yoy.delta.descontos, text: withText(yoy.current.descontos, yoy.previous.descontos, yoy.delta.descontos), upIsGood: false },
    { id: "tax", label: "Carga fiscal efetiva", cur: fmtPct(yoy.current.taxRate), prev: fmtPct(yoy.previous.taxRate), delta: yoy.taxRateDeltaPP, text: pp(yoy.taxRateDeltaPP), upIsGood: false },
    { id: "spent", label: "Gastos", cur: fmtEur(yoy.current.spent), prev: fmtEur(yoy.previous.spent), delta: yoy.delta.spent, text: withText(yoy.current.spent, yoy.previous.spent, yoy.delta.spent), upIsGood: false },
    { id: "saved", label: "Poupança e investimento", cur: fmtEur(yoy.current.saved), prev: fmtEur(yoy.previous.saved), delta: yoy.delta.saved, text: withText(yoy.current.saved, yoy.previous.saved, yoy.delta.saved), upIsGood: true },
    { id: "rate", label: "Taxa de poupança", cur: fmtPct(yoy.current.savingsRate), prev: fmtPct(yoy.previous.savingsRate), delta: yoy.savingsRateDeltaPP, text: pp(yoy.savingsRateDeltaPP), upIsGood: true },
  ];
  const allocCur = Math.round(parcels.reduce((a, r) => a + r.current, 0) * 100) / 100;
  const allocPrev = Math.round(parcels.reduce((a, r) => a + r.previous, 0) * 100) / 100;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-120 table-fixed text-left text-sm">
        <ColGroup />
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="py-1 pr-3 text-left font-medium">Indicador</th>
            <th className="py-1 pr-3 text-left font-medium">{cols.first}</th>
            <th className="py-1 pr-3 text-left font-medium">{cols.second}</th>
            <th className="py-1 text-left font-medium">Variação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border" data-testid={`yoy-row-${r.id}`}>
              <td className="py-1.5 pr-3">{r.label}</td>
              <td className="tnum py-1.5 pr-3">{cols.swap ? r.prev : r.cur}</td>
              <td className="tnum py-1.5 pr-3 text-muted-foreground">{cols.swap ? r.cur : r.prev}</td>
              <td className={cn("tnum py-1.5 font-medium", tone(r.delta, r.upIsGood))}>{r.text ?? pctSigned(r.delta)}</td>
            </tr>
          ))}
        </tbody>
        {parcels.length > 0 && (
          <tbody data-testid="yoy-parcels">
            <tr className="border-t border-border" data-testid="yoy-row-alocado">
              <td className="py-1.5 pr-3">Total alocado por parcela</td>
              <td className="tnum py-1.5 pr-3">{fmtEur(cols.swap ? allocPrev : allocCur)}</td>
              <td className="tnum py-1.5 pr-3 text-muted-foreground">{fmtEur(cols.swap ? allocCur : allocPrev)}</td>
              <td className={cn("tnum py-1.5", tone(allocPrev > 0 ? allocCur / allocPrev - 1 : allocCur - allocPrev, true))}>{eurPct(Math.round((allocCur - allocPrev) * 100) / 100, allocPrev > 0 ? allocCur / allocPrev - 1 : null)}</td>
            </tr>
            {parcels.map((r) => (
              <tr key={r.id} className="border-t border-border/40 text-muted-foreground" data-testid={`yoy-parcel-${r.id}`}>
                <td className="py-1 pl-4 pr-3 text-[0.8125rem]">
                  <span className="inline-flex items-center gap-2">
                    {r.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />}
                    {r.name}
                  </span>
                </td>
                <td className="tnum py-1.5 pr-3">{fmtEur(cols.swap ? r.previous : r.current)}</td>
                <td className="tnum py-1.5 pr-3 text-muted-foreground">{fmtEur(cols.swap ? r.current : r.previous)}</td>
                <td className={cn("tnum py-1.5", tone(r.delta, true))}>{eurPct(r.delta, r.deltaPct)}</td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}

/** Larguras fixas partilhadas: Indicador/Parcela, valor, valor e variação ficam sempre nas mesmas colunas. */
function ColGroup() {
  return (
    <colgroup>
      <col className="w-[32%]" />
      <col className="w-[20%]" />
      <col className="w-[20%]" />
      <col className="w-[28%]" />
    </colgroup>
  );
}

/** Despesa por categoria face ao ano de comparação (Orçamento); usa a mesma escolha do Painel. */
export function CategoryYearOverYear({ d }: { d: Derived }) {
  const { sel, setSel, yoy, refYear, chosenCount, free, noRef } = useYoYComparison(d);
  const rows = useMemo(() => (yoy ? categoryYearOverYear(d.allTransactions, yoy).slice(0, 10) : []), [d.allTransactions, yoy]);
  const cols = yoy ? colsOf(yoy) : { swap: false, first: "", second: "" };
  return (
    <div className="space-y-3" data-testid="yoy-categories-card">
      <YoYControls d={d} sel={sel} setSel={setSel} />
      {!yoy ? (
        <Empty manual={sel.mode === "manual"} noMonths={chosenCount === 0} free={free} noRef={noRef} />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{summary(yoy.pairs.length, refYear, yoy)}</p>
          {rows.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">Sem despesas com categoria nos meses comparados.</p>
          ) : (
            <div className="overflow-x-auto" data-testid="yoy-categories">
              <table className="w-full min-w-120 table-fixed text-left text-sm">
                <ColGroup />
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">Categoria</th>
                    <th className="py-1 pr-3 text-left font-medium">{cols.first}</th>
                    <th className="py-1 pr-3 text-left font-medium">{cols.second}</th>
                    <th className="py-1 text-left font-medium">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name} className="border-t border-border">
                      <td className="py-1.5 pr-3">{r.name}</td>
                      <td className="tnum py-1.5 pr-3">{fmtEur(cols.swap ? r.previous : r.current)}</td>
                      <td className="tnum py-1.5 pr-3 text-muted-foreground">{fmtEur(cols.swap ? r.current : r.previous)}</td>
                      <td className={cn("tnum py-1.5 font-medium", tone(r.delta, false))}>
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
