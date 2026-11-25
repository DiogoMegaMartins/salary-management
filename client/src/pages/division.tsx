import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { AppShell } from "@/components/layout";
import { SectionCard } from "@/components/kpi";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppState, useDerived } from "@/lib/app";
import { useFeatures } from "@/lib/features";
import { DivisionPanel } from "@/components/months/division-panel";
import { MovementsPanel } from "@/components/months/movements-panel";

/**
 * Divisão do salário e movimentos de um mês, num só sítio. O mês vem da rota (`#/divisao/<id>`); sem id, ou com
 * um id que não existe, usa o último mês aberto (ou o último, se todos estiverem fechados).
 */
export default function DivisionPage() {
  const { data, isLoading } = useAppState();
  const d = useDerived(data);
  const features = useFeatures();
  const [, params] = useRoute("/divisao/:mes?");
  const [, navigate] = useLocation();
  const [tabChoice, setTab] = useState("divisao");

  if (isLoading || !d || !data) {
    return (
      <AppShell title="Divisão" subtitle="A carregar…">
        <Skeleton className="h-[360px] rounded-lg" />
      </AppShell>
    );
  }

  const months = d.allMonths;
  const subtitle = "Reparte o vencimento por parcelas e regista movimentos";
  if (!months.length) {
    return (
      <AppShell title="Divisão" subtitle={subtitle}>
        <SectionCard description="Ainda não há meses.">
          <p className="text-sm" data-testid="division-empty">
            Cria primeiro um mês em <Link href="/meses" className="font-medium text-primary underline-offset-4 hover:underline">Meses</Link> para o dividires aqui.
          </p>
        </SectionCard>
      </AppShell>
    );
  }

  const wanted = Number(params?.mes);
  const month =
    months.find((m) => m.id === wanted) ??
    [...months].reverse().find((m) => m.status !== "fechado") ??
    months[months.length - 1];
  const movementCount = data.transactions.filter((t) => t.monthId === month.id).length;
  const tab = tabChoice === "movimentos" && features.movimentos ? "movimentos" : features.divisao ? "divisao" : "movimentos";
  const both = features.divisao && features.movimentos;

  return (
    <AppShell
      title="Divisão"
      subtitle={subtitle}
      actions={
        <Select value={String(month.id)} onValueChange={(v) => navigate(`/divisao/${v}`, { replace: true })}>
          <SelectTrigger className="h-9 w-48 text-sm" aria-label="Mês" data-testid="select-division-month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[...months].reverse().map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>{m.label} {m.year}{m.status === "fechado" ? " (fechado)" : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <Tabs value={tab} onValueChange={setTab} className="space-y-4" data-testid="division-tabs">
        {both && (
          <TabsList className="sticky-tabs">
            <TabsTrigger value="divisao" data-testid="division-tab-divisao">Divisão</TabsTrigger>
            <TabsTrigger value="movimentos" data-testid="division-tab-movimentos">
              Movimentos
              {movementCount > 0 && <Badge variant="secondary" className="px-1.5 py-0 text-[11px]">{movementCount}</Badge>}
            </TabsTrigger>
          </TabsList>
        )}
        {features.divisao && <TabsContent value="divisao" className="mt-0"><DivisionPanel key={month.id} month={month} /></TabsContent>}
        {features.movimentos && <TabsContent value="movimentos" className="mt-0"><MovementsPanel key={month.id} month={month} /></TabsContent>}
      </Tabs>
    </AppShell>
  );
}
