/** Regras puras do assistente: ler valores e datas escritos à mão e escolher o mês alvo. */

/** "1450", "1 450,50", "1.450,50", "40,5", "40€": devolve euros com 2 casas, ou `null` se não for um valor positivo. */
export function parseAmount(text: string): number | null {
  let t = text.trim().replace(/€|eur(os)?/gi, "").replace(/\s+/g, "");
  if (!/^\d[\d.,]*$/.test(t)) return null;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = Math.max(lastComma, lastDot);
    t = t.slice(0, dec).replace(/[.,]/g, "") + "." + t.slice(dec + 1);
  } else if (lastComma >= 0) {
    if ((t.match(/,/g) ?? []).length > 1) return null;
    t = t.replace(",", ".");
  } else if (lastDot >= 0) {
    // "1.450" é mil e quatrocentos e cinquenta; "40.5" é quarenta e meio
    t = /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t;
    if ((t.match(/\./g) ?? []).length > 1) return null;
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const validDate = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

/** Soma dias a uma data ISO (`AAAA-MM-DD`). */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** "hoje", "ontem", "dd/mm", "dd/mm/aaaa", "dd-mm-aaaa" ou "aaaa-mm-dd" (data ISO) → `AAAA-MM-DD`, ou `null`. */
export function parseDate(text: string, today: string): string | null {
  const t = text.trim().toLowerCase();
  if (t === "hoje") return today;
  if (t === "ontem") return shiftDate(today, -1);
  if (t === "anteontem") return shiftDate(today, -2);
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return validDate(+m[1], +m[2], +m[3]) ? iso(+m[1], +m[2], +m[3]) : null;
  m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}))?$/.exec(t);
  if (!m) return null;
  const y = m[3] ? +m[3] : Number(today.slice(0, 4));
  return validDate(y, +m[2], +m[1]) ? iso(y, +m[2], +m[1]) : null;
}

type MonthLike = { id: number; year: number; month: number; base: number; status?: string };

/** Mês onde "Registar o mês" trabalha: o primeiro aberto ainda sem vencimento, ou o seguinte ao último. */
export function targetMonth(months: MonthLike[], today: string): { existing: MonthLike | null; year: number; month: number } {
  const sorted = [...months].sort((a, b) => a.year - b.year || a.month - b.month);
  const empty = sorted.find((m) => m.status !== "fechado" && m.base === 0);
  if (empty) return { existing: empty, year: empty.year, month: empty.month };
  const last = sorted[sorted.length - 1];
  if (!last) return { existing: null, year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  return last.month === 12 ? { existing: null, year: last.year + 1, month: 1 } : { existing: null, year: last.year, month: last.month + 1 };
}

/** Último mês aberto (o mais recente), ou `null`. */
export function latestOpenMonth<T extends MonthLike>(months: T[]): T | null {
  const open = months.filter((m) => m.status !== "fechado").sort((a, b) => a.year - b.year || a.month - b.month);
  return open[open.length - 1] ?? null;
}

/** Mês que contém uma data ISO; prefere um mês aberto se houver vários. */
export function monthOfDate<T extends MonthLike>(months: T[], date: string): T | null {
  const y = Number(date.slice(0, 4)), mo = Number(date.slice(5, 7));
  const same = months.filter((m) => m.year === y && m.month === mo);
  return same.find((m) => m.status !== "fechado") ?? same[0] ?? null;
}
