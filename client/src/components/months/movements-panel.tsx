import { useMemo } from "react";
import { useSave, useAppState } from "@/lib/app";
import { useFeatures } from "@/lib/features";
import type { Month } from "@shared/schema";
import { allocationAmount, availableOf, reconcileMonth } from "@shared/calc";
import { ReconciliationPanel } from "@/components/months/reconciliation-panel";
import { TransactionsPanel } from "@/components/months/transactions-panel";

/** Movimentos de um mês e, se estiver ligada, a reconciliação com a divisão. */
export function MovementsPanel({ month }: { month: Month }) {
  const { data } = useAppState();
  const features = useFeatures();
  const save = useSave();
  const parcels = useMemo(
    () => (data?.parcels ?? []).filter((p) => !p.archived).sort((a, b) => a.sortOrder - b.sortOrder),
    [data?.parcels],
  );
  const allocations = (data?.allocations ?? []).filter((a) => a.monthId === month.id);
  const transactions = (data?.transactions ?? []).filter((t) => t.monthId === month.id);
  const available = availableOf(month, data!.settings);
  const allocated = allocations.reduce((acc, a) => acc + allocationAmount(a, available), 0);
  const carryIn = month.carryIn ?? 0;
  // o transporte recebido do mês anterior soma ao valor a distribuir, mas NÃO é rendimento
  const rec0 = reconcileMonth(available, allocated, transactions);
  const porAlocar = rec0.porAlocar + carryIn;
  const rec = { ...rec0, porAlocar, estado: Math.abs(porAlocar) < 0.005 ? ("zero" as const) : porAlocar > 0 ? ("excedente" as const) : ("defice" as const) };
  const form = month;
  return (
    <div className="space-y-4" data-testid="movements-panel">
            {features.reconciliacao && (
            <ReconciliationPanel
              rec={rec}
              month={form}
              monthId={month.id}
              onSaveReason={(deficitReason, deficitNote) =>
                save.reconciliation.mutate({ id: month.id, deficitReason, deficitNote })
              }
            />
            )}
            <TransactionsPanel monthId={month.id} parcels={parcels} transactions={transactions} />
              </div>
  );
}
