import { createContext, useContext, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, setAccessCode } from "./queryClient";
import type { Allocation, Category, Month, Parcel, Settings, Transaction, Platform, ParcelPlatform, ParcelType, TxType, AllocationPlatform, AllocationAsset, Subgoal, GoalEntry, ContributionLink, FxRate, Valuation } from "@shared/schema";
import {
  computeMonth,
  sortMonths,
  type MonthComputed,
  computeEssentialExpensesByMonth,
  MONTH_NAMES,
} from "@shared/calc";

export const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export type AppState = {
  settings: Settings;
  parcels: Parcel[];
  months: Month[];
  allocations: Allocation[];
  transactions: Transaction[];
  categories: Category[];
  platforms: Platform[];
  parcelPlatforms: ParcelPlatform[];
  parcelTypes: ParcelType[];
  txTypes: TxType[];
  allocationPlatforms: AllocationPlatform[];
  allocationAssets: AllocationAsset[];
  subgoals: Subgoal[];
  goalEntries: GoalEntry[];
  contributionLinks: ContributionLink[];
  fxRates: FxRate[];
  valuations: Valuation[];
  recurringExpenses?: { parcelId?: number | null }[];
  reserves?: { parcelId?: number | null }[];
};

export function useAppState() {
  return useQuery<AppState>({ queryKey: ["/api/state"] });
}

function invalidate() {
  return queryClient.invalidateQueries({ queryKey: ["/api/state"] });
}

