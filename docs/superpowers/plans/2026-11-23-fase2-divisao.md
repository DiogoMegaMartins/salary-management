# Fase 2: mês simples e página Divisão — plano

> **Para quem executa:** superpowers:executing-plans (execução direta, escolhida pelo utilizador).

**Objetivo:** o editor do mês fica só com o vencimento; a divisão do salário e os movimentos passam para uma página própria, `Divisão`, e no mês fica uma vista de leitura com ligação para lá.

**Arquitetura:** o código atual dos separadores Divisão e Movimentos do editor muda de sítio (extraído para `DivisionPanel` e `MovementsPanel`, sem reescrever); uma página nova `/divisao` escolhe o mês e mostra esses dois painéis em separadores. O editor mostra um resumo de leitura. As funcionalidades da fase 1 continuam a mandar (Divisão e Movimentos, `plataformas`, `reconciliacao`).

**Spec:** `docs/superpowers/specs/2026-11-23-meses-e-funcionalidades-design.md`

## Restrições globais
- Os cálculos e a gravação da divisão não mudam. Texto em português de Portugal. Um commit por tema. Versão **1.18.0**, CHANGELOG e Ajuda.
- Só há um sítio onde se edita a divisão e os movimentos: a página Divisão.
- Menu: `Divisão` aparece se `divisao` **ou** `movimentos` estiver ligada. Na barra do telemóvel entra no lugar da Carteira (que passa para "Mais"): Painel, Meses, Divisão, Despesas, Mais.

## Foco da revisão
- Mês fechado: a divisão continua só de leitura, com a nota "Reabre-o em Fecho e planeamento".
- Sem nenhum mês: a página Divisão mostra "Cria primeiro um mês" com ligação para Meses, sem erro.
- `#/divisao?mes=<id>` com id que não existe cai no último mês, sem ecrã em branco.
- Só Movimentos ligado (sem Divisão): a página mostra só o separador Movimentos.
- Mês rascunho (ainda não guardado) não tem ligação para a Divisão.

## Tarefas
1. **Extrair painéis** (`client/src/components/months/division-panel.tsx`, `movements-panel.tsx`): `DivisionPanel({ month: Month })` e `MovementsPanel({ month: Month })`, que leem o estado e calculam o que precisam; o editor passa a usá-los nos separadores, sem mudar o comportamento. Teste e2e de caracterização primeiro (editar um valor da divisão e ver o restante). Commit "Divisão e movimentos: código num sítio próprio".
2. **Página Divisão** (`client/src/pages/division.tsx`, rota `/divisao`, `FeatureRoute` com `anyOf`): seletor de mês (por omissão, o último mês aberto; `?mes=` escolhe), separadores Divisão e Movimentos (este com contagem), estado vazio. Item de menu e da barra (`NavItem.features` com "qualquer uma"). e2e: abre, escolhe mês, dividir um valor, regista um movimento, estados vazio/fechado/só movimentos.
3. **Mês simples:** o editor deixa os separadores; depois de guardar (mês existente) mostra "Próximo passo: abrir Divisão" e um resumo de leitura (alocado, restante, número de movimentos); `Dividir valores` e a ligação levam a `#/divisao?mes=<id>`. Atualizar `e2e/funcionalidades.spec.ts` e a Ajuda.
4. **Fecho:** versão 1.18.0, CHANGELOG, Ajuda; `npm test`, `check`, `check:worker`, `build`, e2e Worker completo; envio para a branch e imagens reais para validar.
