# Guia do utilizador

## Painel
Visão geral do período escolhido nos filtros (período, ano, meses, tipo, parcelas). Mostra líquido total, média mensal, taxa de poupança, gastos, carga fiscal e valor por alocar. O cartão Metas mostra, para cada parcela com meta, o acumulado completo (histórico de alocações, saldo inicial, ajustes e submetas), o que falta e o ritmo estimado. O botão "Editar layout" (ícone de grelha, no cabeçalho, junto de mostrar valores e do tema; existe no Painel, nas Parcelas e na Carteira) permite reordenar e redimensionar os blocos, incluindo cada cartão de indicadores no topo (Painel e Carteira), a faixa de regras das Parcelas e os cartões do Orçamento; o layout fica guardado neste navegador e nas definições.

No cartão Metas, usa o botão de cada meta para mostrar ou esconder todas as suas submetas. Começam escondidas, incluindo depois de recarregar; abrir uma meta não abre as outras. Cada submeta mostra o acumulado, o objetivo, o valor em falta e o progresso na moeda respetiva, com aviso quando falta uma taxa de conversão. Este controlo só muda a apresentação.

Mais leituras no Painel (versão 1.10.0):
- **Ritmo das metas:** numa meta com objetivo e data alvo, um aviso diz quando, ao ritmo dos últimos 3 meses, o objetivo só chega depois do prazo, em que mês chega e quanto seria preciso poupar por mês. As metas fora do ritmo ficam resumidas numa faixa no topo.
- **Comparação mensal e anual:** líquido, rendimento bruto, descontos, carga fiscal, gastos, poupança, taxa de poupança e total alocado por parcela (com cada parcela por baixo). O botão "Tipo de comparação" tem "Comparar com ano" (escolhes primeiro o ano e depois os meses; o ano de comparação lista só os outros anos) e "Comparar com mês" (escolhes um ano, os meses de base e os de comparação, do mesmo ano; com tamanhos diferentes comparam-se médias mensais). A escolha fica guardada neste dispositivo e vale também no Orçamento; "Repor" volta ao filtro.
- **Despesas fora do padrão:** passou para a página Despesas. Mostra as categorias do mês escolhido bem acima do habitual (precisa de 3 meses anteriores).
- **Relatório:** botão no cabeçalho; descarrega em PDF, com opção de ocultar valores. Em "O que incluir" escolhes o período filtrado ou um ano completo (resumo contra o ano anterior, mês a mês, parcelas, despesas por categoria e valor da carteira).

## Meses
Cada mês tem rendimento bruto, subsídio de alimentação, descontos (segurança social e IRS) e a alocação por parcela (valor fixo ou percentagem). Pode duplicar um mês, aplicar as regras por omissão das parcelas e guardar a alocação atual como regras. A distribuição por plataforma e por ativos dentro de cada parcela é planeamento: não cria movimentos.

## Despesas
O botão "Todos os meses" faz a pesquisa e os totais valerem para todo o histórico, não só para o mês escolhido. Depois de remover uma despesa, o aviso oferece "Desfazer".
Registo de despesas, transferências entre parcelas, aportes e retiradas, com data, categoria e nota. As categorias podem ser criadas na própria lista ("+ Nova categoria…"). Eliminar pede confirmação dentro da aplicação. Transferências exigem origem e destino diferentes. Só despesas e retiradas contam como gastos.

## Parcelas e metas
- Cada parcela tem tipo, regra por omissão, plataformas, meta e data alvo. Para remover a data alvo (ou o prazo de uma submeta, ou o fim de uma recorrência), toca no X ao lado do campo.
- "Saldos, ajustes e submetas" mostra o acumulado: histórico de alocações + saldo inicial + ajustes + submetas.
- Saldo inicial: com data de referência, só contam contribuições do mês dessa data em diante (inclusive).
- Ajustes: valores positivos ou negativos com nota.
- Submetas: criar, editar (lápis: nome, plataforma, objetivo, prazo) e eliminar. A moeda só muda enquanto a submeta não tem saldos.
- Taxas de conversão manuais: 1 origem = taxa x destino. Sem taxa, o total fica marcado como incompleto.
- Os cartões deslocam-se internamente quando o painel está aberto.

## Carteira
Acumulado por parcela ao longo do tempo, por ano e por plataforma. Os totais incluem saldos, ajustes e submetas; a tabela por ano mostra os fluxos anuais e uma linha "Saldos, ajustes e submetas" para a conta fechar.
Em "Valor atual e rentabilidade" registas quanto vale cada parcela de poupança ou investimento numa data ("Registar valor"). A app mostra o que lá puseste (saldo de partida mais alocações até esse mês), o valor, o ganho ou a perda e a percentagem. Não vai buscar cotações: escreves tu o valor. A percentagem não conta o tempo (não é anualizada). Os valores entram no backup e no relatório anual.

