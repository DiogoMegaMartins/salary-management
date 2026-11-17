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
| `npm start` | Executa `dist/index.cjs` |
| `npm run db:push` | Sincroniza o esquema Drizzle (uso pontual) |

## Testes
node:test, com bases SQLite temporárias (nunca tocam em `data.db`). Cobertura por iteração: EVO-02 (plataformas e tipos), EVO-03 (distribuição), EVO-04 (metas e submetas), EVO-05 (ativos), EVO-06 (despesas), EVO-07 (backup, validação e segurança).

## Convenções
- Cálculos novos em `shared/calc.ts` com teste.
- Alterações pequenas e verificáveis; testes e documentação em cada alteração.
- Sem migrações destrutivas; sem apagar dados sem confirmação.
- Confirmações via `useConfirm`, nunca `window.confirm`.
- Cada função de acumulado de metas deve passar por `goalBreakdown`.

## Dados de teste
Usar sempre cópia ou base temporária; restaurar `data.db` de uma cópia após testes de interface.
