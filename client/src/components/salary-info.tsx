import { Link } from "wouter";
import { fmtEur } from "@shared/calc";
import type { Month } from "@shared/schema";

const nomeMes = (m: { label: string; year: number }) => `${m.label} ${m.year}`;

/**
 * "Quanto entra": o salário do mês e se parte do dinheiro veio do mês anterior (transporte do fecho).
 * `income` é o rendimento do mês (base das parcelas em %), `carryIn` o que veio do mês anterior.
 */
export function SalaryInfo({ month, income, carryIn, previous }: { month: Month; income: number; carryIn: number; previous: Month | null }) {
  const total = income + carryIn;
  const veio = carryIn > 0.005;
  return (
    <section className="space-y-4" data-testid="dividir-salario" aria-label="Quanto entra este mês">
      <div className="rounded-2xl border border-card-border bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quanto entra em {nomeMes(month)}</p>
        <p className="tnum mt-1 text-4xl font-semibold tracking-tight" data-testid="salary-total">{fmtEur(total)}</p>
        <p className="mt-1 text-sm text-muted-foreground">total para repartir</p>
      </div>
      <div className="rounded-2xl border border-card-border bg-card p-5">
        <h2 className="text-sm font-semibold">De onde veio</h2>
        <div className="mt-2 divide-y divide-border text-sm">
          <div className="flex justify-between gap-3 py-2"><span>Salário líquido do mês</span><span className="tnum font-medium" data-testid="salary-income">{fmtEur(income)}</span></div>
          <div className="flex justify-between gap-3 py-2" data-testid="salary-carry" data-carry={carryIn}>
            <span>{veio ? `Transportado do mês anterior${previous ? ` (${previous.label})` : ""}` : "Nada transportado do mês anterior"}</span>
            <span className="tnum font-medium">{fmtEur(carryIn)}</span>
          </div>
          <div className="flex justify-between gap-3 py-2 font-semibold"><span>Total para repartir</span><span className="tnum">{fmtEur(total)}</span></div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {veio ? "Sobrou no fecho do mês anterior e foi transportado para aqui. Não conta como rendimento." : "Se sobrar dinheiro no fecho do mês anterior, pode ser transportado para este mês."}
        </p>
        <Link href="/meses" className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">Ver ou alterar o salário em Meses</Link>
      </div>
    </section>
  );
}
