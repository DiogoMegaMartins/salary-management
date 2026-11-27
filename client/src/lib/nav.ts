import { CalendarRange, FolderCog, HelpCircle, Layers, LayoutDashboard, Receipt, Settings, Target, Wallet, type LucideIcon } from "lucide-react";
import type { FeatureKey } from "@shared/features";

export type NavItem = { href: string; label: string; testId: string; tabId?: string; icon: LucideIcon; features?: FeatureKey[] };

/** Os três destinos de todos os dias. "Registar despesa" não é um destino: é o botão fixo por baixo do conteúdo. */
export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Início", testId: "painel", icon: LayoutDashboard },
  { href: "/divisao", label: "Plano do mês", testId: "divisão", tabId: "dividir", icon: Layers},
  { href: "/meses", label: "Meses", testId: "meses", icon: CalendarRange },
];

/** O resto da app, agrupado em "Mais". */
export const MORE_NAV: NavItem[] = [
  { href: "/organizar", label: "Organizar", testId: "organizar", icon: FolderCog },
  { href: "/despesas", label: "Despesas", testId: "despesas", icon: Receipt },
  { href: "/carteira", label: "Carteira", testId: "carteira", icon: Wallet, features: ["plataformas"] },
  { href: "/orcamento", label: "Orçamento", testId: "orçamento", icon: Target },
  { href: "/dados", label: "Definições", testId: "definições", icon: Settings },
  { href: "/ajuda", label: "Ajuda e documentação", testId: "ajuda-e-documentação", icon: HelpCircle },
];

/** Só os itens cuja funcionalidade está ligada (basta uma das indicadas). */
export const visibleNav = (list: NavItem[], f: Record<FeatureKey, boolean>) => list.filter((i) => !i.features || i.features.some((k) => f[k]));

export const isNavActive = (href: string, location: string) => (href === "/" ? location === "/" : location.startsWith(href));
