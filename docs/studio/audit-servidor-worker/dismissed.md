# Descartados (resumo dos auditores)

## correctness
Encadeamento de transactionSync no Worker; `.changes` do shim; corridas em closeMonth/payReserve/csvImport (código síncrono); reabertura com reforçar/transportar (coerente); meses repetidos (raro); parseAmount PT; meios cêntimos negativos; PATCH de transação só com monthId; writeFileSync no Worker; saveRecurring `active`.

## security
CSRF (cabeçalho x-sm-client, sem CORS); limites de corpo; import de backup (sem SQL injection); offline sync e CSV (atrás do código); IA (URL fixa, limite diário); CSP; static.ts; `same()` revela comprimento; e.message em 500; ficheiros pre-import; XSS.

## maintainability
Limitador duplicado auth/middleware (equivalente); `{error}` vs `{message}` (cliente trata); cópia pré-import no Worker (fiabilidade); guarded()/installGuards sem buraco concreto; closingPlan vs closeMonth equivalentes; paridade do shim; ficheiros grandes estáveis; pending() desempenho.

## Fusões na fase 5
sec-2+sec-3 -> F2; corr-2+maint-4 -> F5; corr-3+maint-2 -> F6.
