import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionCard } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/confirm";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { errMsg } from "@/components/catalogs";
import { useAppState } from "@/lib/app";
import { parseCsv } from "@shared/evo08";

const NONE = "-1";

/** Versão e ambiente da aplicação. */
export function AppInfo() {
  const q = useQuery<any>({ queryKey: ["/api/app-info"], staleTime: 60000 });
  if (!q.data) return null;
  return (
    <p className="text-xs text-muted-foreground" data-testid="app-info">
      Versão {q.data.version} · ambiente: {q.data.environment} · formato de backup v{q.data.schemaVersion}
    </p>
  );
}

/** Verificar dados: erros bloqueantes e avisos informativos; nunca corrige valores sozinho. */
export function VerifyData() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useQuery<any>({ queryKey: ["/api/verify"], staleTime: 0, enabled: false });
  const [ran, setRan] = useState(false);
  const run = async () => { try { await q.refetch(); setRan(true); } catch (e) { toast({ title: "Não foi possível verificar", description: errMsg(e), variant: "destructive" }); } };
  const issues: any[] = q.data?.issues ?? [];
  const errs = issues.filter((i) => i.severity === "erro");
  const warns = issues.filter((i) => i.severity === "aviso");
  void qc;
  return (
    <SectionCard title="Verificar dados" description="Procura inconsistências sem alterar nada. Os erros bloqueiam o fecho fiável; os avisos são informativos.">
      <div className="space-y-3" data-testid="verify-data">
        <Button size="sm" onClick={run} disabled={q.isFetching} data-testid="button-verify">{q.isFetching ? "A verificar…" : "Verificar dados"}</Button>
        {ran && issues.length === 0 && <p className="text-sm text-primary" data-testid="verify-ok">Sem problemas encontrados.</p>}
        {ran && issues.length > 0 && (
          <div className="space-y-2 text-sm" data-testid="verify-result">
            <p><span className="font-medium text-destructive">{errs.length} erro(s)</span> · <span className="font-medium text-amber-600">{warns.length} aviso(s)</span></p>
            <ul className="space-y-1.5">
              {[...errs, ...warns].slice(0, 100).map((i, k) => (
                <li key={k} className={`rounded-md border p-2 ${i.severity === "erro" ? "border-destructive/40" : "border-amber-500/40"}`} data-testid={`issue-${i.code}`}>
                  <p><span className="font-medium">{i.severity === "erro" ? "Erro" : "Aviso"}</span> · {i.where}: {i.message}</p>
                  <p className="text-xs text-muted-foreground">Sugestão: {i.fix}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

/** Histórico de alterações financeiras relevantes. */
export function ChangeHistory() {
  const q = useQuery<any[]>({ queryKey: ["/api/change-log"], staleTime: 0, enabled: false });
  const [shown, setShown] = useState(false);
  return (
    <SectionCard title="Histórico de alterações" description="Registo das alterações financeiras relevantes (movimentos, alocações, fechos, importações).">
      <div className="space-y-2">
        <Button size="sm" variant="outline" onClick={() => { setShown(true); q.refetch(); }} data-testid="button-history">Ver histórico</Button>
        {shown && (q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem registos.</p>}
        {shown && (q.data ?? []).length > 0 && (
          <ul className="max-h-72 space-y-1 overflow-y-auto text-xs" data-testid="history-list">
            {(q.data ?? []).slice(0, 200).map((l) => (
              <li key={l.id} className="border-b border-border/50 pb-1"><span className="text-muted-foreground">{l.at.slice(0, 16).replace("T", " ")}</span> · {l.entity} · {l.action}{l.summary ? ` · ${l.summary}` : ""}</li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}

/** Importação CSV: ficheiro, mapeamento, pré-visualização, erros por linha e confirmação. */
export function CsvImport() {
  const { data } = useAppState();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { ask, dialog } = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [header, setHeader] = useState<string[]>([]);
  const [map, setMap] = useState({ date: "0", amount: "1", category: NONE, note: NONE });
  const [parcel, setParcel] = useState("");
  const [allowPos, setAllowPos] = useState(false);
  const [pv, setPv] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const parcels = (data?.parcels ?? []).filter((p) => !p.archived);
  const mapping = () => ({ date: Number(map.date), amount: Number(map.amount), ...(map.category !== NONE ? { category: Number(map.category) } : {}), ...(map.note !== NONE ? { note: Number(map.note) } : {}) });
  const fail = (title: string) => (e: unknown) => toast({ title, description: errMsg(e), variant: "destructive" });

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast({ title: "Ficheiro demasiado grande (máx. 5 MB)", variant: "destructive" });
    const t = await f.text();
    const rows = parseCsv(t).rows;
    setText(t); setName(f.name); setHeader(rows[0] ?? []); setPv(null); setDone(null);
    const find = (re: RegExp, d: string) => { const i = (rows[0] ?? []).findIndex((c) => re.test(c)); return i >= 0 ? String(i) : d; };
    setMap({ date: find(/data|date/i, "0"), amount: find(/montante|valor|amount/i, "1"), category: find(/categ/i, NONE), note: find(/descri|nota|note|memo/i, NONE) });
  };
  const preview = async () => {
    setBusy(true);
    try { setPv(await (await apiRequest("POST", "/api/import/csv/preview", { text, mapping: mapping(), hasHeader: true, allowPositive: allowPos })).json()); }
    catch (e) { fail("Não foi possível pré-visualizar")(e); } finally { setBusy(false); }
  };
  const doImport = async (force = false) => {
    if (busy) return;
    if (!(await ask(`Importar ${pv.summary.validas} movimento(s) como despesas${force ? " (ficheiro já importado antes)" : ""}? Linhas duplicadas e com erro não são importadas.`))) return;
    setBusy(true);
    try {
      const r = await (await apiRequest("POST", "/api/import/csv", { text, mapping: mapping(), hasHeader: true, allowPositive: allowPos, parcelId: Number(parcel), force, fileName: name })).json();
      setDone(`${r.imported} movimento(s) importado(s).`); setPv(null); setText("");
      qc.invalidateQueries({ queryKey: ["/api/state"] });
      toast({ title: "Importação concluída" });
    } catch (e) { fail("Não foi possível importar")(e); } finally { setBusy(false); }
  };
  const colOpts = header.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `Coluna ${i + 1}`}</SelectItem>);
  const sel = (k: keyof typeof map, label: string, optional = false) => (
    <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={map[k]} onValueChange={(v) => { setMap({ ...map, [k]: v }); setPv(null); }}>
        <SelectTrigger className="h-9 text-xs" data-testid={`csv-map-${k}`}><SelectValue /></SelectTrigger>
        <SelectContent>{optional && <SelectItem value={NONE}>(não usar)</SelectItem>}{colOpts}</SelectContent>
      </Select></div>
  );
  return (
    <SectionCard title="Importar CSV" description="Importa despesas de um extrato CSV. Datas DD/MM/AAAA ou AAAA-MM-DD; montantes como 1.234,56 ou 1234.56.">
      {dialog}
      <div className="space-y-3 text-sm" data-testid="csv-import">
        <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} data-testid="input-csv-file" />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} data-testid="button-csv-choose">{name || "Escolher ficheiro CSV"}</Button>
        {text && (
          <>
            <div className="grid gap-2 sm:grid-cols-4">{sel("date", "Coluna da data")}{sel("amount", "Coluna do montante")}{sel("category", "Categoria", true)}{sel("note", "Descrição", true)}</div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Parcela de destino</Label>
                <Select value={parcel} onValueChange={setParcel}><SelectTrigger className="h-9 text-xs" data-testid="csv-parcel"><SelectValue placeholder="Escolher parcela" /></SelectTrigger><SelectContent>{parcels.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={allowPos} onChange={(e) => { setAllowPos(e.target.checked); setPv(null); }} />Aceitar montantes positivos como despesas</label>
            </div>
            <Button size="sm" onClick={preview} disabled={busy} data-testid="button-csv-preview">Pré-visualizar</Button>
          </>
        )}
        {pv && (
          <div className="space-y-2" data-testid="csv-preview">
            <p data-testid="csv-summary">{pv.summary.total} linha(s): <b>{pv.summary.validas}</b> a importar · <b className="text-destructive">{pv.summary.erros}</b> com erro · <b className="text-amber-600">{pv.summary.duplicadas}</b> duplicada(s).</p>
            {pv.alreadyImported && <p className="text-amber-600" data-testid="csv-already">Este ficheiro já foi importado antes.</p>}
            <ul className="max-h-60 space-y-0.5 overflow-y-auto text-xs">
              {pv.results.filter((r: any) => !r.ok || r.duplicate).slice(0, 100).map((r: any) => (
                <li key={r.line} className={r.ok ? "text-amber-600" : "text-destructive"}>Linha {r.line}: {r.ok ? `possível duplicado (${r.duplicate === "ficheiro" ? "no ficheiro" : "já existe"})` : r.errors.join("; ")}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy || !parcel || pv.summary.erros > 0 || pv.summary.validas === 0 || pv.alreadyImported} onClick={() => doImport(false)} data-testid="button-csv-import">Importar {pv.summary.validas}</Button>
              {pv.alreadyImported && <Button size="sm" variant="outline" disabled={busy || !parcel || pv.summary.erros > 0} onClick={() => doImport(true)}>Importar mesmo assim</Button>}
            </div>
            {!parcel && <p className="text-xs text-muted-foreground">Escolhe a parcela de destino para importar.</p>}
          </div>
        )}
        {done && <p className="text-primary" role="status" data-testid="csv-done">{done}</p>}
      </div>
    </SectionCard>
  );
}