## Orçamento
Orçado vs real por categoria, projeção até ao fim do ano, runway da reserva de emergência (parcelas marcadas nas definições) e sugestão de distribuição de excedente.
Em baixo, a despesa por categoria na comparação mensal e anual. As despesas fora do padrão estão na página Despesas.

## Definições (antiga página Dados e backups)
Organizada em cinco separadores; o último separador aberto fica lembrado nesta sessão.
- Cálculo: regras de cálculo (descontos, subsídio), objetivos e reserva de emergência, e fórmulas usadas.
- Catálogos: plataformas, tipos de parcela e tipos de movimento (arquivar ou eliminar com confirmação).
- Backups e importação: exportar JSON e XLSX, importar backup (pré-visualização, confirmação e cópia automática), Verificar dados e Importar CSV.
- Segurança: código de acesso.
- Histórico: registo de alterações financeiras relevantes.
A rota `#/dados` continua a funcionar.

## Ajuda
O menu Ajuda e documentação reúne a ajuda integrada e as regras de cálculo.

## Atalhos de teclado
`g` e depois uma letra navegam: `p` Painel, `m` Meses, `d` Despesas, `f` Fecho, `a` Parcelas, `c` Carteira, `o` Orçamento, `s` Definições, `h` Ajuda. `/` põe o cursor na pesquisa de Despesas e `?` mostra a lista. Não funcionam enquanto escreves num campo.

## Dicas
- Exporta um backup JSON todos os meses.
- Se algo não aparecer após uma atualização, faz refresh forçado (Ctrl+Shift+R).

## Fecho e planeamento (menu novo)
### Fecho mensal
Revisão guiada em cinco passos: rendimentos, despesas e movimentos, distribuições (planeado, alocado, por executar), pendências e montante restante. O restante pode ser transportado para o mês seguinte, usado para reforçar uma parcela/meta (cria um aporte) ou mantido como não atribuído. O transporte aparece no mês seguinte como "Transporte" e não conta como rendimento. Um mês fechado recusa alterações financeiras (também no servidor); reabre-o com um motivo, o que desfaz o transporte e fica no histórico.

### Recorrências e reservas
- Despesas recorrentes geram ocorrências pendentes; confirmar cria a despesa uma única vez, ignorar retira a ocorrência. O dia 31 ajusta-se ao último dia de meses mais curtos.
- Reservas guardam dinheiro para uma despesa futura e não são despesas pagas. A sugestão mensal = (alvo - já reservado) / meses até ao prazo. Marcar como paga cria a despesa.

### Simulador de metas
Contribuição mensal, reforço pontual, pausa e prazo. Sem rentabilidade nem inflação. Mostra quando a meta não é atingível e a contribuição necessária para o prazo. Não altera dados.

### Composição dos totais
Para cada parcela mostra o acumulado decomposto (saldo inicial, alocações, aportes/retiradas, ajustes, submetas) com os registos de origem, e separa o fluxo do período do acumulado.

## Novidades em Definições
- Verificar dados: erros (bloqueantes) e avisos (informativos) com sugestão de correção. Não altera nada sozinho.
- Importar CSV: escolher ficheiro, mapear colunas, pré-visualizar (erros por linha, duplicados, resumo) e confirmar. Aceita ; , ou tab, datas DD/MM/AAAA ou AAAA-MM-DD, montantes 1.234,56 ou 1234.56. Importação transacional; o mesmo ficheiro não é reimportado sem confirmação explícita.
- Histórico de alterações: movimentos, alocações, fechos, importações e metas.
- Versão, ambiente e há quantos dias guardaste o último backup aparecem no rodapé do menu lateral.

## Telemóvel
- Formulários e campos reorganizam-se conforme a largura disponível em cada cartão; janelas e painéis respeitam a largura e a altura do ecrã.
- A navegação lateral persistente aparece a partir de 1024 px de largura do ecrã; em espaços menores usa-se a navegação compacta.
- Abaixo de 900 px de largura útil, os layouts personalizados empilham sem alterar automaticamente as coordenadas guardadas. Guardar explicitamente no editor compacto continua a aplicar o layout globalmente.
- Tabelas financeiras largas podem ter deslocação horizontal dentro do seu contentor; isso é intencional e não deve alargar a página.
- Despesas: valor, categoria e data; categorias recentes e favoritas; "Guardar e adicionar outra"; aviso de gravação; o botão fica bloqueado enquanto guarda, para não duplicar.
- Filtros de Despesas ficam guardados neste navegador.
- O ícone do olho no cabeçalho oculta montantes no ecrã (desfoque). Não é controlo de acesso: os dados continuam a ser enviados e protegidos só pelo código de acesso.

## Validação responsiva

A versão 1.9.1 inclui uma revisão em Chromium, com dimensões de computador, tablet, telemóvel e ecrã horizontal baixo. A cobertura e as limitações estão descritas no [relatório responsivo](revisao-responsiva-2026-11-15.md); dispositivos físicos, Safari/WebKit e Firefox não foram certificados.
