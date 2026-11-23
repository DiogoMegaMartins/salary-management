import { computeMonth, MONTH_NAMES, allocationAmount, availableOf, fmtEur } from "@shared/calc";
import { editableMonthPatch } from "@shared/month-patch";
import { divisionStatus, planLeftover, type LeftoverPart } from "@shared/division";
import { latestOpenMonth, monthOfDate, parseAmount, parseDate, shiftDate, targetMonth } from "@shared/assistant";
import type { Month } from "@shared/schema";
import type { AppState, useSave } from "@/lib/app";
import { blankMonth } from "@/lib/new-month";
import { errMsg } from "@/components/catalogs";
import type { FeatureKey } from "@shared/features";
import type { Intent } from "@shared/ai-intent";

/* Fluxos do assistente: descrições de passos, sem interface. A interface (assistant-chat) só os desenha. */

export type Row = { label: string; value: string };
type Parsed<T> = { ok: true; value: T; label: string } | { ok: false; error: string };

export type Step =
  | { kind: "choices"; ask: string; choices: { label: string; value: string }[]; next: (value: string, label: string) => Step }
  | { kind: "text"; ask: string; placeholder: string; inputMode?: "decimal" | "text"; parse: (text: string) => Parsed<unknown>; next: (value: any) => Step }
  | { kind: "confirm"; ask: string; rows: Row[]; run: () => Promise<Step> }
  | { kind: "done"; message: string; rows?: Row[]; tone?: "error"; actions?: { label: string; to?: string; flow?: "despesa" }[] };

export type Ctx = {
  state: AppState;
  save: ReturnType<typeof useSave>;
  today: string;
  features: Record<FeatureKey, boolean>;
};

const monthName = (m: { year: number; month: number }) => `${MONTH_NAMES[m.month - 1]} ${m.year}`;
const showDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const home = { label: "Voltar ao início" };
const fail = (e: unknown): Step => ({ kind: "done", tone: "error", message: `Não foi possível gravar: ${errMsg(e)}`, actions: [home] });

/** Começa uma tarefa pelo nome (usado pelos botões do fim de uma tarefa). */
export function flowStep(name: "despesa", ctx: Ctx): Step {
  return despesaFlow(ctx);
}

/**
 * Entra no fluxo guiado a partir do que a IA percebeu da frase (já validado). Os campos em falta continuam a ser
 * perguntados e o cartão de confirmação é o mesmo: a IA nunca grava.
 */
export function stepFromIntent(intent: Intent, ctx: Ctx): Step {
  const f = ctx.features;
  const desligada = (on: boolean): Step | null => (on ? null : { kind: "done", message: "Essa tarefa está desligada em Definições › Funcionalidades.", actions: [home] });
  switch (intent.task) {
    case "mes": return mesFlow(ctx, intent.amount);
    case "despesa": return desligada(f.movimentos) ?? despesaFlow(ctx, { amount: intent.amount, category: intent.category, date: intent.date });
    case "sobra": return desligada(f.divisao) ?? sobraFlow(ctx);
    case "resumo": return desligada(f.divisao || f.movimentos) ?? resumoFlow(ctx);
    default: return { kind: "done", message: "Não percebi o que queres fazer. Escolhe uma das tarefas, ou escreve de outra maneira.", actions: [home] };
  }
}

/** Início: só mostra as tarefas cujas funcionalidades estão ligadas. */
export function menuStep(ctx: Ctx): Step {
  const f = ctx.features;
  const choices = [
    { label: "Registar o mês", value: "mes" },
    ...(f.movimentos ? [{ label: "Registar uma despesa", value: "despesa" }] : []),
    ...(f.divisao ? [{ label: "Distribuir o que sobra", value: "sobra" }] : []),
    ...(f.divisao || f.movimentos ? [{ label: "Como estou este mês?", value: "resumo" }] : []),
  ];
  return {
    kind: "choices",
    ask: "Olá! O que queres fazer?",
    choices,
    next: (v) => ({ mes: mesFlow, despesa: despesaFlow, sobra: sobraFlow, resumo: resumoFlow } as Record<string, (c: Ctx) => Step>)[v](ctx),
  };
}

