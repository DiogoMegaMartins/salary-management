# Redesenho "Calma", fase 2: menu novo e botão Registar — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Menu com 3 destinos principais (Início, Dividir, Meses) mais "Mais", e um botão "Registar despesa" sempre à mão, por baixo do conteúdo.

**Architecture:** Um modelo de menu puro (`client/src/lib/nav.ts`) alimenta a barra lateral (computador) e a barra de baixo (telemóvel). Um botão fixo no fundo da área de conteúdo abre um diálogo rápido de despesa, que reutiliza `useSave().createTransaction` e os ajudantes de `shared/assistant.ts`. As rotas não mudam.

**Spec:** `docs/superpowers/specs/2026-11-25-redesign-calma-design.md` (fase 2).

## Global Constraints

- Português de Portugal, simples. Rotas e `data-testid` existentes dos links mantêm-se (`link-painel`, `link-divisão`, `link-despesas`, …).
- Destinos principais: **Início** (`/`), **Dividir** (`/divisao`, só com `divisao` ou `movimentos` ligadas), **Meses** (`/meses`). Os restantes (Despesas, Fecho e planeamento, Parcelas e metas, Carteira, Orçamento, Definições, Ajuda) ficam em "Mais".
- "Registar" não é destino do menu; é só o botão.
- O botão não aparece sem meses ou antes de o arranque estar feito. Assistente flutuante não pode ficar por cima dele.
- Títulos das páginas não mudam nesta fase (mudam nas fases 3 e 4).
- Versão 1.25.0, CHANGELOG, notas da Ajuda. Commits locais por tema; push só no fim.

## Review Focus

- Funcionalidade `divisao` e `movimentos` desligadas: "Dividir" desaparece do menu e não deixa buraco.
- Valor inválido (vazio, 0, texto) no diálogo: erro claro, nada gravado.
- Data sem mês correspondente: erro que explica o que fazer, nada gravado.
- Duplo clique em "Guardar": grava uma só vez.
- Teclado aberto no telemóvel: o botão não tapa o campo que se escreve.

## Rulings (decisões minhas)

- Botão "por baixo do conteúdo": `position: sticky; bottom: 0` dentro da área de conteúdo; no telemóvel largura total, no computador pílula ao centro.
- O assistente flutuante sobe no telemóvel para não tapar o botão; no computador fica no canto.
- Registar abre um diálogo (valor, categoria, data, nota) e não o assistente, porque o assistente é opcional.
- Na barra lateral, "Mais" é um grupo sempre visível com os restantes itens (descoberta), não um menu escondido.

---

### Task 1: Modelo do menu

**Files:** Create `client/src/lib/nav.ts`; Test `tests/menu.test.ts`.

**Interfaces:** Produces `NavItem = { href; label; testId; icon; features?: FeatureKey[] }`; `MAIN_NAV`, `MORE_NAV: NavItem[]`; `visibleNav(list, features): NavItem[]`; `isNavActive(href, location): boolean`.

- [ ] Teste: `MAIN_NAV` tem exatamente Início, Dividir, Meses; `MORE_NAV` tem os 7 restantes e não repete nada de `MAIN_NAV`; com `divisao` e `movimentos` desligadas `visibleNav(MAIN_NAV, …)` não tem Dividir; com só uma ligada tem; `isNavActive("/", "/meses") === false`, `isNavActive("/meses", "/meses/x") === true`.
- [ ] Ver falhar; implementar `nav.ts` (ícones de `lucide-react`); ver passar. Commit "Menu: modelo novo com Início, Dividir, Meses e Mais".

### Task 2: Barra lateral e barra de baixo

**Files:** Modify `client/src/components/layout.tsx`; Test `e2e/menu.spec.ts`.

- [ ] Teste e2e (computador): barra lateral tem Início, Dividir, Meses e, sob o título "Mais", os 7 restantes; navegar por cada um abre a página certa. (telemóvel): barra de baixo tem Início, Dividir, Meses e Mais, sem Despesas; o painel "Mais áreas" tem os 7 restantes.
- [ ] Ver falhar; trocar `NAV`/`TABS`/`MORE` locais pelo modelo; sidebar com os 3 principais e grupo "Mais"; ver passar. Commit "Menu: três destinos principais e o resto em Mais".

### Task 3: Botão e diálogo Registar despesa

**Files:** Create `client/src/components/register-expense.tsx`; Modify `client/src/components/layout.tsx` (renderizar no `<main>`), `client/src/components/assistant/assistant-fab.tsx` (posição); Test `e2e/registar.spec.ts`.

**Interfaces:** Produces `RegisterBar()`; testids `register-button`, `register-dialog`, `register-value`, `register-category`, `register-date`, `register-note`, `register-save`, `register-error`.

- [ ] Testes e2e: botão visível no Início e em Meses, encostado ao fundo da área visível mesmo depois de deslocar; guardar 12,50 com categoria cria a despesa (aparece em Despesas); valor vazio, 0 e "abc" mostram erro e não gravam; data num mês inexistente mostra erro; duplo clique grava uma só vez; botão não está por cima do assistente (caixas sem interseção); sem teclado a tapar (campo focado visível no telemóvel).
- [ ] Ver falhar; implementar com `parseAmount`, `monthOfDate`, `createTransaction`, categorias ativas; ver passar. Commit "Registar despesa: botão sempre à mão e diálogo rápido".

### Task 4: Versão, documentação e validação

- [ ] Versão 1.25.0 (`package.json`, `package-lock.json`), CHANGELOG, notas da Ajuda, estado da fase 2 no documento do desenho.
- [ ] `npm test`, `npm run check`, `npm run check:worker`, `npm run build`, e2e do Worker completo; imagens para o utilizador validar antes do push.
