import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Search, Printer, Download, Link2, Check, ChevronDown, List } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HELP_SECTIONS, HELP_VERSION, HELP_UPDATED_AT, type HelpSection } from "@/lib/help-content";

const LAST_VISITED_KEY = "help-last-section";
/** Memoria em runtime (nao usa sessionStorage, que e bloqueado no preview em iframe). */
let lastVisitedSection: string | null = null;

function highlightRanges(text: string, query: string): { text: string; match: boolean }[] {
  if (!query.trim()) return [{ text, match: false }];
  const q = query.trim().toLowerCase();
  const lower = text.toLowerCase();
  const parts: { text: string; match: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(q, i);
    if (idx === -1) {
      parts.push({ text: text.slice(i), match: false });
      break;
    }
    if (idx > i) parts.push({ text: text.slice(i, idx), match: false });
    parts.push({ text: text.slice(idx, idx + q.length), match: true });
    i = idx + q.length;
  }
  return parts;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const parts = highlightRanges(text, query);
  return (
    <>
      {parts.map((p, i) =>
        p.match ? (
          <mark key={i} className="rounded bg-primary/25 px-0.5 text-foreground">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** Extrai texto simples de um ReactNode, para pesquisa full-text. */
function extractText(node: any): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (node.props?.children != null) return extractText(node.props.children);
  return "";
}

export default function HelpPage() {
  const params = useParams<{ slug?: string }>();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const sectionsWithText = useMemo(
    () => HELP_SECTIONS.map((s) => ({ ...s, plainText: extractText(s.body) })),
    [],
  );

  const activeSlug = params.slug ?? lastVisitedSection ?? HELP_SECTIONS[0].slug;
  const active = sectionsWithText.find((s) => s.slug === activeSlug) ?? sectionsWithText[0];

  useEffect(() => {
    if (!params.slug) {
      navigate(`/ajuda/${activeSlug}`, { replace: true });
    } else {
      lastVisitedSection = params.slug;
    }
  }, [params.slug]);

  const filtered = useMemo(() => {
    if (!query.trim()) return sectionsWithText;
    const q = query.trim().toLowerCase();
    return sectionsWithText.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.plainText.toLowerCase().includes(q) ||
        s.keywords?.some((k) => k.toLowerCase().includes(q)),
    );
  }, [query, sectionsWithText]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, typeof filtered>();
    for (const s of filtered) {
      if (!byGroup.has(s.group)) {
        byGroup.set(s.group, []);
        order.push(s.group);
      }
      byGroup.get(s.group)!.push(s);
    }
    return order.map((g) => ({ group: g, items: byGroup.get(g)! }));
  }, [filtered]);

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}${window.location.pathname}#/ajuda/${slug}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(slug);
    setTimeout(() => setCopied(null), 1500);
  };

  const exportMarkdown = () => {
    const md: string[] = [
      `# Ajuda e documentação — Partição do Salário`,
      "",
      `Versão ${HELP_VERSION} · atualizado em ${HELP_UPDATED_AT}`,
      "",
    ];
    for (const g of groups.length && !query ? groupAll() : groups) {
      md.push(`## ${g.group}`, "");
      for (const s of g.items) {
        md.push(`### ${s.title}`, "");
        md.push(s.plainText, "");
      }
    }
    const blob = new Blob([md.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ajuda-particao-do-salario.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  function groupAll() {
    const order: string[] = [];
    const byGroup = new Map<string, typeof sectionsWithText>();
    for (const s of sectionsWithText) {
      if (!byGroup.has(s.group)) {
        byGroup.set(s.group, []);
        order.push(s.group);
      }
      byGroup.get(s.group)!.push(s);
    }
    return order.map((g) => ({ group: g, items: byGroup.get(g)! }));
  }

  return (
    <AppShell
      title="Ajuda e documentação"
      subtitle={`Versão ${HELP_VERSION} · atualizado em ${HELP_UPDATED_AT}`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportMarkdown} data-testid="button-export-help">
            <Download className="h-3.5 w-3.5" />
            Exportar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.print()}
            data-testid="button-print-help"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="min-w-0 print:hidden md:sticky md:top-0 md:h-[calc(100dvh-7rem)] md:overflow-y-auto">
          <Button variant="outline" className="mb-3 flex h-11 w-full items-center justify-between gap-2 md:hidden" onClick={() => setIndexOpen((o) => !o)} aria-expanded={indexOpen ? "true" : "false"} data-testid="button-help-index">
            <span className="flex min-w-0 items-center gap-2"><List className="h-4 w-4 shrink-0" /><span className="truncate">Índice · {active.title}</span></span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", indexOpen && "rotate-180")} />
          </Button>
          <div className={cn(indexOpen ? "block" : "hidden", "md:block")}>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar na ajuda…"
              className="pl-8"
              data-testid="input-help-search"
              aria-label="Pesquisar na documentação"
            />
          </div>
          <nav aria-label="Índice da documentação" className="space-y-4">
            {groups.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem resultados para "{query}".</p>
            )}
            {groups.map((g) => (
              <div key={g.group}>
                <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.group}
                </p>
                <ul className="space-y-0.5">
                  {g.items.map((s) => (
                    <li key={s.slug}>
                      <button
                        onClick={() => { navigate(`/ajuda/${s.slug}`); setIndexOpen(false); contentRef.current?.scrollIntoView({ block: "start" }); }}
                        className={cn(
                          "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                          s.slug === active.slug
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-foreground/80 hover:bg-muted/60",
                        )}
                        data-testid={`link-help-${s.slug}`}
                      >
                        <Highlight text={s.title} query={query} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          </div>
        </aside>

        <div ref={contentRef} className="min-w-0" data-testid="help-content">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h1 id={active.slug} className="min-w-0 break-words text-xl font-semibold tracking-tight">
              {active.title}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground print:hidden"
              onClick={() => copyLink(active.slug)}
              aria-label="Copiar hiperligação para esta secção"
              data-testid="button-copy-section-link"
            >
              {copied === active.slug ? <Check className="h-4 w-4 text-primary" /> : <Link2 className="h-4 w-4" />}
            </Button>
          </div>
          <article className="min-w-0 max-w-2xl [overflow-wrap:anywhere]">{active.body}</article>
        </div>
      </div>
    </AppShell>
  );
}
