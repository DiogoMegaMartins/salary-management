# Changelog

Ordem do mais recente para o mais antigo.

## 1.31.0 | 2026-11-27

Plano do mês remodelado e Início alinhado.

- **Plano do mês**: os 3 passos ficam numa coluna à esquerda, com "Mais ferramentas" por baixo (Gastos do mês, Parcelas e metas e, no Detalhado, Recorrências e reservas, Simulador de metas e Composição dos totais); o que se escolhe abre à direita (`pages/division.tsx`). Acabaram-se os separadores dentro de separadores, que se sobrepunham no Fecho (`ClosingPanel` removido; `Recurring`, `Simulator` e `Composition` passam a ferramentas).
- Os passos mudam de nome: **Quanto entra**, **Para onde vai** e **Fechar o mês** (`shared/dividir.ts`). O primeiro diz, quando é o caso, quanto foi transportado do mês anterior.
- Clicar em **Quanto entra** (mesmo com o mês já repartido) abre o total para repartir, o salário líquido do mês e o que foi transportado do mês anterior, com o nome desse mês (`components/salary-info.tsx`).
- **Fechar o mês** começa por uma lista do que falta (salário definido, valor repartido, mês acabado), por cima do fecho que já existia (`components/closing-checklist.tsx`).
- A vista aberta já não salta sozinha quando se acaba de repartir o valor: fica onde estás até escolheres outra.
- Início (Detalhado): quem tinha um layout guardado antes do resumo do mês via o resumo e os cartões desencontrados. Agora o grupo volta às posições por omissão e as secções de baixo descem o necessário (`migrateSavedLayout` em `lib/layout-geometry.ts`; o que está guardado não é alterado).
- Testes: `e2e/dividir.spec.ts` e `e2e/divisao.spec.ts` seguem a nova estrutura; novos testes de `migrateSavedLayout` e dos nomes e texto dos passos.

## 1.30.0 | 2026-11-26

Ajustes ao menu, ao Início e a Dividir.

- **Dividir passa a "Plano do mês"** no menu, no título da página, na Ajuda e nos botões. O endereço `/divisao` não muda.
- Plano do mês mais leve: os 3 passos passam a um só cartão suave (o passo em curso com fundo de cor, sem contorno forte); o cartão-resumo e os cartões das parcelas têm cantos mais redondos e mais espaço; "Por distribuir" fica alinhado à esquerda no telemóvel. Corrigida a sobreposição em que a barra de separadores tapava a parte de baixo dos passos (`pages/division.tsx`).
- Início (Detalhado): o resumo do mês ocupa metade da largura e os 6 cartões pequenos ficam ao lado, 2 por linha, na mesma grelha (`dashboard.tsx`; novo `itemClass` em `EditableSectionGrid`). Em ecrãs pequenos o resumo ocupa a largura toda e os cartões ficam por baixo. O resumo passa a ser uma secção do layout editável ("Resumo do mês"); as posições por omissão das outras secções desceram 4 linhas.
- Na barra lateral, "Mais" é um botão que mostra e esconde as outras opções (`nav-more-toggle`, `aria-expanded`). Começa fechado, abre sozinho quando a página atual é uma delas e lembra a escolha (`sm.nav.more`). No telemóvel nada muda.
- Registar despesa: a lista de categorias tem "+ Criar categoria…" (`register-expense.tsx`): escreve-se o nome, carrega-se em Criar e fica escolhida; se já existir, é reutilizada.
- Testes: `e2e/menu.spec.ts` cobre o botão Mais; a verificação do histórico de fecho em `e2e/dividir.spec.ts` já não depende de haver um mês fechado antes.

## 1.29.0 | 2026-11-26

Redesenho "Calma", fase 6: polimento e acessibilidade.

- Verificação automática de acessibilidade com o axe (`e2e/acessibilidade.spec.ts`, nova dependência de desenvolvimento `@axe-core/playwright`) em todos os ecrãs, nos temas claro e escuro, nos modos Básico e Detalhado, em computador e telemóvel, e nos diálogos abertos. O contraste das cinco paletas passou sem correções.
- Corrigido: 29 seletores sem nome para leitores de ecrã (`aria-label`); controlos dentro de controlos (ligação de ajuda dentro do cartão clicável do Início, botões dentro de opções na lista de parcelas); barras de progresso sem nome; cabeçalho de coluna vazio em Meses; títulos fora de ordem no Fecho; menu lateral e índice da Ajuda sem nome; tabela da Carteira com deslocação horizontal sem acesso por teclado.
- Novo botão "Saltar para o conteúdo" no primeiro Tab (`layout.tsx`); `main` aceita foco.
- Movimento reduzido (`prefers-reduced-motion`): sem transições nem animações, também no deslocamento suave dos separadores.
- Alvos de toque de 44 px no telemóvel (cabeçalho, navegação, botão Registar, assistente) ficam com teste.

