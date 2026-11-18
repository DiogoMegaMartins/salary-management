# Revisão responsiva da app

Revisão de 15 de novembro de 2026 à Partição do Salário, focada na grelha, dimensões e utilização de campos, botões, formulários e janelas em computador, tablet e telemóvel. As correções foram inicialmente entregues na pré-visualização privada e, posteriormente, a plataforma confirmou a publicação da versão 1.9.1; o estado e as limitações de verificação em produção estão registados no final.

## Resultado

Não foram encontrados elementos a provocar scroll horizontal acidental na página ou na área principal nas 99 combinações finais de área/ecrã verificadas. As tabelas financeiras largas mantêm scroll horizontal localizado, para preservar as colunas sem comprimir os valores.

O aspeto e as funcionalidades existentes foram preservados, sem alterações ao servidor, ao esquema de dados ou às fórmulas financeiras. O controlo de mostrar/esconder submetas continua independente por meta e fechado por omissão.

## Correções implementadas

- **Estrutura e navegação:** a navegação lateral persistente passa a aparecer a partir de 1024 px, libertando espaço nos tablets mais estreitos. As colunas, a área principal e os grupos do cabeçalho passam a poder encolher e mudar de linha sem esmagar o título.
- **Despesas, recorrências e reservas:** os formulários passam a distribuir os campos de acordo com o espaço do próprio formulário, em vez de dependerem de uma grelha fixa para todo o ecrã. As ações de guardar e fechar podem mudar de linha.
- **Parcelas, metas e submetas:** os campos adaptam-se à largura de cada cartão, incluindo cartões personalizados estreitos. O histórico de saldos e ajustes, os cabeçalhos das submetas e os formulários de criação/edição podem reorganizar-se verticalmente.
- **Plataformas e catálogos:** os nomes compridos podem mudar de linha nos elementos de seleção e nos indicadores das plataformas escolhidas. Os botões de gestão têm colunas próprias, sem espremer o campo do nome.
- **Gráficos:** no cartão estreito de distribuição média, a legenda passa para baixo do gráfico. Não foram alterados os valores nem as séries financeiras.
- **Janelas e painéis:** as dimensões respeitam o espaço disponível, incluindo ecrãs horizontais baixos; o conteúdo extenso mantém scroll vertical. Os controlos de fechar têm uma área de 44 × 44 px.
- **Nova parcela e distribuição mensal:** a paleta de cores passa a mudar de linha e cada cor tem uma área de 44 × 44 px. As colunas de remoção de plataformas e ativos reservam espaço suficiente para os botões táteis.
- **Detalhe de movimentos:** os dados e as ações podem ocupar linhas diferentes, e o formulário de edição passa a adaptar as colunas ao painel.
- **Layouts personalizados:** abaixo de 900 px de largura útil, os cartões são empilhados sem reescrever automaticamente as coordenadas guardadas. A leitura de geometrias inválidas ou fora da grelha é normalizada para as doze colunas; guardar um layout em modo compacto continua a ter o efeito global indicado no aviso existente.
- **Ajuda:** o índice e o artigo passam a usar colunas que podem efetivamente encolher. Os títulos e conteúdos compridos deixam de alargar a grelha do telemóvel.
- **Controlos táteis:** campos e ações nos modos compactos ou de ponteiro tátil usam alvos maiores. Os interruptores e caixas de seleção preservam a dimensão visual do controlo, com uma área de toque alargada.

## Cobertura verificada

Os testes de interface usaram Chromium, com dados do ambiente de pré-visualização e respostas de teste isoladas quando era necessário simular conteúdo adicional. A cobertura abaixo distingue a navegação geral dos estados expandidos e não significa que todas as combinações possíveis de dados e ações tenham sido executadas.

| Conjunto | Cobertura | Resultado final |
|---|---|---|
| Áreas principais | Painel, Meses, Despesas, Fecho e planeamento, Parcelas e metas, Carteira, Orçamento, Definições e Ajuda | 99 combinações, sem scroll horizontal acidental de documento/área principal |
| Dimensões da matriz principal | 320×820, 375×820, 640×820, 768×1024, 820×1180, 1024×768, 1280×800, 1440×900, 1920×1080, 667×375 e 1024×600 px | Retrato, horizontal e alturas reduzidas |
| Definições e Fecho | Cinco separadores de Definições e quatro de Fecho, a 320, 768, 1024 e 1440 px | 36 verificações sem transbordo identificado |
| Formulários expandidos | Nova despesa; recorrências/reservas; metas, histórico e edição de submetas, a 320, 768, 1024 e 1440 px | 12 verificações sem campos a sair da grelha |
| Editor de mês existente | Vencimento, Divisão com linhas de plataformas em rascunho, Movimentos com formulário aberto | 15 verificações em cinco dimensões, incluindo 667×375 px |
| Janelas | Relatório, detalhe de movimentos, nova parcela, nova categoria de orçamento e novo mês | 20 verificações de limites e scroll horizontal, sem falhas finais |
| Ajuda | 19 artigos, a 320, 768, 1024 e 1440 px; pesquisa e seleção de artigo no telemóvel | 76 verificações de artigos sem transbordo identificado |
| Layouts guardados | Painel, Parcelas e Carteira com cartões de três colunas, a 320, 768, 1024 e 1440 px | 12 verificações; empilhamento nos espaços compactos e grelha em computador |
| Conteúdo adicional | Nomes longos, nomes sem espaços e saldo fictício elevado; seletor de plataformas no telemóvel | Transbordo encontrado nos indicadores de plataformas a 320 px corrigido e revisto |
| Ativos e detalhe de movimentos | Editor de ativos em quatro larguras; edição de movimento em três larguras, através de respostas GET isoladas | Sem transbordo identificado; pedidos de escrita bloqueados nestes testes |

