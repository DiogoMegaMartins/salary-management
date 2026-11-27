import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/layout";
import { ManageList } from "@/components/manage-list";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { errMsg } from "@/components/catalogs";
import { useConfirm } from "@/components/confirm";
import { useToast } from "@/hooks/use-toast";
import { useAppState, useSave } from "@/lib/app";
import { useFeatures } from "@/lib/features";
import { categoryRows, platformRows, usesText } from "@shared/organizar";

function HubCard({ title, count, text, children, to, action, testId }: { title: string; count: string; text: string; children?: React.ReactNode; to: string; action: string; testId: string }) {
  return (
    <section className="flex flex-col rounded-2xl border border-card-border bg-card p-5" data-testid={testId} aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      <div className="mt-3 min-h-8 flex-1 text-xs text-muted-foreground">{children}</div>
      <Button asChild variant="outline" className="mt-4 w-fit min-h-10 gap-1.5">
        <Link href={to} data-testid={`${testId}-abrir`}>{action}<ArrowRight className="h-4 w-4" aria-hidden /></Link>
      </Button>
    </section>
  );
}

const Chips = ({ names }: { names: string[] }) => (
  <div className="flex flex-wrap gap-1.5">
    {names.map((n) => <span key={n} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground">{n}</span>)}
  </div>
);

/**
 * Organizar: tudo o que a app usa, num só sítio. O ecrã inicial resume as quatro áreas; Categorias e Plataformas
 * têm aqui a sua gestão (listas iguais: procurar, criar, renomear, arquivar, eliminar). Parcelas e metas e Movimentos
 * abrem os ecrãs que já existem.
 */
export default function OrganizePage() {
  const { data, isLoading } = useAppState();
  const features = useFeatures();
  const save = useSave();
  const { toast } = useToast();
  const { ask, dialog } = useConfirm();
  const [, params] = useRoute("/organizar/:secao?");
  const secao = params?.secao;
  const fail = (title: string) => (e: unknown) => toast({ title, description: errMsg(e), variant: "destructive" });

  if (isLoading || !data) {
    return (
      <AppShell title="Organizar" subtitle="A carregar…">
        <Skeleton className="h-[240px] rounded-2xl" />
      </AppShell>
    );
  }

  const cats = categoryRows(data.categories, data.transactions);
  const plats = platformRows(data.platforms ?? [], data.parcelPlatforms ?? []);
  const back = (
    <Link href="/organizar" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline" data-testid="organizar-voltar">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Organizar
    </Link>
  );

  if (secao === "categorias") {
    return (
      <AppShell title="Categorias" subtitle="Para saberes em que gastas">
        {dialog}
        {back}
        <ManageList
          testPrefix="cat" noun="categorias" rows={cats} placeholderNew="Por exemplo: Alimentação"
          usesLabel={(n) => usesText(n, "movimento", "movimentos")}
          onCreate={(name) => save.createCategory.mutate({ name } as any, { onError: fail("Não foi possível criar a categoria") })}
          onRename={(id, name) => save.updateCategory.mutate({ id, patch: { name } }, { onError: fail("Não foi possível renomear") })}
          onArchive={(id, archived) => save.updateCategory.mutate({ id, patch: { active: archived ? 0 : 1 } as any }, { onError: fail("Não foi possível alterar") })}
          onDelete={async (id) => {
            const c = cats.find((x) => x.id === id);
            if (await ask(`Eliminar a categoria "${c?.name}"?`, "Não tem movimentos. Esta ação não se desfaz.")) save.deleteCategory.mutate(id, { onError: fail("Não foi possível eliminar") });
          }}
        />
      </AppShell>
    );
  }

  if (secao === "plataformas" && features.plataformas) {
    return (
      <AppShell title="Plataformas" subtitle="Bancos e corretoras onde o dinheiro está">
        {dialog}
        {back}
        <ManageList
          testPrefix="plat" noun="plataformas" rows={plats} placeholderNew="Por exemplo: Banco ou corretora"
          usesLabel={(n) => usesText(n, "parcela", "parcelas")}
          onCreate={(name) => save.createPlatform.mutate({ name }, { onError: fail("Não foi possível criar a plataforma") })}
          onRename={(id, name) => save.updatePlatform.mutate({ id, patch: { name } }, { onError: fail("Não foi possível renomear") })}
          onArchive={(id, archived) => save.updatePlatform.mutate({ id, patch: { archived: archived ? 1 : 0 } }, { onError: fail("Não foi possível alterar") })}
          onDelete={async (id) => {
            const p = plats.find((x) => x.id === id);
            if (await ask(`Eliminar a plataforma "${p?.name}"?`, "Não está ligada a nenhuma parcela. Esta ação não se desfaz.")) save.deletePlatform.mutate(id, { onError: fail("Não foi possível eliminar") });
          }}
        />
      </AppShell>
    );
  }

  const activeCats = cats.filter((c) => !c.archived);
  const activePlats = plats.filter((p) => !p.archived);
  const parcels = data.parcels.filter((p) => !p.archived);
  const goals = parcels.filter((p) => (p.targetAmount ?? 0) > 0).length;
  const latest = [...data.months].sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month))[0];
  const latestCount = latest ? data.transactions.filter((t) => t.monthId === latest.id).length : 0;

  return (
    <AppShell title="Organizar" subtitle="Tudo o que a app usa, num só sítio">
      <div className="grid gap-4 md:grid-cols-2" data-testid="page-organizar">
        {features.parcelas && (
          <HubCard testId="organizar-parcelas" title="Parcelas e metas" count={`${parcels.length} ${parcels.length === 1 ? "parcela" : "parcelas"} · ${goals} ${goals === 1 ? "meta" : "metas"}`}
            text="Para onde vai o teu salário e o que queres alcançar." to="/parcelas" action="Gerir parcelas e metas">
            <Chips names={parcels.slice(0, 4).map((p) => p.name)} />
          </HubCard>
        )}
        <HubCard testId="organizar-categorias" title="Categorias" count={`${activeCats.length} ${activeCats.length === 1 ? "categoria" : "categorias"}`}
          text="Para saberes em que gastas." to="/organizar/categorias" action="Gerir categorias">
          {activeCats.length === 0 ? "Ainda não há categorias." : <Chips names={activeCats.slice(0, 4).map((c) => c.name)} />}
        </HubCard>
        {features.plataformas && (
          <HubCard testId="organizar-plataformas" title="Plataformas" count={`${activePlats.length} ${activePlats.length === 1 ? "plataforma" : "plataformas"}`}
            text="Bancos e corretoras onde o dinheiro está." to="/organizar/plataformas" action="Gerir plataformas">
            {activePlats.length === 0 ? "Ainda não há plataformas." : <Chips names={activePlats.slice(0, 4).map((p) => p.name)} />}
          </HubCard>
        )}
        <HubCard testId="organizar-movimentos" title="Movimentos" count={latest ? `${latestCount} em ${latest.label}` : "sem meses"}
          text="Todas as despesas, entradas e saídas." to="/despesas" action="Ver as despesas">
          {latest ? (latestCount === 0 ? `Ainda sem movimentos em ${latest.label} ${latest.year}.` : `Último mês: ${latest.label} ${latest.year}.`) : "Cria um mês para começares a registar."}
        </HubCard>
      </div>
    </AppShell>
  );
}