## 1.28.0 | 2026-11-26

Redesenho "Calma", fase 5: restantes páginas.

- Cabeçalho das páginas em faixa suave (cor de destaque da paleta) com o título maior (`client/src/components/layout.tsx`), e cartões com cantos mais redondos, mais espaço interior e bordas mais leves (`SectionCard`, `Kpi`, `Card`). Aplica-se a todas as páginas.
- Modo **Básico** nas restantes páginas (`shared/ui-mode.ts`: `visibleSections`, `visibleSettingsTabs`): Despesas esconde "Despesas fora do padrão" e o filtro por plataforma (o filtro guardado deixa de se aplicar no Básico); Orçamento mostra só "Orçamento vs. real por categoria"; Carteira só o valor atual por parcela; Definições só Funcionalidades, Aparência, Backups e importação, e Segurança. O Detalhado mostra tudo como antes. Mudar de modo não apaga nada.
- Ajuda: igual nos dois modos.

## 1.27.0 | 2026-11-26

Redesenho "Calma", fase 4: Dividir.

- A página Divisão passa a **Dividir** e abre com o cartão "O teu mês em 3 passos" (`client/src/components/dividir-steps.tsx`, regras em `shared/dividir.ts`): **Salário** (vem do mês criado; se o mês não tem salário, aponta para Meses), **Repartir** (faltam X por distribuir, excede X ou tudo repartido) e **Fechar**. O passo em curso é o primeiro por fazer; cada passo pode ser aberto.
- Modo **Básico**: o cartão e o passo escolhido (Salário, Divisão ou fecho mensal), com uma ligação para "Parcelas e metas". Modo **Detalhado**: separadores Divisão, Movimentos, Parcelas e metas e Fechar o mês (este com Recorrências, Simulador e Composição lá dentro).
- Parcelas e metas e Fecho e planeamento passam a viver dentro de Dividir (`ParcelsPanel` em `pages/parcels.tsx`, `ClosingPanel` e `MonthClosing` em `pages/closing.tsx`). Saem do menu Mais; `/parcelas` e `/fecho` redirecionam para o separador certo (`/parcelas` só com a funcionalidade ligada).
- Dividir está sempre no menu, mesmo com Divisão e Movimentos desligadas (também guarda o fecho do mês). Atalho "f" passa a "Fechar o mês".

## 1.26.0 | 2026-11-25

Redesenho "Calma", fase 3: novo Início.

- O Painel passa a chamar-se **Início** e abre com o resumo do mês (`client/src/components/inicio-summary.tsx`): título do mês e dias que faltam, **"Valor disponível"** (gastos mensais planeados − despesas registadas; passa a **"Gasto acima do planeado"**, com o valor excedido, quando se ultrapassa o planeado), aviso de atenção (a partir de 85% gastos, com mais de 5 dias por andar; no estado normal e quando se excede não há frase, o título e a cor do valor já o dizem), barra de progresso e para onde vai o dinheiro. Seletor de mês (por defeito o último mês aberto). Sem gastos planeados, em vez de um número aparece "Define quanto queres gastar este mês" com ligação a Dividir. Regras em `shared/inicio.ts`.
- Contam as despesas sem parcela e as ligadas a parcelas de gastos; as ligadas a poupança ou investimento ficam de fora.
- Modo Básico: só o resumo, com as 3 maiores categorias. Modo Detalhado: o resumo com todas as categorias e o "Por distribuir", seguido dos filtros, indicadores e gráficos de sempre.
- Registar despesa pede a parcela, já preenchida com a parcela de gastos (a não arquivada de menor id); pode mudar-se ou escolher "Sem parcela".
- A primeira cor dos gráficos passa a ser o destaque da paleta escolhida.
- O atalho de teclado "p" e os testes passam a falar em "Início".

## 1.25.0 | 2026-11-25

