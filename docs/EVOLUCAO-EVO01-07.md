# Evolução EVO-01 a EVO-07: modelo, migração e reversão

## Modelo (SQLite, `data.db`)
Tabelas novas (criadas com `CREATE TABLE IF NOT EXISTS` no arranque; nenhuma tabela existente é apagada ou reescrita):

| Tabela | Conteúdo |
|---|---|
| `platforms`, `parcel_platforms` | Catálogo de plataformas (nome único normalizado, arquivável) e ligação parcela-plataforma |
| `parcel_types`, `tx_types` | Tipos personalizados; herdam `kind`/`type` base, por isso os cálculos não mudam |
| `allocation_platforms` | Distribuição de uma alocação mensal por plataforma (`mode` fixo/percentagem, `value`) |
| `allocation_assets` | Ativos/classes dentro de uma plataforma de uma alocação (nome, %, nota, posição) |
| `subgoals`, `goal_entries`, `contribution_links`, `fx_rates` | Submetas, saldos iniciais/ajustes, atribuição de movimentos e taxas manuais |
| `schema_migrations` | Migrações versionadas e idempotentes |

Colunas novas: `parcels.type_id`, `parcels.currency` (por omissão `EUR`), `transactions.type_id`. A coluna antiga `parcels.platforms` (texto "A | B") mantém-se, derivada do catálogo.

## Regras de cálculo
- Valores novos em cêntimos inteiros; percentagens com 4 casas; arredondamento por soma acumulada (distribuído + restante = total).
- Acumulado da meta = saldo inicial + contribuições a partir do mês da data de referência (inclusive) + aportes/retiradas desde essa data + ajustes. Sem saldo inicial, é o histórico atual (saldos existentes preservados).
- Despesas = tipos `expense` e `withdrawal`; transferências e aportes não contam. Datas são texto `AAAA-MM-DD`, sem fuso horário.
- Moedas: taxa manual direta ou inversa, a mais recente; sem taxa o total fica marcado como incompleto.
- Distribuições, ativos, saldos e submetas são planeamento: não criam movimentos nem posições da Carteira.

## Backup (`schemaVersion` 3)
Inclui todas as tabelas acima. Backups v1/v2 são aceites (plataformas reconstruídas a partir do texto). Antes de restaurar valida-se versão, estrutura e todas as referências; o restauro corre numa única transação SQLite (falha = nada alterado) e escreve `pre-import-backup-*.json`.

## Migração e reversão
1. Antes de arrancar a nova versão sobre dados reais, copiar `data.db` (e `data.db-wal`/`-shm` se existirem) ou exportar o backup JSON.
2. A migração `evo02-platforms-from-text` corre uma vez e é idempotente.
3. Reversão: parar a aplicação, repor a cópia de `data.db`, ou restaurar o backup JSON na versão anterior (as tabelas novas são ignoradas por versões antigas; o backup v3 só é lido pela versão nova).

## Testes
`npm test` (node:test, sem dependências novas; usa bases temporárias e nunca toca em `data.db`): `tests/evo02` a `tests/evo07`.

## Limitações conhecidas
- Duplicar um mês não copia distribuições nem ativos.
- Se uma parcela em percentagem encolher abaixo de uma distribuição por valor guardada, a edição do mês não é bloqueada; a interface avisa e a distribuição tem de ser corrigida.
- Aportes/retiradas só entram no acumulado de metas com saldo inicial; atribuição a submetas só em submetas na moeda da meta.
- Reembolsos não têm compensação automática.
- Avisos de segurança anteriores (dependência xlsx, código de acesso no URL, sem limitação de tentativas) mantêm-se; ver relatório de segurança.
