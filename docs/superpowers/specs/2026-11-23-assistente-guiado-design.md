# Assistente guiado (fase 5)

Data: 2026-11-23. Estado: proposto, a aguardar aprovação. Continua `2026-11-23-meses-e-funcionalidades-design.md` (decisão 5). Fases 1 a 4 entregues; a fase 6 (IA) fica para depois.

## Intenção e porquê
Quem não conhece a app não sabe por onde começar. Um assistente em conversa, com perguntas curtas e botões, leva-o a fazer as tarefas mais comuns sem navegar pelos menus, e torna a app mais fácil, agradável e acessível.

## Objetivos
- Um **botão flutuante** sempre visível (computador e telemóvel) abre o assistente por cima do ecrã atual; o assistente não é uma página do menu.
- Quatro tarefas, por agora: **Registar o mês**, **Registar uma despesa**, **Distribuir o que sobra** e **Como estou este mês?** (resumo, só leitura). Mais tarefas acrescentam-se depois sem refazer a estrutura.
- Cada tarefa que grava mostra primeiro um cartão "Vou registar…" e **só grava ao confirmar**.
- Funcionalidade ligável (Definições › Funcionalidades › "Assistente", ligada por defeito); desligada, o botão desaparece.
- Acessível: teclado (Enter continua, Esc fecha), foco visível, respostas anunciadas ao leitor de ecrã, "Voltar atrás" corrige a resposta anterior.

## Não objetivos
- Interpretar frases livres (fica para a fase 6, com IA). O campo de texto serve para valores e datas.
- Guardar a conversa. Cada tarefa gravada fica no histórico de alterações que a app já tem.
- Tarefas de gestão avançada (apagar, editar, fechar mês, importar).

## Anti-objetivos
- Gravar sem confirmação, ou fora das regras da app (mês fechado, valores inválidos, parcelas fora do mês).
- Um segundo caminho de gravação com regras próprias: o assistente usa as mesmas mutações da interface.
- Cobrir a app com o botão (esconde conteúdo ou o menu do telemóvel).

## Constraints
- Reutiliza `useSave()` (`createMonth`, `createTransaction`, `createCategory`, `allocation`, `applyRules`) e as regras de `shared/division.ts` (distribuir o que sobra) e `shared/calc`.
- Mês novo: os mesmos valores por defeito do botão "Novo mês" (taxas das definições), e o modelo da Divisão é aplicado ao criar (já acontece no servidor).
- Despesa: tipo `expense`, `monthId` do mês que contém a data (se não existir, o assistente diz e oferece criar o mês).
- Regras do repositório (commits, PR, versão 1.21.0, CHANGELOG, Ajuda, sem segredos).

## Abordagens consideradas
- **A. Página própria "Assistente" no menu:** simples, mas obriga a sair do ecrã onde se está. Rejeitada pelo utilizador.
- **B. Botão flutuante que abre uma folha/diálogo (escolhida):** disponível em qualquer ecrã.
- **C. Interpretar texto livre já agora:** exige IA ou regras frágeis; adiada para a fase 6.

## Decisões
1. **Estrutura:** os fluxos são descrições de passos (pergunta, tipo de resposta, o que fazer a seguir) separadas da interface, para se testarem sem ecrã e para a fase 6 (IA) usar as mesmas ações.
2. **Registar o mês:** pergunta o vencimento (**valor base, bruto**, porque o líquido é calculado pela app); mês alvo = o primeiro mês aberto sem vencimento, ou o mês seguinte ao último; mostra no cartão bruto, líquido calculado e disponível; oferece "Dividir com o modelo" (aplica o modelo), "Dividir à mão" (abre a Divisão do mês) ou "Mais tarde".
3. **Registar uma despesa:** valor, categoria (das categorias ativas; "Outra…" cria uma categoria com o nome escrito, depois de confirmar), data (hoje, ontem ou escrita `dd/mm` ou `dd/mm/aaaa`); cartão de confirmação com "Editar" e "Cancelar".
4. **Distribuir o que sobra:** do mês aberto mais recente; mesmas opções e a mesma matemática do diálogo da Divisão (tudo para uma parcela, proporcional); sem sobra, diz "Já está tudo distribuído".
5. **Como estou este mês:** disponível, alocado, restante e despesas registadas do mês aberto mais recente, em duas linhas, com ligação para a Divisão.
6. **Botão:** canto inferior direito, acima da barra do telemóvel; esconde-se com o teclado aberto e enquanto o arranque está aberto; abre uma folha de ecrã inteiro no telemóvel e um painel lateral no computador.

## Fica para o construtor
Textos exatos das perguntas, ícones, animações, forma de anunciar mensagens ao leitor de ecrã, nomes de ficheiros e de `data-testid`, ordem das categorias nos botões (as mais usadas primeiro).

## Riscos
- Datas e valores escritos à mão: interpretador puro e testado (vírgula e ponto decimais, espaços, `dd/mm`, "hoje", "ontem"), com erro claro em vez de adivinhar.
- Mês inexistente para a data da despesa: pergunta se cria o mês.
- Botão a tapar conteúdo: posição testada em computador e telemóvel; desligável.
