import { useEffect, useMemo, useRef, useState } from "react";
import GridLayout, { type Layout } from "react-grid-layout";
import { GripVertical, RotateCcw, Save, X } from "lucide-react";
import { layoutEditor } from "@/lib/layout-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { normalizeSectionGeometry, shouldStackSections } from "@/lib/layout-geometry";

export type SectionSpec = {
  /** Identificador estável da secção (não muda entre versões da página). */
  id: string;
  title: string;
  /** Posição/tamanho por omissão em unidades de grid (12 colunas). */
  defaultLayout: { x: number; y: number; w: number; h: number };
  node: React.ReactNode;
  /** Tamanho mínimo em unidades de grid (por omissão 3 × 4). Cartões pequenos, como os KPIs, usam 3 × 3. */
  minW?: number;
  minH?: number;
  /**
   * Secções seguidas com o mesmo `group` aparecem juntas, dentro de um contentor com `groupClass`, quando não há
   * layout personalizado (ex.: a fila de KPIs mantém a sua grelha responsiva). Em edição cada cartão move-se sozinho.
   */
  group?: string;
  groupClass?: string;
  /**
   * Altura máxima (unidades de grid) a mostrar enquanto o cartão está vazio. Só vale fora do modo de edição:
   * o layout guardado não muda e o cartão volta ao tamanho escolhido quando tiver conteúdo.
   */
  collapsedH?: number;
};

export type PageLayoutMap = Record<string, { x: number; y: number; w: number; h: number }>;

function toRglLayout(sections: SectionSpec[], saved: PageLayoutMap | undefined): Layout {
  return sections.map((s) => {
    const min = { w: s.minW ?? 3, h: s.minH ?? 4 };
    const l = normalizeSectionGeometry(saved?.[s.id], s.defaultLayout, min);
    return { i: s.id, x: l.x, y: l.y, w: l.w, h: l.h, minW: min.w, minH: min.h };
  });
}

/** Pilha normal (sem grid): as secções do mesmo grupo ficam juntas no contentor do grupo. */
function renderStack(list: SectionSpec[]) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < list.length; ) {
    const s = list[i];
    if (!s.group) {
      out.push(<div key={s.id} className="min-w-0">{s.node}</div>);
      i++;
      continue;
    }
    let j = i;
    while (j < list.length && list[j].group === s.group) j++;
    out.push(
      <div key={`group-${s.group}-${s.id}`} className={s.groupClass}>
        {list.slice(i, j).map((x) => <div key={x.id} className="min-w-0 *:h-full">{x.node}</div>)}
      </div>,
    );
    i = j;
  }
  return out;
}

function onLayoutRequest(onRequest: (request: number) => void) {
  return layoutEditor.subscribe(() => onRequest(layoutEditor.getState().request));
}

function useContainerWidth(active: boolean) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const ref = (node: HTMLDivElement | null) => setEl(node);
  useEffect(() => {
    if (!active || !el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    obs.observe(el);
    setWidth(el.clientWidth);
    return () => obs.disconnect();
  }, [active, el]);
  return { ref, width };
}

/**
 * SM-012: grelha de secções com modo de edição opcional (arrastar para mover,
 * arrastar o canto para redimensionar). Fora do modo de edição, as secções
 * aparecem numa pilha normal (sem grid), preservando o layout responsivo
 * habitual das páginas. O layout escolhido é guardado via `onSave` (patch
 * para `settings.pageLayouts`) e persiste entre sessões.
 */
