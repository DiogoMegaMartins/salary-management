import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAppState, useSave } from "@/lib/app";
import { useIsMobile } from "@/hooks/use-mobile";
import { defaultRegisterDate, monthOfDate, parseAmount } from "@shared/assistant";
import { fmtEur } from "@shared/calc";
import { parseUiMode } from "@shared/ui-mode";

const NONE = "__none__";
const hoje = () => new Date().toLocaleDateString("sv-SE");

/**
 * Botão sempre à mão, fixo no fundo da área de conteúdo, que abre um diálogo rápido para registar uma despesa.
 * Só existe no modo Básico, depois do arranque e com pelo menos um mês criado. No telemóvel esconde-se enquanto se escreve noutro campo.
 */
export function RegisterBar() {
  const { data } = useAppState();
  const save = useSave();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [value, setValue] = useState("");
  const [category, setCategory] = useState(NONE);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false); // protege contra duplo envio

  useEffect(() => {
    const editable = (el: EventTarget | null) => el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !["checkbox", "radio", "button", "submit"].includes((el as HTMLInputElement).type);
    const onIn = (e: FocusEvent) => setTyping(editable(e.target));
    const onOut = () => setTyping(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => { document.removeEventListener("focusin", onIn); document.removeEventListener("focusout", onOut); };
  }, []);

  if (!data || data.settings.onboardingDone === 0 || data.months.length === 0 || parseUiMode(data.settings.uiMode) !== "basico") return null;
  const categories = data.categories.filter((c) => c.active).map((c) => c.name);

  const abrir = () => {
    setValue(""); setNote(""); setCategory(NONE); setError(null);
    setDate(defaultRegisterDate(data.months, hoje()));
    setOpen(true);
  };

  const guardar = () => {
    if (busy.current) return;
    const v = parseAmount(value);
    if (v == null || v <= 0) return setError("Indica um valor maior que zero.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Indica a data da despesa.");
    const month = monthOfDate(data.months, date);
    if (!month) return setError("Não há mês para esta data. Cria o mês em Meses ou escolhe outra data.");
    if (month.status === "fechado") return setError("Esse mês está fechado. Escolhe a data de um mês aberto.");
    busy.current = true;
    save.createTransaction.mutate({ monthId: month.id, date, type: "expense", value: v, category: category === NONE ? "" : category, note: note.trim() } as any, {
      onSuccess: () => { busy.current = false; setOpen(false); toast({ title: `${fmtEur(v)} guardado`, description: "A despesa já está em Despesas." }); },
      onError: (e) => { busy.current = false; setError(e instanceof Error ? e.message : "Não foi possível guardar. Tenta de novo."); },
    });
  };

  return (
    <>
      {!(typing && isMobile && !open) && (
        <div className="pointer-events-none sticky bottom-0 z-10 -mx-4 -mb-5 mt-4 flex justify-center bg-linear-to-t from-background via-background/85 to-transparent px-4 pb-4 pt-8 md:-mx-6 md:-mb-6" data-testid="register-bar">
          <Button onClick={abrir} size="lg" className="pointer-events-auto w-full gap-2 rounded-2xl shadow-lg md:w-auto md:rounded-full md:px-8" data-testid="register-button">
            <Plus className="h-5 w-5" aria-hidden />
            Registar despesa
          </Button>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="register-dialog">
          <DialogHeader>
            <DialogTitle>Registar despesa</DialogTitle>
            <DialogDescription>Fica já guardada no mês da data escolhida.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
            <div className="space-y-1">
              <Label htmlFor="register-value">Valor (€)</Label>
              <Input id="register-value" data-testid="register-value" inputMode="decimal" autoComplete="off" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="12,50" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="register-category">Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="register-category" data-testid="register-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sem categoria</SelectItem>
                    {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="register-date">Data</Label>
                <Input id="register-date" data-testid="register-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="register-note">Nota (opcional)</Label>
              <Input id="register-note" data-testid="register-note" autoComplete="off" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive" data-testid="register-error">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" data-testid="register-save">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
