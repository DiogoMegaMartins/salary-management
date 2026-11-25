import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Atalhos de navegação: `g` e depois uma letra (como no GitHub). */
export const GO_SHORTCUTS: { key: string; href: string; label: string }[] = [
  { key: "p", href: "/", label: "Início" },
  { key: "m", href: "/meses", label: "Meses" },
  { key: "d", href: "/despesas", label: "Despesas" },
  { key: "f", href: "/fecho", label: "Fecho e planeamento" },
  { key: "a", href: "/parcelas", label: "Parcelas e metas" },
  { key: "c", href: "/carteira", label: "Carteira" },
  { key: "o", href: "/orcamento", label: "Orçamento" },
  { key: "s", href: "/dados", label: "Definições" },
  { key: "h", href: "/ajuda", label: "Ajuda" },
];

/** Escrever num campo ou ter um diálogo aberto nunca dispara atalhos. */
function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.getAttribute?.("role") === "combobox";
}

export function KeyboardShortcuts() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const waiting = useRef<number | null>(null);

  useEffect(() => {
    const stop = () => { if (waiting.current != null) { window.clearTimeout(waiting.current); waiting.current = null; } };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || typing(e.target)) return;
      if (document.querySelector('[role="dialog"],[role="alertdialog"]') && !open) return;
      if (e.key === "?") { e.preventDefault(); setOpen((v) => !v); stop(); return; }
      if (e.key === "/") {
        const campo = document.querySelector<HTMLInputElement>('[data-testid="input-expense-search"]');
        if (campo) { e.preventDefault(); campo.focus(); }
        return;
      }
      if (waiting.current != null) {
        const alvo = GO_SHORTCUTS.find((s) => s.key === e.key.toLowerCase());
        stop();
        if (alvo) { e.preventDefault(); navigate(alvo.href); }
        return;
      }
      if (e.key === "g" || e.key === "G") waiting.current = window.setTimeout(stop, 1200);
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); stop(); };
  }, [navigate, open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm" data-testid="dialog-shortcuts">
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
          <DialogDescription>Não funcionam enquanto escreves num campo.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-sm">
          {GO_SHORTCUTS.map((s) => (
            <div key={s.key} className="contents">
              <dt className="whitespace-nowrap"><kbd className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-xs">g</kbd> <kbd className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-xs">{s.key}</kbd></dt>
              <dd className="text-muted-foreground">Ir para {s.label}</dd>
            </div>
          ))}
          <div className="contents">
            <dt><kbd className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-xs">/</kbd></dt>
            <dd className="text-muted-foreground">Pesquisar (em Despesas)</dd>
          </div>
          <div className="contents">
            <dt><kbd className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-xs">?</kbd></dt>
            <dd className="text-muted-foreground">Mostrar ou fechar esta lista</dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
