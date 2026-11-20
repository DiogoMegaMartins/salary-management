# Cloudflare

A app pode correr na Cloudflare, em vez de num servidor Node. O código do servidor é o mesmo (Express, Drizzle, SQLite); muda só onde corre e onde ficam os dados.

## Como funciona

- **Interface:** o resultado de `npm run build` (`dist/public`) é servido pelo Workers Static Assets. Só os pedidos a `/api/*` passam pelo Worker.
- **API:** o Worker (`worker/index.ts`) entrega cada pedido a um Durable Object, `SalaryDO`, que corre a app Express (`server/app.ts`) com `cloudflare:node` (`handleAsNodeRequest`).
- **Dados:** o SQLite desse Durable Object (`ctx.storage.sql`). Há um único objeto, chamado `principal`, com todos os dados. A API do SQLite é síncrona, como a do `better-sqlite3`, e as transações usam `transactionSync`.
- **Sem alterar o servidor:** o `wrangler.jsonc` troca `better-sqlite3` por `worker/sqlite-shim.ts` e `drizzle-orm/better-sqlite3` por `worker/drizzle-shim.ts`. O servidor Node (`npm start`) continua a funcionar como antes.

## O que muda face ao servidor Node

| | Servidor Node | Cloudflare |
| --- | --- | --- |
| Base de dados | ficheiro `data.db` | SQLite do Durable Object |
| Backups automáticos em ficheiro | sim (`BACKUP_*`) | não se aplicam; usa a exportação JSON da app |
| Cópia antes de restaurar um backup | ficheiro `pre-import-backup-*.json` | não é gravada; exporta antes de restaurar |
| Código de acesso | `ACCESS_CODE` no ambiente | segredo `ACCESS_CODE` do Worker |
| Versão do ambiente na app | "produção" | "produção" |

A Cloudflare mantém o histórico do SQLite dos Durable Objects, com recuperação ao ponto no tempo (confirma o prazo atual na documentação da Cloudflare). Mantém a rotina de exportar um backup JSON.

## Primeiro deploy

1. Na Cloudflare, cria um token de API com a permissão "Edit Cloudflare Workers" e anota o ID da conta.
2. No GitHub, em Settings > Secrets and variables > Actions, cria `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
3. Em Actions, corre "Deploy (Cloudflare)". Corre os testes e depois `npm run deploy`.
4. Define o código de acesso (uma vez, escreve-o quando pedido):

```bash
npx wrangler secret put ACCESS_CODE
```

5. Abre o endereço `https://salary-management.private.workers.dev`. A primeira parte é o nome do Worker (`name` em `wrangler.jsonc`); `private` é o subdomínio da conta, que se escolhe uma vez em Workers & Pages e é único em toda a Cloudflare (se já estiver ocupado, escolhe outro e o endereço muda).

## Migrar os dados atuais

1. Na app atual, em Definições, exporta o backup JSON.
2. Na app da Cloudflare, entra com o código de acesso e importa o ficheiro em Definições.
3. Confirma os meses, as parcelas e o total de cada mês antes de deixares de usar a antiga.

## Desenvolvimento

```bash
npm run build
npm run dev:worker
```

`npm run check:worker` verifica os tipos do Worker (corre também no CI). Para correr os testes e2e contra o Worker, arranca `wrangler dev --port 5057 --local --var ACCESS_CODE:codigo-de-teste-1234` e corre `E2E_PORT=5057 npx playwright test`.

## Limites conhecidos

- Um só Durable Object: todos os pedidos passam por ele, um de cada vez. Para uma app pessoal chega.
- O `XLSX` corre dentro do Worker; confirma o descarregamento do Excel depois do primeiro deploy.
- Um domínio próprio e o Cloudflare Access (login por e-mail antes da app) ficam para uma fase seguinte.
