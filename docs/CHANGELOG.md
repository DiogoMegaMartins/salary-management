# Changelog

Ordem do mais recente para o mais antigo.

## Por lançar

- Cloudflare: a app corre num Worker, com a interface em Static Assets e o Express e o SQLite dentro de um Durable Object. Ver `docs/CLOUDFLARE.md`. O servidor Node continua suportado.
- `server/app.ts`: criação da app Express partilhada pelo servidor Node e pelo Worker.
- Novos: `worker/`, `wrangler.jsonc`, `npm run dev:worker`, `npm run deploy`, `npm run check:worker` e o workflow manual "Deploy (Cloudflare)".

## 1.12.7 | 2026-11-19

- Widget "Comparação mensal e anual": "Total alocado por parcela" é uma linha normal (sem negrito nem sombreado) com os totais e a variação, e as parcelas ficam por baixo como subindicadores.
- "Despesas fora do padrão" passou do Painel e do Orçamento para a página Despesas e usa o mês escolhido ali. A comparação mensal e anual ocupa a largura toda no Painel e no Orçamento.
- Comparação: as parcelas ganham cor pela variação (verde sobe, vermelho desce) e uma variação zero aparece sem "+".
- Versão da app numa só fonte: `shared/version.ts` lê o `version` do `package.json` (servidor e ajuda).
- Arredondamento: `round2` de `@shared/evo08` usado também em `server/routes.ts` e `server/validation.ts`.
- Acessibilidade: nomes acessíveis nos campos de regra e meta das parcelas, nome da nova parcela, etiqueta e notas do mês.
- CI: e2e em série com o Chrome do runner (sem instalar browser nem `apt`); Dependabot semanal só para alertas, com nota em `docs/NOTA-DEPENDABOT.md`.
- Sem alterações ao esquema de dados.

## 1.12.6 | 2026-11-18

Correções menores da auditoria.

- `goalBreakdown`: sem saldo inicial, a parte atribuída a submetas sai do saldo por distribuir (`txNet = -linked`), por isso o total da meta não muda.
- `updateTransaction`: 409 se o valor ficar abaixo do atribuído a submetas, ou se mudar o tipo ou a parcela com atribuições.
- `POST /api/months/:id/apply-rules` corre numa transação (tudo ou nada).
- `checkConsistency`: novo erro `dist_plataformas` (distribuição por plataformas acima do total da parcela); `setAssets` devolve o erro real da distribuição.
- Meses repetidos (mesmo ano e mês): a data de um movimento escolhe um mês aberto (depois o mais antigo) e as ocorrências de recorrências são únicas e vão para um mês aberto.
- Testes: 5 novos em `tests/correcao-financeira.test.ts`. Sem alterações ao esquema de dados.

## 1.12.5 | 2026-11-18

Limpeza e bundle (auditoria).

- `shared/constants.ts` com `TRANSACTION_TYPES` e `TX_NATURES`; o cliente deixa de importar valores de `shared/schema.ts`, por isso `drizzle-orm`, `drizzle-zod` e `zod` saem do pacote inicial.
- Removidos: os `insert*Schema` e tipos `Insert*` (sem uso), `drizzle-zod`, `@tailwindcss/typography`, `@radix-ui/react-tooltip` e `ui/tooltip.tsx`, o alias `@assets`, `transactionsOfMonth`, `monthKey` e cerca de 40 imports e variáveis sem uso. `noUnusedLocals` ligado no `tsconfig.json` (o `npm run check` apanha novos casos).
- Documentação: `INSTALACAO.md` fundido no README (requisitos e tabela de variáveis de ambiente); documentos históricos movidos para `docs/historico/`; `API.md` com `GET /health` e `POST /offline/sync`.
- CI: cache do Chromium do Playwright, `timeout-minutes` por job e um job `changes` que salta `check`, `test`, `build` e `e2e` em commits só de documentação (`**.md`, `docs/**`). Os jobs ficam "skipped", que conta como verde nas verificações obrigatórias da `main`, por isso uma PR só de documentação continua a poder ser integrada.
- Sem alterações ao esquema de dados.

## 1.12.4 | 2026-11-18

- **Node 24 como única versão:** `engines.node` passa de `>=20.19.0` para `>=24`; `@types/node` 24.19.2 (e `undici-types` 7.24.6 no lockfile); `INSTALACAO.md` e `docs/DESENVOLVIMENTO-E-TESTES.md` atualizados. O CI já corria só em Node 24. Sem alterações ao esquema de dados.

