# Arquitetura

## Visão geral
Aplicação full-stack numa só porta: servidor Express serve a API REST (`/api`) e o cliente React compilado.

```
Navegador (React + Vite + Tailwind + wouter hash routes)
   | fetch /api (JSON, cabeçalho x-codigo-acesso)
Servidor Express (server/routes.ts)
   | storage (server/storage.ts, Drizzle ORM)
SQLite (data.db)
```

## Estrutura
| Pasta | Função |
|---|---|
| `client/src/pages` | Ecrãs: dashboard, months, expenses, parcels, portfolio, budget, data, help |
| `client/src/components` | Componentes partilhados (goal-panel, confirm, editable-section-grid, catalogs, layout) |
| `client/src/lib` | Estado (`app.tsx`: useAppState/useDerived/useSave), queryClient, layout de páginas, conteúdo de ajuda |
| `server/routes.ts` | Rotas, autenticação, validação de backups e rate limiting |
| `server/storage.ts` | Acesso a dados (meses, parcelas, movimentos, distribuições), seed, restauro transacional |
| `server/db.ts` | Ligação SQLite/Drizzle, criação e migração do esquema, `httpError` e `roundCents` |
| `server/storage-catalogs.ts`, `server/storage-goals.ts` | Plataformas e tipos; saldos, ajustes, submetas, atribuições e taxas. Compostos em `storage` |
| `server/route-schemas.ts` | Esquemas zod das rotas de catálogos, metas, recorrências e reservas |
| `shared/schema.ts` | Tabelas Drizzle e tipos |
| `shared/calc.ts` e `shared/calc/` | Cálculos puros partilhados por cliente e servidor; `calc.ts` reexporta os módulos `month`, `budget`, `distribution`, `goals` e `expenses` |
| `client/src/lib/dashboard-model.ts` | Números do Painel (totais, comparação, séries, metas) como função pura |
| `tests/` | Testes node:test (EVO-02 a EVO-07) |
| `script/build.ts` | Build do cliente (Vite) e do servidor (esbuild, `dist/index.cjs`) |

## Fluxo de dados
1. O cliente carrega `/api/state` (estado completo) e deriva valores com `shared/calc.ts` (`useDerived`; módulos em `shared/calc/`).
2. Alterações usam mutações (`useSave`) que chamam a API e invalidam o estado.
3. As páginas usam funções únicas de cálculo: o acumulado de uma meta vem sempre de `goalTotalOf`/`goalBreakdown`.

## Decisões
- Hash routing: funciona em hospedagem estática e em iframes.
- Confirmações dentro da aplicação (`useConfirm`): `window.confirm` é bloqueado em iframes.
- Sem serviços externos: tudo corre localmente com SQLite.
- Cálculos puros em `shared/` para serem testáveis sem base de dados.

## Módulos de Meses
`pages/months.tsx` (lista) e `components/months/`: `month-editor`, `number-field`, `reconciliation-panel`, `platform-distribution`, `transactions-panel`.