Redesenho "Calma", fase 2: menu novo e botão Registar.

- Menu: três destinos à vista (Início, Dividir, Meses) e o resto agrupado em "Mais" (Despesas, Fecho e planeamento, Parcelas e metas, Carteira, Orçamento, Definições, Ajuda). Na barra lateral o grupo "Mais" está sempre visível; no telemóvel a barra de baixo tem Início, Dividir, Meses e Mais (a Despesas passou para o painel Mais). "Dividir" esconde-se se Divisão e Movimentos estiverem ambas desligadas. As rotas e os títulos das páginas não mudam (mudam nas fases 3 e 4). Modelo em `client/src/lib/nav.ts`.
- Botão "Registar despesa" fixo no fundo do conteúdo (`client/src/components/register-expense.tsx`): abre um diálogo com valor, categoria, data e nota. Propõe hoje, ou o último dia do último mês aberto se o mês de hoje não existir (`defaultRegisterDate` em `shared/assistant.ts`); recusa valor inválido, data sem mês e mês fechado, com mensagem clara; protege contra duplo clique. Só aparece depois do arranque e com pelo menos um mês. No telemóvel esconde-se enquanto se escreve noutro campo.
- Modo de utilização (`settings.ui_mode`, `shared/ui-mode.ts`): **Básico** ou **Detalhado**, em Definições › Funcionalidades. O botão "Registar despesa" só aparece no Básico. Instalações novas começam no Básico; bases que já existem (e backups antigos) ficam no Detalhado, por isso quem já usa a app não vê nada mudar. O que mais o modo esconde ou mostra vem na fase 3.
- O botão flutuante do assistente sobe no telemóvel para não ficar por baixo do botão Registar.

## 1.24.0 | 2026-11-25

Redesenho "Calma", fase 1: cores e temas.

- Cinco cores para a app (Céu por defeito, Sálvia, Pêssego, Lavanda e Maré), cada uma em claro e escuro, definidas em `client/src/index.css` (`:root[data-palette]` e `:root[data-palette].dark`). Um teste (`tests/paletas-contraste.test.ts`) garante contraste WCAG suficiente em todas.
- Definições › Aparência: escolha da cor e do modo (automático, claro, escuro). Fica guardada na conta (`settings.palette`, `settings.color_mode`) e numa cache local; um script externo (`client/public/appearance-boot.js`) aplica-a antes do primeiro desenho, por isso a app não pisca ao abrir. Quem já tinha escolhido claro ou escuro mantém essa escolha; no modo automático a app acompanha o sistema em tempo real.
- Valores e percentagens a subir ou a descer usam sempre verde (bom), âmbar (a subir o que é mau) e vermelho (a descer o que é bom), com as novas cores de estado `--success` e `--warning` (iguais em todas as paletas e com contraste verificado em `tests/paletas-contraste.test.ts`). Antes o "bom" usava a cor da paleta, que agora é azul.
- Letra Figtree, alojada na própria app (sem pedidos a terceiros).
- O botão de tema do cabeçalho continua a alternar claro e escuro (passou a fixar o modo).
- Regras partilhadas em `shared/appearance.ts`.

## 1.23.2 | 2026-11-25

Cursor, barras de separadores e Divisão no telemóvel.

- Cursor: o Tailwind 4 deixa os botões com a seta; passa a haver a mãozinha em tudo o que se carrega (botões, separadores, interruptores, caixas de seleção, opções de menus e ligações) e "não permitido" no que está desativado. Regra global em `client/src/index.css`.
- Barras de separadores coladas ao topo (Definições, Fecho e planeamento, Divisão): a barra cobre agora também o espaço por cima e ao lado (`.sticky-tabs`; o `[role=tablist] { max-width: 100% }` antigo cortava-a), por isso o conteúdo já não aparece por cima ou ao lado dela quando se desce na página.
- Barras de separadores no telemóvel: deslocam só na horizontal (`touch-action: pan-x`, sem deslocação vertical nem encadeamento à volta, e sem o desvio de 1 px do `-mb-px`); escolher um separador só desloca a própria barra (antes `scrollIntoView` também mexia na página). A linha por baixo passou a ser uma sombra interior.
- Divisão: apagadas as regras de CSS do antigo separador "Divisão" do editor do mês (`.division-summary` colava o resumo por cima das parcelas no telemóvel; `.allocation-*` mudavam o aspeto das parcelas e acrescentavam um segundo "Valor calculado").