## 1.12.3 | 2026-11-18

Interface (auditoria).

- `MutationCache.onError` em `queryClient.ts`: toda a mutação sem `onError` próprio mostra um aviso. "Aplicar sugestão" usa `Promise.allSettled` e só mantém os lançamentos que falharam.
- `AppShell` mostra `state-error` com "Tentar de novo" quando `GET /api/state` falha sem dados.
- Editor de mês: confirmação ao fechar com alterações; eliminar movimento e categoria pedem confirmação e têm nome acessível.
- Definições: campo de taxa vazio ou sem alteração não grava.
- Filtros Tipo e Parcelas com `DropdownMenuCheckboxItem` (teclado); `NumberField` e campos das definições com `htmlFor`; linhas de parcela do Painel com `role="button"`; `--destructive` mais claro no tema escuro e `amber-700` nos avisos.
- Estados vazios em Despesas e Fecho mensal.
- Testes: `e2e/interface.spec.ts` (3). Sem alterações ao esquema de dados.

## 1.12.2 | 2026-11-18

Segurança (auditoria).

- O código de acesso passa a ser verificado **antes** dos `express.json` (`server/middleware.ts`); `/api/import` e `/api/offline` sem `inflate`.
- `verifyCodeAsync` (scrypt assíncrono), `knownGood` (código já verificado passa sempre), limitador por IP/`/64` e teto global de 60 falhas/min (`authLimiter`, `globalLimiter`, `ipKey`).
- Aviso no arranque em produção sem código de acesso.
- `vite.config.ts`: `server.fs.deny` cobre `*.db`, `backups/` e `pre-import-backup-*.json`.
- `docs/SEGURANCA.md` atualizado (incluindo a revisão manual do `xlsx`).
- Testes: 3 novos em `tests/security.test.ts`, 1 ajustado (o dono já autenticado não é trancado). Sem alterações ao esquema de dados.

## 1.12.1 | 2026-11-18

Correções financeiras da auditoria.

- **Mês fechado:** `normalizeTransaction` recusa (423) um movimento cuja data o deslocaria para um mês fechado, na criação e na edição.
- **Reconciliação:** "Aplicar como lançamentos" usa uma data dentro do mês reconciliado (`dateInMonth`).
- **Parcelas:** eliminar uma parcela com alocação (valor > 0) em mês fechado dá 409; arquiva-se.
- **Categorias:** `budgetVsRealByCategory` e as despesas essenciais comparam sem maiúsculas nem espaços nas pontas (`catKey`).
- **Projeção anual:** os meses restantes contam-se pelo calendário (depois do mês corrente ou do último registado), não por linhas de mês.
- **Sugestão de excedente:** divisão em cêntimos, soma exatamente igual ao excedente.
- **Comparação com ano fixo:** `categoryYearOverYear` soma por par, tal como os totais.
- **Datas:** "hoje" no fuso local (`localToday`) em vez de UTC.
- Testes: `tests/correcao-financeira.test.ts` (7). Versão 1.12.1, sem alterações ao esquema de dados.

## 1.12.0 | 2026-11-18

- **Comparar com ano:** o botão de meses tem primeiro o filtro de ano e depois os meses desse ano; o ano de comparação lista só os outros anos (sem a opção "ano anterior"; sem escolha de ano continua a comparar com o ano anterior de cada mês).
- **Comparar com mês:** primeiro os meses de base (iniciais), depois os de comparação (finais); tabelas com colunas "Base" e "Comparação" (no modo ano, uma coluna por ano).
- `YoYSelection` ganha `year`. Versão da aplicação, da Ajuda e de `/api/app-info` em 1.12.0. Sem alterações ao esquema de dados.

## 1.11.0 | 2026-11-18

