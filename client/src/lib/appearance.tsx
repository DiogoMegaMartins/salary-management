import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  APPEARANCE_KEY, LEGACY_THEME_KEY, readAppearanceCache, resolveDark, parsePalette, parseColorMode,
  type ColorMode, type Palette,
} from "@shared/appearance";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAppState } from "@/lib/app";

/** Cor da app e modo claro/escuro. A conta é a fonte de verdade; a cache local só evita o piscar ao abrir. */

type Ctx = {
  palette: Palette;
  mode: ColorMode;
  dark: boolean;
  setPalette: (p: Palette) => void;
  setMode: (m: ColorMode) => void;
  /** chamado quando as definições da conta chegam: a conta vence a cache */
  syncFromAccount: (palette: unknown, mode: unknown) => void;
};

const Ctx = createContext<Ctx>({ palette: "ceu", mode: "auto", dark: false, setPalette: () => {}, setMode: () => {}, syncFromAccount: () => {} });

const lerCache = () => {
  try { return readAppearanceCache(localStorage.getItem(APPEARANCE_KEY), localStorage.getItem(LEGACY_THEME_KEY)); }
  catch { return readAppearanceCache(null, null); }
};
const guardarCache = (palette: Palette, mode: ColorMode) => {
  try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ palette, mode })); } catch { /* sem armazenamento */ }
};
const sistemaEscuro = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;

const gravarNaConta = (patch: { palette?: Palette; colorMode?: ColorMode }) =>
  apiRequest("PATCH", "/api/settings", patch)
    .then(() => queryClient.invalidateQueries({ queryKey: ["/api/state"] }))
    .catch(() => { /* a escolha vale neste aparelho; a conta atualiza-se na próxima vez */ });

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [{ palette, mode }, setState] = useState(lerCache);
  const [sistema, setSistema] = useState(sistemaEscuro);
  const dark = resolveDark(mode, sistema);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const on = () => setSistema(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-palette", palette);
    el.classList.toggle("dark", dark);
    const fundo = getComputedStyle(el).getPropertyValue("--background").trim();
    if (fundo) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", `hsl(${fundo})`);
  }, [palette, dark]);

  const setPalette = useCallback((p: Palette) => {
    setState((s) => { guardarCache(p, s.mode); return { ...s, palette: p }; });
    void gravarNaConta({ palette: p });
  }, []);
  const setMode = useCallback((m: ColorMode) => {
    setState((s) => { guardarCache(s.palette, m); return { ...s, mode: m }; });
    void gravarNaConta({ colorMode: m });
  }, []);
  const syncFromAccount = useCallback((p: unknown, m: unknown) => {
    const next = { palette: parsePalette(p), mode: parseColorMode(m) };
    setState((s) => (s.palette === next.palette && s.mode === next.mode ? s : next));
    guardarCache(next.palette, next.mode);
  }, []);

  const value = useMemo(() => ({ palette, mode, dark, setPalette, setMode, syncFromAccount }), [palette, mode, dark, setPalette, setMode, syncFromAccount]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAppearance = () => useContext(Ctx);

/** Botão do cabeçalho: alterna entre claro e escuro, fixando o modo. */
export function useTheme() {
  const { dark, setMode } = useAppearance();
  return { theme: (dark ? "dark" : "light") as "light" | "dark", toggle: () => setMode(dark ? "claro" : "escuro") };
}

/** Dentro do acesso: quando as definições chegam, a conta vence a cache local. */
export function AppearanceSync() {
  const { data } = useAppState();
  const { syncFromAccount } = useAppearance();
  const p = data?.settings.palette;
  const m = data?.settings.colorMode;
  useEffect(() => { if (p !== undefined && m !== undefined) syncFromAccount(p, m); }, [p, m, syncFromAccount]);
  return null;
}
