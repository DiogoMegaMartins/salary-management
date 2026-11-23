# Fase 1: interruptores de funcionalidades — plano

> **Para quem executa:** usar superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans. Os passos usam caixas `- [ ]`.

**Objetivo:** a pessoa liga e desliga funcionalidades em Definições › Funcionalidades; o que está desligado desaparece do menu, do mês e do Painel, sem apagar dados.

**Arquitetura:** uma coluna `features` (JSON em texto) em `settings`, lida por um módulo puro partilhado (`shared/features.ts`) e por um hook no cliente. Chave em falta = ligada, por isso dados e backups antigos ficam "tudo ligado". Cada ecrã consulta o hook; nada de lógica nova de cálculo.

**Tecnologias:** TypeScript, Express + better-sqlite3/Drizzle (Node), Worker + Durable Object (produção), React 19, Radix `Switch`, node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-23-meses-e-funcionalidades-design.md`

## Restrições globais
- Utilizadores atuais veem **tudo ligado** depois de atualizar.
- Desligar **nunca apaga dados**; ligar de novo repõe tudo.
- A migração segue o padrão de `server/db.ts` (lista de `ALTER TABLE ... ADD COLUMN`), que o Worker também usa. Funciona em Node e no Worker.
- Texto em português de Portugal. Um commit por tema. Subir versão para **1.17.0**, CHANGELOG e notas na Ajuda.
- Sem segredos em commits ou PRs. PR com Resumo / O que mudou / Como foi testado / Antes do merge.

## Chaves de funcionalidades (esta fase)
`divisao`, `movimentos`, `parcelas`, `plataformas`, `irsJovem`, `reconciliacao`. (`assistente` entra na fase 4.)
Dependência: `reconciliacao` precisa de `movimentos` (o painel vive no separador Movimentos). Com `movimentos` desligado, `reconciliacao` conta como desligada e o seu interruptor fica inativo com a nota "Precisa de Movimentos".

## Foco da revisão
- Dados antigos sem a coluna ou com `features = '{}'` → tudo ligado.
- JSON inválido, chave desconhecida ou valor não booleano → pedido recusado (400); na leitura, lixo guardado nunca desliga nada.
- Abrir a rota de uma funcionalidade desligada (ex.: `#/parcelas`) → redireciona para o Painel, sem ecrã em branco.
- Mês com `divisao` e `movimentos` desligados → sem barra de separadores, só o Vencimento.
- Backup exportado e restaurado mantém os interruptores.

## Mapa de ficheiros
- Criar `shared/features.ts` — chaves, rótulos, dependências, `parseFeatures`, `isFeatureOn`.
- Criar `client/src/lib/features.ts` — `useFeature(key)` e `useFeatures()`.
- Criar `client/src/components/features-settings.tsx` — separador Funcionalidades.
- Alterar `shared/schema.ts`, `server/db.ts`, `server/validation.ts` — coluna e validação.
- Alterar `client/src/components/layout.tsx`, `client/src/App.tsx` — menu e rotas.
- Alterar `client/src/components/months/month-editor.tsx` — separadores, IRS Jovem, plataformas, reconciliação.
- Alterar `client/src/pages/dashboard.tsx` — cartões ligados a parcelas e divisão.
- Alterar `client/src/pages/data.tsx` — novo separador.
- Testes: `tests/features.test.ts`, `tests/security.test.ts`, `e2e/funcionalidades.spec.ts`; ajustar `e2e/helpers.ts` só se for preciso.

---

### Tarefa 1: Módulo puro de funcionalidades

**Ficheiros:** criar `shared/features.ts`; teste `tests/features.test.ts`.

**Interfaces:**
- Produz:
  - `export type FeatureKey = "divisao"|"movimentos"|"parcelas"|"plataformas"|"irsJovem"|"reconciliacao"`
  - `export const FEATURES: { key: FeatureKey; label: string; help: string; requires?: FeatureKey }[]` (rótulos e ajudas da imagem 2 do desenho)
  - `export function parseFeatures(json: string | null | undefined): Record<FeatureKey, boolean>` — chave em falta = `true`; JSON inválido ou valor não booleano = `true`; aplica a dependência (`reconciliacao` fica `false` se `movimentos` for `false`).
  - `export function isFeatureOn(json: string | null | undefined, key: FeatureKey): boolean`
  - `export function featuresPatch(json: string | null | undefined, key: FeatureKey, on: boolean): string` — devolve o JSON com só as chaves explicitamente `false` (compacto).

