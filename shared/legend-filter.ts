/**
 * Legendas clicáveis dos gráficos: esconder ou mostrar uma série. Nunca se esconde a última visível
 * (um gráfico vazio não diz nada); o clique nessa é ignorado.
 */
export function toggleSeries(hidden: readonly string[], name: string, all: readonly string[]): string[] {
  if (hidden.includes(name)) return hidden.filter((n) => n !== name);
  const next = [...hidden, name];
  const visible = all.filter((n) => !next.includes(n));
  return visible.length === 0 ? [...hidden] : next;
}

/**
 * Peso de cada item entre os que estão visíveis (soma 100 %). Os escondidos ficam a `null`.
 * É o que o gráfico circular mostra: depois de esconder uma parcela, as restantes repartem o círculo todo.
 */
export function visibleShares(items: { key: string; value: number }[], isHidden: (key: string) => boolean): Record<string, number | null> {
  const total = items.reduce((a, i) => (isHidden(i.key) ? a : a + Math.max(0, i.value)), 0);
  const out: Record<string, number | null> = {};
  for (const i of items) out[i.key] = isHidden(i.key) || total <= 0 ? null : Math.max(0, i.value) / total;
  return out;
}
