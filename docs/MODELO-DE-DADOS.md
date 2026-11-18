# Modelo de dados (SQLite, Drizzle)

Definido em `shared/schema.ts`. Datas são texto `AAAA-MM-DD`. Valores novos em euros com arredondamento por cêntimos.

| Tabela | Conteúdo principal |
|---|---|
| `parcels` | nome, `kind` (gastos, poupança, investimento), cor, regra por omissão (`default_mode` fixo/percentagem, `default_value`), meta (`target_amount`, `target_date`), `currency`, `type_id`, `archived`, `sort_order` |
| `months` | ano, mês, rendimento, descontos, subsídio, notas e reconciliação |
| `allocations` | alocação de um mês a uma parcela (`mode`, `value`) |
| `transactions` | despesas, transferências, aportes, retiradas (`type`, `value`, `date`, `category`, `parcel_id`, `target_parcel_id`, `month_id`, `type_id`) |
| `categories` | categorias de despesa |
| `settings` | definições globais: taxas, lembrete de backup, `access_code`, reserva de emergência, `page_layouts` |
| `platforms`, `parcel_platforms` | catálogo de plataformas e ligação a parcelas |
| `parcel_types`, `tx_types` | tipos personalizados |
| `allocation_platforms` | distribuição de uma alocação por plataforma |
| `allocation_assets` | ativos dentro de uma plataforma (nome, percentagem, nota) |
| `subgoals` | submetas (nome único por meta, moeda, objetivo, prazo, plataforma) |
| `goal_entries` | saldos iniciais e ajustes (`kind` inicial/ajuste, `amount`, `date`, submeta opcional) |
| `contribution_links` | atribuição de movimentos a submetas |
| `fx_rates` | taxas de conversão manuais |
| `schema_migrations` | migrações idempotentes |

## Relações principais
`months` 1-N `allocations` N-1 `parcels`; `allocations` 1-N `allocation_platforms` (por plataforma) e `allocations` 1-N `allocation_assets` (por ativo, com `platform_id`); `parcels` 1-N `subgoals` 1-N `goal_entries`; `transactions` N-1 `months` e N-1 `parcels` (origem e destino).

## Migrações
As tabelas são criadas com `CREATE TABLE IF NOT EXISTS` no arranque; nada existente é apagado. Detalhes em [historico/EVOLUCAO-EVO01-07.md](historico/EVOLUCAO-EVO01-07.md).

## EVO-08 (migração aditiva, `CREATE TABLE IF NOT EXISTS` e `ALTER TABLE ADD COLUMN`)
| Alteração | Detalhe |
|---|---|
| `months.status` | `aberto` (omissão) ou `fechado` |
| `months.carry_in` | transporte recebido do mês anterior (omissão 0), não é rendimento |
| `transactions.recurrence_id`, `occurrence_key`, `import_batch_id` | origem recorrente e lote de importação (nulos nos registos antigos) |
| `month_closures` | histórico de fecho e reabertura (restante, destino, nota) |
| `change_log` | histórico de alterações financeiras |
| `recurring_expenses`, `recurrence_skips` | recorrências e ocorrências ignoradas |
| `reserves` | reservas para despesas futuras |
| `import_batches` | impressão digital de ficheiros CSV importados |
| `offline_receipts` | recibos dos lotes do modo offline já aplicados (idempotência de `/api/offline/sync`); criada em `server/offline.ts` |
Impacto: nenhum dado existente é alterado; meses antigos ficam `aberto` com transporte 0.

As ligações entre tabelas são lógicas (colunas `*_id`), sem chaves estrangeiras SQL. Diagrama em [ARQUITETURA.md](ARQUITETURA.md).
