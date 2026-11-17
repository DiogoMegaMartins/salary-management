import { useEffect, useState } from "react";

/** Ocultar montantes é só visual (desfoque no ecrã). Não protege dados: para isso existe o código de acesso. */
const KEY = "sm.privacy.hidden";
const apply = (hidden: boolean) => document.documentElement.classList.toggle("privacy-hide", hidden);
let current = (() => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } })();
const listeners = new Set<(v: boolean) => void>();
if (typeof document !== "undefined") apply(current);

export function usePrivacy() {
  const [hidden, setHidden] = useState(current);
  useEffect(() => { listeners.add(setHidden); return () => { listeners.delete(setHidden); }; }, []);
  const toggle = () => {
    current = !current;
    try { localStorage.setItem(KEY, current ? "1" : "0"); } catch { /* sem armazenamento */ }
    apply(current);
    listeners.forEach((l) => l(current));
  };
  return { hidden, toggle };
}
