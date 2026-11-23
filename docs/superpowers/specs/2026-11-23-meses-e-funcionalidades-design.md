# Meses mais simples, funcionalidades ligáveis e assistente

Data: 2026-11-23. Estado: aprovado em conversa (desenho), por fases.

## Intenção e porquê
A app mostra tudo desde o primeiro minuto (IRS Jovem, plataformas, parcelas, reconciliação). Para quem chega de fora, isso pesa. Queremos que registar um mês seja fácil, agradável e acessível para **todo o tipo de pessoas e perfis**, e que cada pessoa possa **desligar o que não usa**.

## Objetivos
- Interruptores de funcionalidades em Definições. Desligado = some do menu, do mês e do Painel. Os dados não se apagam.
- Arranque no primeiro uso (2 a 3 perguntas) que liga os interruptores certos, com atalho "Ligar tudo".
- Mês só com o essencial (mês, vencimento, outros rendimentos, notas). Divisão e movimentos passam para um menu próprio "Divisão".
- No mês fica só uma **vista de leitura** (resumo da divisão e dos movimentos) com ligação para editar na Divisão. Há um único sítio de edição.
- Assistente em conversa, guiado (sem IA), com botões de resposta rápida e texto livre simples.
- Boa acessibilidade: teclado, leitor de ecrã, rótulos e ajuda curta em cada campo.

## Não objetivos
- IA de linguagem livre nesta entrega (fase futura, ver abaixo).
- Apagar ou migrar dados ao desligar uma funcionalidade.
- Mudar os cálculos do mês.

## Anti-objetivos (seria falha mesmo a funcionar)
- Esconder funcionalidades sem a pessoa conseguir voltar a ligá-las.
- Dois sítios onde se edita a mesma coisa.
- Perder dados de quem já usa a app.

## Restrições
- Hoje só há interruptores soltos em `settings` (tabela única). A app corre em Node (testes) e no Worker (produção, Durable Object com SQLite): a alteração de esquema tem de existir nos dois e ser compatível com backups antigos.
- Quem já usa a app (utilizador atual) deve ver **tudo ligado** depois da atualização: o valor por defeito para dados existentes é "completo".
- Rotas por hash (wouter). Menu lateral e barra inferior móvel em `client/src/components/layout.tsx`.
- Testes de interface existentes referem separadores `tab-divisao` e `tab-movimentos` do editor do mês; têm de ser atualizados.
- Regras do repositório: um commit por tema, PR com Resumo/O que mudou/Como foi testado/Antes do merge, versão e CHANGELOG, sem segredos.

## Abordagens consideradas
- **A. Modo Simples ou Completo** (um interruptor): simples de explicar, mas rígido. Rejeitada.
- **B. Funcionalidades ligáveis uma a uma:** serve todos os perfis e responde ao pedido de desligar funcionalidades. **Escolhida**, com arranque no primeiro uso.
- **C. Assistente passo a passo:** muito amigável, mas lento para quem já sabe o que quer. Escolhida **só como funcionalidade extra** (ecrã de conversa), não como único caminho.

## Decisões
1. **Funcionalidades:** divisão, movimentos, parcelas e metas, plataformas e carteira, IRS Jovem, reconciliação, assistente. Guardadas como JSON numa coluna nova `features` de `settings` (vazia = tudo ligado, para dados antigos). *(Decisão do construtor: formato exato.)*
2. **Arranque:** aparece uma vez (marca guardada em `settings`), perguntas: só salário e despesas; também invisto; metas e poupanças; IRS Jovem; "Ligar tudo". Pode repetir-se em Definições.
3. **Divisão:** nova página `/divisao` com separadores Divisão e Movimentos, no menu e na barra móvel quando ativa. Sem divisão do mês, mostra "Criar divisão deste mês". O código atual de divisão e movimentos muda de sítio, não se reescreve.
4. **Mês:** o editor perde os separadores Divisão e Movimentos; mostra um cartão "Próximo passo" depois de guardar, e um resumo de leitura quando já há dados.
5. **Assistente guiado:** fluxo escrito à mão (vencimento do mês, dividir como no mês anterior, destino do que sobra, registar um movimento). Cada escrita mostra-se e só grava depois de confirmar. Usa as mesmas funções de gravação da app.

## Fases (um PR cada)
1. Interruptores de funcionalidades (coluna, API, Worker, página Definições › Funcionalidades, esconder menu/Painel).
2. Mês simples e página Divisão (mover divisão e movimentos, resumo de leitura, testes atualizados).
3. Arranque no primeiro uso.
4. Assistente guiado.
5. (Futura, opcional) Assistente com IA.

## Fase futura: assistente com IA
Frases livres interpretadas por um modelo, que chama as mesmas funções do assistente guiado. O pedido passa pelo Worker; a chave fica como segredo do Worker, não no código. Desligado por defeito, com aviso de que os dados saem para um serviço externo, limite diário de custo, e **nunca grava sem confirmação**. Cada instalação usa a sua chave.

## Fica para o construtor
Formato exato de `features` e migração nos dois motores, nomes de rotas e de `data-testid`, texto das perguntas do arranque, textos de ajuda por campo, ordem dos separadores em móvel.

## Riscos
- Esconder uma funcionalidade usada por outra (ex.: Painel que lê metas): cada ecrã que a usa tem de respeitar o interruptor. Mitigação: lista única `useFeature()` e teste por interruptor.
- Utilizadores atuais surpreendidos pela Divisão noutro menu: nota de versão na Ajuda e manter ligação no mês.
