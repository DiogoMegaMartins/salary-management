// Constantes sem dependências: o cliente importa daqui para não arrastar drizzle-orm para o bundle inicial.

export const TRANSACTION_TYPES = [
  { value: "expense", label: "Despesa" },
  { value: "transfer", label: "Transferência entre parcelas" },
  { value: "withdrawal", label: "Retirada de parcela" },
  { value: "contribution", label: "Aporte a parcela" },
] as const;

export const TX_NATURES = [
  { value: "despesa", label: "Despesa", baseType: "expense" },
  { value: "entrada", label: "Entrada (aporte)", baseType: "contribution" },
  { value: "transferencia", label: "Transferência", baseType: "transfer" },
  { value: "ajuste", label: "Ajuste", baseType: "withdrawal" },
] as const;
