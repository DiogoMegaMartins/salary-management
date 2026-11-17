# API REST

Base: `/api`. JSON. Erros: `{ "message": "..." }` com 400 (validação), 401 (código), 404, 409 (conflito), 429 (demasiadas tentativas).
Se existir código de acesso, enviar o cabeçalho `x-codigo-acesso` em todos os pedidos (exceto `/api/auth*`).

| Área | Endpoints |
|---|---|
| Acesso | `GET /auth/status`, `POST /auth` ({code}) |
| Estado | `GET /state`, `PATCH /settings` |
| Parcelas | `POST /parcels`, `PATCH /parcels/:id`, `DELETE /parcels/:id` |
| Meses | `POST /months`, `PATCH /months/:id`, `DELETE /months/:id`, `POST /months/:id/duplicate`, `POST /months/:id/apply-rules`, `POST /months/:id/save-as-rules`, `PATCH /months/:id/reconciliation` |
| Alocações | `PUT /allocations`, `PUT /months/:monthId/parcels/:parcelId/distribution`, `PUT /months/:monthId/parcels/:parcelId/distribution/:platformId/assets` |
| Movimentos | `GET /months/:id/transactions`, `POST /transactions`, `PATCH /transactions/:id`, `DELETE /transactions/:id` |
| Categorias | `GET/POST /categories`, `PATCH/DELETE /categories/:id` |
| Catálogos | `POST /platforms`, `PATCH/DELETE /platforms/:id`; o mesmo para `/parcel-types` e `/tx-types` |
| Metas | `POST /goal-entries`, `DELETE /goal-entries/:id`, `POST /subgoals`, `PATCH/DELETE /subgoals/:id`, `POST/DELETE /contribution-links`, `POST/DELETE /fx-rates` |
| Backup | `GET /export/json`, `GET /export/xlsx`, `POST /import/preview`, `POST /import` |

## Regras de validação relevantes
- Transações: valor maior que zero, data válida, mês e parcelas existentes, tipo válido, transferência com origem e destino diferentes.
- Submetas: nome único normalizado por meta (409); moeda bloqueada se houver saldos (409).
- Importação: valida estrutura, tipos, intervalos e referências antes de qualquer alteração.

## EVO-08
| Endpoint | Função |
|---|---|
| `GET /app-info` | versão, ambiente, formato de backup |
| `GET /verify` | verificação de consistência (não altera dados) |
| `GET /change-log` | histórico de alterações |
| `GET /months/:id/summary`, `POST /months/:id/close`, `POST /months/:id/reopen`, `GET /closures` | fecho mensal e histórico |
| `GET/POST /recurring`, `PATCH/DELETE /recurring/:id`, `GET /recurring/pending`, `POST /recurring/confirm`, `POST /recurring/skip` | recorrências |
| `GET/POST /reserves`, `PATCH/DELETE /reserves/:id`, `POST /reserves/:id/pay` | reservas |
| `POST /import/csv/preview`, `POST /import/csv` | importação CSV |
Mês fechado: criar, editar ou eliminar movimentos, alocações, distribuições, ativos e o próprio mês devolve 423. `status` e `carryIn` só mudam pelo fecho/reabertura.

## Notas
- Todos os erros devolvem `{ "message": "..." }`. Pedidos que alteram dados exigem o cabeçalho `x-sm-client: 1`.
- `DELETE /parcels/:id` devolve 409 se a parcela tiver movimentos, recorrências ou reservas.
- `GET /state` não inclui `changeLog`; usar `GET /change-log`. `GET /export/json` inclui-o.
- `PATCH /goal-entries/:id` edita valor, data e nota de um saldo inicial ou ajuste (404 se não existir; 400 se inválido).
