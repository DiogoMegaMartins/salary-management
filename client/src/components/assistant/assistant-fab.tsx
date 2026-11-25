import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppState } from "@/lib/app";
import { useFeature } from "@/lib/features";
import { AssistantChat } from "@/components/assistant/assistant-chat";

/**
 * Botão flutuante que abre o assistente por cima do ecrã atual. Só existe com a funcionalidade "Assistente" ligada,
 * depois do arranque, e esconde-se no telemóvel enquanto se escreve (para não tapar o teclado).
 */
export function AssistantFab() {
  const { data } = useAppState();
  const on = useFeature("assistente");
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const editable = (el: EventTarget | null) => el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !["checkbox", "radio", "button", "submit"].includes((el as HTMLInputElement).type);
    const onIn = (e: FocusEvent) => setTyping(editable(e.target));
    const onOut = () => setTyping(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => { document.removeEventListener("focusin", onIn); document.removeEventListener("focusout", onOut); };
  }, []);
  if (!data || !on || data.settings.onboardingDone === 0) return null;
  return (
    <>
      {!open && !(typing && isMobile) && (
        <Button
          size="icon"
          className="fixed! bottom-[calc(8.5rem+env(safe-area-inset-bottom))] right-4 z-40! h-14 w-14 rounded-full shadow-lg lg:bottom-6 lg:right-6"
          aria-label="Abrir o assistente"
          data-testid="assistant-fab"
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="h-6 w-6" aria-hidden />
        </Button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={`flex flex-col gap-0 overflow-hidden p-0 [&>button.absolute]:hidden ${isMobile ? "h-dvh! max-h-dvh! w-dvw! max-w-dvw! rounded-none border-0" : "w-[420px] max-w-[420px]"}`}
          data-testid="assistant-sheet"
        >
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div>
              <SheetTitle className="text-base">Assistente</SheetTitle>
              <SheetDescription className="text-xs">Ajuda passo a passo. Só grava quando confirmas.</SheetDescription>
            </div>
            <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Fechar o assistente" data-testid="assistant-close" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" aria-hidden />
            </Button>
          </div>
          {open && <AssistantChat onClose={() => setOpen(false)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
