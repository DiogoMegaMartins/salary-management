# Divisão renovada: parcelas do mês, mais fácil de usar, detalhe opcional e modelo

Data: 2026-11-23. Estado: proposto, a aguardar aprovação. Continua `2026-11-23-meses-e-funcionalidades-design.md` (fase 2 já entregue: página Divisão).

## Renumeração das fases
Fase 1 (interruptores) e fase 2 (página Divisão) estão feitas. Fica assim: **fase 3 Divisão renovada** (este documento), fase 4 arranque no primeiro uso, fase 5 assistente guiado, fase 6 assistente com IA (opcional).

## Intenção e porquê
Dividir o salário é o gesto mais frequente e hoje é pouco amigável: lista todas as parcelas ativas com um modo e um valor, sem ver de relance se sobra ou falta, sem poder deixar uma parcela de fora num mês, e com o detalhe por plataforma escondido num botão. Pessoas com perfis diferentes (só salário e despesas; ou investimentos e metas) têm de conseguir usar sem ruído e com o mínimo de passos.

## Objetivos
- **Escolher que parcelas entram em cada mês** (interruptor "entra neste mês"). Uma parcela fora não conta nem aparece na divisão do mês; o valor que tinha fica guardado.
- **Visão de relance:** barra colorida da divisão, "Por distribuir" sempre visível, estado "Tudo distribuído" em verde (com texto, não só cor), aviso quando excede.
- **Controlos mais fáceis:** botões − e + (passo ajustável), valor em € e percentagem lado a lado, alternar € ou %, tudo com teclado e leitor de ecrã.
- **"Distribuir o que sobra"** (tudo para uma parcela, proporcional, ou deixar), com pré-visualização antes de aplicar.
- **Detalhe opcional em três níveis:** parcela → plataforma → ativo, com os mesmos controlos e o mesmo "por detalhar" em cada nível. Só aparece se "Plataformas e carteira" estiver ligada; por defeito fechado.
- **Divisão-modelo por parcela para os meses novos:** o modelo inclui se a parcela entra por defeito, o modo e o valor, as plataformas e os ativos. "Guardar como modelo" guarda a divisão do mês aberto; "Aplicar modelo" preenche um mês; um **mês novo nasce já com o modelo aplicado**.

## Não objetivos
- Mudar as fórmulas de cálculo (disponível, alocado, restante).
- Criar movimentos a partir da divisão (continua a ser planeamento).
- Reajustar sozinho o detalhe de plataformas quando o valor da parcela muda (mostra "Por detalhar" ou "Excede").
- Arrastar para repartir (pouco acessível sem rato).

## Anti-objetivos
- Perder valores ao tirar uma parcela do mês ou ao aplicar um modelo (nunca apagar sem avisar).
- Sinal só por cor.
- Dois sítios para editar a divisão (continua a ser só a página Divisão).
- Modelo que sobrescreve em silêncio uma divisão já feita (aplicar modelo a um mês com dados pede confirmação).

## Restrições
- Já existem as "regras" por parcela (`parcels.default_mode` e `default_value`, botões "Guardar como regras" e "Aplicar regras das parcelas") e as tabelas `allocation_platforms` e `allocation_assets`. O modelo **estende** estas regras, não cria um segundo conceito; o nome visível passa a "modelo".
- Funciona em Node e Worker (migração `ALTER TABLE`/`CREATE TABLE IF NOT EXISTS` em `server/db.ts`), e backups antigos (sem os campos novos) restauram com tudo incluído e sem modelo de plataformas.
- Mês fechado: divisão só de leitura, como hoje.
- Funcionalidades da fase 1 mandam: sem "Plataformas e carteira" não há detalhe nem modelo de plataformas; sem "Divisão" não há página.
- Regras do repositório (commits, PR, versão, Ajuda, sem segredos).

## Abordagens consideradas
- **A. Só visual** (barra, −/+, tudo num ecrã): barato, mas não resolve escolher parcelas nem os meses novos. Rejeitada.
- **B. Divisão renovada com modelo guardado** (escolhida): estende as regras atuais, mantém um só sítio de edição.
- **C. Assistente passo a passo para dividir:** fica para a fase do assistente; não substitui o ecrã.
Para o "entra neste mês", comparou-se apagar a alocação (perde o valor) com uma marca `included` na alocação (guarda o valor). Escolhida a marca.

## Decisões
1. **Dados:** `allocations.included` (inteiro, por defeito 1); `parcels.default_included` (por defeito 1); novas tabelas do modelo `rule_platforms` (parcela, plataforma, modo, valor) e `rule_assets` (parcela, plataforma, nome, percentagem, nota, posição), espelho das tabelas mensais. *(Nomes exatos: do construtor.)*
2. **Calcular:** uma alocação com `included = 0` conta 0 e não entra em alocado, restante nem nas reconciliações; mantém `mode` e `value`.
3. **Aplicar modelo a um mês:** substitui as alocações das parcelas com modelo; nas que não têm modelo, não mexe. Num mês que já tem divisão, pede confirmação e diz o que muda.
4. **Mês novo:** nasce com o modelo aplicado (mês duplicado continua a copiar o mês de origem).
5. **"Guardar como modelo":** grava, por parcela, se entra, o modo e valor, e as plataformas e ativos do mês aberto.
6. **"Distribuir o que sobra":** só altera parcelas em € fixo (as em % mantêm a regra); mostra o resultado antes de aplicar.
7. **Navegação:** a página Divisão mantém o seletor de mês e os separadores; o detalhe abre dentro de cada parcela.

## Fica para o construtor
Nomes de colunas e tabelas, passo do −/+, textos de ajuda, ordem dos blocos em ecrãs largos, animações, pormenores de teclado (atalhos), valores de arredondamento (já existem em `shared/evo08`).

## Riscos
- Cálculo que ignore `included`: um só sítio (`allocationAmount` e o resumo) e teste por cenário (parcela fora, % de disponível, mês fechado).
- Modelo desatualizado a criar meses com valores velhos: o ecrã mostra "Aplicado o modelo" e permite desfazer pelo histórico/botão de desfazer existente.
- Migração e backups antigos: testes de restauro sem os campos novos.