/* ------------------------------------------------------------ registar o mês */

function mesFlow(ctx: Ctx, preAmount?: number): Step {
  const { state, save, today } = ctx;
  const t = targetMonth(state.months, today);
  const name = monthName(t);
  const confirmBase = (base: number): Step => {
      const month = t.existing ? ({ ...t.existing, base } as Month) : blankMonth(state.settings, t.year, t.month, base);
      const c = computeMonth(month, [], [], state.settings);
      return {
        kind: "confirm",
        ask: "Vou registar:",
        rows: [
          { label: "Mês", value: name },
          { label: "Vencimento base (bruto)", value: fmtEur(base) },
          { label: "Líquido calculado", value: fmtEur(c.net) },
          { label: "Disponível", value: fmtEur(c.available) },
          { label: "Divisão", value: t.existing ? "Mantém a que já tens" : "Com o modelo das parcelas (se houver)" },
        ],
        run: async () => {
          try {
            let id: number;
            if (t.existing) {
              await save.month.mutateAsync({ id: t.existing.id, patch: { base } });
              id = t.existing.id;
              const hasDivision = state.allocations.some((a) => a.monthId === id && a.value !== 0);
              if (!hasDivision && ctx.features.divisao) await save.applyRules.mutateAsync(id);
            } else {
              const created = await save.createMonth.mutateAsync(editableMonthPatch(month) as Partial<Month>);
              id = created.id;
            }
            return {
              kind: "done",
              message: `${name} registado.`,
              actions: [...(ctx.features.divisao ? [{ label: "Abrir a Divisão", to: `/divisao/${id}` }] : []), home],
            };
          } catch (e) {
            return fail(e);
          }
        },
      };
  };
  if (preAmount != null) return confirmBase(preAmount);
  return {
    kind: "text",
    ask: `Qual é o vencimento base (bruto) de ${name}? A app calcula o líquido.`,
    placeholder: "Ex.: 1450 ou 1 450,50",
    inputMode: "decimal",
    parse: (text) => {
      const v = parseAmount(text);
      return v == null ? { ok: false, error: "Não percebi o valor. Escreve só o número, por exemplo 1450 ou 1 450,50." } : { ok: true, value: v, label: fmtEur(v) };
    },
    next: confirmBase,
  };
}

/* ---------------------------------------------------------- registar despesa */