## 1.23.1 | 2026-11-25

- Assistente com IA: a IA também entende "fechar o mês" (nova tarefa `fechar` no pedido e na validação da resposta). Entra no fluxo guiado de fecho, que pergunta o mês e, só se sobrar dinheiro, o destino; só fecha depois de confirmares.

## 1.23.0 | 2026-11-25

Fecho do mês e transporte do restante.

- Fecho mensal: com restante positivo, "Transportar para o mês seguinte" é o destino por defeito se o mês seguinte existir e estiver aberto (senão fica "Manter" e "Transportar" aparece desativado, a pedir que se crie o mês seguinte). Sem restante (0), ou com o mês em défice, não há destino a escolher: o botão "Fechar mês" fecha-o diretamente (a API não mudou). Regras em `shared/closing.ts`.
- Divisão: o transporte recebido (`carryIn`) passa a contar no "Disponível" e no "Por distribuir" (com uma nota "Inclui X transportados do mês anterior"); as parcelas em % continuam a ter o rendimento como base. O resumo de leitura do mês e a distribuição do que sobra usam o mesmo total.
- Assistente: nova tarefa "Fechar o mês" (mês aberto mais antigo ou à escolha; pergunta o destino só se sobrar dinheiro, e oferece transportar quando possível); o resumo do assistente mostra o transporte recebido.

## 1.22.0 | 2026-11-23

Assistente com IA para frases livres (fase 6): lógica pronta, **desativada**.

- Novo `POST /api/assistant/parse` e `GET /api/assistant/ai-status`. O servidor envia à Anthropic só a frase (até 300 letras), a data de hoje e os nomes das categorias; a resposta (JSON) é validada com `parseAmount`/`parseDate` (`shared/ai-intent.ts`) e entra no fluxo guiado já preenchido, com o mesmo cartão de confirmação. A IA nunca grava nem recebe totais.
- Três portas, todas fechadas por defeito: chave `ANTHROPIC_API_KEY` no servidor, opção `settings.ai_enabled` (0) ligada em Definições, e limite de 50 pedidos por dia (`ai_usage`). Sem chave, nada da IA aparece. Modelo `haiku` (Claude Haiku 5.5) por defeito, `sonnet` à escolha (`settings.ai_model`).
- Erros genéricos (502, 429, 503) que não revelam a chave nem a resposta do serviço; testado com um serviço simulado, incluindo o conteúdo enviado.
- Documentação em `docs/ASSISTENTE-IA.md`.

## 1.21.0 | 2026-11-23

Assistente guiado (fase 5 do plano "meses mais simples").

- Botão flutuante que abre uma conversa passo a passo (folha de ecrã inteiro no telemóvel, painel lateral no computador), com quatro tarefas: registar o mês (vencimento base, líquido calculado; cria o mês, que já nasce com o modelo, ou preenche o primeiro aberto sem vencimento), registar uma despesa (valor, categoria existente ou nova, data hoje/ontem/`dd/mm`/`dd/mm/aaaa`; recusa meses inexistentes ou fechados), distribuir o que sobra (mesmo cálculo da Divisão) e resumo do mês aberto mais recente.
- Só grava depois de mostrar um cartão "Vou registar…" e de confirmares; usa as mesmas mutações da interface, por isso valem as mesmas regras (mês fechado, validações). "Voltar atrás" e "Editar" corrigem respostas; Esc fecha. A conversa não se guarda.
- Nova funcionalidade `assistente` (ligada por defeito) em Definições › Funcionalidades; desligada, o botão desaparece. O botão esconde-se enquanto o arranque está aberto e, no telemóvel, enquanto se escreve.
- Leitura de valores e datas escritos à mão em `shared/assistant.ts` (testada); o cálculo de "distribuir o que sobra" passou para `shared/division.ts` e é partilhado entre a Divisão e o assistente.

## 1.20.0 | 2026-11-23

Arranque no primeiro uso (fase 4 do plano "meses mais simples").