- **Comparação mensal e anual (antes "Face ao ano anterior"):** botão "Tipo de comparação" (com ano / com mês); em "com mês" escolhe-se um ano e comparam-se meses desse ano. Antes: seletor de meses no próprio cartão (um, vários, todos ou nenhum, com uma só ação de selecionar/limpar) e seletor da base: ano anterior, um ano fixo ou outros meses à escolha (inclui meses do mesmo ano; com tamanhos diferentes, médias mensais). A escolha fica guardada no dispositivo (`localStorage`, validada ao ler) e vale no Painel e no Orçamento; "Repor" volta ao filtro.
- **Mais métricas:** rendimento bruto, descontos, carga fiscal efetiva e total alocado por parcela (`parcelYearOverYear`), além de líquido, gastos, poupança e taxa de poupança.
- `yearOverYear` aceita `refYear`; meses com o mesmo ano e mês (dois dezembros) somam-se de cada lado e um mês nunca se compara com ele próprio. `pairs` passa a ter `current` e `previous` como listas de meses.
- **Relatório mensal:** removida a descarga em Markdown; fica só o PDF. A exportação da Ajuda em Markdown mantém-se.
- Testes: 3 novos em `tests/insights.test.ts` (ano fixo, meses repetidos, por parcela) e 1 de interface (`e2e/insights.spec.ts`) para a escolha, a memória e o "Repor".
- Versão da aplicação, da Ajuda e de `/api/app-info` em 1.11.0. Sem alterações ao esquema de dados.

## 1.10.0 | 2026-11-18

- **Ritmo das metas:** `goalPace` compara o ritmo dos últimos 3 meses com a data alvo (estados no ritmo, atrasada, sem ritmo, prazo passado, sem prazo, atingida). Aviso por meta e faixa no Painel.
- **Face ao ano anterior:** `yearOverYear` e `categoryYearOverYear`; cartão no Painel (líquido, gastos, poupança, taxa) e tabela por categoria no Orçamento. Só meses com par nos dois anos.
- **Despesas fora do padrão:** `spendAnomalies`; cartão no Painel e no Orçamento para o último mês com despesas.
- **Relatório mensal em PDF:** gerador sem dependências (`shared/pdf.ts`, Helvetica, WinAnsi); botão "Descarregar PDF". Mantém a opção de ocultar valores. A descarga em Markdown foi removida do relatório (o Markdown passa a ser só o formato intermédio interno do PDF); a exportação da Ajuda em Markdown mantém-se.
- Novas fórmulas documentadas em REGRAS-DE-CALCULO.md; secção "Ritmo das metas, ano anterior e despesas fora do padrão".
- Testes: `tests/insights.test.ts` (9), `tests/pdf.test.ts` (3, com extração de texto por `pdftotext` quando existe) e `e2e/insights.spec.ts` (4 por ambiente), mais `e2e/dados.spec.ts` (fecho, CSV e restauro).
- Versão da aplicação, da Ajuda e de `/api/app-info` em 1.10.0. Sem alterações ao esquema de dados.

## Arquitetura documentada

- `docs/ARQUITETURA.md` passa a ter diagramas Mermaid: componentes cliente/servidor/base de dados, sequência de entrada e gravação, modelo de dados (relações), camadas de proteção, modo offline e do código à produção.
- `docs/MODELO-DE-DADOS.md`: corrigida a relação de `allocation_assets` (liga a `allocations` e a `platforms`) e documentada a tabela `offline_receipts`.
- `docs/API.md`: regras de validação das rotas. `docs/DESENVOLVIMENTO-E-TESTES.md`: secção Pipeline e ramos.
- Ajuda da aplicação: nova secção "Como a aplicação funciona", com diagrama.

## Ficheiros grandes divididos

- `shared/calc.ts` passa a reexportar cinco módulos em `shared/calc/` (`month`, `budget`, `distribution`, `goals`, `expenses`). Os imports `@shared/calc` não mudam.
- `server/storage.ts` perde a ligação e o esquema (`server/db.ts`) e os métodos de catálogos e de metas (`server/storage-catalogs.ts`, `server/storage-goals.ts`), compostos de volta no objeto `storage`. `storage`, `db`, `sqlite`, `httpError`, `roundCents`, `dataDir` e `dbPath` continuam exportados por `server/storage.ts`.
- O cálculo dos números do Painel sai de `dashboard.tsx` para `client/src/lib/dashboard-model.ts` (`buildDashboardModel`).
- Sem alterações de comportamento: mesmos 129 testes.

## Esquemas formais nas rotas

