import { useEffect, useState } from "react";
import { enableOffline, offlineInfo, syncOffline, forgetOffline, exportOffline, reviewConflict, applyReviewedConflict, type ConflictReview } from "@/lib/offline";
import { getAccessCode } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function OfflineStatus() {
  const [info, setInfo] = useState(offlineInfo);
  const [review, setReview] = useState<ConflictReview | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const update = () => setInfo(offlineInfo());
    window.addEventListener("sm:offline", update);
    return () => window.removeEventListener("sm:offline", update);
  }, []);
  if (!info.enabled && info.online) return null;
  return <div className="flex flex-wrap items-center gap-2 text-xs" role="status" data-testid="offline-status">
    <span>{!info.online ? "Sem internet" : info.syncing ? "A sincronizar…" : info.count ? "Guardado neste dispositivo" : "Sincronizado"}
      {info.count > 0 ? ` · ${info.count} alterações por sincronizar` : ""}</span>
    {info.at && <span className="text-muted-foreground">Cópia: {new Date(info.at).toLocaleString("pt-PT")}</span>}
    {info.count > 0 && <Button variant="outline" size="sm" disabled={!info.online || info.syncing} onClick={() => void syncOffline()} data-testid="button-sync">Sincronizar agora</Button>}
    {info.conflict && <Button variant="outline" size="sm" disabled={!info.online || busy} data-testid="button-review-conflict" onClick={async () => { setReviewError(""); try { setReview(await reviewConflict()); } catch (e: any) { setReviewError(e.message); } }}>Rever conflito</Button>}
    {info.error && <span className="w-full text-destructive" role="alert">{info.error}</span>}
    {reviewError && <span className="w-full text-destructive" role="alert">{reviewError}</span>}
    <Dialog open={!!review} onOpenChange={open => !open && setReview(null)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Rever alterações em conflito</DialogTitle><DialogDescription>O servidor mudou desde a cópia offline. Compara os valores abaixo. Ao confirmar, só os campos listados recebem os valores locais; as restantes alterações do servidor são mantidas. Meses fechados continuam protegidos.</DialogDescription></DialogHeader>
        <div className="space-y-3" data-testid="conflict-review">
          {review?.operations.map((op, i) => {
            const parts = op.url.split("/");
            const monthId = op.data.monthId ?? Number(parts[3]);
            const month = review.state.months.find((m: any) => m.id === monthId);
            const parcel = review.state.parcels.find((p: any) => p.id === op.data.parcelId || p.id === Number(parts[5]));
            let server: any = "Nova despesa (será adicionada uma vez)";
            if (op.method === "PATCH") server = Object.fromEntries(Object.keys(op.data).map(k => [k, month?.[k]]));
            else if (op.url === "/api/allocations") {
              const a = review.state.allocations.find((a: any) => a.monthId === monthId && a.parcelId === op.data.parcelId);
              server = { mode: a?.mode, value: a?.value };
            } else if (op.url.includes("/distribution")) {
              const a = review.state.allocations.find((a: any) => a.monthId === monthId && a.parcelId === Number(parts[5]));
              server = (parts[8] === "assets" ? review.state.allocationAssets : review.state.allocationPlatforms).filter((x: any) => x.allocationId === a?.id && (parts[8] !== "assets" || x.platformId === Number(parts[7])));
            }
            return <section key={i} className="space-y-2 rounded border border-border p-3 text-xs">
              <h3 className="font-semibold">{month?.label} {month?.year}{parcel ? ` · ${parcel.name}` : ""}</h3>
              <p className="break-words">Servidor: {JSON.stringify(server)}</p>
              <p className="break-words">Alteração local: {JSON.stringify(op.data)}</p>
            </section>;
          })}
        </div>
        <p className="text-xs text-muted-foreground">Exporta uma cópia antes de decidir. Se o servidor voltar a mudar, a sincronização será novamente bloqueada.</p>
        {reviewError && <p role="alert" className="text-sm text-destructive">{reviewError}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={exportOffline}>Exportar cópia</Button>
          <Button variant="ghost" onClick={() => setReview(null)}>Cancelar</Button>
          <Button disabled={busy} data-testid="button-apply-conflict" onClick={async () => {
            if (!review) return; setBusy(true); setReviewError("");
            try { await applyReviewedConflict(review); setReview(null); } catch (e: any) { setReviewError(e.message); }
            finally { setBusy(false); }
          }}>{busy ? "A aplicar…" : "Aplicar valores locais listados"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
export function OfflineSettings() {
  const [info, setInfo] = useState(offlineInfo);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const update = () => setInfo(offlineInfo()); window.addEventListener("sm:offline", update); return () => window.removeEventListener("sm:offline", update); }, []);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setMessage(""); try { await fn(); } catch (e: any) { setMessage(e.message); } finally { setBusy(false); } };
  return <section className="space-y-3 rounded-lg border border-border bg-card p-4" data-testid="offline-settings">
    <h2 className="text-base font-semibold">Aplicação no telemóvel e offline</h2>
    <p className="text-sm text-muted-foreground">Ativa neste dispositivo para consultar os dados, editar vencimentos e divisões de meses existentes, distribuir por plataformas e ativos, e registar despesas sem internet. Fechar/reabrir meses, criar meses, catálogos e outros movimentos exigem ligação.</p>
    <p className="text-xs text-muted-foreground">Usa um código forte de pelo menos 8 caracteres. A cópia local é cifrada; não substitui um backup. Para instalar, abre o endereço próprio da aplicação e escolhe “Adicionar ao ecrã principal” no navegador. A pré-visualização incorporada pode não permitir instalação ou armazenamento.</p>
    <div className="flex flex-wrap gap-2">
      {!info.enabled ? <Button disabled={busy} onClick={() => void run(() => enableOffline(getAccessCode()))} data-testid="button-enable-offline">{busy ? "A preparar…" : "Preparar este dispositivo"}</Button> : <>
        <Button disabled={busy || !info.online || info.syncing} onClick={() => void run(syncOffline)} data-testid="button-settings-sync">Sincronizar agora</Button>
        <Button variant="outline" onClick={exportOffline} data-testid="button-export-offline">Exportar cópia e alterações</Button>
        <Button variant="ghost" disabled={busy || info.count > 0} onClick={() => void run(forgetOffline)} data-testid="button-remove-offline">Remover cópia deste dispositivo</Button>
      </>}
    </div>
    {info.enabled && <p className="text-xs text-muted-foreground">Dispositivo preparado. {info.count} alterações pendentes. A sincronização recusa conflitos e preserva a cópia local para revisão.</p>}
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
  </section>;
}
