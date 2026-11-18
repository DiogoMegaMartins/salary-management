# Regras de cálculo

Implementadas em `shared/calc.ts` e cobertas por testes.

## Rendimento do mês
- Bruto = soma das componentes de rendimento; descontos = segurança social + IRS (base e extra).
- Líquido = bruto - descontos (com opção de excluir "outros" do IRS); o subsídio de alimentação entra conforme a definição `include_meal`.
- Disponível = líquido (e subsídio, se incluído) a repartir pelas parcelas.

## Alocação
- Modo fixo: valor em euros. Modo percentagem: percentagem do disponível.
- Distribuição por plataforma e por ativos usa cêntimos inteiros e arredondamento por soma acumulada, de modo que distribuído + restante = total.

## Movimentos
- Gastos = tipos `expense` e `withdrawal`. Transferências e aportes não contam como gasto.
- Transferências exigem origem e destino distintos.

## Acumulado de uma meta
Acumulado = histórico de alocações + saldo inicial + ajustes + submetas.
- Com saldo inicial: só contam contribuições do mês da data de referência em diante (inclusive) e aportes/retiradas desde essa data.
- Sem saldo inicial: histórico de alocações (saldos antigos preservados).
- Submetas noutra moeda são convertidas por taxa manual (direta ou inversa, a mais recente); sem taxa o total fica marcado como incompleto.
- Fonte única: `goalBreakdown` (cálculo) e `goalTotalOf` (cliente). Usada no Painel, Parcelas e metas, Orçamento (reserva) e Carteira.

## Orçamento
Orçado vs real por categoria, projeção de fim de ano, runway = reserva de emergência / despesas essenciais médias da janela definida, e sugestão de excedente acima do limite configurado.

## Planeamento
Distribuições por plataforma, ativos, saldos e submetas não criam movimentos nem posições reais.

## EVO-08: precisão, períodos e execução
### Precisão monetária
Somas e comparações são feitas em cêntimos inteiros (`toCents`, `sumEuros`, `round2`). Distribuições usam arredondamento por soma acumulada e a contribuição sugerida arredonda para cima ao cêntimo.

### Movimentos do período vs acumulado
O acumulado de uma parcela é sempre `goalBreakdown`: saldo inicial + alocações (desde o corte) + aportes/retiradas + ajustes + submetas, sem dupla contagem. O fluxo do período é só o que entrou nos meses filtrados.

### Planeado, alocado, executado, por executar
- Planeado: soma das alocações do mês. Alocado: planeado + aportes.
- Executado: despesas e retiradas registadas. Transferências internas nunca são despesas.
- Por executar: para parcelas de gastos, max(0, planeado - executado). Registos antigos não recebem estado retroativo: contam como executado/alocado conforme já existiam.

### Fecho mensal
Restante = disponível + transporte recebido - despesas - alocado - aportes. O transporte soma ao restante, não ao rendimento. Transporte de dezembro vai para janeiro do ano seguinte. Reabrir desfaz o transporte.

### Recorrências e reservas
Ocorrência em AAAA-MM com dia ajustado ao último dia do mês; chave `recorrência:AAAA-MM` única. Sugestão de reserva = ceil((alvo - reservado) / meses restantes) em cêntimos; prazo ultrapassado sugere o montante em falta.

### Simulador
Linear, sem rentabilidade: acumulado atual + contribuição mensal (exceto pausa) + reforços. Contribuição necessária = ceil((alvo - atual - reforços) / meses ativos até ao prazo).

### Verificação de dados
Erros: distribuição acima do disponível, percentagens fora de 0-100 ou somas acima de 100, referências inexistentes, transferências inválidas, valores não positivos. Avisos: por distribuir, possíveis duplicados (mesma data, valor, tipo, parcela e categoria).

## Ritmo das metas, ano anterior e despesas fora do padrão
Implementadas em `shared/calc/insights.ts` e cobertas por `tests/insights.test.ts`.

### Ritmo de uma meta (`goalPace`)
- Entradas: objetivo, data alvo (`AAAA-MM` ou `AAAA-MM-DD`), acumulado, ritmo mensal e o mês de referência (hoje).
- Em falta = objetivo − acumulado (arredondado a cêntimos). Ritmo mensal = média das contribuições dos últimos 3 meses.
- Meses necessários = ⌈em falta ÷ ritmo⌉. Meses até ao prazo = (ano e mês do prazo) − (ano e mês de hoje); 0 no próprio mês do prazo.
- Poupança necessária por mês = em falta ÷ máx(1, meses até ao prazo).
- Estados: `sem_objetivo`; `atingida` (em falta ≤ 0,005); `sem_prazo`; `prazo_passado` (meses até ao prazo < 0); `sem_ritmo` (ritmo 0); `no_ritmo` (meses necessários ≤ meses até ao prazo); `atrasada` (caso contrário, com atraso = necessários − até ao prazo).
- Mês previsto = mês de hoje + meses necessários.

### Comparação com o ano anterior (`yearOverYear`)
- Meses a comparar: os do filtro de período (omissão) ou os escolhidos no próprio cartão (qualquer ano com dados). A escolha fica guardada no dispositivo e vale no Painel e no Orçamento.
- Ano de comparação: o ano anterior de cada mês (omissão) ou um ano fixo à escolha. Um mês nunca se compara com ele próprio.
- Cada mês é emparelhado com o mesmo mês no ano de comparação. Meses sem par ficam de fora dos dois lados. Meses com o mesmo ano e mês (ex.: dois dezembros) contam como um par e somam-se de cada lado.
- Totais por lado: líquido, rendimento bruto, descontos, gastos (parcelas de gastos), poupança e investimento, disponível e total alocado a cada parcela. Taxa de poupança = (poupança + investimento) ÷ disponível. Carga fiscal efetiva = descontos ÷ bruto.
- Variação relativa = atual ÷ anterior − 1; sem valor anterior (0) e com valor atual, fica indefinida. A taxa de poupança e a carga fiscal comparam-se em pontos percentuais.
- Por categoria (`categoryYearOverYear`): despesas do tipo `expense` agrupadas por categoria (sem distinguir maiúsculas), nos meses emparelhados. Por parcela (`parcelYearOverYear`): total alocado a cada parcela, sem as parcelas vazias nos dois lados.

### Despesas fora do padrão (`spendAnomalies`)
- Mês analisado: o último mês do período com despesas. Histórico: até 12 meses anteriores existentes (meses sem gasto na categoria contam como 0). Sem pelo menos 3 meses anteriores, não há análise.
- Por categoria: média e desvio-padrão (populacional) do histórico. Alerta se gasto > média + 2 × desvio, gasto ≥ 1,5 × média e gasto ≥ 20 €.
- Categoria sem gasto no histórico (média 0): alerta `novo` se o gasto for ≥ 40 € (o dobro do mínimo).
- Ordenação por excesso sobre a média, do maior para o menor.


## Regras acrescentadas na 1.12.1

- Categorias comparam-se sem maiúsculas nem espaços nas pontas ("supermercado" = "Supermercado"), no orçamento e nas despesas essenciais.
- Projeção de fim de ano: meses restantes = 12 − mês corrente (ou, sem mês corrente no ano, o último mês registado).
- Sugestão de excedente: dividida em cêntimos; o resto vai para as primeiras parcelas e a soma fecha a zero.
- Uma data num mês fechado nunca desloca um movimento para esse mês (423). Eliminar uma parcela com alocação em meses fechados é recusado (409).
