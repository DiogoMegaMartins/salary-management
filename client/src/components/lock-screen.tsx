import { useEffect, useRef, useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/layout";
import { API_BASE } from "@/lib/app";
import { setAccessCode, restoreAccessCode, clearAccessCode } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { hasOffline, unlockOffline } from "@/lib/offline";

type Status = "a-verificar" | "livre" | "bloqueado";

export function AccessGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("a-verificar");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/auth/status`)
      .then((r) => { if (!r.ok) throw new Error("Servidor indisponível."); return r.json(); })
      .then(async (d) => {
        if (!alive) return;
        if (!d?.enabled) return setStatus("livre");
        // tenta retomar a sessão guardada (validada no servidor antes de mostrar dados)
        const saved = restoreAccessCode();
        if (saved) {
          try {
            const r = await fetch(`${API_BASE}/api/auth`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: saved }),
            });
            if (r.ok) {
              if (await hasOffline()) await unlockOffline(saved);
              return alive && setStatus("livre");
            }
          } catch {
            /* sem rede: pede o código */
          }
          clearAccessCode();
        }
        if (alive) setStatus("bloqueado");
      })
      .catch(async (err) => {
        if (!alive) return;
        // falha de rede (fetch rejeita com TypeError) é diferente de o servidor responder com erro
        const rede = err instanceof TypeError;
        setOffline(true);
        const saved = restoreAccessCode();
        if (saved && await unlockOffline(saved)) { if (alive) setStatus("livre"); return; }
        if (alive) {
          setStatus("bloqueado");
          const temCopia = await hasOffline();
          setError(
            rede
              ? temCopia ? "Sem ligação. Usa o código da cópia offline deste dispositivo." : "Sem ligação e sem cópia offline preparada. Liga-te à internet para entrar."
              : temCopia ? "O servidor não respondeu como esperado. Usa o código da cópia offline deste dispositivo." : "O servidor não respondeu como esperado (a tua ligação está bem). Tenta de novo daqui a um minuto.",
          );
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onLock = () => {
      clearAccessCode();
      queryClient.clear();
      setStatus("bloqueado");
    };
    window.addEventListener("sm:locked", onLock);
    return () => window.removeEventListener("sm:locked", onLock);
  }, []);

  useEffect(() => {
    if (status === "bloqueado") inputRef.current?.focus();
  }, [status]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      if (offline || !navigator.onLine) {
        if (!await unlockOffline(code.trim())) { setError("Código incorreto ou cópia offline indisponível."); return; }
        setAccessCode(code.trim());
        queryClient.invalidateQueries();
        setStatus("livre");
        return;
      }
      const res = await fetch(`${API_BASE}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) {
        setError("Código incorreto. Tenta outra vez.");
        setCode("");
        inputRef.current?.focus();
        return;
      }
      setAccessCode(code.trim());
      if (await hasOffline()) await unlockOffline(code.trim());
      queryClient.invalidateQueries();
      setStatus("livre");
    } catch {
      setError("Não foi possível validar o código.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "livre") return <>{children}</>;

  if (status === "a-verificar") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <Logo className="h-7 w-7 text-primary" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Partição</div>
            <div className="text-xs text-muted-foreground">Gestão do salário</div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Lock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold">Espaço privado</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Introduz o código de acesso para ver os teus dados.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <Input
              ref={inputRef}
              type="password"
              inputMode="text"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Código de acesso"
              className="tnum tracking-widest"
              data-testid="input-access-code"
            />
            {error && (
              <p className="text-sm text-destructive" data-testid="text-access-error">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={busy || !code.trim()}
              data-testid="button-unlock"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Entrar
            </Button>
          </form>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          A cópia offline é cifrada com o teu código. Sincroniza e remove a cópia local antes de alterar o código em Segurança.
        </p>
      </div>
    </div>
  );
}
