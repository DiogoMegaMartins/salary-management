# Redesenho "Calma", fase 4: Dividir — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A página Dividir junta Divisão, Parcelas e Fecho: um cartão "O teu mês em 3 passos" no topo e, por baixo, o passo em curso (Básico) ou os separadores completos (Detalhado).

**Spec:** `docs/superpowers/specs/2026-11-25-redesign-calma-design.md` (fase 4).

## Decisões do utilizador

- Estrutura híbrida (opção 3): cartão de 3 passos (Salário, Repartir, Fechar) + separadores por baixo.
- O salário vem do mês criado (não há passo para o definir: se o mês não tem salário, o passo 1 aponta para Meses).
- Básico mostra o cartão e o passo em curso; Detalhado mostra também os separadores completos.

## Rulings (decisões minhas)

- Os passos: **Salário** feito se o disponível do mês é > 0; **Repartir** feito se `restante ≈ 0`, "Faltam X" se > 0, "Excede X" se < 0; **Fechar** feito se o mês está fechado, "pronto" quando já está repartido. O passo em curso é o primeiro não feito.
- Detalhado: separadores Divisão, Movimentos (se ligados), Parcelas e metas (se ligada), Fechar o mês (com Recorrências, Simulador e Composição lá dentro).
- Básico: passo 2 mostra a Divisão; passo 3 mostra o fecho mensal; passo 1 sem conteúdo (ligação a Meses). Clicar num passo mostra-o.
- `/parcelas` e `/fecho` passam a redirecionar para Dividir, no separador certo (`/parcelas` só com a funcionalidade ligada).
- Título do ecrã: "Dividir". Menu: Parcelas e metas e Fecho e planeamento saem de Mais.

## Tarefas

1. Regras `shared/dividir.ts` (`dividirSteps`) + `tests/dividir.test.ts`.
2. Extrair `ParcelsPanel` (de `pages/parcels.tsx`) e `ClosingTabs`/`MonthClosing` (de `pages/closing.tsx`) para reutilizar.
3. Página Dividir: cartão de passos, Básico/Detalhado, separadores; redirecionamentos; menu; atalhos; testes e2e.
4. Versão 1.27.0, CHANGELOG, Ajuda, validação completa e imagens.