export function EditableSectionGrid({
  pageKey,
  sections,
  savedLayout,
  onSave,
  isSaving,
}: {
  pageKey: string;
  sections: SectionSpec[];
  savedLayout: PageLayoutMap | undefined;
  onSave: (layout: PageLayoutMap) => void;
  isSaving?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const isMobile = useIsMobile();
  // o botão "Editar layout" está no cabeçalho: regista-se enquanto esta grelha existe e reage aos pedidos
  const lastRequest = useRef(layoutEditor.getState().request);
  useEffect(() => {
    layoutEditor.setAvailable(true);
    return () => layoutEditor.setAvailable(false);
  }, []);
  useEffect(() => {
    layoutEditor.setEditing(editing);
  }, [editing]);
  const [draft, setDraft] = useState<Layout | null>(null);
  const { ref, width } = useContainerWidth(true);
  const isCompact = isMobile || shouldStackSections(width);

  const initialLayout = useMemo(() => toRglLayout(sections, savedLayout), [sections, savedLayout]);
  const initialLayoutRef = useRef(initialLayout);
  initialLayoutRef.current = initialLayout;
  const activeLayout = draft ?? initialLayout;
  // cartões vazios encolhem na vista normal; os de baixo sobem (compactação vertical da grelha)
  const viewLayout = useMemo(
    () => initialLayout.map((l) => {
      const c = sections.find((s) => s.id === l.i)?.collapsedH;
      return c ? { ...l, h: Math.min(l.h, Math.max(c, l.minH ?? 0)), minH: Math.min(l.minH ?? c, c) } : l;
    }),
    [initialLayout, sections],
  );
  const hasCustomLayout = !!savedLayout && Object.keys(savedLayout).length > 0;
  const stackedLayout = useMemo(() => {
    let y = 0;
    return [...activeLayout].sort((a, b) => a.y - b.y || a.x - b.x).map((l) => {
      const spec = sections.find((s) => s.id === l.i);
      const item = { ...l, x: 0, y, w: 12, h: spec?.group ? Math.max(spec.minH ?? 3, l.h) : Math.max(10, l.h) };
      y += item.h;
      return item;
    });
  }, [activeLayout, sections]);
  const mobileSections = useMemo(() => [...sections].sort((a, b) => {
    const ai = initialLayout.find((l) => l.i === a.id)!;
    const bi = initialLayout.find((l) => l.i === b.id)!;
    return ai.y - bi.y || ai.x - bi.x;
  }), [sections, initialLayout]);

  // pedido vindo do botão do cabeçalho
  useEffect(() => {
    return onLayoutRequest((request) => {
      if (request === lastRequest.current) return;
      lastRequest.current = request;
      setDraft(initialLayoutRef.current);
      setEditing(true);
    });
  }, []);

  if (!editing) {
    return (
      <div className="space-y-4">
        <div ref={ref}>
          {hasCustomLayout && width > 0 && !isCompact ? (
            <GridLayout
              width={width}
              layout={viewLayout}
              gridConfig={{ cols: 12, rowHeight: 28, margin: [16, 16], containerPadding: null, maxRows: Infinity }}
              dragConfig={{ enabled: false }}
              resizeConfig={{ enabled: false }}
              autoSize
            >
              {sections.map((s) => (
                <div key={s.id} className="grid-widget h-full min-w-0 overflow-hidden">
                  {s.node}
                </div>
              ))}
            </GridLayout>
          ) : (
            <div className="space-y-4">{renderStack(isCompact ? mobileSections : sections)}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
        <span className="flex items-center gap-1.5 text-primary">
          <GripVertical className="h-4 w-4" />
          {isCompact ? "Layout empilhado: arrasta a barra para mover e usa o canto para redimensionar. Guardar aplica este layout também no computador." : "Modo de edição: arrasta para mover, usa o canto para redimensionar."}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {hasCustomLayout && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={() => setDraft(toRglLayout(sections, undefined))}
              data-testid={`button-reset-layout-${pageKey}`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Repor
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              setEditing(false);
              setDraft(null);
            }}
            data-testid={`button-cancel-layout-${pageKey}`}
          >
            <X className="h-3.5 w-3.5" />
            Cancelar
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={isSaving}
            onClick={() => {
              const map: PageLayoutMap = {};
              for (const l of isCompact ? stackedLayout : activeLayout) map[l.i] = { x: l.x, y: l.y, w: l.w, h: l.h };
              onSave(map);
              setEditing(false);
              setDraft(null);
            }}
            data-testid={`button-save-layout-${pageKey}`}
          >
            <Save className="h-3.5 w-3.5" />
            Guardar layout
          </Button>
        </div>
      </div>

      <div ref={ref}>
        {width > 0 && (
          <GridLayout
            width={width}
            layout={isCompact ? stackedLayout : activeLayout}
            gridConfig={{ cols: 12, rowHeight: 28, margin: [16, 16], containerPadding: null, maxRows: Infinity }}
            dragConfig={{ enabled: true, handle: ".section-drag-handle" }}
            resizeConfig={{ enabled: true }}
            onLayoutChange={(l) => setDraft(l)}
            autoSize
          >
            {sections.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "flex h-full flex-col overflow-hidden rounded-lg border-2 border-dashed border-primary/40 bg-background",
                )}
              >
                <div className={cn("section-drag-handle flex min-h-11 cursor-grab touch-none items-center gap-1.5 border-dashed border-primary/40 bg-primary/5 px-2 py-1 text-xs text-primary active:cursor-grabbing", s.group ? "flex-1" : "border-b")}>
                  <GripVertical className="h-3.5 w-3.5 shrink-0" />
                  {s.title}
                </div>
                {!s.group && (
                  <div className="min-h-0 flex-1 overflow-auto p-2">
                    <div className="grid-widget pointer-events-none h-full opacity-95">{s.node}</div>
                  </div>
                )}
              </div>
            ))}
          </GridLayout>
        )}
      </div>
    </div>
  );
}
