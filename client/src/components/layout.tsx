import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, LayoutGrid, Moon, Sun, Ellipsis } from "lucide-react";
import { useAppState } from "@/lib/app";
import { useTheme } from "@/lib/appearance";
import { usePrivacy } from "@/lib/privacy";
import { useFeatures } from "@/lib/features";
import { MAIN_NAV, MORE_NAV, visibleNav as visible, isNavActive as isActive, type NavItem } from "@/lib/nav";
import { layoutEditor, useLayoutEditor } from "@/lib/layout-editor";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { OfflineStatus } from "@/components/offline-status";
import { KeyboardShortcuts } from "@/components/shortcuts";
import { LogoutButton } from "@/components/logout";
import { offlineInfo } from "@/lib/offline";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-label="Personal Salary Management"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75" />
      <path d="M2.6 8.5h18.8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4.1 15.5h15.8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 15.5V22" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const features = useFeatures();
  const link = (item: NavItem) => {
    const active = isActive(item.href, location);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        data-testid={`link-${item.testId}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };
  return (
    <nav className="flex flex-col gap-1" aria-label="Navegação principal">
      {visible(MAIN_NAV, features).map(link)}
      <p className="mt-4 px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground" data-testid="nav-more-heading">Mais</p>
      {visible(MORE_NAV, features).map(link)}
    </nav>
  );
}

/** Barra de separadores no fundo do ecrã (telemóvel). Esconde-se com o teclado aberto. */
function BottomNav() {
  const [location] = useLocation();
  const features = useFeatures();
  const [moreOpen, setMoreOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [alert, setAlert] = useState(() => offlineInfo().count > 0 || offlineInfo().conflict);
  useEffect(() => {
    const editable = (el: EventTarget | null) => el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !["checkbox", "radio", "button", "submit"].includes((el as HTMLInputElement).type);
    const onIn = (e: FocusEvent) => setTyping(editable(e.target));
    const onOut = () => setTyping(false);
    const update = () => { const i = offlineInfo(); setAlert(i.count > 0 || !!i.conflict); };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    window.addEventListener("sm:offline", update);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
      window.removeEventListener("sm:offline", update);
    };
  }, []);
  useEffect(() => setMoreOpen(false), [location]);
  const moreActive = visible(MORE_NAV, features).some((n) => isActive(n.href, location));
  const item = "relative flex min-h-13 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors active:scale-95";
  return (
    <>
      {!typing && (
        <nav aria-label="Navegação principal" data-testid="bottom-nav" className="lg:hidden col-start-1 z-30 flex border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
          {visible(MAIN_NAV, features).map((t) => {
            const active = isActive(t.href, location);
            return (
              <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} data-testid={`tab-${t.label.toLowerCase()}`} className={cn(item, active ? "text-primary" : "text-muted-foreground")}>
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-primary/12")}>
                  <t.icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                </span>
                {t.label}
              </Link>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={moreOpen} data-testid="tab-mais" className={cn(item, moreActive ? "text-primary" : "text-muted-foreground")}>
            <span className={cn("relative flex h-7 w-12 items-center justify-center rounded-full transition-colors", moreActive && "bg-primary/12")}>
              <Ellipsis className="h-5 w-5" strokeWidth={moreActive ? 2.4 : 1.8} />
              {alert && <span className="absolute right-2.5 top-0.5 h-2 w-2 rounded-full bg-destructive" data-testid="tab-mais-alert" aria-label="Há alterações por sincronizar" />}
            </span>
            Mais
          </button>
        </nav>
      )}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]" data-testid="sheet-mais">
          <SheetHeader className="text-left">
            <SheetTitle>Mais áreas</SheetTitle>
            <SheetDescription>{alert ? "Há alterações guardadas só neste dispositivo. Vê o estado em cada página." : "Outras áreas da aplicação."}</SheetDescription>
          </SheetHeader>
          <div className="mt-3 grid grid-cols-1 gap-1">
            {visible(MORE_NAV, features).map((n) => (
              <Link key={n.href} href={n.href} data-testid={`more-${n.href.slice(1)}`} className={cn("flex min-h-12 items-center gap-3 rounded-lg px-3 text-base", isActive(n.href, location) ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted")}>
                <n.icon className="h-5 w-5 shrink-0" />
                {n.label}
              </Link>
            ))}
            <LogoutButton className="min-h-12 px-3 text-base text-foreground hover:bg-muted [&>svg]:h-5 [&>svg]:w-5" onDone={() => setMoreOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function AppShell({
  title,
  subtitle,
  actions,
  filters,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { theme, toggle } = useTheme();
  const layoutState = useLayoutEditor();
  const { hidden, toggle: togglePrivacy } = usePrivacy();
  const state = useAppState();
  const failed = state.isError && !state.data;
  return (
    <div className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] bg-background lg:grid-cols-[236px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
      <aside className="hidden lg:flex lg:row-span-2 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 overflow-y-auto overscroll-contain">
        <div className="flex items-center gap-2.5 px-1 pt-1">
          <Logo className="h-6 w-6 text-primary" />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Personal Salary Management</div>
          </div>
        </div>
        <NavLinks />
        <div className="mt-auto px-1 text-xs text-muted-foreground">
          <LogoutButton className="-mx-1 w-[calc(100%+0.5rem)] px-2 py-2 text-sm" />
        </div>
      </aside>

      <header className="app-header col-start-1 lg:col-start-2 [@media(min-height:760px)]:sticky top-0 z-20 flex min-w-0 flex-col gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-sm md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-[1_1_16rem] items-center gap-3">
            <div className="min-w-0">
              <h1 className="wrap-break-word text-lg font-semibold tracking-tight md:text-xl" data-testid="text-page-title">
                {title}
              </h1>
              {subtitle && <div className="wrap-break-word text-xs text-muted-foreground md:text-sm">{subtitle}</div>}
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {actions}
            <Button variant="ghost" size="icon" onClick={togglePrivacy} data-testid="button-privacy" aria-pressed={hidden} aria-label={hidden ? "Mostrar montantes" : "Ocultar montantes"} title="Ocultar montantes no ecrã (não é controlo de acesso)">
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            {layoutState.available && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => layoutEditor.requestEdit()}
                disabled={layoutState.editing}
                aria-pressed={layoutState.editing}
                aria-label="Editar layout"
                title="Editar layout: mover e redimensionar as secções desta página"
                data-testid="button-edit-layout"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={toggle} data-testid="button-theme" aria-label="Alternar tema">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {filters}
        <OfflineStatus />
      </header>
      <KeyboardShortcuts />

      <main className="min-h-0 min-w-0 col-start-1 lg:col-start-2 overflow-y-auto overscroll-contain px-4 py-5 md:px-6 md:py-6">
        {failed ? (
          <div role="alert" className="mx-auto mt-10 max-w-md space-y-3 rounded-lg border border-border bg-card p-5 text-center" data-testid="state-error">
            <p className="font-medium">Não foi possível carregar os dados.</p>
            <p className="text-sm text-muted-foreground">Verifica a ligação e tenta de novo. Os teus dados no servidor não foram alterados.</p>
            <Button onClick={() => state.refetch()} disabled={state.isFetching} data-testid="button-retry-state">
              {state.isFetching ? "A tentar…" : "Tentar de novo"}
            </Button>
          </div>
        ) : (
          children
        )}
      </main>
      <BottomNav />
    </div>
  );
}
