import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Confirmação dentro da aplicação. `window.confirm` é bloqueado em iframes (pré-visualização) e
 * devolve false em silêncio, o que fazia os botões de remover parecerem não funcionar.
 */
export function useConfirm(): { ask: (title: string, description?: string) => Promise<boolean>; dialog: ReactNode } {
  const [state, setState] = useState<{ title: string; description?: string } | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const ask = useCallback(
    (title: string, description?: string) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setState({ title, description });
      }),
    [],
  );
  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setState(null);
  };
  const dialog = (
    <AlertDialog open={!!state} onOpenChange={(o) => !o && close(false)}>
      <AlertDialogContent data-testid="dialog-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>{state?.title}</AlertDialogTitle>
          {state?.description && <AlertDialogDescription>{state.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-confirm-cancel">Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => close(true)} data-testid="button-confirm-ok">Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { ask, dialog };
}