- Novo diálogo "Bem-vindo": só salário e despesas (sempre incluído), "Também invisto" (Plataformas e carteira), "Tenho metas e poupanças" (Parcelas e metas), "Tenho IRS Jovem", ou "Ligar tudo (modo completo)". Divisão e Movimentos ficam sempre ligados; a Reconciliação só em "Ligar tudo". Não se fecha com Esc nem fora do diálogo, para não passar sem escolher.
- Nova definição `onboarding_done`: uma base que já tem meses conta como feito ao migrar (quem já usa a app não vê o arranque); uma base nova fica por fazer. "Repetir o arranque" em Definições › Funcionalidades volta a abri-lo, já com o que está ligado.
- Testes de interface: o arranque dá-se como feito antes de correr (`e2e/global-setup.ts`).

## 1.19.0 | 2026-11-23

Divisão renovada (fase 3 do plano "meses mais simples").

- Parcela fora do mês: interruptor "entra neste mês" por parcela. Uma parcela fora conta 0 no alocado, restante, reconciliação e verificação de dados, mas guarda o valor e o detalhe. Nova coluna `allocations.included` (por defeito 1) e `parcels.default_included`; backups antigos restauram com tudo incluído.
- Resumo de relance (barra, "Por distribuir", "Tudo distribuído" a verde, "Excede"), botões − e +, € ou % com conversão para o valor equivalente, e "Distribuir o que sobra" (tudo para uma parcela ou proporcional pelas parcelas em € fixo, com pré-visualização; soma exata em cêntimos).
- Modelo por parcela: as antigas "regras" passam a guardar também se a parcela entra, as plataformas e os ativos (novas tabelas `rule_platforms` e `rule_assets`). "Aplicar modelo" repõe tudo num mês (com confirmação se já houver divisão; sem plataformas no modelo, o detalhe do mês fica, e se o novo valor não o comportar nada muda). Um mês criado de raiz nasce com o modelo aplicado; um mês duplicado continua a copiar o de origem.
- Detalhe por plataforma e ativo: fechado por defeito ("Detalhar por plataforma"), com "Por detalhar" ou "Detalhe completo".

## 1.18.0 | 2026-11-23

Mês mais simples e página Divisão (fase 2 do plano "meses mais simples").

- Nova página `/divisao` (menu "Divisão"): seletor de mês e separadores Divisão (por parcelas, com plataformas e regras) e Movimentos (com a reconciliação, se estiver ligada). Aparece se Divisão ou Movimentos estiverem ligados; o mês por omissão é o último aberto, e `#/divisao/<id>` abre um mês concreto.
- O editor do mês deixa de ter separadores: só vencimento, com um resumo de leitura (alocado, restante, número de movimentos) e um botão para abrir a Divisão desse mês. Há um único sítio onde se edita a divisão. Em "Meses", no telemóvel, "Dividir valores" abre a Divisão do mês.
- Barra do telemóvel: Painel, Meses, Divisão, Despesas e "Mais" (a Carteira passa para "Mais").
- O código da divisão e dos movimentos foi extraído do editor para componentes próprios (`DivisionPanel`, `MovementsPanel`) sem mudar o comportamento.

## 1.17.0 | 2026-11-23

Funcionalidades ligáveis (fase 1 do plano "meses mais simples").

- Definições › Funcionalidades: interruptores para Divisão do salário, Movimentos, Parcelas e metas, Plataformas e carteira, IRS Jovem e Reconciliação. Desligar esconde (menu, barra do telemóvel, Painel, editor do mês) e não apaga dados; abrir a rota de uma funcionalidade desligada leva ao Painel. A Reconciliação precisa dos Movimentos.
- Sem divisão nem movimentos, o editor do mês mostra só o vencimento, sem barra de separadores.
- Nova definição `features` (JSON só com o que está desligado). Vazia = tudo ligado, por isso bases e backups antigos ficam como estavam. Migração automática no Node e no Worker.

## 1.16.0 | 2026-11-21

Separadores com linha verde em toda a aplicação.

- Os separadores de Definições, Fecho e planeamento, editor de Mês e da parcela passam a ter o mesmo estilo: texto cinzento, e o ativo com texto e linha verdes por baixo. Deixam de quebrar em duas linhas dentro de uma caixa cinzenta: se não couberem (telemóvel), deslocam na horizontal e o separador escolhido vem para a vista.
- Em Definições e Fecho, os separadores ficam fixos no topo enquanto o conteúdo desloca.

## 1.15.0 | 2026-11-21

Dependências principais atualizadas. Sem alterações de funcionalidades, fórmulas nem esquema de dados.