- [ ] **Passo 1: testes que falham** em `tests/features.test.ts`: `parseFeatures("")`, `("{}")`, `("lixo")` → tudo `true`; `('{"parcelas":false}')` → só `parcelas` `false`; `('{"movimentos":false}')` → `movimentos` e `reconciliacao` `false`; `('{"parcelas":"não"}')` → `parcelas` `true`; `featuresPatch("{}","parcelas",false)` → `'{"parcelas":false}'` e `featuresPatch('{"parcelas":false}',"parcelas",true)` → `'{}'`.
- [ ] **Passo 2:** correr `npx tsx --test tests/features.test.ts` (ou o comando usado em `npm test`) → falha por módulo em falta.
- [ ] **Passo 3:** implementar `shared/features.ts` com as assinaturas acima.
- [ ] **Passo 4:** correr o teste → passa.
- [ ] **Passo 5:** commit "Funcionalidades: base para ligar e desligar partes da app".

### Tarefa 2: Coluna, validação e API

**Ficheiros:** alterar `shared/schema.ts` (`features: text("features").notNull().default("{}")` em `settings`), `server/db.ts` (acrescentar `"ALTER TABLE settings ADD COLUMN features TEXT NOT NULL DEFAULT '{}'"` à lista de migrações, a seguir à de `page_layouts`), `server/validation.ts` (`features` em `settingsPatchSchema`); teste `tests/security.test.ts`.

**Interfaces:**
- Consome: `FEATURES` da Tarefa 1.
- Produz: `PATCH /api/settings { features: string }` aceita um JSON de objeto cujas chaves sejam todas conhecidas e valores booleanos (máx. 500 caracteres); recusa o resto com 400.

- [ ] **Passo 1: testes** em `tests/security.test.ts`, no teste "definições: valida tipos…": recusa `{ features: "null" }`, `"[1]"`, `'{"nada":false}'`, `'{"parcelas":"não"}'`; aceita `{ features: '{"parcelas":false}' }` e confirma que `GET /api/state` devolve `settings.features === '{"parcelas":false}'`.
- [ ] **Passo 2:** correr `npm test` → falha.
- [ ] **Passo 3:** implementar. Reutilizar `parsesToObject` e acrescentar a verificação de chaves e valores (função `isFeaturesJson` em `server/validation.ts`).
- [ ] **Passo 4:** `npm test`, `npm run check` e `npm run check:worker` → passam. Confirmar que uma base antiga (sem a coluna) abre e fica com `features = '{}'` (teste que cria a tabela antiga ou usa o `db` de teste existente em `tests/integrity.test.ts`; seguir o padrão que já lá exista).
- [ ] **Passo 5:** commit "Definições: guardar quais funcionalidades estão ligadas".

### Tarefa 3: Hook e página de interruptores

**Ficheiros:** criar `client/src/lib/features.ts`, `client/src/components/features-settings.tsx`; alterar `client/src/pages/data.tsx` (novo `TabsTrigger` `settings-tab-funcionalidades`, texto "Funcionalidades", depois de Cálculo); teste `e2e/funcionalidades.spec.ts`.

**Interfaces:**
- Consome: `parseFeatures`, `isFeatureOn`, `featuresPatch`, `FEATURES`; `useAppState()` e `useSave().settings` de `client/src/lib/app.tsx`.
- Produz: `useFeature(key: FeatureKey): boolean` e `useFeatures(): Record<FeatureKey, boolean>` (enquanto o estado carrega, devolvem `true`); `<FeaturesSettings />`.

- [ ] **Passo 1: teste e2e (falha)** `e2e/funcionalidades.spec.ts`: em `#/dados` abrir `settings-tab-funcionalidades`; ver 6 interruptores `feature-switch-<chave>` todos ligados; desligar `feature-switch-parcelas` → o link "Parcelas e metas" do menu lateral deixa de existir; recarregar → continua desligado; ligar de novo → volta.
- [ ] **Passo 2:** correr `E2E_TARGET=worker E2E_PORT=5057 npx playwright test e2e/funcionalidades.spec.ts` → falha.
- [ ] **Passo 3:** implementar o hook e o componente: um `Switch` (`@/components/ui/switch`, criar no padrão dos outros componentes `ui/` se não existir) por funcionalidade, com rótulo, ajuda curta (`FEATURES`) e `aria-describedby`. O de `reconciliacao` fica `disabled` com a nota "Precisa de Movimentos" quando `movimentos` está desligada. Gravar com `save.settings.mutate({ features: featuresPatch(...) })` e toast "Funcionalidade desligada" / "ligada". Nota fixa: "Desligar esconde; não apaga dados."
- [ ] **Passo 4:** correr o teste → passa quando a Tarefa 4 também estiver feita; por agora basta a parte dos interruptores (marcar o resto do teste com `test.fixme` até à Tarefa 4 e retirar nela).
- [ ] **Passo 5:** commit "Definições: separador Funcionalidades com interruptores".

### Tarefa 4: Menu, rotas e Painel

**Ficheiros:** alterar `client/src/components/layout.tsx`, `client/src/App.tsx`, `client/src/pages/dashboard.tsx`; testes em `e2e/funcionalidades.spec.ts`.