/** Despesa; com `pre` (vindo da IA, já validado) salta as perguntas já respondidas. */
function despesaFlow(ctx: Ctx, pre?: { amount?: number; category?: string; date?: string }): Step {
  const { state, save, today } = ctx;
  const afterAmount = (value: number): Step => {
      const cats = (state.categories ?? []).filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)).slice(0, 6);
      const afterCategory = (category: string, isNew: boolean): Step => (pre?.date ? confirmar(category, isNew, pre.date) : {
        kind: "choices",
        ask: "Quando foi?",
        choices: [{ label: "Hoje", value: "hoje" }, { label: "Ontem", value: "ontem" }, { label: "Outra data…", value: "outra" }],
        next: (v) => (v === "outra" ? askDate(category, isNew) : confirmar(category, isNew, v === "hoje" ? today : shiftDate(today, -1))),
      });
      const askDate = (category: string, isNew: boolean): Step => ({
        kind: "text",
        ask: "Em que data? Escreve, por exemplo, 22/11 ou 22/11/2026.",
        placeholder: "dd/mm ou dd/mm/aaaa",
        parse: (text) => {
          const d = parseDate(text, today);
          return d ? { ok: true, value: d, label: showDate(d) } : { ok: false, error: "Não percebi a data. Usa o formato 22/11 ou 22/11/2026." };
        },
        next: (d: string) => confirmar(category, isNew, d),
      });
      const confirmar = (category: string, isNew: boolean, date: string): Step => {
        const month = monthOfDate(state.months, date);
        if (!month)
          return { kind: "done", tone: "error", message: `Não existe o mês ${date.slice(5, 7)}/${date.slice(0, 4)}. Regista esse mês primeiro.`, actions: [home] };
        if (month.status === "fechado")
          return { kind: "done", tone: "error", message: `${monthName(month)} está fechado. Reabre-o em Fecho e planeamento para registar despesas.`, actions: [home] };
        return {
          kind: "confirm",
          ask: "Vou registar:",
          rows: [
            { label: "Despesa", value: fmtEur(value) },
            { label: "Categoria", value: isNew ? `${category} (nova)` : category },
            { label: "Data", value: showDate(date) },
            { label: "Mês", value: monthName(month) },
          ],
          run: async () => {
            try {
              if (isNew) await save.createCategory.mutateAsync({ name: category });
              await save.createTransaction.mutateAsync({ monthId: month.id, date, type: "expense", value, category, note: "" });
              return { kind: "done", message: `Despesa de ${fmtEur(value)} registada em ${category}.`, actions: [{ label: "Registar outra despesa", flow: "despesa" }, home] };
            } catch (e) {
              return fail(e);
            }
          },
        };
      };
      if (pre?.category) {
        const same = (state.categories ?? []).find((c) => c.name.trim().toLowerCase() === pre.category!.toLowerCase());
        return afterCategory(same ? same.name : pre.category, !same);
      }
      return {
        kind: "choices",
        ask: "Em que categoria?",
        choices: [...cats.map((c) => ({ label: c.name, value: `c:${c.name}` })), { label: "Outra…", value: "outra" }],
        next: (v) =>
          v === "outra"
            ? {
                kind: "text",
                ask: "Como se chama a categoria nova?",
                placeholder: "Ex.: Saúde",
                parse: (text) => {
                  const n = text.trim();
                  if (!n) return { ok: false, error: "Escreve um nome para a categoria." };
                  if (n.length > 60) return { ok: false, error: "O nome é demasiado grande (máximo 60 letras)." };
                  const same = (state.categories ?? []).find((c) => c.name.trim().toLowerCase() === n.toLowerCase());
                  return { ok: true, value: same ? same.name : n, label: same ? same.name : n };
                },
                next: (name: string) => afterCategory(name, !(state.categories ?? []).some((c) => c.name === name)),
              }
            : afterCategory(v.slice(2), false),
      };
  };
  if (pre?.amount != null) return afterAmount(pre.amount);
  return {
    kind: "text",
    ask: "Qual foi o valor?",
    placeholder: "Ex.: 40 ou 12,99",
    inputMode: "decimal",
    parse: (text) => {
      const v = parseAmount(text);
      return v == null ? { ok: false, error: "Não percebi o valor. Escreve só o número, por exemplo 40 ou 12,99." } : { ok: true, value: v, label: fmtEur(v) };
    },
    next: afterAmount,
  };
}

/* ------------------------------------------------------ distribuir o que sobra */

function divisionOf(ctx: Ctx) {
  const month = latestOpenMonth(ctx.state.months);
  if (!month) return null;
  const available = availableOf(month, ctx.state.settings);
  const parcels = ctx.state.parcels.filter((p) => !p.archived).sort((a, b) => a.sortOrder - b.sortOrder);
  const rows = parcels.map((p) => {
    const a = ctx.state.allocations.find((x) => x.monthId === month.id && x.parcelId === p.id);
    const included = (a?.included ?? 1) !== 0;
    const mode = a?.mode ?? p.defaultMode;
    const amount = included ? allocationAmount({ mode, value: a?.value ?? 0 } as any, available) : 0;
    return { p, included, mode, amount };
  });
  const allocated = rows.reduce((s, r) => s + r.amount, 0);
  return { month, available, rows, allocated, ...divisionStatus(available, allocated) };
}

