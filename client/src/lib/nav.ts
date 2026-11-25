import { CalendarCheck, CalendarRange, HelpCircle, Layers, LayoutDashboard, PieChart, Receipt, Settings, Target, Wallet, type LucideIcon } from "lucide-react";
import type { FeatureKey } from "@shared/features";

export type NavItem = { href: string; label: string; testId: string; icon: LucideIcon; features?: FeatureKey[] };

/** Os três destinos de todos os dias. "Registar despesa" não é um destino: é o botão fixo por baixo do conteúdo. */
export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Início", testId: "painel", icon: LayoutDashboard },
  { href: "/divisao", label: "Dividir", testId: "divisão", icon: Layers, features: ["divisao", "movimentos"] },
  { href: "/meses", label: "Meses", testId: "meses", icon: CalendarRange },
];

/** O resto da app, agrupado em "Mais". */
export const MORE_NAV: NavItem[] = [
  { href: "/despesas", label: "Despesas", testId: "despesas", icon: Receipt },
  { href: "/fecho", label: "Fecho e planeamento", testId: "fecho-e-planeamento", icon: CalendarCheck },
  { href: "/parcelas", label: "Parcelas e metas", testId: "parcelas-e-metas", icon: PieChart, features: ["parcelas"] },
  { href: "/carteira", label: "Carteira", testId: "carteira", icon: Wallet, features: ["plataformas"] },
  { href: "/orcamento", label: "Orçamento", testId: "orçamento", icon: Target },
  { href: "/dados", label: "Definições", testId: "definições", icon: Settings },
  { href: "/ajuda", label: "Ajuda e documentação", testId: "ajuda-e-documentação", icon: HelpCircle },
];

/** Só os itens cuja funcionalidade está ligada (basta uma das indicadas). */
export const visibleNav = (list: NavItem[], f: Record<FeatureKey, boolean>) => list.filter((i) => !i.features || i.features.some((k) => f[k]));

export const isNavActive = (href: string, location: string) => (href === "/" ? location === "/" : location.startsWith(href));