## Interações e regressões

- **Submetas no Painel:** confirmado o estado fechado por omissão, também após recarregar. Abrir uma meta não abre a outra; Enter e Espaço continuam a operar o botão.
- **Arrastar e redimensionar:** em computador, foi confirmada a alteração das posições e dimensões do rascunho com rato. Em emulação tátil Chromium, sequências CDP de toque alteraram a posição e a altura de um cartão; outra sequência de toque fez scroll na área principal através de um cartão normal.
- **Navegação e utilitários:** verificados o menu de navegação, o painel Mais, a navegação/pesquisa da ajuda e a alternância de tema e de ocultação de montantes, com reposição do estado.
- **Verificações técnicas:** TypeScript aprovado, 109 testes automáticos aprovados e compilação de produção concluída. Foram acrescentados quatro testes de regressão para limites, valores inválidos, preservação e empilhamento da geometria dos cartões.
- **Impeccable:** o detetor de código devolveu uma lista vazia de ocorrências nos alvos examinados. A inspeção visual e os testes de interação foram efetuados separadamente; o resultado do detetor não é uma certificação de acessibilidade ou de segurança.
- **Pré-visualização alojada:** confirmados o carregamento do Painel, o estado inicial das submetas e a sua expansão independente a 375 px. A 768 px, os cinco campos da nova despesa apresentaram 168 × 44 px, sem transbordo do formulário ou da área principal.

## Limitações e observações

- **Dispositivos e navegadores:** não foram utilizados iPhone, iPad ou Android físicos, nem os motores Safari/WebKit e Firefox. Os testes de toque são sintetizados em Chromium e não certificam o comportamento do teclado virtual, barras do navegador ou gestos do sistema nesses dispositivos.
- **Operações sensíveis:** não foram executados restauros, importações destrutivas, fechos de mês ou alterações de códigos de acesso apenas para testar o layout. A presença e disposição das respetivas áreas foram revistas, mas esta revisão não certifica novamente esses fluxos de escrita.
- **Dados de produção:** os testes não utilizaram a base de dados de produção. A pré-visualização não deve ser tratada como cópia de segurança dos registos publicados.
- **Avisos de compilação:** mantêm-se avisos de dimensão do bundle e de ferramentas/dependências. Não impediram a compilação; otimização de carregamento não foi o objetivo desta revisão.
- **Primeiro carregamento alojado:** a primeira tentativa de abertura apresentou uma falha transitória de carregamento de recursos. Os recursos responderam depois com sucesso e uma atualização da página permitiu concluir os testes alojados; o incidente foi registado.
- **Âmbito:** não se atribui uma classificação global de acessibilidade, segurança ou desempenho. A conclusão é limitada aos cenários responsivos e interações descritos.

## Estado de entrega

O código, os testes e este relatório ficam guardados nos ficheiros do projeto. A pré-visualização da app existente foi atualizada; o estado abaixo complementa a revisão inicial sem alterar a sua cobertura ou limitações.

### Preparação da publicação e documentação

O utilizador pediu a publicação e a atualização da documentação em 15 de novembro de 2026. A Ajuda integrada, o guia, o README, o changelog e as instruções de publicação foram atualizados; os metadados da Ajuda e do servidor passam a identificar a versão 1.9.1. Esta alteração de metadados não modifica a lógica do servidor ou as fórmulas financeiras.

Antes de publicar, o acesso privado da plataforma impediu a exportação dos registos reais no navegador de verificação; uma base de dados de pré-visualização não os substitui. O utilizador autorizou então especificamente a publicação desta revisão sem backup, aceitando o risco de perda de registos e os avisos de segurança descritos em `SEGURANCA.md`. A autorização anterior de outra versão não foi reutilizada.

Após a atualização da documentação, passaram novamente a verificação TypeScript, os 109 testes e a compilação. Foram repetidas 22 verificações locais a 375 e 1440 px: as nove áreas e os artigos Notas de versão, Painel e Usar no telemóvel, sem transbordo horizontal de documento/área principal ou erros de página observados. A Ajuda 1.9.1 foi também confirmada na pré-visualização alojada a 375 px, incluindo a navegação pelo índice para as instruções de submetas e layouts, sem transbordo de página. `/api/app-info` no ambiente de pré-visualização devolveu 1.9.1.

### Publicação confirmada pela plataforma

A plataforma devolveu o estado `published` em 2026-11-15 para https://salary-management.pplx.app e a visibilidade `Private`. A abertura pós-publicação voltou a encontrar a autenticação da plataforma; não foi possível verificar a versão da interface ou os fluxos autenticados em produção. Não foi feita comparação dos registos antes/depois e não se afirma que os dados ou o código de acesso tenham sido preservados.

Os resultados detalhados em `docs/qa/responsive-results-2026-11-15.json` representam a execução de QA anterior à publicação e mantêm o seu marcador histórico `productionPublished: false`. Não constituem testes executados na base de dados publicada. Os controlos de visibilidade estão em https://www.perplexity.ai/computer/a/d0b63f6a-1ad0-4717-bcf5-29203f5625c2?open-publish=true.
