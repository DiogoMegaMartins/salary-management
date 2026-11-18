# Desenvolvimento e testes

## Requisitos
Node.js 20+ e npm.

## Comandos
| Comando | Função |
|---|---|
| `npm run dev` | Servidor + Vite em modo desenvolvimento (porta 5000) |
| `npm run check` | Verificação de tipos (tsc) |
| `npm test` | Testes (`tsx --test tests/*.test.ts`) |
| `npm run build` | Build de produção em `dist/` |
| `npm run test:e2e` | Testes de interface (Playwright); exigem `npm run build` antes |
| `npm start` | Executa `dist/index.cjs` |
| `npm run db:push` | Sincroniza o esquema Drizzle (uso pontual) |

## Testes
node:test, com bases SQLite temporárias (nunca tocam em `data.db`). Cobertura por iteração: EVO-02 (plataformas e tipos), EVO-03 (distribuição), EVO-04 (metas e submetas), EVO-05 (ativos), EVO-06 (despesas), EVO-07 (backup, validação e segurança).

### Testes de interface (Playwright)
Ficam em `e2e/` (`*.spec.ts`) e correm em Chromium, num ecrã de computador e num de telemóvel (Pixel 7). `e2e/serve.mjs` arranca `dist/index.cjs` com uma base temporária e um código de acesso de teste (`E2E_ACCESS_CODE`, porta `E2E_PORT`), por isso nunca tocam em dados reais. Cobrem: a API recusar pedidos sem código, `/api/health`, o ecrã de bloqueio (código errado e certo), a abertura de todos os ecrãs sem erros de consola e a ausência de deslocação horizontal da página. Os fluxos de escrita (`e2e/escrita.spec.ts`) criam e eliminam uma plataforma (incluindo a recusa de um nome duplicado), uma despesa (confirmando que sobrevive a um recarregamento) e um mês. Cada teste desfaz o que cria, por isso não depende do estado da base nem deixa resíduos. No telemóvel, os cliques passam por `clicar()`, que centra o botão antes de clicar (um botão encostado ao fundo do ecrã pode ficar sob a barra de navegação). Na primeira vez: `npx playwright install chromium`. No CI correm no job `e2e`; se falharem, o relatório fica como artefacto `playwright-report`.

## Convenções
- Cálculos novos em `shared/calc.ts` com teste.
- Alterações pequenas e verificáveis; testes e documentação em cada alteração.
- Sem migrações destrutivas; sem apagar dados sem confirmação.
- Confirmações via `useConfirm`, nunca `window.confirm`.
- Cada função de acumulado de metas deve passar por `goalBreakdown`.

## Dados de teste
Usar sempre cópia ou base temporária; restaurar `data.db` de uma cópia após testes de interface.
