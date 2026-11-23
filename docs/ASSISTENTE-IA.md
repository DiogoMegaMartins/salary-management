# Assistente com IA (frases livres)

O assistente guiado (botão no canto do ecrã) pode, opcionalmente, perceber frases como "gastei 40 no supermercado ontem". **Está desligado até haver uma chave de API e a opção ser ligada.** Sem chave, não aparece nenhuma opção e o assistente guiado funciona como sempre.

## O que sai da app
Para interpretar a frase, o servidor envia à Anthropic **só**: a frase (até 300 letras), a data de hoje e os nomes das categorias ativas. Nunca envia vencimentos, saldos, totais, parcelas nem movimentos. A IA responde só com campos (tarefa, valor, categoria, data); a app valida-os e mostra o mesmo cartão "Vou registar…". **A IA nunca grava**: só grava quem confirma.

## Ativar
1. Cria uma chave de API na conta Anthropic (a conta e o custo são teus).
2. Guarda-a no servidor como segredo, **nunca no código, num commit, num PR ou numa conversa**:
   - **Cloudflare:** `npx wrangler secret put ANTHROPIC_API_KEY` (escreve a chave quando pedido) ou, na Cloudflare, Workers > salary-management > Settings > Variables and Secrets.
   - **Servidor Node:** variável de ambiente `ANTHROPIC_API_KEY` ao arrancar.
3. Abre Definições › Funcionalidades: aparece o cartão "Assistente com IA". Liga-o (lê o aviso de privacidade) e escolhe o modelo.

## Modelos e limite
- **Haiku 5.5** (por defeito): o mais barato, chega para frases curtas. **Sonnet 5.5**: percebe melhor frases confusas, custa mais.
- **50 pedidos por dia** (dia em UTC), contados no servidor (tabela `ai_usage`); passado o limite, o assistente diz e continua a funcionar com as perguntas. Cada pedido é curto (resposta de no máximo 200 tokens).

## Desativar
Desliga a opção em Definições, ou apaga o segredo (`npx wrangler secret delete ANTHROPIC_API_KEY`). Sem chave, nada da IA aparece.

## Se algo falhar
O servidor responde com mensagens genéricas ("O serviço de IA não respondeu"); o motivo técnico vai para os registos do servidor, sem a chave. A primeira experiência real com uma chave tem de ser feita por ti: os testes usam um serviço simulado.
