# Candidatos (fase 5): 17 achados dos auditores -> 14 após fusões (3 fusões)

| Id | Sev | Conf | Local | Afirmação | Esf. | Lentes |
|---|---|---|---|---|---|---|
| F1 | high | high | server/vite.ts:12 | `npm run dev` serve data.db e backups/ por `/@fs` sem código; `fs.deny` anulado, escuta em 0.0.0.0, `allowedHosts: true` | S | security |
| F2 | high | high | server/middleware.ts:49 | `knownGood` corre antes do limitador (Node): IP bloqueado continua a testar códigos; no Worker `knownGood` é sempre falso e o teto global de 60/min bloqueia o dono e o backup R2 | M | security (sec-2 + sec-3) |
| F3 | high | high | server/routes.ts:632 | Restaurar backup apaga rulePlatforms/ruleAssets (modelo de divisão); lista de tabelas escrita à mão em 6 sítios | S | maintainability |
| F4 | high | high | server/offline.ts:43 | Despesa offline com data em mês inexistente/fechado bloqueia a fila de sync e todas as escritas | M | correctness |
| F5 | medium | high | server/evo08.ts:104 | Percentagens arredondadas linha a linha: 100% mostra défice de 0,01 € e erro `dist_excede`; 5 implementações de arredondamento divergentes | M | correctness + maintainability (corr-2 + maint-4) |
| F6 | medium | high | server/offline.ts:35 | Sync offline ignora `included` e não valida o PATCH de mês (monthPatchSchema) | S | correctness + maintainability (corr-3 + maint-2) |
| F7 | medium | high | server/routes.ts:231 | Duplicar mês volta a incluir parcelas excluídas | S | correctness |
| F8 | medium | medium | server/middleware.ts:13 | TRUST_PROXY=1 por omissão em produção: X-Forwarded-For forjado anula o limite por IP | S | security |
| F9 | medium | high | server/routes.ts:496 | Validação do backup é cópia fraca: não valida valores de movimentos, taxas, kind de parcelas | M | maintainability |
| F10 | medium | high | server/routes.ts:260 | Quatro estilos de erro; rotas manuais devolvem e.message em 500 | S | maintainability |
| F11 | low | high | server/access.ts:18 | Worker com ACCESS_CODE < 8 caracteres fica aberto | S | security |
| F12 | low | high | server/evo08.ts:81 | Histórico por monkey-patch com entradas `{}` em metas/submetas | S | maintainability |
| F13 | low | medium | server/db.ts:96 | ALTER em try/catch engole qualquer erro | S | maintainability |
| F14 | low | high | server/evo08.ts:268 | Código morto e comentários enganadores | S | maintainability |

Nenhum achado foi largado por falta de ficheiro, linha ou cenário. Cadeias: F8 + F2 (XFF forjado satura o teto global e bloqueia o dono).
