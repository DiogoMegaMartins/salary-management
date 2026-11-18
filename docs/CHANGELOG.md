# Changelog

Ordem do mais recente para o mais antigo.

## Ficheiros grandes divididos

- `shared/calc.ts` passa a reexportar cinco módulos em `shared/calc/` (`month`, `budget`, `distribution`, `goals`, `expenses`). Os imports `@shared/calc` não mudam.
- `server/storage.ts` perde a ligação e o esquema (`server/db.ts`) e os métodos de catálogos e de metas (`server/storage-catalogs.ts`, `server/storage-goals.ts`), compostos de volta no objeto `storage`. `storage`, `db`, `sqlite`, `httpError`, `roundCents`, `dataDir` e `dbPath` continuam exportados por `server/storage.ts`.
- O cálculo dos números do Painel sai de `dashboard.tsx` para `client/src/lib/dashboard-model.ts` (`buildDashboardModel`).
- Sem alterações de comportamento: mesmos 129 testes.

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
- Evidência e limitações: [revisão responsiva](revisao-responsiva-2026-11-15.md).

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