- Plataformas, tipos de parcela e de movimento, saldos e ajustes, submetas, atribuições, taxas de conversão, recorrências, reservas e fecho/reabertura de mês passam a validar o pedido com esquemas zod (`server/route-schemas.ts`): tipos, limites e valores permitidos.
- Campos desconhecidos no corpo e identificadores de rota inválidos (`/api/platforms/abc`) dão 400 em vez de serem ignorados. Os campos obrigatórios e as regras de domínio continuam na camada de armazenamento, com as mesmas mensagens.
- `destination` do fecho de mês só aceita `transportar`, `reforcar` ou `manter` (antes, um valor desconhecido era tratado como `manter`).
- Testes novos em `tests/route-schemas.test.ts`.

## Saldos e ajustes com o mesmo cartão das submetas

- O histórico de saldos e ajustes usa agora o mesmo cartão das submetas (nome, informação, valor e ícones nas mesmas posições) e ganhou o ícone de **editar**: valor, data e nota podem ser corrigidos sem apagar e voltar a criar. O tipo (saldo inicial ou ajuste) e a meta/submetas não mudam.
- API: `PATCH /api/goal-entries/:id` ({ amount, date, note }), com as mesmas validações da criação (saldo inicial não negativo, ajuste diferente de 0, data AAAA-MM-DD); fica no histórico de alterações.
- Correção: meios-cêntimos negativos arredondavam para o lado errado (−12,345 dava −12,34); passam a arredondar para longe de zero (−12,35).
- 129 testes.

## Alinhamento à esquerda e ícones nas metas e submetas

- Histórico de saldos e ajustes: cada registo passa a ter data e tipo, submeta e nota alinhadas à esquerda, em linhas inteiras (a nota era espremida numa coluna de uma letra), com o valor e o ícone de remover à direita, alinhados entre linhas.
- Submetas, atribuições de aportes e taxas de conversão: texto à esquerda; ícones de editar e eliminar de 24 px para 32 px, alinhados à direita em todas as linhas.
- Telemóvel: cabeçalhos e valores das tabelas alinhados à esquerda (os cabeçalhos de duas linhas ficavam à direita); nome da parcela alinhado com os campos.

## Cartões superiores editáveis e tabelas no telemóvel

- Editar layout passa a abranger os cartões de topo: cada KPI do Painel e da Carteira, a faixa "Regras por omissão" das Parcelas e os cartões do Orçamento (que ganha a opção). Cada cartão move-se e redimensiona-se sozinho (mínimo 3 × 3); sem layout guardado, a fila de KPIs mantém a grelha responsiva de sempre. Suporte em `EditableSectionGrid` (`group`, `groupClass`, `minW`, `minH`).
- Telemóvel: a regra `overflow-wrap: anywhere` dos cartões partia palavras em colunas estreitas (nomes de categorias letra a letra no Orçamento, "Poupan/ças" na Carteira). As tabelas passam a quebrar só entre palavras, os valores monetários não quebram e há mais respiro entre colunas; a 1.ª coluna fica fixa ao deslocar na horizontal.
- 128 testes.

## Botão Editar layout no cabeçalho

- "Editar layout" saiu do corpo das páginas e passou para o cabeçalho, ao lado de mostrar valores e do tema (ícone de grelha). Só aparece onde há grelha (Painel, Parcelas, Carteira) e fica desativado durante a edição, quando continuam no corpo da página Repor, Cancelar e Guardar layout. Implementado em `lib/layout-editor.ts`.
- Chips de parcelas em Definições com altura mínima de 32 px.

## Melhorias visuais

- Valores em euros com milhares sempre agrupados (`4 850,00 €`, como `10 375,00 €`); antes o pt-PT só agrupava a partir de 5 dígitos.
- KPI com variação desfavorável a âmbar: nos Gastos, subir deixa de aparecer a verde (prop `deltaTone="up-bad"`).
- Tema claro: verde primário mais escuro (contraste de texto, selos e botões de 4,15:1 para mais de 5:1); 0 falhas de contraste medidas em 7 ecrãs.
- Texto de 9–10 px passa a 11 px; selo "man." com contraste suficiente.
- Alvos de toque nas listas (editar, duplicar, eliminar) de 28 px para 32 px; nomes de meses e cabeçalhos expansíveis com área maior.
- Telemóvel: KPIs em 2 colunas (os 6 cabem num ecrã), dicas que quebram linha em vez de ficarem cortadas, ícone de ajuda sem aumentar a altura do cartão.
- Cabeçalho com filtros fixo só em ecrãs com 760 px de altura ou mais.
- Cor de Matérias-Primas (castanho, parecido com o dourado de Outras Poupanças) passa a azul-turquesa na paleta e no seed.
- Tema escolhido (claro/escuro) é guardado no browser; antes voltava ao do sistema a cada recarga.
- 126 testes (novo: formato de euros).

