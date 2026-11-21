import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const pad2 = (n: number) => String(n).padStart(2, "0");
/** Hoje no fuso local, AAAA-MM-DD (toISOString dava o dia UTC, que perto da meia-noite é outro dia). */
export function localToday(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}
/** Uma data dentro do mês indicado: hoje, se cair nesse mês, senão o último dia do mês. */
export function dateInMonth(year: number, month: number, now: Date = new Date()): string {
  if (now.getFullYear() === year && now.getMonth() + 1 === month) return localToday(now);
  return `${year}-${pad2(month)}-${pad2(new Date(year, month, 0).getDate())}`;
}

/** Dias desde uma data ISO; null se vazia ou inválida. */
export function daysSince(iso: string): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86400000);
}
