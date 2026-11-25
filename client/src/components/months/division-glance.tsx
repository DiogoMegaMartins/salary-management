import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/app";
import type { Month } from "@shared/schema";
import { allocationAmount, availableOf, fmtEur } from "@shared/calc";
import { Summary } from "@/components/months/summary";

/**
 * Vista de leitura da divisão e dos movimentos de um mês, para o editor do mês. Editar faz-se só na página
 * Divisão; aqui há um resumo e a ligação para lá.
 */
export function DivisionGlance({ month, onOpen }: { month: Month; onOpen: () => void }) {
  const { data } = useAppState();
  const available = availableOf(month, data!.settings);
  const allocs = (data?.allocations ?? []).filter((a) => a.monthId === month.id);
  const allocated = allocs.reduce((acc, a) => acc + allocationAmount(a, available), 0);
  const movements = (data?.transactions ?? []).filter((t) => t.monthId === month.id).length;
  const started = allocs.length > 0 || movements > 0;
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3" data-testid="division-glance">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Divisão e movimentos</p>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onOpen} data-testid="button-open-division">
          {started ? "Abrir Divisão" : "Dividir este mês"}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
      {started ? (
        <div className="grid grid-cols-3 gap-2">
          <Summary label="Alocado" value={fmtEur(allocated)} />
          <Summary label="Restante" value={fmtEur(available + (month.carryIn ?? 0) - allocated)} strong />
          <Summary label="Movimentos" value={String(movements)} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Ainda sem divisão nem movimentos. O próximo passo é repartir o salário pelas parcelas.</p>
      )}
    </div>
  );
}
