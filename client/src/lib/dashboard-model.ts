import { goalCtx } from "@/components/goal-panel";
import { goalBreakdown, goalPace, monthKeyOf, monthLabelShort } from "@shared/calc";
import type { useAppState, useDerived } from "@/lib/app";

type Derived = NonNullable<ReturnType<typeof useDerived>>;
type AppData = NonNullable<ReturnType<typeof useAppState>["data"]>;

/**
 * Números do Painel para o período filtrado: totais, comparação com o período anterior,
 * séries dos gráficos, peso por parcela, alertas de divisão e progresso das metas.
 * Função pura sobre o estado derivado; devolve `null` enquanto não há dados.
 */
export function buildDashboardModel(d: Derived | null | undefined, data: AppData | undefined, today: Date = new Date()) {
  if (!d) return null;
  const c = d.computed;
  const n = c.length || 1;
  const netTotal = c.reduce((a, x) => a + x.net, 0);
  const grossTotal = c.reduce((a, x) => a + x.gross, 0);
  const descontosTotal = c.reduce((a, x) => a + x.descontos, 0);
  const mealTotal = c.reduce((a, x) => a + x.meal, 0);
  const availableTotal = c.reduce((a, x) => a + x.available, 0);
  const remainingTotal = c.reduce((a, x) => a + x.remaining, 0);
  const savedTotal = c.reduce((a, x) => a + x.byKind.poupanca + x.byKind.investimento, 0);
  const spentTotal = c.reduce((a, x) => a + x.byKind.gastos, 0);

  // SM-008: comparação com o período anterior equivalente
  const pc = d.previousComputed;
  const prevNetTotal = pc.reduce((a, x) => a + x.net, 0);
  const prevSavedTotal = pc.reduce((a, x) => a + x.byKind.poupanca + x.byKind.investimento, 0);
  const prevSpentTotal = pc.reduce((a, x) => a + x.byKind.gastos, 0);
  const prevAvailableTotal = pc.reduce((a, x) => a + x.available, 0);
  const prevSavingsRate = prevAvailableTotal > 0 ? prevSavedTotal / prevAvailableTotal : 0;
  const pctChange = (curr: number, prev: number) => (prev !== 0 ? curr / prev - 1 : curr !== 0 ? null : 0);
  const comparison = pc.length > 0
    ? {
        hasData: true as const,
        netDelta: pctChange(netTotal, prevNetTotal),
        savedDelta: pctChange(savedTotal, prevSavedTotal),
        spentDelta: pctChange(spentTotal, prevSpentTotal),
        savingsRateDeltaPP: (availableTotal > 0 ? savedTotal / availableTotal : 0) - prevSavingsRate,
        n: pc.length,
      }
    : { hasData: false as const, netDelta: null, savedDelta: null, spentDelta: null, savingsRateDeltaPP: 0, n: 0 };

  const series = c.map((x) => {
    const row: any = {
      name: monthLabelShort(x.month),
      liquido: x.net,
      bruto: x.gross,
      descontos: x.descontos,
      subsidio: x.meal,
      disponivel: x.available,
      restante: x.remaining,
      taxa: x.savingsRate,
      gastos: x.byKind.gastos,
      poupanca: x.byKind.poupanca,
      investimento: x.byKind.investimento,
    };
    for (const p of d.parcels) row[`p${p.id}`] = x.byParcel[p.id] ?? 0;
    return row;
  });

  const perParcel = d.parcels
    .map((p) => {
      const values = c.map((x) => x.byParcel[p.id] ?? 0);
      const total = values.reduce((a, b) => a + b, 0);
      const nonZero = values.filter((v) => v > 0).length || 1;
      const half = Math.ceil(values.length / 2);
      const firstHalf = values.slice(0, half).reduce((a, b) => a + b, 0) / (half || 1);
      const secondHalf =
        values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half || 1);
      return {
        parcel: p,
        total,
        avg: total / nonZero,
        share: availableTotal > 0 ? total / availableTotal : 0,
        trend: firstHalf > 0 ? secondHalf / firstHalf - 1 : 0,
        values,
      };
    })
    .sort((a, b) => b.total - a.total);

  // tolerância de arredondamento: só alerta acima de 1 cêntimo por parcela
  const alerts = c.filter((x) => x.remaining < -0.5);
  const avgExpenses = spentTotal / n;

  // acumulado global por parcela (para metas)
  const goals = d.allParcels
    .filter((p) => (p.targetAmount != null && p.targetAmount > 0) || data?.subgoals?.some((s) => s.parcelId === p.id))
    .map((p) => {
      const monthly = d.allComputed.map((x) => ({
        key: monthKeyOf(x.month.year, x.month.month),
        amount: x.byParcel[p.id] ?? 0,
      }));
      const breakdown = data ? goalBreakdown(goalCtx(data, p, monthly), p.id) : null;
      const acc = breakdown?.total ?? monthly.reduce((a, x) => a + x.amount, 0);
      const recent = d.allComputed.slice(-3);
      const pace =
        recent.length > 0 ? recent.reduce((a, x) => a + (x.byParcel[p.id] ?? 0), 0) / recent.length : 0;
      const missing = Math.max(0, (p.targetAmount ?? 0) - acc);
      const paceInfo = goalPace({
        targetAmount: p.targetAmount,
        targetDate: p.targetDate,
        accumulated: acc,
        pacePerMonth: pace,
        now: { year: today.getFullYear(), month: today.getMonth() + 1 },
      });
      return {
        parcel: p,
        paceInfo,
        subs: breakdown?.subs ?? [],
        incomplete: breakdown?.incomplete ?? false,
        missingRates: breakdown?.missing ?? [],
        acc,
        pace,
        missing,
        monthsLeft: pace > 0 ? Math.ceil(missing / pace) : null,
        pct: p.targetAmount && p.targetAmount > 0 ? Math.max(0, Math.min(1, acc / p.targetAmount)) : 0,
      };
    })
    .sort((a, b) => b.pct - a.pct);

  return {
    netTotal,
    grossTotal,
    descontosTotal,
    mealTotal,
    availableTotal,
    remainingTotal,
    savedTotal,
    spentTotal,
    avgNet: netTotal / n,
    savingsRate: availableTotal > 0 ? savedTotal / availableTotal : 0,
    effectiveTax: grossTotal > 0 ? descontosTotal / grossTotal : 0,
    runway: avgExpenses > 0 ? savedTotal / avgExpenses : 0,
    series,
    perParcel,
    alerts,
    goals,
    n,
    comparison,
  };
}