- React 18 → 19 e todos os componentes Radix na versão mais recente. Havia duas versões da camada de diálogos e, com React 19, confirmar dentro de um diálogo (ex.: "Descartar as alterações?") reabria a pergunta; ficou uma só.
- Vite 7 → 8 (com `@vitejs/plugin-react` 6 e esbuild 0.28).
- Tailwind 3 → 4 e tailwind-merge 2 → 3. A configuração passou de `tailwind.config.ts` para `client/src/index.css` (`@theme`); o `autoprefixer` deixou de ser preciso. As regras CSS próprias continuam fora das camadas do Tailwind para prevalecerem como antes; o editor de mês no telemóvel anula agora também a propriedade `translate`. Diferenças visuais de 2 a 4 px em alguns espaçamentos; o indicador do separador ativo na barra do telemóvel passou a ter o fundo que já estava previsto.
- Recharts 2 → 3.
- TypeScript 5 → 7: `baseUrl` saiu dos `tsconfig` (opção retirada).
- CI mais barato: o `e2e` passa a testar o Worker (o que corre em produção), em computador e telemóvel; nos ramos, o telemóvel corre só o essencial; o servidor Node é testado na `main` (`e2e-node`); o rasto do Playwright só se grava na repetição de um teste falhado. O job `e2e-worker` deixou de existir (fundiu-se no `e2e`).
- Parcelas no telemóvel: a parcela abre em ecrã inteiro, com botão de voltar, o nome e os separadores fixos no topo e só o conteúdo a deslocar (o topo fica sempre no mesmo sítio). O separador ativo passa a ter sublinhado verde.
- Auto PR: a descrição do PR passa a ser feita a partir dos commits (o que mudou, com a explicação de cada commit, e o tamanho) e atualiza-se a cada push, a não ser que seja escrita à mão. Novo `CLAUDE.md` com as regras de commits e PRs e modelo `pull_request_template.md`.
- Metas e submetas no telemóvel: separadores compactos (o número de submetas passa a um selo), botões principais de largura total no topo da Meta, bloco próprio para o valor de mercado (ganho ou perda), histórico em duas linhas sem partir palavras, seta nas parcelas da lista, explicação das submetas recolhida e botões com altura de toque. No Painel, a meta sem contribuições já não repete o aviso duas vezes.
- Ao terminar sessão, o código deixa de ficar escrito na caixa do ecrã de acesso (e o navegador não o preenche sozinho).
- Nome da aplicação: "Personal Salary Management" no menu lateral, no separador do navegador, no ecrã do código de acesso, no nome da aplicação instalada (manifesto) e no título no iOS.
- Deploy automático: o CI (job `auto-deploy`) só dispara o "Deploy (Cloudflare)" se existir a variável de repositório `AUTO_DEPLOY=true`; sem ela o workflow de deploy nem aparece em Actions (antes aparecia como ignorado). Por omissão fica só manual até os "Required reviewers" do ambiente `production` estarem ativos.
- O pacote `xlsx` volta a instalar-se no ambiente de desenvolvimento na nuvem (host `cdn.sheetjs.com` permitido).

## 1.14.0 | 2026-11-21

Parcelas e metas refeitas, sessão e deploy com aprovação.

**Parcelas e metas**
- Lista de parcelas (regra, plataformas, acumulado e progresso da meta) e, ao lado, o detalhe da parcela escolhida com separadores Meta, Submetas, Histórico e Definições. No telemóvel o detalhe abre num painel por cima.
- Dinheiro e mercado separados: "Registar entrada/saída" (muda o acumulado; inclui "Corrigir total" e "Transferir" entre a meta principal e as submetas, que não muda o total) e "Registar valor de mercado" (só mostra o ganho ou a perda). O valor de mercado aparece também na Carteira.
- Saldo inicial passa para Definições da parcela.
- Submetas em diálogo próprio, marcadas como "Objetivo" ou "Plataforma". Noutra moeda, a taxa aparece junto da submeta, com "atualizar" ou "Definir taxa"; deixou de haver uma lista de taxas repetida em todas as parcelas.
- Histórico único por parcela: saldo inicial, entradas, saídas e valores de mercado, com editar e remover.
- Sem alterações ao esquema de dados nem às fórmulas: entradas e saídas são ajustes com sinal, como antes.

