# Validação da versão móvel e offline

Esta atualização mantém a aplicação existente e melhora sobretudo a divisão mensal no telemóvel. A validação usa dados sintéticos em bases separadas; não foi usada nem alterada a base de dados de produção.

## Resultado técnico

- TypeScript: sem erros.
- Testes automatizados: 99 aprovados, sem falhas.
- Build de produção: concluído. Mantém o aviso de tamanho do bundle.
- Navegação: nove páginas verificadas em Chromium móvel e desktop.
- Erros JavaScript: nenhum novo erro de página observado nos percursos testados.

## Percursos verificados

- Divisão mensal em cartões, com nome completo, modo, valor e resultado calculado.
- Gravação de vencimentos e alocações com separador decimal português.
- Edição de plataformas e percentagens de ativos.
- Criação de mês, cancelamento sem criação e proteção de mês fechado.
- Exportação de backup JSON, alternância de tema e privacidade.
- Larguras de 320 e 375 px e editor com altura reduzida, simulando espaço ocupado pelo teclado.
- Gráficos renderizados e detalhes consultáveis por toque; layouts personalizados empilhados no telemóvel.
- Edição e gravação de layout móvel e transição computador/telemóvel/computador.

## Offline e sincronização

- Preparação explícita de dispositivo em origem própria de teste.
- Edição de um vencimento e alocação e criação de uma despesa sem rede.
- Recuperação dos dados após recarregar sem rede.
- Código errado recusado e código correto aceite ao abrir uma nova sessão offline.
- Payload cifrado sem a nota da despesa ou o código em texto simples.
- Sincronização com uma única despesa no servidor.
- Alteração concorrente detetada, sem apagar a fila local.
- Revisão explícita do conflito; aplicação da alteração local sem eliminar uma nota independente entretanto criada no servidor.
- Testes de API cobrem repetição idempotente de lote, transação atómica e rollback.

## Pré-visualização e publicação

A pré-visualização usa o mesmo identificador da aplicação e um servidor com dados de exemplo. A verificação alojada inclui carregamento de dados e gravação através do proxy, não apenas ficheiros estáticos.

O endereço externo do Computer pode apresentar um desafio Cloudflare à automação; o conteúdo alojado é inspecionado pelo endereço temporário fornecido pelo deploy. A instalação offline precisa de um endereço HTTPS próprio, acesso a service worker e CacheStorage e preparação prévia com rede.

A publicação permanente não foi executada. Antes de publicar ou migrar dados, é necessário exportar e verificar o backup da aplicação que está em uso.

## Limitações

- Não foi realizado teste físico em iPhone ou Android.
- A altura do teclado foi simulada; o comportamento final depende do navegador e sistema operativo.
- Fechar/reabrir e criar meses, alterar catálogos e executar operações específicas do servidor continuam a exigir internet.
- O navegador pode apagar armazenamento local; o modo offline não substitui backups.
- SQLite local mantém as limitações de durabilidade existentes numa republicação.
- Não foi efetuada auditoria completa de acessibilidade, dependências ou segurança.

O guia `MOBILE-OFFLINE.md` descreve preparação, operações suportadas, proteção da cópia local e resolução de conflitos. O inventário técnico de regressão está em `FLOWS.md`.