export function useSave() {
  const month = useMutation({
    mutationFn: async (v: { id: number; patch: Partial<Month> }) =>
      (await apiRequest("PATCH", `/api/months/${v.id}`, v.patch)).json(),
    onSuccess: invalidate,
  });
  const createMonth = useMutation({
    mutationFn: async (v: Partial<Month>) => (await apiRequest("POST", "/api/months", v)).json(),
    onSuccess: invalidate,
  });
  const duplicateMonth = useMutation({
    mutationFn: async (v: { id: number; year: number; month: number; label: string }) =>
      (await apiRequest("POST", `/api/months/${v.id}/duplicate`, v)).json(),
    onSuccess: invalidate,
  });
  const deleteMonth = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/months/${id}`)).json(),
    onSuccess: invalidate,
  });
  const applyRules = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/months/${id}/apply-rules`)).json(),
    onSuccess: invalidate,
  });
  const saveAsRules = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/months/${id}/save-as-rules`)).json(),
    onSuccess: invalidate,
  });
  const allocation = useMutation({
    mutationFn: async (v: { monthId: number; parcelId: number; mode: string; value: number; included?: boolean }) =>
      (await apiRequest("PUT", "/api/allocations", v)).json(),
    onSuccess: invalidate,
  });
  const parcel = useMutation({
    mutationFn: async (v: { id: number; patch: Partial<Parcel> }) =>
      (await apiRequest("PATCH", `/api/parcels/${v.id}`, v.patch)).json(),
    onSuccess: invalidate,
  });
  const createParcel = useMutation({
    mutationFn: async (v: Partial<Parcel>) => (await apiRequest("POST", "/api/parcels", v)).json(),
    onSuccess: invalidate,
  });
  const deleteParcel = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/parcels/${id}`)).json(),
    onSuccess: invalidate,
  });
  const settings = useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const saved = await (await apiRequest("PATCH", "/api/settings", patch)).json();
      // o servidor já aceitou o código novo: os pedidos seguintes (recarregar o estado) têm de o usar
      if ("accessCode" in patch) setAccessCode(String(patch.accessCode ?? ""));
      return saved;
    },
    onSuccess: invalidate,
  });
  const importJson = useMutation({
    mutationFn: async (payload: unknown) => (await apiRequest("POST", "/api/import", payload)).json(),
    onSuccess: invalidate,
  });
  const createTransaction = useMutation({
    mutationFn: async (v: Partial<Transaction>) => (await apiRequest("POST", "/api/transactions", v)).json(),
    onSuccess: invalidate,
  });
  const updateTransaction = useMutation({
    mutationFn: async (v: { id: number; patch: Partial<Transaction> }) =>
      (await apiRequest("PATCH", `/api/transactions/${v.id}`, v.patch)).json(),
    onSuccess: invalidate,
  });
  const deleteTransaction = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/transactions/${id}`)).json(),
    onSuccess: invalidate,
  });
  const reconciliation = useMutation({
    mutationFn: async (v: { id: number; deficitReason: string; deficitNote: string }) =>
      (await apiRequest("PATCH", `/api/months/${v.id}/reconciliation`, v)).json(),
    onSuccess: invalidate,
  });
  const createCategory = useMutation({
    mutationFn: async (v: Partial<Category>) => (await apiRequest("POST", "/api/categories", v)).json(),
    onSuccess: invalidate,
  });
  const updateCategory = useMutation({
    mutationFn: async (v: { id: number; patch: Partial<Category> }) =>
      (await apiRequest("PATCH", `/api/categories/${v.id}`, v.patch)).json(),
    onSuccess: invalidate,
  });
  const deleteCategory = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/categories/${id}`)).json(),
    onSuccess: invalidate,
  });
  const mk = <T,>(method: string, url: (v: any) => string, body?: (v: any) => unknown) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMutation({
      mutationFn: async (v: any) => (await apiRequest(method, url(v), body ? body(v) : v)).json() as Promise<T>,
      onSuccess: invalidate,
    });
  const bulkTransactions = mk<{ ok: boolean; count: number }>("POST", () => "/api/transactions/bulk");
  const createPlatform = mk<Platform>("POST", () => "/api/platforms");
  const updatePlatform = mk<Platform>("PATCH", (v) => `/api/platforms/${v.id}`, (v) => v.patch);
  const deletePlatform = mk<unknown>("DELETE", (v) => `/api/platforms/${v}`, () => undefined);
  const createParcelType = mk<ParcelType>("POST", () => "/api/parcel-types");
  const updateParcelType = mk<ParcelType>("PATCH", (v) => `/api/parcel-types/${v.id}`, (v) => v.patch);
  const deleteParcelType = mk<unknown>("DELETE", (v) => `/api/parcel-types/${v}`, () => undefined);
  const createTxType = mk<TxType>("POST", () => "/api/tx-types");
  const updateTxType = mk<TxType>("PATCH", (v) => `/api/tx-types/${v.id}`, (v) => v.patch);
  const deleteTxType = mk<unknown>("DELETE", (v) => `/api/tx-types/${v}`, () => undefined);
  const setDistribution = mk<AllocationPlatform[]>(
    "PUT",
    (v) => `/api/months/${v.monthId}/parcels/${v.parcelId}/distribution`,
    (v) => ({ lines: v.lines }),
  );
  const createGoalEntry = mk<GoalEntry>("POST", () => "/api/goal-entries");
  const updateGoalEntry = mk<GoalEntry>("PATCH", (v) => `/api/goal-entries/${v.id}`, (v) => v.patch);
  const deleteGoalEntry = mk<unknown>("DELETE", (v) => `/api/goal-entries/${v}`, () => undefined);
  const createSubgoal = mk<Subgoal>("POST", () => "/api/subgoals");
  const updateSubgoal = mk<Subgoal>("PATCH", (v) => `/api/subgoals/${v.id}`, (v) => v.patch);
  const deleteSubgoal = mk<unknown>("DELETE", (v) => `/api/subgoals/${v}`, () => undefined);
  const createLink = mk<ContributionLink>("POST", () => "/api/contribution-links");
  const deleteLink = mk<unknown>("DELETE", (v) => `/api/contribution-links/${v}`, () => undefined);
  const createFxRate = mk<FxRate>("POST", () => "/api/fx-rates");
  const deleteFxRate = mk<unknown>("DELETE", (v) => `/api/fx-rates/${v}`, () => undefined);
  const createValuation = mk<Valuation>("POST", () => "/api/valuations");
  const deleteValuation = mk<unknown>("DELETE", (v) => `/api/valuations/${v}`, () => undefined);
  const setAssets = mk<AllocationAsset[]>("PUT", (v) => `/api/months/${v.monthId}/parcels/${v.parcelId}/distribution/${v.platformId}/assets`, (v) => ({ lines: v.lines }));
  return {
    setAssets,
    bulkTransactions,
    createGoalEntry, updateGoalEntry, deleteGoalEntry, createSubgoal, updateSubgoal, deleteSubgoal, createLink, deleteLink, createFxRate, deleteFxRate, createValuation, deleteValuation,
    setDistribution,
    createPlatform,
    updatePlatform,
    deletePlatform,
    createParcelType,
    updateParcelType,
    deleteParcelType,
    createTxType,
    updateTxType,
    deleteTxType,
    month,
    createMonth,
    duplicateMonth,
    deleteMonth,
    applyRules,
    saveAsRules,
    allocation,
    parcel,
    createParcel,
    deleteParcel,
    settings,
    importJson,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    reconciliation,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}

/* --------------------------------------------------------------- filtros */

// SM-008: presets de período. "custom" usa year + fromMonth..toMonth como hoje.
export type PeriodPreset = "custom" | "ultimos_3" | "ultimos_6" | "ultimos_12";

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "custom", label: "Período personalizado" },
  { value: "ultimos_3", label: "Últimos 3 meses" },
  { value: "ultimos_6", label: "Últimos 6 meses" },
  { value: "ultimos_12", label: "Últimos 12 meses" },
];

type Filters = {
  year: number | "todos";
  setYear: (y: number | "todos") => void;
  fromMonth: number;
  toMonth: number;
  setRange: (from: number, to: number) => void;
  parcelIds: number[] | null; // null = todas
  setParcelIds: (ids: number[] | null) => void;
  kinds: string[] | null;
  setKinds: (k: string[] | null) => void;
  preset: PeriodPreset;
  setPreset: (p: PeriodPreset) => void;
  reset: () => void;
};

