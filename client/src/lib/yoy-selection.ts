import { useCallback, useEffect, useState } from "react";

/**
 * Escolha dos meses e do ano de comparação do cartão "Comparação mensal e anual".
 * Fica guardada neste dispositivo (localStorage) e vale no Painel e no Orçamento.
 * - `filtro`: usa os meses do filtro de período da página (omissão).
 * - `manual`: usa os meses `AAAA-MM` escolhidos (qualquer ano com dados).
 * - `refYear`: `auto` = ano anterior de cada mês; ou um ano fixo.
 */
export type YoYSelection = {
  mode: "filtro" | "manual";
  months: string[];
  /** `auto`/ano fixo = mesmos meses de outro ano; `meses` = grupo livre `compareMonths` (pode ser do mesmo ano) */
  refYear: "auto" | "meses" | number;
  compareMonths: string[];
  /** ano dos meses na comparação "com mês" (null = o mais recente) */
  year: number | null;
};

export const DEFAULT_YOY_SELECTION: YoYSelection = { mode: "filtro", months: [], refYear: "auto", compareMonths: [], year: null };

const KEY = "sm-yoy-selection-v1";
const EVENT = "sm:yoy-selection";

/** Valida o que veio do armazenamento; qualquer coisa estranha volta à omissão. */
export function parseYoYSelection(raw: unknown): YoYSelection {
  try {
    const o = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!o || typeof o !== "object") return DEFAULT_YOY_SELECTION;
    const v = o as Record<string, unknown>;
    const list = (x: unknown) =>
      Array.from(new Set(Array.isArray(x) ? x.filter((m): m is string => typeof m === "string" && /^\d{4}-\d{2}$/.test(m)) : [])).sort();
    const ref = v.refYear === "meses" ? "meses" : typeof v.refYear === "number" && Number.isInteger(v.refYear) && v.refYear >= 1900 && v.refYear <= 2200 ? v.refYear : "auto";
    const year = typeof v.year === "number" && Number.isInteger(v.year) && v.year >= 1900 && v.year <= 2200 ? v.year : null;
    return { mode: v.mode === "manual" ? "manual" : "filtro", months: list(v.months), refYear: ref, compareMonths: list(v.compareMonths), year };
  } catch {
    return DEFAULT_YOY_SELECTION;
  }
}

function read(): YoYSelection {
  try {
    return parseYoYSelection(window.localStorage.getItem(KEY));
  } catch {
    return DEFAULT_YOY_SELECTION; // armazenamento indisponível: a página funciona na mesma
  }
}

export function useYoYSelection(): [YoYSelection, (next: YoYSelection) => void] {
  const [sel, setSel] = useState<YoYSelection>(read);
  useEffect(() => {
    const sync = () => setSel(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const update = useCallback((next: YoYSelection) => {
    const clean = parseYoYSelection(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(clean));
    } catch {
      /* sem armazenamento: a escolha vale só nesta sessão */
    }
    setSel(clean);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [sel, update];
}
