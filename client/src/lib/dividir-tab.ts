/** Separador de Dividir pedido por uma ligação antiga (/parcelas, /fecho): vale uma só vez, na próxima abertura de Dividir. */
export type DividirTab = "divisao" | "movimentos" | "parcelas" | "fecho";
let pending: DividirTab | null = null;
export const setPendingDividirTab = (t: DividirTab) => { pending = t; };
export function takePendingDividirTab(): DividirTab | null { const t = pending; pending = null; return t; }
