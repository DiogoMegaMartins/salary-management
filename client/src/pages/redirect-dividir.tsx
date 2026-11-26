import { useEffect } from "react";
import { useLocation } from "wouter";
import { setPendingDividirTab, type DividirTab } from "@/lib/dividir-tab";

/** Ligações antigas (/parcelas, /fecho): levam a Dividir, já no separador certo. */
export default function RedirectDividir({ tab }: { tab: DividirTab }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    setPendingDividirTab(tab);
    navigate("/divisao", { replace: true });
  }, [tab, navigate]);
  return null;
}
