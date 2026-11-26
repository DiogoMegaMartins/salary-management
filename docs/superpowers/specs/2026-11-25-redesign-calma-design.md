# Redesenho "Calma": novo aspeto e navegação

Estado: entregue (fases 1 a 6). Fase 1 (cores e temas) entregue na 1.24.0; fase 2 (menu e Registar) na 1.25.0; fase 3 (novo Início) na 1.26.0; fase 4 (Dividir) na 1.27.0; fase 5 (restantes páginas) na 1.28.0; fase 6 (polimento e acessibilidade) na 1.29.0

## Intenção
Quem chega à app pela primeira vez vê demasiada informação e não encontra o caminho para tarefas simples, como dividir o salário. O objetivo é uma app mais leve, descontraída, intuitiva, acessível e atual, para todo o tipo de pessoas. O aspeto e a organização mudam de forma radical. Os dados e as regras de negócio não mudam.

## Objetivos
- Ecrã inicial que responde, de relance, a: como está este mês, quanto sobra, para onde vai o dinheiro, registar uma despesa.
- Menu organizado pelo que a pessoa quer fazer, não pela estrutura interna.
- Modo **Básico** (essencial) e **Detalhado** (tudo), como parte das Funcionalidades já existentes.
- Escolha da cor da app e do modo claro/escuro em Definições.
- Acessibilidade: contraste suficiente, teclado, leitores de ecrã, movimento reduzido, alvos de toque grandes.

## Não objetivos
- Não muda a base de dados, a API nem as regras de cálculo.
- Não remove funcionalidades. O que sai do menu continua acessível em "Mais" ou no modo Detalhado.
- Não há conta de utilizador nem novas integrações.

## Anti-objetivos (falha mesmo que "funcione")
- Pessoas que já usam a app deixarem de encontrar o que usavam. As rotas antigas redirecionam para o sítio novo.
- Texto com pouco contraste só para parecer "leve".
- Duas maneiras diferentes de chegar ao mesmo sítio no menu (ex.: "Registar" repetido).

## Decisões do utilizador
- **Direção:** "Calma" (opção A): cartões redondos, um número grande, frase que tranquiliza.
- **Topo do Início:** opção 2, título do mês ("Novembro", "2026 · faltam 9 dias"), pesquisa e definições à direita. Faixa suave, sem muito contraste. O valor ("Sobra este mês") logo por baixo, grande mas não pesado.
- **Cor por defeito:** Céu (azul claro). Outras: Sálvia, Pêssego, Lavanda, Maré. Escolha em Definições › Aparência.
- **Tema:** claro e escuro automático por defeito, com opção de forçar um deles.
- **Menu:** lateral no computador; barra em baixo no telemóvel. Destinos: **Início, Dividir, Meses, Mais**. "Registar" não é destino do menu.
- **Botão "Registar despesa":** sempre à mão e **por baixo do conteúdo** (decisão do utilizador).
- **Modo Básico/Detalhado:** faz parte de Definições › Funcionalidades.
- **Construção:** por fases, cada uma validada e fundida antes da seguinte.

## Abordagens consideradas
1. Tudo de uma vez. Rápido, mas PR enorme e arriscado. Rejeitada.
2. **Por fases (escolhida).** Menor risco, o utilizador valida cada passo.
3. Só pele nova. Seguro, mas não resolve a dificuldade em encontrar caminhos. Rejeitada.

## Estrutura nova
| Destino | Pergunta que responde | Junta o que hoje está em |
|---|---|---|
| Início | Como estou este mês? Quanto sobra? | Painel, Orçamento |
| Dividir | Como divido o meu salário? | Divisão, Parcelas, Fecho |
| Meses | Ver ou criar um mês | Meses |
| Mais | Histórico, carteira, dados, ajuda, definições | Carteira, Dados, Ajuda, Definições |

Registar despesa: botão fixo por baixo do conteúdo (ver "Calls do construtor").

## Fases
1. **Cores e temas.** Variáveis de cor por paleta (`data-palette`), modo claro/escuro, Definições › Aparência, guardado nas definições e em cache local para não piscar ao abrir.
2. **Menu e botão Registar.** Shell nova: menu lateral / barra em baixo; botão Registar fixo; redirecionamentos das rotas antigas.
3. **Novo Início.** Topo "Calma", valor principal, gasto, categorias. Básico mostra o essencial; Detalhado junta o resto.
4. **Dividir.** Uma página guiada que junta Divisão, Parcelas e Fecho.
5. **Restantes páginas** (Despesas, Carteira, Orçamento, Dados, Ajuda) no novo estilo.
6. **Polimento e acessibilidade.** Contraste, teclado, leitor de ecrã, movimento reduzido, alvos de toque.

Cada fase: versão nova, entrada no CHANGELOG, notas de versão na Ajuda, testes unitários e e2e, imagens para o utilizador validar.

## Restrições
- Stack atual: React 19, Tailwind 4 (`@theme` em `client/src/index.css`), Radix, wouter com hash.
- Funcionar no Worker da Cloudflare e no servidor Node (testes).
- Não perder o que foi feito nas fases anteriores (interruptores de funcionalidades, assistente flutuante, barras de separadores fixas).
- Tipografia Figtree (a confirmar licença/peso e como carregar sem pedir a servidores externos em produção).

## Calls do construtor (a rever)
- O botão Registar fica **fixo no fundo da área de conteúdo**: acima da barra no telemóvel; no fundo da coluna principal no computador. O assistente flutuante deve mudar de sítio para não ficar por cima dele.
- Os valores e frases de estado ("Estás dentro do previsto") vêm de regras já existentes; se faltar dado, a frase não aparece.
- Modo Básico/Detalhado: novo perfil nas Funcionalidades, Básico por defeito só para instalações novas; quem já usa mantém o que tem.
- Paleta guardada em `settings` (novas chaves `palette`, `colorMode`).

## O que fica para quem constrói
Desenho detalhado de cada ecrã, nomes das variáveis, animações (mínimas, respeitando movimento reduzido), copy final em PT-PT.
