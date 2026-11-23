import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppState, useSave } from "@/lib/app";
import { useFeatures } from "@/lib/features";
import { localToday } from "@/lib/utils";
import { flowStep, menuStep, type Ctx, type Row, type Step } from "@/components/assistant/flows";

/** Uma entrada da conversa: o passo e, depois de respondido, o que a pessoa respondeu. */
type Turn = { step: Step; answer?: string };

/**
 * Conversa do assistente: desenha os passos de `flows.ts`. Só grava quando a pessoa confirma. A zona da conversa
 * é anunciada ao leitor de ecrã; o foco vai para o primeiro controlo de cada pergunta.
 */
export function AssistantChat({ onClose }: { onClose: () => void }) {
  const { data } = useAppState();
  const save = useSave();
  const features = useFeatures();
  const [, navigate] = useLocation();
  const ctx = (): Ctx => ({ state: data!, save, today: localToday(), features });
  const [trail, setTrail] = useState<Turn[]>(() => [{ step: menuStep({ state: data!, save, today: localToday(), features }) }]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const current = trail[trail.length - 1].step;

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
    (controls.current?.querySelector("input, button") as HTMLElement | null)?.focus();
  }, [trail.length]);

  const advance = (answer: string, next: Step) => {
    setError("");
    setText("");
    setTrail((t) => [...t.slice(0, -1), { ...t[t.length - 1], answer }, { step: next }]);
  };
  const back = () => {
    setError("");
    setText("");
    setTrail((t) => (t.length > 1 ? [...t.slice(0, -2), { step: t[t.length - 2].step }] : t));
  };
  const restart = (step?: Step) => setTrail([{ step: step ?? menuStep(ctx()) }]);

  const submitText = (step: Extract<Step, { kind: "text" }>) => {
    const r = step.parse(text);
    if (!r.ok) return setError(r.error);
    advance(r.label, step.next(r.value));
  };
  const confirm = async (step: Extract<Step, { kind: "confirm" }>) => {
    setBusy(true);
    const result = await step.run();
    setBusy(false);
    advance("Confirmar", result);
  };

  const ask = (s: Step) => (s.kind === "done" ? s.message : s.ask);
  const rowsOf = (s: Step): Row[] | undefined => (s.kind === "confirm" || s.kind === "done" ? s.rows : undefined);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="assistant-chat">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" role="log" aria-live="polite" aria-label="Conversa com o assistente">
        {trail.map((t, i) => (
          <div key={i} className="space-y-2">
            <div className={`max-w-[88%] rounded-2xl rounded-tl-sm border px-3 py-2 text-sm ${t.step.kind === "done" && t.step.tone === "error" ? "border-destructive/40 bg-destructive/5" : "bg-card"}`} data-testid="assistant-bot">
              <p>{ask(t.step)}</p>
              {rowsOf(t.step) && (
                <dl className="mt-2 space-y-0.5 text-sm">
                  {rowsOf(t.step)!.map((r) => (
                    <div key={r.label} className="flex justify-between gap-4"><dt className="text-muted-foreground">{r.label}</dt><dd className="tnum font-medium">{r.value}</dd></div>
                  ))}
                </dl>
              )}
            </div>
            {t.answer && <div className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground" data-testid="assistant-me">{t.answer}</div>}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div ref={controls} className="space-y-2 border-t bg-background px-4 py-3" data-testid="assistant-controls">
        {current.kind === "choices" && (
          <div className="flex flex-wrap gap-2">
            {current.choices.map((c) => (
              <Button key={c.value} variant="outline" className="min-h-10 rounded-full border-primary/60 text-primary" onClick={() => advance(c.label, current.next(c.value, c.label))} data-testid={`assistant-choice-${c.value}`}>
                {c.label}
              </Button>
            ))}
          </div>
        )}
        {current.kind === "text" && (
          <form onSubmit={(e) => { e.preventDefault(); submitText(current); }} className="space-y-1.5">
            <div className="flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                inputMode={current.inputMode}
                placeholder={current.placeholder}
                aria-label={current.ask}
                aria-invalid={!!error}
                aria-describedby={error ? "assistant-error" : undefined}
                className="h-11 flex-1"
                data-testid="assistant-input"
              />
              <Button type="submit" size="icon" className="h-11 w-11" aria-label="Continuar" data-testid="assistant-send"><Send className="h-4 w-4" /></Button>
            </div>
            {error && <p id="assistant-error" role="alert" className="text-xs text-destructive" data-testid="assistant-error">{error}</p>}
          </form>
        )}
        {current.kind === "confirm" && (
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => confirm(current)} data-testid="assistant-confirm">{busy ? "A gravar…" : "Confirmar"}</Button>
            <Button variant="outline" disabled={busy} onClick={back} data-testid="assistant-edit">Editar</Button>
            <Button variant="ghost" disabled={busy} onClick={() => restart()} data-testid="assistant-cancel">Cancelar</Button>
          </div>
        )}
        {current.kind === "done" && (
          <div className="flex flex-wrap gap-2">
            {(current.actions ?? []).map((a) => (
              <Button
                key={a.label}
                variant="outline"
                className="min-h-10 rounded-full border-primary/60 text-primary"
                onClick={() => (a.to ? (navigate(a.to), onClose()) : a.flow ? restart(flowStep(a.flow, ctx())) : restart())}
                data-testid={a.to ? "assistant-action-open" : a.flow ? `assistant-action-${a.flow}` : "assistant-action-home"}
              >{a.label}</Button>
            ))}
          </div>
        )}
        {trail.length > 1 && current.kind !== "confirm" && current.kind !== "done" && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={back} data-testid="assistant-back">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar atrás
          </Button>
        )}
      </div>
    </div>
  );
}