## Auditoria — verificação em browser e remate

- Testado num browser real (modo dev e produção): 9 ecrãs, editor de mês (3 separadores), criação de lançamento, ativação/mudança do código e ecrã de bloqueio, exportações, gráficos, sem erros nem violações de CSP.
- Corrigido: depois de ativar ou mudar o código de acesso, a app recarregava o estado com o cabeçalho antigo (401, ecrã desatualizado ou bloqueio). O cabeçalho passa a usar o código novo antes do recarregamento.
- Corrigido: o formulário aceitava códigos de 4 caracteres, mas o servidor exige 8.
- Corrigido: a data por omissão de um novo lançamento é agora um dia do mês que se está a editar (antes era hoje, o que dava erro noutro mês).
- `DATA_DIR`/`DB_PATH`: base de dados, cópias e backups pré-importação podem ficar num volume persistente. `/api/health`. Paragem ordenada (SIGTERM/SIGINT) com consolidação do WAL.
- `npm run check-db -- caminho\data.db`: verifica uma cópia de uma base real (migração e consistência) sem a alterar.
- Valores em euros guardados com 2 casas decimais em todas as escritas (meses, parcelas, movimentos, alocações fixas, saldos e ajustes).
- Content-Security-Policy em produção (sem scripts inline, sem terceiros).
- `months.tsx` (1541 linhas) dividido em `pages/months.tsx` (308) e 5 módulos em `components/months/`.
- 125 testes.

## Auditoria — restante

- `seed.json` e `script/make-seed.py` com dados fictícios (Banco/Corretora/Exchange Exemplo, vencimento de 1500–1550 €) em vez de valores reais; o gerador escreve agora em `server/seed.json` por caminho relativo e verifica que a divisão nunca excede o líquido.

- Cópias automáticas da base de dados (diárias, 7 últimas) e limite de 10 `pre-import-backup-*.json`.
- CI (GitHub Actions): tipos, testes, audit e build em Node 20/22/24.
- `package.json` com nome e versão corretos; nota de histórico no relatório de segurança antigo.

## Auditoria — etapa 5

- `/api/state` deixa de enviar o histórico de alterações (rota própria `/api/change-log`, mais recentes primeiro); o backup JSON continua a incluí-lo. Histórico limitado a 20 000 entradas. A versão de sincronização offline ignora-o.
- Ecrãs carregados por rota (lazy): ficheiro principal de 1,6 MB para 0,86 MB; gráficos (0,40 MB) só no Painel.
- Fontes Inter e JetBrains Mono alojadas localmente (subconjunto latino, 90 kB); sem pedidos à Google e disponíveis offline.
- Ícones PWA regenerados (`npx tsx script/make-icons.ts`; os anteriores eram ponteiros do Git LFS), com variante maskable; favicon com caminho relativo.
- 122 testes.

## Auditoria — etapa 4

- `npm audit`: 0 vulnerabilidades (antes 4 altas e 2 moderadas). `xlsx` passou para SheetJS 0.20.3 (distribuição oficial cdn.sheetjs.com), em devDependencies porque vai dentro do bundle do servidor; `postcss-selector-parser` fixado em ^6.1.5.
- Removidas 19 dependências sem uso (Supabase, passport, express-session, framer-motion, next-themes, react-icons, ws, etc.) e 21 pacotes de UI, mais 26 componentes shadcn sem uso (incluindo o único `dangerouslySetInnerHTML`).
- `build.ts`: lista de bundle reduzida ao que existe; servidor compilado de 2,6 MB para 1,7 MB.
- 121 testes (novo: exportação XLSX).

## Auditoria — etapa 3

- Meses, parcelas e categorias validados no servidor (tipos, limites, enums); `status`/`carryIn` nunca aceites na criação.
- Duplicar um mês dá sempre um mês aberto, sem transporte, numa só transação (sem meses a meio).
- Eliminar uma parcela com movimentos, recorrências ou reservas devolve 409 (arquivar em vez de eliminar); eliminar um mês limpa o histórico de fechos.
- Todos os erros da API passam a `{ "message": "..." }`; erros internos não expõem detalhes.
- 4 novos testes de integridade (120 no total).

