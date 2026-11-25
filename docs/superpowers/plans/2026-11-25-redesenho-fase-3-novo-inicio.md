# Redesenho "Calma", fase 3: novo Início — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Um Início que responde de relance a "quanto ainda posso gastar este mês e para onde vai o dinheiro", com modo Básico (só isto) e Detalhado (isto mais o painel de hoje).

**Spec:** `docs/superpowers/specs/2026-11-25-redesign-calma-design.md` (fase 3).

## Decisões do utilizador (desta fase)

- Número principal: **"Ainda podes gastar" = gastos mensais planeados − despesas registadas** (planeado = soma das parcelas do tipo `gastos` do mês).
- Despesa registada **pede a parcela**; por defeito cai na parcela de gastos. Despesas sem parcela contam como gasto do mês; as ligadas a poupança ou investimento ficam de fora.
- Topo do Início: título do mês, "faltam N dias", pesquisa e definições (opção 2). Valores a subir/descer a verde, âmbar ou vermelho.
- Básico mostra só o resumo (3 maiores categorias); Detalhado mostra o resumo (todas as categorias) e, por baixo, os filtros, indicadores e gráficos de hoje.

## Rulings (decisões minhas)

- Estado: `sem-plano` se o planeado é 0; `excedido` se gastou mais do que o planeado; `atencao` se já gastou ≥ 85% e (não é o mês de hoje ou faltam mais de 5 dias); senão `ok`.
- Mês mostrado: o último mês aberto (ou o último, se todos fechados), com seletor se houver vários.
- Várias parcelas de gastos: a do menor id é a predefinida no Registar.
- O título da página passa a "Início" (testes e atalhos atualizados).
- As cores dos gráficos passam a seguir a paleta (`--chart-1` = destaque).

## Tarefas

1. **Regras** `shared/inicio.ts` (`inicioSummary`, `defaultExpenseParcel`) + `tests/inicio-resumo.test.ts`.
2. **Registar pede a parcela** (select com a de gastos por defeito) + e2e.
3. **Início** (`client/src/components/inicio-summary.tsx`) no topo da página; Básico só isto; Detalhado também o resto; título "Início"; e2e.
4. **Gráficos** com a cor da paleta (`--chart-1`), teste de contraste.
5. **Versão 1.26.0**, CHANGELOG, Ajuda, validação completa e imagens.