**Outras alterações**
- Campos de mês (data alvo, prazos, recorrências, reservas) passam a ser uma escolha de mês e ano em português, igual em todos os navegadores (o campo nativo mostrava "----").
- Menu: "Terminar sessão" com confirmação (no telemóvel, no painel "Mais"); saiu a frase "Espaço privado". Versão, ambiente, formato de backup, último backup e atalhos passaram do rodapé do menu para o topo da Ajuda.
- Cartões vazios encolhem: "Orçamento vs. real por categoria" sem categorias e "Comparação mensal e anual" sem tabela (Painel e Orçamento), também com layout personalizado.
- Comparação mensal e anual: o ano de comparação escolhe-se sempre à mão (sem ano anterior por omissão).
- Deploy (Cloudflare) arranca sozinho quando o CI da `main` passa depois de um merge e espera pela aprovação no ambiente `production`.

## 1.13.0 | 2026-11-21

Auditoria completa: segurança do Worker, limpeza, layout e funcionalidades novas.

**Funcionalidades**
- Carteira: "Valor atual e rentabilidade". Registas o valor de cada parcela de poupança ou investimento numa data e a app calcula o ganho ou a perda face ao que lá foi posto (saldo de partida mais alocações até esse mês). Nova tabela `valuations`, rotas `POST /api/valuations` e `DELETE /api/valuations/:id`, incluída no backup. Formato de backup v4 (backups v3 continuam a importar).
- Relatório anual em PDF (resumo contra o ano anterior, mês a mês, parcelas, despesas por categoria e valor da carteira). O botão passou a chamar-se "Relatório" e tem "O que incluir".
- Despesas: botão "Todos os meses" para pesquisar em todo o histórico; "Desfazer" depois de remover uma despesa.
- Atalhos de teclado: `g` e uma letra para navegar, `/` para pesquisar, `?` para ver a lista.
- Menu lateral: mostra há quantos dias foi o último backup (a âmbar quando o lembrete passou).
- Ecrã do código: distingue falta de ligação de um erro do servidor.

**Segurança (Worker)**
- Cabeçalhos de segurança (CSP, `nosniff`, `Referrer-Policy`, `Permissions-Policy`) nos ficheiros estáticos, em `client/public/_headers`, com teste que garante o mesmo CSP do servidor Node.
- O limite de tentativas de código passa a guardar-se na base de dados (tabela `auth_failures`) e sobrevive aos reinícios do objeto. Antes ficava só em memória e reiniciava quando a Cloudflare descartava o objeto.
- O Worker deixou de devolver o texto do erro interno ao visitante (fica nos registos).
- CI: novo job `e2e-worker` (bateria de interface contra o Worker em local) e o deploy confirma `/api/health` no fim.
- Cópia diária opcional para o R2 (tarefa agendada 03:17 UTC; precisa de ligar o bucket, ver `docs/CLOUDFLARE.md`).

**Layout**
- Indicadores do Painel alinhados; filtro "Período personalizado" sem corte; taxas em Definições com vírgula; estados vazios compactos; total de Meses mais visível e "manual" legível; gráfico de rendimento com linhas retas.
- O menu duplicado do telemóvel saiu (fica a barra de baixo com "Mais"). A oferta "Aplicação no telemóvel e offline" passou para Definições > Segurança.

**Limpeza**
- Exportações sem uso passaram a internas, `nanoid` substituído por `crypto.randomUUID`, dependências menores atualizadas.

## Worker da Cloudflare (alterações desde a 1.12.7, publicadas antes da 1.13.0)

- Cloudflare: a app corre num Worker, com a interface em Static Assets e o Express e o SQLite dentro de um Durable Object. Ver `docs/CLOUDFLARE.md`. O servidor Node continua suportado.
- `server/app.ts`: criação da app Express partilhada pelo servidor Node e pelo Worker.
- Worker: o código de acesso compara-se em texto com o segredo `ACCESS_CODE` (sem scrypt no arranque), o limite de tentativas usa o IP real do visitante e a importação mostra o erro verdadeiro em vez de "Não foi possível ler o JSON".
- Worker: corrigido o erro 1101 ("Cannot perform I/O on behalf of a different Durable Object"). A Cloudflare descarta o objeto e cria outro no mesmo processo, que mantém os módulos em cache; o armazenamento ficava preso ao primeiro objeto. Agora o armazenamento do pedido vem de um contexto (`AsyncLocalStorage`) e a app Express cria-se uma vez por processo. O Worker também devolve o motivo da falha em vez do "error code: 1101".
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