## Auditoria — etapas 1 e 2

- Arranque em Windows (reusePort só fora do Windows), better-sqlite3 12, `engines`, scripts com cross-env.
- Importação de backups até 50 MB (antes falhava acima de 100 kB).
- Código de acesso com hash, ausente do estado e dos backups, limite de tentativas também por cabeçalho, `ACCESS_CODE`, anti-CSRF, trust proxy, mudança de código corrigida.
- Validação das definições; 7 novos testes de segurança (116 no total).

- Datas opcionais (Data alvo das metas, Prazo das submetas, Fim das recorrências) têm um botão X para limpar o valor; na Data alvo grava logo como sem data.

- Correção: campos de data e mês (ex.: Data alvo nas metas) já não ultrapassam o cartão no Safari do iPhone.

## 1.9.1 | 2026-11-15

Publicação confirmada pela plataforma em 2026-11-15 no endereço https://salary-management.pplx.app, mantendo a visibilidade Private. O utilizador autorizou explicitamente publicar esta revisão sem backup e aceitou os avisos apresentados. O acesso privado impediu a validação autenticada da versão e a comparação dos registos reais; a preservação dos dados não foi verificada.

- Interface: estrutura e navegação adaptadas a computador, tablet e telemóvel; formulários sensíveis à largura do cartão, nomes longos com mudança de linha e janelas limitadas pelo espaço disponível.
- Layouts personalizados: empilhamento abaixo de 900 px úteis, sem reescrita automática das coordenadas guardadas; normalização de geometrias inválidas e quatro testes de regressão.
- Ajuda: correção da largura do índice/artigos; instruções sobre grelhas, campos, tabelas largas e o controlo independente das submetas.
- Metadados: versão da Ajuda e de `/api/app-info` alinhadas em 1.9.1; sem alterações ao esquema, aos registos ou às fórmulas financeiras.
- Evidência e limitações: [revisão responsiva](historico/revisao-responsiva-2026-11-15.md).

## Alterações anteriores

- Painel: botão independente em cada meta para mostrar ou esconder todas as suas submetas; ficam escondidas por omissão. As metas principais e os totais mantêm-se sempre visíveis.

- Painel: adicionada a apresentação de submetas no cartão Metas, com acumulado, objetivo, valor em falta e progresso. A apresentação inicialmente sempre visível foi depois substituída pelo botão independente por meta, fechado por omissão. Inclui metas principais sem objetivo que tenham submetas, moedas próprias e aviso de conversão incompleta; reutiliza o cálculo partilhado, sem duplicar saldos.

- Sessão de acesso retomada ao recarregar (sessionStorage, expira após 30 min de inatividade, renovada com o uso, 401 volta ao ecrã de código); melhorias mobile: zonas seguras, alvos táteis de 44 px, campos de 16 px sem zoom automático, zoom por pinça permitido, tema e atalho para o ecrã inicial

- Página Dados e backups renomeada para Definições e dividida em separadores: Cálculo, Catálogos, Backups e importação, Segurança e Histórico

- EVO-08: fecho mensal com transporte e reabertura, verificação de dados, planeado/executado, recorrências e reservas, simulador de metas, importação CSV, histórico, ocultar montantes, filtros persistentes, composição dos totais, versão e ambiente (migração aditiva, versão 1.8.0)

- Carteira usa o acumulado completo; nova linha "Saldos, ajustes e submetas" (f8a1a19)
- Painel e Orçamento usam o acumulado completo da meta; editar submetas (954c2b7)
- Cartões de parcelas com deslocação interna para o painel de submetas (d1cc3bd)
- Segurança: validação de transações e backups, limite de tentativas, código só por cabeçalho, logs sem respostas (85abac2)
- Confirmações dentro da aplicação e criação de categorias em Despesas (7cf3459)
- EVO-07 backup e restauro v3 com validação (09a42f3)
- EVO-06 Despesas (9f41ef2)
- EVO-05 ativos por plataforma (69e3bfa)
- EVO-04 metas, saldos, ajustes e submetas (b8edc8c)
- EVO-03 distribuição por plataforma (7e87150)
- EVO-02 plataformas e tipos (a1b6ed5)