**Interfaces:**
- Consome: `useFeature`.
- Produz: itens do menu e da barra móvel filtrados por funcionalidade (`/parcelas` ← `parcelas`; `/carteira` ← `plataformas`); componente `FeatureRoute` em `App.tsx` que, para uma rota com funcionalidade desligada, faz `navigate("/")` com `replace`.

- [ ] **Passo 1: testes e2e (falham)** em `e2e/funcionalidades.spec.ts`: (a) com `parcelas` desligada, `#/parcelas` leva a `#/` e o Painel não mostra o cartão `metas`; (b) com `plataformas` desligada, `#/carteira` leva a `#/` e "Carteira" sai do menu; (c) em ecrã de telemóvel, a barra inferior continua com 4 itens ou menos e o "Mais" não lista os desligados; (d) com `divisao` desligada o cartão `divisao-por-parcela` do Painel não aparece.
- [ ] **Passo 2:** correr → falham.
- [ ] **Passo 3:** implementar. No `layout.tsx`, `NAV` e `TABS` ganham um campo opcional `feature?: FeatureKey` e filtram-se com `useFeatures()`. No Painel, filtrar por `id` as secções `metas` e `parcelas-periodo` (`parcelas`) e `divisao-por-parcela` (`divisao`), respeitando o layout personalizado já guardado (secção em falta não parte o grid).
- [ ] **Passo 4:** correr o e2e e `e2e/navegacao.spec.ts` → passam (todas ligadas por defeito).
- [ ] **Passo 5:** commit "Menu e Painel respeitam as funcionalidades desligadas".

### Tarefa 5: Editor do mês

**Ficheiros:** alterar `client/src/components/months/month-editor.tsx`; testes em `e2e/funcionalidades.spec.ts`.

- Separador `divisao` (`tab-divisao`) só com `divisao` ligada; `movimentos` (`tab-movimentos`) só com `movimentos` ligada; sem nenhum dos dois, não se desenha a `TabsList` (só o Vencimento). A grelha dos separadores usa o número de separadores visíveis (`grid-cols-1|2|3`).
- Campo IRS Jovem (`select-irs-jovem`) só com `irsJovem` ligada; `PlatformDistribution` só com `plataformas` ligada; `ReconciliationPanel` só com `reconciliacao` ligada (já implica `movimentos`).

- [ ] **Passo 1: testes e2e (falham):** com `movimentos` desligada, `tab-movimentos` não existe e `tab-divisao` sim; com ambos desligados nenhum separador existe e o Vencimento aparece; com `irsJovem` desligada `select-irs-jovem` não existe; com tudo ligado o editor é igual ao de hoje (`e2e/escrita.spec.ts` continua verde).
- [ ] **Passo 2:** correr → falham.
- [ ] **Passo 3:** implementar com `useFeatures()`. Atenção ao `initialTab`: se o separador pedido estiver desligado, cair no `vencimento`. Um mês já guardado com IRS Jovem escolhido, com a funcionalidade desligada, **mantém o valor** (o campo só se esconde).
- [ ] **Passo 4:** correr `E2E_TARGET=worker E2E_PORT=5057 npx playwright test` → tudo verde (63+ testes).
- [ ] **Passo 5:** commit "Mês: esconde divisão, movimentos e IRS Jovem quando desligados".

### Tarefa 6: Versão, documentação e verificação final

**Ficheiros:** `package.json` (1.17.0), `docs/CHANGELOG.md`, `client/src/lib/help-content.tsx` (notas de versão e uma secção curta sobre Funcionalidades), `docs/DESENVOLVIMENTO-E-TESTES.md` se mencionar a lista de testes.

- [ ] **Passo 1:** escrever as entradas (para quem usa: "Podes desligar o que não usas em Definições › Funcionalidades; os dados ficam guardados").
- [ ] **Passo 2:** correr `npm test`, `npm run check`, `npm run check:worker`, `npm run build`, e a interface no Worker (`E2E_TARGET=worker E2E_PORT=5057 npx playwright test`) e no Node (`E2E_PORT=5057 npx playwright test`). Tudo verde.
- [ ] **Passo 3:** só então `git push -u origin claude/fase1-funcionalidades`; o PR automático escreve a descrição a partir dos commits.

## Auto-revisão
- Cobertura do desenho: interruptores, esconder no menu/mês/Painel, dados preservados, compatibilidade com dados antigos — cada um tem tarefa e teste. O arranque, a página Divisão e o assistente ficam para as fases 2 a 4, como no documento.
- Assinaturas coerentes: `parseFeatures`, `isFeatureOn`, `featuresPatch`, `useFeature(s)` usados com os mesmos nomes em todas as tarefas.
- Ponto em aberto assumido: o cartão `metas` do Painel e a rota `/orcamento` não dependem de `parcelas` nesta fase (Orçamento fica sempre ativo).
