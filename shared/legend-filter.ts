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
