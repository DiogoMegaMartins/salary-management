import { useId, useRef, useState } from "react";
import { Download, FileSpreadsheet, Lock, ShieldCheck, Upload } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionCard } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDerived } from "@/lib/app";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { errMsg } from "@/components/catalogs";
import { API_BASE, useAppState, useSave } from "@/lib/app";
import { setAccessCode, withAccessCode, getAccessCode } from "@/lib/queryClient";
import { fmtEur } from "@shared/calc";
import { CatalogsSection } from "@/components/catalogs";
import { VerifyData, ChangeHistory, CsvImport } from "@/components/data-tools";
import { FeaturesSettings } from "@/components/features-settings";
import { AppearanceSettings } from "@/components/appearance-settings";
import { UiModeSettings } from "@/components/ui-mode-settings";
import { parseUiMode, visibleSettingsTabs } from "@shared/ui-mode";
import { AiSettings } from "@/components/ai-settings";
import { OfflineSettings } from "@/components/offline-status";
import { daysSince } from "@/lib/utils";
import { isValidDecimalDraft, parseDecimalDraft } from "@/components/months/number-field";

export default function DataPage() {
  const { data, isLoading } = useAppState();
  const d = useDerived(data);
  const save = useSave();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<any | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [tab, setTabState] = useState(() => { try { return sessionStorage.getItem("sm.settings.tab") || "calculo"; } catch { return "calculo"; } });
  const setTab = (v: string) => { setTabState(v); try { sessionStorage.setItem("sm.settings.tab", v); } catch { /* sem armazenamento */ } };

  if (isLoading || !data) {
    return (
      <AppShell title="Definições" subtitle="A carregar…">
        <Skeleton className="h-[360px] rounded-lg" />
      </AppShell>
    );
  }

  const s = data.settings;
  const since = daysSince(s.lastBackupAt);
  const overdue = since === null || since >= s.backupReminderDays;
  const restoreSince = daysSince(s.lastRestoreAt);

  const ALL_TABS = ["calculo", "funcionalidades", "aparencia", "catalogos", "backups", "seguranca", "historico"];
  const shown = visibleSettingsTabs(ALL_TABS, parseUiMode(s.uiMode));
  const activeTab = shown.includes(tab) ? tab : shown[0];

  const markBackup = () => save.settings.mutate({ lastBackupAt: new Date().toISOString() });

  // download por fetch com cabeçalho: o código de acesso nunca vai no URL
  const openExport = async (path: string) => {
    try {
      const res = await fetch(withAccessCode(path), { headers: getAccessCode() ? { "x-codigo-acesso": getAccessCode() } : {} });
      if (!res.ok) throw new Error(`${res.status}`);
      const name = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "exportacao";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      markBackup();
    } catch (e) {
      toast({ title: "Não foi possível exportar", description: errMsg(e), variant: "destructive" });
    }
  };

  return (
    <AppShell title="Definições" subtitle="Cálculo, catálogos, backups, segurança e histórico">
      <Tabs value={activeTab} onValueChange={setTab} className="space-y-4" data-testid="settings-tabs">
        <TabsList className="sticky-tabs" data-testid="settings-tablist">
          {shown.includes("calculo") && <TabsTrigger value="calculo" data-testid="settings-tab-calculo">Cálculo</TabsTrigger>}
          {shown.includes("funcionalidades") && <TabsTrigger value="funcionalidades" data-testid="settings-tab-funcionalidades">Funcionalidades</TabsTrigger>}
          {shown.includes("aparencia") && <TabsTrigger value="aparencia" data-testid="settings-tab-aparencia">Aparência</TabsTrigger>}
          {shown.includes("catalogos") && <TabsTrigger value="catalogos" data-testid="settings-tab-catalogos">Catálogos</TabsTrigger>}
          {shown.includes("backups") && <TabsTrigger value="backups" data-testid="settings-tab-backups">Backups e importação</TabsTrigger>}
          {shown.includes("seguranca") && <TabsTrigger value="seguranca" data-testid="settings-tab-seguranca">Segurança</TabsTrigger>}
          {shown.includes("historico") && <TabsTrigger value="historico" data-testid="settings-tab-historico">Histórico</TabsTrigger>}
        </TabsList>
        <TabsContent value="calculo" className="mt-0"><div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Regras de cálculo" description="Definem como o líquido e o valor disponível são apurados">
          <div className="space-y-4">
            <label className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-sm font-medium">Incluir subsídio de alimentação no disponível</span>
                <span className="block text-xs text-muted-foreground">
                  Ativa se dividires também o cartão de refeição em parcelas.
                </span>
              </span>
              <Switch
                checked={!!s.includeMeal}
                onCheckedChange={(v) => save.settings.mutate({ includeMeal: v ? 1 : 0 })}
                data-testid="switch-include-meal"
              />
            </label>

            <label className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-sm font-medium">Excluir “Outros rend. suj. a IRS” do líquido</span>
                <span className="block text-xs text-muted-foreground">
                  Replica a fórmula da tua folha de cálculo, onde este valor é somado e depois subtraído.
                </span>
              </span>
              <Switch
                checked={!!s.excludeOutrosIrsFromNet}
                onCheckedChange={(v) => save.settings.mutate({ excludeOutrosIrsFromNet: v ? 1 : 0 })}
                data-testid="switch-exclude-outros"
              />
            </label>

            <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              <Field
                label="Subsídio diário por omissão"
                value={s.defaultMealDaily}
                suffix="€"
                onSave={(v) => save.settings.mutate({ defaultMealDaily: v })}
              />
              <Field
                label="Taxa Segurança Social"
                value={s.defaultTaxaSs * 100}
                suffix="%"
                step={0.001}
                onSave={(v) => save.settings.mutate({ defaultTaxaSs: v / 100 })}
              />
              <Field
                label="Taxa IRS base"
                value={s.defaultTaxaIrsBase * 100}
                suffix="%"
                step={0.0001}
                onSave={(v) => save.settings.mutate({ defaultTaxaIrsBase: v / 100 })}
              />
              <Field
                label="Taxa IRS extra"
                value={s.defaultTaxaIrsExtra * 100}
                suffix="%"
                step={0.0001}
                onSave={(v) => save.settings.mutate({ defaultTaxaIrsExtra: v / 100 })}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Objetivos e reserva de emergência"
          description="Usados na projeção de final de ano e no cálculo do runway (página Orçamento)"
        >
          <div className="space-y-4">
            <Field
              label="Meta de poupança anual"
              value={s.annualSavingsGoal ?? 0}
              suffix="€"
              step={1}
              onSave={(v) => save.settings.mutate({ annualSavingsGoal: v })}
            />

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Parcelas usadas como reserva de emergência</Label>
              <div className="flex flex-wrap gap-2">
                {d?.allParcels.map((p) => {
                  const ids = (s.emergencyParcelIds || "")
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean);
                  const active = ids.includes(String(p.id));
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        const next = active ? ids.filter((x) => x !== String(p.id)) : [...ids, String(p.id)];
                        save.settings.mutate({ emergencyParcelIds: next.join(",") });
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors min-h-8 ${
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                      data-testid={`button-emergency-parcel-${p.id}`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Seleciona uma ou mais parcelas (ex.: “Fundos de Emergência”) cujo saldo acumulado conta para o runway.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Janela do runway por omissão</Label>
              <Select
                value={String(s.runwayMonthsWindow ?? 3)}
                onValueChange={(v) => save.settings.mutate({ runwayMonthsWindow: Number(v) })}
              >
                <SelectTrigger aria-label="Janela da reserva de emergência" className="h-9 w-48 text-sm" data-testid="select-runway-window-default">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Média 3 meses</SelectItem>
                  <SelectItem value="6">Média 6 meses</SelectItem>
                  <SelectItem value="12">Média 12 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Field
              label="Sugerir distribuição de excedente a partir de"
              value={s.surplusSuggestionThreshold ?? 50}
              suffix="€"
              step={1}
              onSave={(v) => save.settings.mutate({ surplusSuggestionThreshold: v })}
            />
          </div>
        </SectionCard>

        <SectionCard title="Fórmulas usadas" description="Para que saibas exatamente o que a aplicação calcula" className="xl:col-span-2">
          <div className="space-y-2 font-mono text-xs leading-relaxed text-muted-foreground">
            <p>bruto = base + extraordinária + outros(IRS+SS) + outros(IRS) + isentos</p>
            <p>
              descontos (auto) = (base + outros(IRS+SS)) × taxaSS + (base + outros(IRS)) × taxaIRS_base + outros(IRS) ×
              taxaIRS_extra
            </p>
            <p>líquido = bruto − descontos {s.excludeOutrosIrsFromNet ? "− outros(IRS)" : ""}</p>
            <p>subsídio = valor diário × dias</p>
            <p>disponível = líquido {s.includeMeal ? "+ subsídio" : ""}</p>
            <p>parcela = valor fixo, ou % × disponível</p>
            <p>restante = disponível − Σ parcelas</p>
            <p>taxa de poupança = (poupança + investimento) ÷ disponível</p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Total registado no histórico:{" "}
            <span className="tnum font-medium text-foreground">
              {fmtEur(data.months.length ? data.allocations.reduce((a, x) => a + (x.mode === "fixo" && x.included !== 0 ? x.value : 0), 0) : 0)}
            </span>{" "}
            em alocações de valor fixo, em {data.months.length} meses e {data.parcels.length} parcelas.
          </p>
        </SectionCard>

        </div></TabsContent>
        <TabsContent value="funcionalidades" className="mt-0"><UiModeSettings settings={s} /><FeaturesSettings settings={s} /><AiSettings settings={s} /></TabsContent>
        <TabsContent value="aparencia" className="mt-0"><AppearanceSettings /></TabsContent>
        <TabsContent value="catalogos" className="mt-0"><div className="space-y-4">
        <SectionCard
          title="Catálogos"
          description="Plataformas e tipos personalizados, reutilizados em Meses, Parcelas e metas e Carteira. Renomear mantém as ligações; o que está em uso só pode ser arquivado."
        >
          <CatalogsSection state={data!} />
        </SectionCard>


        </div></TabsContent>
        <TabsContent value="backups" className="mt-0"><div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Cópia de segurança"
          description="Os dados vivem nesta aplicação. Guarda um ficheiro no teu computador todos os meses."
        >
          <div
            className={`mb-4 flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-xs ${
              overdue ? "border-destructive/40 bg-destructive/10" : "border-primary/40 bg-primary/10"
            }`}
            data-testid="text-backup-status"
          >
            <ShieldCheck className={`mt-0.5 h-4 w-4 ${overdue ? "text-destructive" : "text-primary"}`} />
            <div>
              <p className="font-medium">
                {since === null
                  ? "Ainda não fizeste nenhuma cópia de segurança"
                  : since === 0
                    ? "Cópia de segurança feita hoje"
                    : `Última cópia há ${since} ${since === 1 ? "dia" : "dias"}`}
              </p>
              <p className="text-muted-foreground">
                Lembrete a cada {s.backupReminderDays} dias. Guarda o JSON — é o ficheiro que permite restaurar tudo.
              </p>
              <p className="mt-1 text-muted-foreground" data-testid="text-last-restore">
                {restoreSince === null
                  ? "Ainda sem restauro de backups."
                  : restoreSince === 0
                    ? "Último restauro hoje."
                    : `Último restauro há ${restoreSince} ${restoreSince === 1 ? "dia" : "dias"}.`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5" onClick={() => openExport("/api/export/json")} data-testid="button-export-json">
              <Download className="h-4 w-4" />
              Backup JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => openExport("/api/export/xlsx")}
              data-testid="button-export-xlsx"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => fileRef.current?.click()}
              data-testid="button-import"
            >
              <Upload className="h-4 w-4" />
              Restaurar backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                let parsed: unknown;
                try {
                  parsed = JSON.parse(await file.text());
                } catch {
                  toast({ title: "Ficheiro inválido", description: "Não foi possível ler o JSON.", variant: "destructive" });
                  e.target.value = "";
                  return;
                }
                try {
                  setPreviewError("");
                  const code = getAccessCode();
                  const res = await fetch(`${API_BASE}/api/import/preview`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-sm-client": "1", ...(code ? { "x-codigo-acesso": code } : {}) },
                    body: JSON.stringify(parsed),
                  });
                  // a resposta pode não ser JSON (por exemplo, uma página de erro da plataforma)
                  const text = await res.text();
                  let body: any = null;
                  try { body = JSON.parse(text); } catch { /* resposta que não é JSON */ }
                  if (!res.ok) {
                    setPreviewError(body?.message ?? body?.error ?? `O servidor respondeu ${res.status}${text ? `: ${text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)}` : "."}`);
                    setPreview(null);
                    setPending(null);
                  } else if (!body) {
                    setPreviewError("O servidor respondeu com algo que não é JSON. Tenta de novo; se continuar, vê os registos do servidor.");
                    setPreview(null);
                    setPending(null);
                  } else {
                    setPreview(body);
                    setPending(parsed as any);
                  }
                } catch (err) {
                  toast({ title: "Não foi possível enviar o ficheiro", description: err instanceof Error ? err.message : "Falha de ligação ao servidor.", variant: "destructive" });
                }
                e.target.value = "";
              }}
            />
          </div>

          <div className="mt-4 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Lembrete de backup (dias)</Label>
            <Input
              type="number"
              step={1}
              min={1}
              defaultValue={s.backupReminderDays}
              onBlur={(e) => save.settings.mutate({ backupReminderDays: Number(e.target.value) || 30 })}
              className="tnum h-9 w-32 text-sm"
              data-testid="input-reminder-days"
            />
          </div>
        </SectionCard>

        <VerifyData />
        <CsvImport />

        </div></TabsContent>
        <TabsContent value="seguranca" className="mt-0"><div className="space-y-4">
        <OfflineSettings />
        <AccessCodeCard
          hasCode={!!(s.accessCode ?? "").trim()}
          onSave={(code) => {
            // o cabeçalho só passa a ter o código novo depois de o servidor o aceitar (com o antigo)
            save.settings.mutate(
              { accessCode: code },
              {
                onError: (e: any) => toast({ title: "Não foi possível guardar o código", description: e?.message, variant: "destructive" }),
                onSuccess: () => {
                  setAccessCode(code);
                  toast({
                    title: code ? "Código de acesso atualizado" : "Código de acesso removido",
                    description: code
                      ? "Vai ser pedido sempre que abrires a aplicação."
                      : "A aplicação deixa de pedir código.",
                  });
                },
              },
            );
          }}
        />


        </div></TabsContent>
        <TabsContent value="historico" className="mt-0"><div className="space-y-4">
        <ChangeHistory />

        </div></TabsContent>
      </Tabs>

      <AlertDialog open={!!previewError} onOpenChange={(o) => !o && setPreviewError("")}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Não foi possível ler este backup</AlertDialogTitle>
            <AlertDialogDescription data-testid="text-import-error">{previewError}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir tudo por este backup?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                Os dados atuais ({data.months.length} meses, {data.parcels.length} parcelas, {data.transactions.length}{" "}
                movimentos) são substituídos por:
              </span>
              {preview?.resumo && (
                <span className="mt-2 block space-y-0.5 font-mono text-xs" data-testid="text-import-preview">
                  <span className="block">{preview.resumo.meses} meses</span>
                  <span className="block">{preview.resumo.movimentos} movimentos</span>
                  <span className="block">{preview.resumo.parcelas} parcelas</span>
                  <span className="block">{preview.resumo.objetivos} parcelas com objetivo definido</span>
                  {preview.exportedAt && <span className="block">Exportado em {new Date(preview.exportedAt).toLocaleString("pt-PT")}</span>}
                </span>
              )}
              <span className="mt-2 block text-xs">
                É feita uma cópia de segurança automática do estado atual antes de substituir.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-import"
              onClick={() => {
                save.importJson.mutate(pending, {
                  onSuccess: () => toast({ title: "Backup restaurado", description: "Substituído tudo (pré-visualização confirmada)." }),
                  onError: () => toast({ title: "Falha ao restaurar", variant: "destructive" }),
                });
                setPending(null);
                setPreview(null);
              }}
            >
              Substituir tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

/** Mostra o número com vírgula (formato português), sem zeros a mais. */
const shown = (v: number) => String(Number(v.toFixed(4))).replace(".", ",");

function Field({
  label,
  value,
  suffix,
  onSave,
}: {
  label: string;
  value: number;
  suffix: string;
  step?: number; // já não é usado: o campo aceita qualquer decimal
  onSave: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          defaultValue={shown(value)}
          onChange={(e) => { if (!isValidDecimalDraft(e.target.value)) e.target.value = e.target.value.slice(0, -1); }}
          onBlur={(e) => {
            // campo vazio, ilegível ou sem alteração não grava (esvaziar não pode virar 0%)
            const n = parseDecimalDraft(e.target.value);
            if (n === null || n === Number(value.toFixed(4))) {
              e.target.value = shown(value);
              return;
            }
            onSave(n);
            e.target.value = shown(n);
          }}
          className="tnum h-9 pr-8 text-sm"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  );
}

function AccessCodeCard({
  hasCode,
  onSave,
}: {
  hasCode: boolean;
  onSave: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const a = code.trim();
    if (a.length < 8) {
      setError("Usa pelo menos 8 caracteres.");
      return;
    }
    if (a !== confirm.trim()) {
      setError("Os dois campos não coincidem.");
      return;
    }
    setError("");
    setCode("");
    setConfirm("");
    onSave(a);
  };

  return (
    <SectionCard
      title="Código de acesso"
      description="Protege o link da aplicação com um código só teu"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground" data-testid="text-access-state">
            {hasCode
              ? "Proteção ativa: o código é pedido sempre que abres a aplicação e nenhum dado é devolvido sem ele."
              : "Sem proteção: quem tiver o link consegue ver e editar os teus dados. Define um código abaixo."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {hasCode ? "Novo código" : "Código"}
              </Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                data-testid="input-new-access-code"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Confirmar</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repete o código"
                data-testid="input-confirm-access-code"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" data-testid="text-access-code-error">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" data-testid="button-save-access-code">
              {hasCode ? "Alterar código" : "Ativar proteção"}
            </Button>
            {hasCode && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setCode("");
                  setConfirm("");
                  setError("");
                  onSave("");
                }}
                data-testid="button-remove-access-code"
              >
                Remover código
              </Button>
            )}
          </div>
        </form>

        <p className="text-xs text-muted-foreground">
          O código fica guardado apenas na aplicação e nunca no browser, por isso é pedido a cada
          abertura. Se o esqueceres, apaga o valor na base de dados para voltar a começar.
        </p>
      </div>
    </SectionCard>
  );
}
