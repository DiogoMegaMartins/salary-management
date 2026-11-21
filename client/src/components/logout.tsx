import { useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { lockOffline } from "@/lib/offline";
import { cn } from "@/lib/utils";

/** Termina a sessão: esquece o código guardado neste separador e volta ao ecrã do código (com confirmação). */
export function endSession() {
  lockOffline();
  window.dispatchEvent(new Event("sm:locked"));
}

/**
 * Botão "Terminar sessão". Só aparece quando a aplicação tem código de acesso: sem código não há sessão
 * para terminar. Pede confirmação antes de sair.
 */
export function LogoutButton({ className, onDone }: { className?: string; onDone?: () => void }) {
  const status = useQuery<{ enabled: boolean }>({ queryKey: ["/api/auth/status"], staleTime: 5 * 60_000 });
  const { ask, dialog } = useConfirm();
  if (!status.data?.enabled) return null;
  return (
    <>
      {dialog}
      <button
        type="button"
        data-testid="button-logout"
        className={cn("flex items-center gap-3 rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground", className)}
        onClick={() =>
          ask("Terminar sessão?", "Voltas ao ecrã do código de acesso. Os dados ficam guardados; precisas do código para voltar a entrar.").then((ok) => {
            if (!ok) return;
            onDone?.();
            endSession();
          })
        }
      >
        <LogOut className="h-4 w-4 shrink-0" />
        Terminar sessão
      </button>
    </>
  );
}
