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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildAnnualReportPdf, buildMonthlyReportPdf, downloadPdf } from "@/lib/monthly-report";

/**
 * SM-010: relatório mensal/periódico arquivável. Gera um PDF a partir
 * dos dados já carregados no cliente e do período filtrado ativo — não faz
 * nenhuma chamada de escrita ao servidor.
 */
export function MonthlyReportDialog({ d }: { d: Derived }) {
  const { data } = useAppState();
  const [open, setOpen] = useState(false);
  const [hideAmounts, setHideAmounts] = useState(false);
  const [scope, setScope] = useState<string>("periodo"); // "periodo" ou um ano

  const generatePdf = () => {
    if (!data) return;
    const stamp = new Date().toISOString().slice(0, 10);
    if (scope === "periodo") {
      downloadPdf(buildMonthlyReportPdf(d, data.categories, { hideAmounts }), `relatorio-particao-salario-${stamp}.pdf`);
    } else {
      downloadPdf(buildAnnualReportPdf(d, Number(scope), { hideAmounts }), `relatorio-anual-${scope}-particao-salario.pdf`);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-open-report">
          <FileText className="h-3.5 w-3.5" />
          Relatório
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-monthly-report">
        <DialogHeader>
          <DialogTitle>Gerar relatório do período</DialogTitle>
          <DialogDescription>
            Fotografia em PDF. Escolhe o período filtrado ({d.periodLabel}) ou um ano completo, com resumo,
            mês a mês, parcelas, despesas por categoria e valor da carteira. A exportação não altera nenhum dado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">O que incluir</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="h-9 text-sm" data-testid="select-report-scope"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="periodo">Período filtrado ({d.periodLabel})</SelectItem>
              {[...d.years].sort((a, b) => b - a).map((y) => <SelectItem key={y} value={String(y)}>Relatório anual de {y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

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
          <Button onClick={generatePdf} data-testid="button-generate-report-pdf">
            Descarregar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
