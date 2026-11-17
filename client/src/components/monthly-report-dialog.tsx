import { useState } from "react";
import { FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAppState, type Derived } from "@/lib/app";
import { buildMonthlyReportMarkdown, downloadMarkdown } from "@/lib/monthly-report";

/**
 * SM-010: relatório mensal/periódico arquivável. Gera um Markdown a partir
 * dos dados já carregados no cliente e do período filtrado ativo — não faz
 * nenhuma chamada de escrita ao servidor.
 */
export function MonthlyReportDialog({ d }: { d: Derived }) {
  const { data } = useAppState();
  const [open, setOpen] = useState(false);
  const [hideAmounts, setHideAmounts] = useState(false);

  const generate = () => {
    if (!data) return;
    const md = buildMonthlyReportMarkdown(d, data.categories, { hideAmounts });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadMarkdown(md, `relatorio-particao-salario-${stamp}.md`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-open-report">
          <FileText className="h-3.5 w-3.5" />
          Relatório mensal
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-monthly-report">
        <DialogHeader>
          <DialogTitle>Gerar relatório do período</DialogTitle>
          <DialogDescription>
            Fotografia em Markdown com KPIs, orçamento vs. real, parcelas, metas e alertas do período
            atualmente filtrado ({d.periodLabel}). A exportação não altera nenhum dado da aplicação.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
          <div>
            <Label htmlFor="hide-amounts" className="text-sm font-medium">
              Ocultar valores de património
            </Label>
            <p className="text-xs text-muted-foreground">
              Substitui os montantes em euros por marcadores, mantendo percentagens e estrutura.
            </p>
          </div>
          <Switch
            id="hide-amounts"
            checked={hideAmounts}
            onCheckedChange={setHideAmounts}
            data-testid="switch-hide-amounts"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={generate} data-testid="button-generate-report">
            Descarregar Markdown
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
