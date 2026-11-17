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
