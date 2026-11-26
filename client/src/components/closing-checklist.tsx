import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChecklistItem = { key: string; done: boolean; text: string };

/** Lista do que falta para fechar o mês. Só informa: o fecho em si faz-se logo abaixo. */
export function ClosingChecklist({ items }: { items: ChecklistItem[] }) {
  return (
    <section className="rounded-2xl border border-card-border bg-card p-5" aria-label="O que falta para fechar" data-testid="closing-checklist">
      <h2 className="text-sm font-semibold">{items.every((i) => i.done) ? "Tudo pronto para fechar" : "Para fechar o mês, falta"}</h2>
      <ul className="mt-2 divide-y divide-border">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-3 py-2.5 text-sm" data-done={i.done}>
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs", i.done ? "bg-success text-background" : "bg-muted text-muted-foreground")}>
              {i.done ? <Check className="h-3.5 w-3.5" aria-hidden /> : "•"}
            </span>
            <span className={i.done ? "text-muted-foreground" : "font-medium"}>{i.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
