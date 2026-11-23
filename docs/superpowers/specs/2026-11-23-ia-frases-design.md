# Assistente com IA: frases livres (fase 6) — lógica pronta, desativada

Data: 2026-11-23. Estado: **aprovado em conversa** (abordagem A, 50 pedidos por dia, Haiku por defeito) e **implementado desativado**: só passa a existir quando houver uma chave de API configurada e a pessoa ligar a opção. Continua `2026-11-23-assistente-guiado-design.md`.

## Intenção
Escrever "gastei 40 no supermercado ontem" em vez de seguir as perguntas, sem que a IA veja ou grave dados financeiros.

## Abordagem A: a IA só traduz a frase
1. A pessoa escreve uma frase na caixa de texto do assistente.
2. O servidor envia ao modelo **só**: a frase (máximo 300 letras), a data de hoje e os nomes das categorias ativas.
3. O modelo responde com JSON `{ task, amount, category, date }` (`task` = `mes`, `despesa`, `sobra`, `resumo` ou `desconhecido`).
4. A app **valida** a resposta com as mesmas regras de hoje (`parseAmount`, `parseDate`, categorias) e entra no fluxo guiado já preenchido; o que faltar, pergunta. Mostra o mesmo cartão "Vou registar…" e só grava quando confirmas.
5. A IA nunca grava, nunca recebe totais, saldos, vencimentos nem movimentos.

## Desativada por defeito (três portas, todas têm de estar abertas)
- Há uma chave de API no servidor (`ANTHROPIC_API_KEY`: segredo do Worker ou variável de ambiente; nunca no código, nunca devolvida pela API).
- A pessoa liga "Assistente com IA" em Definições › Funcionalidades (só aparece se houver chave); `settings.ai_enabled` = 0 por defeito.
- Dentro do limite diário (50 pedidos por dia, contados no servidor).
Sem chave: não aparece nenhuma opção nem caixa de texto, e o assistente guiado funciona como antes.

## Decisões
- Modelo: `haiku` (Claude Haiku 5.5) por defeito, `sonnet` (Claude Sonnet 5.5) à escolha em Definições; resposta curta (máximo 200 tokens), limite de tempo de 15 s.
- Limite: 50 pedidos por dia (dia em UTC), tabela `ai_usage`; passado o limite, 429 com mensagem clara. Conta o pedido antes de chamar o serviço (protege o custo).
- Erros do serviço: 502 genérico ("O serviço de IA não respondeu"); o corpo da resposta externa e a chave nunca vão para o cliente nem para os registos.
- Frase que o modelo não percebe, ou resposta inválida: `desconhecido` e a app volta ao início das tarefas.
- Privacidade: quem liga a opção vê o aviso "A frase que escreves sai da app para a Anthropic (com os nomes das categorias) para ser interpretada."
- Testes sem chave real: o pedido ao serviço é injetável; os testes verificam o conteúdo enviado (só frase, data e categorias).

## Não objetivos
Responder a perguntas livres sobre os números (abordagem B), conversar com memória, gravar sem confirmação.

## Riscos
- Prompt injection na frase: a saída é só JSON validado; não há ferramentas nem escrita.
- Custo: limite diário e modelo pequeno; opção desligada por defeito.
- Primeira experiência real só depois de configurar a chave (fica com o utilizador).
