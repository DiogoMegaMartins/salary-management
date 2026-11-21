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
| Código de acesso | `ACCESS_CODE` no ambiente (guardado como hash scrypt) | segredo `ACCESS_CODE` do Worker, comparado em texto (o scrypt gasta mais CPU do que o plano gratuito permite) |
| Versão do ambiente na app | "produção" | "produção" |

A Cloudflare mantém o histórico do SQLite dos Durable Objects, com recuperação ao ponto no tempo (confirma o prazo atual na documentação da Cloudflare). Mantém a rotina de exportar um backup JSON.

## Primeiro deploy

1. Na Cloudflare, cria um token de API com a permissão "Edit Cloudflare Workers" e anota o ID da conta.
2. No GitHub, em Settings > Secrets and variables > Actions, cria `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
3. Em Actions, corre "Deploy (Cloudflare)" e aprova-o (ver "Deploy automático com aprovação"). Corre os testes e depois `npm run deploy`.
4. Define o código de acesso (uma vez, escreve-o quando pedido):

```bash
npx wrangler secret put ACCESS_CODE
```

5. Abre o endereço `https://salary-management.private-finances.workers.dev`. A primeira parte é o nome do Worker (`name` em `wrangler.jsonc`); `private-finances` é o subdomínio da conta, que se escolhe uma vez em Workers & Pages e é único em toda a Cloudflare (se já estiver ocupado, escolhe outro e o endereço muda).

## Deploy automático com aprovação

Depois de um merge para a `main`, quando o CI dessa `main` acaba com sucesso, o CI dispara o workflow "Deploy (Cloudflare)", que fica à espera da tua aprovação. Publica exatamente o commit que o CI validou. Se alguma verificação falhar, não dispara.

Isto está desligado por omissão: só acontece se criares a variável de repositório `AUTO_DEPLOY` com o valor `true` (Settings > Secrets and variables > Actions > Variables > New repository variable). Sem a variável (ou com outro valor), o CI não dispara nada e o workflow de deploy nem aparece em Actions; no CI, o job `auto-deploy` fica "skipped". Só a atives depois de configurares os "Required reviewers" abaixo, senão o deploy corre sem pedir nada. Também podes sempre correr o deploy à mão em Actions (Run workflow), e esse arranque também espera pela aprovação.

A aprovação vem do ambiente `production` do GitHub. Configura-o uma vez:

1. No GitHub, em Settings > Environments, abre `production` (aparece depois do primeiro deploy; podes criá-lo antes com "New environment").
2. Ativa "Required reviewers" e escolhe-te a ti.
3. Em "Deployment branches and tags", escolhe "Selected branches and tags" e acrescenta `main`.

Sem "Required reviewers", o deploy corre sem pedir aprovação. Para aprovar: em Actions, abre a execução "Deploy (Cloudflare)" em espera e carrega em "Review deployments" > "Approve and deploy". O GitHub também envia uma notificação.

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

## Cabeçalhos de segurança

O HTML e os ficheiros da interface não passam pelo Express: saem do Workers Static Assets. Por isso o CSP e os restantes cabeçalhos de segurança vêm de `client/public/_headers` (copiado para `dist/public`). As respostas de `/api/*` levam os cabeçalhos do Express. O teste `tests/cabecalhos.test.ts` garante que o CSP do `_headers` tem todas as diretivas do `server/middleware.ts`. Se mudares um, muda o outro.

## Cópia diária para o R2 (opcional)

O Worker tem uma tarefa agendada (03:17 UTC) que guarda o JSON completo de backup num bucket R2 e conserva as últimas 14 cópias. Está desligada até ligares um bucket:

1. Cria o bucket: no painel da Cloudflare, **R2 > Create bucket**, com o nome `salary-management-backups` (precisa de R2 ativo na conta e, no token da API, da permissão para editar o R2).
2. Em `wrangler.jsonc`, tira o comentário à linha `"r2_buckets"`.
3. Faz o deploy. A partir daí o Worker escreve `backups/AAAA-MM-DD.json` todos os dias.

Sem o bucket, a tarefa agendada não faz nada. As cópias não levam o código de acesso (a exportação já o exclui).

## Testes do Worker

`npm run test:e2e:worker` corre a bateria de interface contra o Worker em local (`wrangler dev --local`, com um código de teste). No CI, o job `e2e` corre a bateria contra o Worker (computador e telemóvel). O workflow de deploy confirma `/api/health` no endereço publicado e falha se não responder.

## Armazenamento e reinícios

A Cloudflare descarta o Durable Object quando está inativo e cria outro, no mesmo processo, quando chega um pedido. Os módulos ficam em cache nesse processo, por isso o servidor nunca guarda o armazenamento em variáveis de módulo: `worker/sqlite-shim.ts` lê o armazenamento do pedido em curso (`AsyncLocalStorage`) e `worker/index.ts` cria a app Express uma só vez por processo. Quem mexer nisto deve manter essa regra, ou volta o erro "Cannot perform I/O on behalf of a different Durable Object" (1101).

## Limites conhecidos

- **Plano gratuito:** a Cloudflare limita o tempo de processamento por pedido (10 ms nos Workers gratuitos; a documentação dos Durable Objects indica 30 s, mas confirma o que se aplica à tua conta). Se aparecer o erro 1102 ("Worker exceeded resource limits") ou a app mostrar "Sem ligação" ao abrir, vê em Workers & Pages > salary-management > Observability se há "Exceeded CPU Time Limits". Importações grandes são o caso mais provável. O plano pago dos Workers (a partir de 5 USD por mês) sobe o limite.
- **Código de acesso:** usa 12 ou mais caracteres (a comparação é em texto e a app só obriga a 8). Definido só pelo segredo `ACCESS_CODE`. Para o mudar, altera o segredo; a app não o altera pelas Definições.
- **IP dos visitantes:** o limite de tentativas usa o IP que a Cloudflare indica (`cf-connecting-ip`).
- Um só Durable Object: todos os pedidos passam por ele, um de cada vez. Para uma app pessoal chega.
- O `XLSX` corre dentro do Worker; confirma o descarregamento do Excel depois do primeiro deploy.
- Um domínio próprio e o Cloudflare Access (login por e-mail antes da app) ficam para uma fase seguinte.
