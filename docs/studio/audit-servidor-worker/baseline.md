runs: tests yes, build yes

# baseline.md

Nota: `npm run build` não foi executado (escreve em `dist/`). Tipos verificados com `npm run check` e `npm run check:worker`.

## Testes
- `npm test`: 306 testes, 306 passam, 0 falham. Cobertura não medida. Playwright não corrido.

## Build e lint
| Comando | Resultado |
|---|---|
| `npm run check` | passou, 0 erros |
| `npm run check:worker` | passou, 0 erros |
| `npm run build` | não executado |
- Lint: não configurado.

## Dependências
- `npm audit`: 0 vulnerabilidades.

## Hotspots (histórico só desde 17/11/2026, ~9 dias, 233 commits)
| Ficheiro | Alterações | Linhas |
|---|---|---|
| server/storage.ts | 12 | 574 |
| server/evo08.ts | 12 | 278 |
| shared/schema.ts | 10 | 384 |
| server/routes.ts | 10 | 666 |
| server/db.ts | 10 | 334 |
| server/validation.ts | 7 | 97 |
| worker/index.ts | 6 | 93 |
| shared/calc/insights.ts | 5 | 347 |
| shared/evo08.ts | 4 | 369 |
| shared/calc/month.ts | 4 | 197 |

## Maiores ficheiros (linhas)
server/routes.ts 666 · server/storage.ts 574 · shared/schema.ts 384 · shared/evo08.ts 369 · shared/calc/insights.ts 347 · server/db.ts 334 · shared/calc/budget.ts 292 · server/evo08.ts 278 · shared/pdf.ts 238 · shared/calc/month.ts 197
