# Mapa — servidor e Worker (server/, worker/, shared/)

## Stack
v1.29.0, Node >= 24, Express 5, better-sqlite3 + Drizzle; produção: Cloudflare Worker + Durable Object `SalaryDO` (`wrangler.jsonc`). Node: porta 5000 (`server/index.ts:26`); Worker: 8080 interna (`worker/index.ts:17`). Testes: `npm test`, `npm run check`, `npm run check:worker`, Playwright (`E2E_TARGET=worker`).

## Componentes
- `server/app.ts:24` buildApp; `server/middleware.ts:11` installBase (cabeçalhos, CSP, código de acesso, limites de corpo, CSRF por cabeçalho); `server/routes.ts:30` registerRoutes (quase todas as rotas /api, SCHEMA_VERSION=4 em :416).
- `server/offline.ts` sync offline + `offline_receipts`; `server/evo08.ts` fecho/reabertura de mês, recorrências, reservas, importação CSV, change_log.
- `server/storage*.ts` dados (migração única MIG_ID `storage.ts:121`); `server/db.ts` SQLite WAL, tabelas e ALTER em try (:16-325).
- `server/access.ts` código de acesso (scrypt, tempo constante, limitadores); `server/ai.ts` assistente (Anthropic); `server/backup.ts` cópias locais; `server/static.ts` estáticos.
- `worker/index.ts` entrada Worker + `SalaryDO`; `worker/sqlite-shim.ts`, `worker/drizzle-shim.ts` substituem better-sqlite3/drizzle.
- `shared/` schema.ts, calc/*, division.ts, closing.ts, pdf.ts, annual-report.ts, features.ts.

## Pontos de entrada
GET /api/health :65; GET /api/auth/status :69; POST /api/auth :74; GET /api/state :95; PATCH /api/settings :102; GET /api/assistant/ai-status :150; POST /api/assistant/parse :151; meses/parcelas/transações/alocações :115-340; POST /api/months/:id/close :356, /reopen :357; recorrências e reservas :359-370; POST /api/import/csv/preview :371, /csv :372; GET /api/export/json :418, /xlsx :440; POST /api/import/preview :570, /api/import :607; POST /api/offline/sync (`offline.ts:19`). Worker: fetch -> DO "principal"; `SalaryDO.fetch` `worker/index.ts:57`; `scheduled` cópia R2 diária (cron `17 3 * * *`, 14 cópias).

## Fronteiras de confiança
- `x-codigo-acesso` em todo /api exceto auth/health (`middleware.ts:41-65`); sem código definido a app fica aberta (:46).
- `x-sm-client: 1` obrigatório em POST/PUT/PATCH/DELETE (`middleware.ts:73`).
- Corpos: 1 MB; 50 MB em /api/import; 10 MB em /api/offline (`middleware.ts:69-71`). Zod em `route-schemas.ts`, `validation.ts`.
- Import de backup: validateBackupShape/Refs + versão do esquema (`routes.ts:570-607`). CSV por texto no corpo (`evo08.ts:238,252`).
- IP: `cf-connecting-ip` no Worker (`worker/index.ts:60`); `TRUST_PROXY` no Node (`middleware.ts:13`). Limite de tentativas de /api/auth por IP (`routes.ts:74-93`).
- IA: texto livre -> `api.anthropic.com` (`ai.ts:58`), chave `ANTHROPIC_API_KEY`, limite diário `ai_usage`.
- CSP `middleware.ts:18-35`; estáticos `static.ts:14,21`.

## Armazenamento
SQLite (`DATA_DIR`/`DB_PATH`, WAL). Tabelas `db.ts:16-320` + `ai_usage`, `offline_receipts`, `auth_failures`, `schema_migrations`. Sem ferramenta de migração versionada. No Worker: armazenamento do DO via `AsyncLocalStorage` (`sqlite-shim.ts:18`); sem cópias de ficheiro (usa export JSON). Paridade shim vs SQLite real não verificada.

## Caminhos críticos
- Dinheiro: `shared/calc/month.ts` (computeMonth :127, reconcileMonth :99), `calc/distribution.ts` (toCents :17, distribute :24), `calc/goals.ts` (convertAmount :30), `roundCents` `db.ts:328`.
- Divisão do salário: `shared/division.ts` (:6-43). Fecho: `shared/closing.ts:10`, `evo08.ts:110,137,22`.
- Autenticação: `access.ts`, `middleware.ts:41-65`, `routes.ts:74`.
- Backup/restauro: `routes.ts:418,570-607`, `backup.ts`, `worker/index.ts scheduled`. Escritas: `storage*.ts`, `evo08.ts`, `offline.ts:19`.

## Integrações
Anthropic API; Cloudflare (Worker, DO, secret `ACCESS_CODE`, Assets, cron, R2 opcional `BACKUPS`).

## Produto (inferido, a confirmar)
Uma pessoa ou família que gere salário, despesas e metas mês a mês: divide o salário por parcelas, regista movimentos, fecha meses, exporta/importa backups. Crítico: cêntimos certos na divisão e no fecho, não perder dados, acesso protegido pelo código.

Interface: sim, `client/` (fora do âmbito).

## Não confirmado
Schemas Zod, lógica interna de /api/import e /offline/sync, `shared/schema.ts`, `pdf.ts`, `annual-report.ts`, maior parte de `storage*.ts`, paridade do shim.
