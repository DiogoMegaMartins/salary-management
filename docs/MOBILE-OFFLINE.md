# Versão 1.9.0: telemóvel e offline

A interface móvel mantém a navegação e funcionalidades existentes. A gestão dos meses passa a cartões e a ação “Dividir valores” abre diretamente a divisão; o computador mantém a tabela.

## Divisão de valores

- Nomes das parcelas completos, modo, campo decimal e montante calculado em cartões.
- Edição da distribuição por plataformas e ativos adaptada à largura do dispositivo.
- Resumo de disponível, alocado e restante acompanha a divisão.
- Editor ocupa o ecrã móvel e ajusta a altura ao teclado através de VisualViewport.
- A divisão guarda ao sair de cada campo; o vencimento usa uma ação explícita.
- Erros de gravação não fecham o formulário.
- O PATCH do mês inclui apenas campos editáveis efetivamente alterados, nunca estado/transporte.
- Meses fechados continuam protegidos pelo servidor.
- Ao guardar, a atualização da consulta é aguardada antes de fechar, evitando reabrir imediatamente uma cópia antiga.
- Os campos numéricos atualizam o formulário mesmo que o teclado móvel não retire o foco antes de tocar em Guardar.

## Barra de navegação inferior

No telemóvel, uma barra fixa no fundo (com margem de segurança do iPhone) dá acesso a Painel, Meses, Despesas, Carteira e Mais. O separador ativo fica destacado e “Mais” abre uma folha com as restantes áreas e mostra um ponto de aviso quando há alterações por sincronizar ou um conflito. A barra esconde-se com o teclado aberto e não aparece no computador.

## Documentação na aplicação

A página Ajuda inclui o grupo “Telemóvel e offline” (uso no telemóvel, instalação e modo offline, sincronização e conflitos) e notas da versão 1.9.0. No telemóvel o índice fica recolhido num botão, para o conteúdo aparecer logo.

## Gráficos e layouts

Os detalhes dos gráficos abrem por toque no telemóvel e por passagem do rato no computador. Os layouts personalizados do computador são apresentados em pilha no telemóvel; na edição móvel, a grelha usa uma coluna. Guardar esse layout empilhado aplica-o também no computador, conforme o aviso no editor.

## Preparar um dispositivo

Abre a aplicação num endereço HTTPS próprio. Em Definições, configura um código de acesso forte com pelo menos oito caracteres, volta a entrar e escolhe “Preparar este dispositivo”; apenas este gesto autoriza a criação da cópia local. Não uses esta opção num dispositivo partilhado.

A instalação como PWA usa o menu do navegador: “Adicionar ao ecrã principal”. A pré-visualização incorporada do Computer pode bloquear service workers e CacheStorage; a aplicação mostra essa limitação, não promete funcionamento offline nesse contexto. A instalação em iOS e Android reais ainda requer validação nesses dispositivos.

## O que funciona offline

- Consultar o conjunto de dados descarregado e vistas que se calculam a partir desse conjunto.
- Editar vencimentos e divisões de meses existentes e abertos.
- Distribuir por plataformas e ativos.
- Criar despesas. Outros tipos de movimento e alterações a movimentos existentes exigem ligação.

Criar/duplicar/eliminar meses, fechar/reabrir, aplicar regras em massa, alterar catálogos, importar e executar verificações do servidor exigem ligação. Os dados de serviços externos não são atualizados offline. As funcionalidades que dependem de consultas específicas ao servidor não são convertidas em resultados offline fictícios.

## Persistência e segurança

A interface pública é guardada por um service worker. A cópia financeira e o lote pendente ficam separados, em CacheStorage, cifrados com AES-GCM e uma chave derivada do código por PBKDF2-SHA256 (310 000 iterações e salt aleatório). O código de acesso não é incluído na cópia financeira; API e dados financeiros não são guardados no cache público do service worker.

O código é necessário para desbloquear a cópia offline numa nova sessão. A proteção depende da força do código e do dispositivo: não equivale a autenticação biométrica nem a proteção contra código malicioso no mesmo endereço. O navegador pode apagar armazenamento local; cópias de segurança continuam indispensáveis.

Sem permissão/capacidade de escrita local, uma alteração offline falha e não é apresentada como guardada. Um pedido ao servidor e uma gravação local são estados distintos na interface.

Sincroniza e remove a cópia local antes de mudar o código. A aplicação bloqueia a remoção enquanto existirem alterações pendentes. “Exportar cópia e alterações” descarrega JSON não cifrado: guarda-o num local seguro.

## Sincronização e conflitos

As escritas suportadas passam primeiro pela fila persistida, mesmo online. A sincronização é tentada quando a ligação regressa, ao recuperar o foco e pelo botão “Sincronizar agora”; não depende de Background Sync.

Cada lote tem identificador único e limite de 500 operações. A versão de partida é um hash do estado do servidor sem código de acesso. O servidor aplica o lote numa transação SQLite e guarda o recibo na mesma transação: repetir um pedido após uma resposta perdida não duplica despesas.

A deteção de conflitos é conservadora: qualquer alteração ao estado do servidor bloqueia o lote. “Rever conflito” mostra os campos/linhas do servidor e os valores locais; só após confirmação explícita são reaplicados os campos listados sobre a versão revista. O servidor volta a confirmar essa versão. Cancelar mantém as alterações locais; meses entretanto fechados continuam a impedir a reaplicação.

As escritas locais são serializadas e usam Web Locks quando disponível. CacheStorage é específico do endereço e perfil do navegador; instalar noutro endereço/dispositivo exige nova preparação.

## Dados de produção e publicação

Esta entrega atualiza a pré-visualização e o código, não publica automaticamente nem migra a base de dados da aplicação já publicada. O armazenamento do servidor continua a ser SQLite local, com a limitação de durabilidade já existente. Antes de uma publicação, exporta e verifica um backup JSON da aplicação em uso; não substituas dados de produção por fixtures de teste.

## Validação

Testes automatizados cobrem cálculos existentes, proteção de meses fechados, PATCH editável, sincronização idempotente, conflito e rollback de lote. A validação em Chromium inclui navegação móvel, gravação com vírgula decimal, plataformas/ativos, recarregar sem rede, desbloqueio offline, despesa offline e sincronização única. O relatório de QA regista os resultados finais e as limitações.
