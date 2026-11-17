> Histórico (2026-09-23). Superado por [SEGURANCA.md](SEGURANCA.md): o código já não viaja em URLs, não é guardado em claro e o `xlsx` foi atualizado.

# Pre-publish security review

Project: `/home/user/workspace/patrimonio`  
Baseline: `629539a`  
Reviewed update: `e538c77`  
Review date: 2026-09-23

## BLOCK (must fix before publishing)

None found.

## WARN (still-open and accepted)

- **`xlsx` dependency audit finding (existing, not introduced by this update).** `npm audit --json` reports one high-severity direct dependency finding for `xlsx@0.18.5`: prototype pollution (`GHSA-4r6h-8v6p-xvw6`) and regular-expression denial of service (`GHSA-5pgg-2g8v-p4x9`), with no automated fix available. The package is used only by the server-side `/api/export/xlsx` export route (`server/routes.ts:12,230-282`) to create workbooks from the app's stored state; the application does not parse uploaded workbooks. This remains the previously known, accepted export-only risk.
- **Access code in query strings (existing, not introduced by this update).** `client/src/lib/queryClient.ts:16-20` adds the access code to URLs for downloads, and `server/routes.ts:37-40` accepts it from `req.query.codigo`. This can expose the code through browser history, logs, or referrer handling. The normal API path uses the `x-codigo-acesso` header. This remains the previously known, accepted risk.

## PASS

- Dependency audit found no critical vulnerabilities and no additional high-severity findings.
- Secret-pattern scan over source/config files found no API keys, private keys, hardcoded credentials, or non-`VITE_` environment secrets. No new `.env` files or sensitive files were added by the update.
- The new files (`client/src/components/editable-section-grid.tsx` and `client/src/lib/page-layout.ts`) and the modified page/storage/schema files contain no secrets or newly exposed personal financial data. `pageLayouts` is UI-position metadata, not a credential.
- `settings.pageLayouts` is stored as a SQLite text value through Drizzle's parameterized update path (`server/routes.ts:48-50`; `server/storage.ts:168-170`), so JSON strings cannot become SQL syntax. The client parses the value as JSON and passes only layout numbers to `react-grid-layout`; it does not use the value as HTML, JavaScript, a CSS selector, or a DOM attribute. No XSS or code-injection path was found.
- The generic settings PATCH route remains protected by the existing API access-code middleware when a code is configured (`server/routes.ts:33-42`). No new route or unauthenticated mutation was introduced.
- The dangerous-pattern scan found only the pre-existing `dangerouslySetInnerHTML` in `client/src/components/ui/chart.tsx:80-99`; it generates chart CSS from static chart configuration and is unrelated to the new layout field. No new dangerous sink was added.
- No open CORS pattern was found.
- `npm run check`, `npm run build`, and `git diff --check` completed successfully.

## Hardening note (not escalated to WARN for this private single-user app)

The generic PATCH endpoint does not structurally validate `pageLayouts`. A caller who already has the access code can store arbitrary text, and a value such as the JSON string `null` would make `client/src/lib/page-layout.ts:20` throw while rendering a page. This is a robustness/availability hardening opportunity, not an injection or secret-exposure finding; add server-side JSON-shape and numeric-range validation if the endpoint will later serve multiple users or less-trusted callers.