const FiltersContext = createContext<Filters | null>(null);

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const [year, setYear] = useState<number | "todos">(new Date().getFullYear());
  const [fromMonth, setFrom] = useState(1);
  const [toMonth, setTo] = useState(12);
  const [parcelIds, setParcelIds] = useState<number[] | null>(null);
  const [kinds, setKinds] = useState<string[] | null>(null);
  const [preset, setPreset] = useState<PeriodPreset>("custom");
  const value: Filters = {
    year,
    setYear: (y) => {
      setPreset("custom");
      setYear(y);
    },
    fromMonth,
    toMonth,
    setRange: (f, t) => {
      setPreset("custom");
      setFrom(f);
      setTo(t);
    },
    parcelIds,
    setParcelIds,
    kinds,
    setKinds,
    preset,
    setPreset,
    reset: () => {
      setPreset("custom");
      setYear(new Date().getFullYear());
      setFrom(1);
      setTo(12);
      setParcelIds(null);
      setKinds(null);
    },
  };
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters fora do provider");
  return ctx;
}

/* ------------------------------------------------------- dados derivados */

export type Derived = {
  state: AppState;
  years: number[];
  months: Month[]; // filtrados
  allMonths: Month[]; // ordenados, sem filtro
  computed: MonthComputed[]; // filtrados
  allComputed: MonthComputed[];
  parcels: Parcel[]; // visíveis (filtro + não arquivadas)
  allParcels: Parcel[];
  transactionsByMonth: Record<number, Transaction[]>;
  allTransactions: Transaction[];
  savedByMonthId: Record<number, number>;
  essentialExpensesByMonthId: Record<number, number>;
  // SM-008: período anterior equivalente ao filtro atual, para comparação
  previousMonths: Month[];
  previousComputed: MonthComputed[];
  periodLabel: string;
};

export function useDerived(state: AppState | undefined): Derived | null {
  const f = useFilters();
  return useMemo(() => {
    if (!state) return null;
    const allMonths = sortMonths(state.months);
    const years = Array.from(new Set(allMonths.map((m) => m.year))).sort();

    const presetN =
      f.preset === "ultimos_3" ? 3 : f.preset === "ultimos_6" ? 6 : f.preset === "ultimos_12" ? 12 : null;
    const months =
      presetN !== null
        ? allMonths.slice(-presetN)
        : allMonths.filter(
            (m) =>
              (f.year === "todos" || m.year === f.year) && m.month >= f.fromMonth && m.month <= f.toMonth,
          );

    const previousMonths = (() => {
      if (months.length === 0) return [] as Month[];
      const firstIdx = allMonths.findIndex((m) => m.id === months[0].id);
      if (firstIdx <= 0) return [] as Month[];
      const start = Math.max(0, firstIdx - months.length);
      return allMonths.slice(start, firstIdx);
    })();

    const periodLabel = (() => {
      if (presetN !== null) return PERIOD_PRESETS.find((p) => p.value === f.preset)?.label ?? "Período";
      if (months.length === 0) return "Sem meses no período";
      const yLabel = f.year === "todos" ? "Todos os anos" : String(f.year);
      if (f.fromMonth === 1 && f.toMonth === 12) return yLabel;
      return `${MONTH_NAMES[f.fromMonth - 1]}–${MONTH_NAMES[f.toMonth - 1]} ${yLabel}`;
    })();

    const compute = (list: Month[]) =>
      list.map((m) => computeMonth(m, state.allocations, state.parcels, state.settings));
    const allParcels = [...state.parcels].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    const parcels = allParcels.filter(
      (p) =>
        !p.archived &&
        (f.parcelIds === null || f.parcelIds.includes(p.id)) &&
        (f.kinds === null || f.kinds.includes(p.kind)),
    );
    const transactionsByMonth: Record<number, Transaction[]> = {};
    for (const t of state.transactions) {
      (transactionsByMonth[t.monthId] ??= []).push(t);
    }
    const allComputed = compute(allMonths);
    const savedByMonthId: Record<number, number> = {};
    for (const c of allComputed) {
      savedByMonthId[c.month.id] = (c.byKind.poupanca ?? 0) + (c.byKind.investimento ?? 0);
    }
    const essentialExpensesByMonthId = computeEssentialExpensesByMonth(
      state.transactions,
      state.categories,
    );
    return {
      state,
      years,
      months,
      allMonths,
      computed: compute(months),
      allComputed,
      parcels,
      allParcels,
      transactionsByMonth,
      allTransactions: state.transactions,
      savedByMonthId,
      essentialExpensesByMonthId,
      previousMonths,
      previousComputed: compute(previousMonths),
      periodLabel,
    };
  }, [state, f.year, f.fromMonth, f.toMonth, f.parcelIds, f.kinds, f.preset]);
}