function sobraFlow(ctx: Ctx): Step {
  const d = divisionOf(ctx);
  if (!d) return { kind: "done", message: "Ainda não há nenhum mês aberto. Começa por registar o mês.", actions: [home] };
  const name = monthName(d.month);
  if (d.status === "completo") return { kind: "done", message: `${name}: já está tudo distribuído.`, actions: [home] };
  if (d.status === "excede") return { kind: "done", tone: "error", message: `${name}: a divisão excede o disponível em ${fmtEur(-d.remaining)}. Corrige-a na Divisão.`, actions: [{ label: "Abrir a Divisão", to: `/divisao/${d.month.id}` }, home] };
  const parts: LeftoverPart[] = d.rows.filter((r) => r.included).map((r) => ({ id: r.p.id, name: r.p.name, amount: r.amount, fixed: r.mode === "fixo" }));
  const hasFixed = parts.some((p) => p.fixed && p.amount > 0);
  const confirmar = (changes: ReturnType<typeof planLeftover>): Step => ({
    kind: "confirm",
    ask: "Vou alterar:",
    rows: changes.map((c) => ({ label: parts.find((p) => p.id === c.id)?.name ?? "", value: `+ ${fmtEur(c.amount - (parts.find((p) => p.id === c.id)?.amount ?? 0))}` })),
    run: async () => {
      try {
        for (const c of changes) await ctx.save.allocation.mutateAsync({ monthId: d.month.id, parcelId: c.id, mode: "fixo", value: c.amount });
        return { kind: "done", message: `${fmtEur(d.remaining)} distribuídos em ${name}.`, actions: [{ label: "Abrir a Divisão", to: `/divisao/${d.month.id}` }, home] };
      } catch (e) {
        return fail(e);
      }
    },
  });
  return {
    kind: "choices",
    ask: `${name}: sobram ${fmtEur(d.remaining)}. Como queres distribuir?`,
    choices: [
      { label: "Tudo para uma parcela", value: "uma" },
      ...(hasFixed ? [{ label: "Proporcional ao que já tens", value: "proporcional" }] : []),
      { label: "Deixar por distribuir", value: "deixar" },
    ],
    next: (v) => {
      if (v === "deixar") return { kind: "done", message: "Está bem, fica por distribuir.", actions: [home] };
      if (v === "proporcional") return confirmar(planLeftover("proporcional", d.remaining, parts));
      return {
        kind: "choices",
        ask: "Para que parcela?",
        choices: parts.map((p) => ({ label: p.name, value: String(p.id) })),
        next: (id) => confirmar(planLeftover("uma", d.remaining, parts, Number(id))),
      };
    },
  };
}

/* ------------------------------------------------------------------- resumo */

function resumoFlow(ctx: Ctx): Step {
  const d = divisionOf(ctx);
  if (!d) return { kind: "done", message: "Ainda não há nenhum mês aberto. Começa por registar o mês.", actions: [home] };
  const spent = ctx.state.transactions.filter((t) => t.monthId === d.month.id && t.type === "expense").reduce((s, t) => s + t.value, 0);
  return {
    kind: "done",
    message: `${monthName(d.month)}:`,
    rows: [
      { label: "Disponível", value: fmtEur(d.available) },
      { label: "Alocado", value: fmtEur(d.allocated) },
      { label: d.status === "excede" ? "Excede em" : "Por distribuir", value: fmtEur(Math.abs(d.remaining)) },
      { label: "Despesas registadas", value: fmtEur(spent) },
    ],
    actions: [...(ctx.features.divisao || ctx.features.movimentos ? [{ label: "Abrir a Divisão", to: `/divisao/${d.month.id}` }] : []), home],
  };
}
