# Main flows and QA

## Responsive review (2026-11-15)
- Scope: all nine routes, all settings/closing/month-editor tabs, creation/edit forms, report and drilldown overlays, selectors/popovers, help, and normal/custom/editable grids.
- Baseline findings: dense viewport-based expense/recurring grids, non-wrapping goal history, undersized tablet controls, a non-wrapping colour palette, and help-index intrinsic sizing could overflow or compress controls.
- Check 320/375/390px phones, phone landscape, 640/768/820/1024px intermediate/tablets and 1280/1440/1920px desktops; default and saved layouts, narrow widgets, short viewports, keyboard and coarse-pointer emulation.
- Content must reflow inside its own card, not be hidden to mask overflow. Wide financial tables may scroll in a named, keyboard-accessible local region; primary forms may not require horizontal scrolling.
- Preserve financial calculations, record IDs, default-collapsed per-goal subgoals, access settings and all existing actions. Use isolated preview records only.
- Main regressions: navigation, month salary/division/platforms/assets/movements, expense create/edit, recurring/reserve forms, goal/subgoal forms, budget categories, settings tabs/catalogs/import preview/export, help search, report, drilldown, theme/privacy and layout edit/cancel.
- Deliver private preview and a coverage/findings report. Do not publish production. Physical-device keyboards, OS installation and actual Safari/iOS touch behavior are not certified by Chromium emulation.

### Responsive review results
- Final nine-route matrix: 99 viewport/route combinations, with no accidental document/main horizontal overflow. Wide financial tables retain their intentional local scrolling.
- Settings/closing tabs: 36 checks. All 19 help articles: 76 checks. Primary expanded forms: 12 checks. Existing month salary/division/movements, including draft platform rows: 15 checks. No overflow failures in these final checks.
- Report, drilldown, new parcel, budget category and new month dialogs: 20 checks across phone/tablet/desktop/short landscape; final bounds and horizontal overflow pass. Mobile More sheet also checked.
- Isolated GET-response fixtures (writes blocked) exercised saved narrow widgets, long names, synthetic large balances, the asset editor and drilldown editing. The long-platform badge overflow found at 320px was fixed and rechecked.
- Mouse drag/resize and Chromium CDP touch drag/resize completed. A synthesized touch sequence across a normal parcel card scrolled main. These are emulated gestures, not physical iOS/Android evidence.
- Per-goal subgoals remain collapsed on initial/reload, independent, and keyboard-operable; theme/privacy round trips and mobile help search/navigation pass.
- TypeScript and production build pass; all 109 tests pass (four new geometry regressions). Impeccable source detector returned an empty findings array; this is not accessibility, performance or security certification.
- Same existing app preview updated, not production. Hosted preview confirmed current dashboard, independent subgoal expansion at 375px, and expense form at 768px (five fields 168×44px, zero form/main overflow).
- Detailed coverage, limitations and retained build warnings: docs/revisao-responsiva-2026-11-15.md. Machine-readable viewport results: docs/qa/responsive-results-2026-11-15.json.

## Show/hide dashboard subgoals per goal
- Start: Painel, Metas card. All subgoal groups are hidden by default, including after reloading.
- Each goal has its own "Mostrar submetas (N)" button; activating it reveals all subgoals of that goal only, leaving other goals collapsed.
- Its button changes to "Esconder submetas"; activating it hides that group only. Principal goals, their totals and the underlying subgoal values are unchanged.
- Keyboard Enter/Space operates each button; aria-expanded reflects its own group and aria-controls references that group's ID.
- Desktop, 375px and 320px: button remains readable and reachable, no horizontal overflow. Desktop/mobile/desktop resizing preserves the current show/hide state.
- No subgoals: no unnecessary toggle button. State is transient and per goal; toggle never writes financial records or changes accumulated values.
- Regression: nine route navigation, month editor open/close, report, drilldown, layout edit/cancel, privacy/theme round trips. Hosted preview: toggle both ways and open another route.

### Per-goal toggle results
- Initial load and reload: zero visible subgoals. Expanding goal 3 shows its four subgoals while goal 2 stays hidden. Both can be open; closing goal 3 leaves goal 2 open.
- Keyboard Enter and Space both operate the focused goal's button. All principal totals remain unchanged after toggling.
- No-subgoal state checked through an isolated API response fixture: no toggle buttons rendered.
- Desktop, 375px and 320px inspected, including expanded/collapsed states. No horizontal overflow. Resizing preserves the current goal's expanded state.
- All nine navigation routes, month editor open/close, monthly report, drilldown, layout edit/cancel, privacy and theme round trips passed without new page errors.
- TypeScript, 105 tests and production build pass.
- Fresh hosted preview context: all initially hidden, independent expansion and collapse work, values retained, mobile overflow zero and month navigation works. No page errors. Temporary deployment proxy used after the Perplexity wrapper's Cloudflare challenge.
- Preview updated only. No publication, database, schema, financial record or persistent setting changes.

## Dashboard subgoals (2026-11-03)
- Baseline: Painel shows principal goals only; existing goal totals use the shared breakdown.
- Painel: after expanding a goal, each subgoal is visible under its parent, with name, accumulated amount, target, remaining amount, percentage and progress bar.
- Edge states: reached/exceeded target shows "Objetivo atingido"; absent/zero target shows balance and "Sem objetivo definido", without a percentage/bar.
- Currencies: subgoal amounts retain their own currency. Missing conversion warns of an incomplete parent total; no false completed claim.
- Parent with subgoals but no target remains visible. Parent without subgoals is unchanged; no double counting.
- Desktop, 375px and 320px: long names wrap, cents remain visible, no horizontal overflow. Saved short widgets allow internal scrolling to all subgoals.
- Regression: open all nine routes through navigation; open/cancel month edit, open/close report and expense drilldown, theme/privacy toggle and restore, edit/cancel layout.
- Integration: on isolated seed database create/update a subgoal and balance, then return to Painel and verify fresh data, reload and compare total with Parcelas e metas.
- Hosted preview: in fresh context load dashboard/subgoals and another route using the backend proxy. Do not publish production or use its database.

### Results
- TypeScript and production build pass; all 105 tests pass, including six new dashboard subgoal regressions.
- Created a subgoal and adjustment through the existing goal controls. Dashboard shows 1250.25 accumulated, 3000 target, 1749.75 remaining and 42%; principal total agrees with Parcelas e metas.
- Edited the target to 3100.50 through the UI and returned to Painel: 1850.25 remaining and 40%. Hosted preview edit back to 3000 also updates the summary through the backend proxy.
- Reached/exceeded target, null/zero target, foreign currency without rate, targetless parent and long names checked on isolated seed data.
- Inspected desktop, dark theme, 375px and 320px screenshots; no horizontal document overflow. A short saved goal widget has a 229px viewport and 670px scroll content; the last subgoal remains reachable.
- All nine navigation routes opened; month editor open/close, monthly report, expense drilldown, layout edit/cancel and theme/privacy round trips exercised. No new browser page errors observed.
- A separate browser context with throwing localStorage/sessionStorage/indexedDB getters still loads the subgoal dashboard and month route without errors. Existing guarded storage calls are a false positive in deployment lint; no storage code was removed or changed for this feature.
- Hosted content verified in a fresh context via the deployment tool's temporary proxy because the Perplexity wrapper presents a Cloudflare challenge to automated Chromium. Dashboard loads and a subgoal edit persists and appears on return.
- Production remains unpublished and untouched. Preview fixtures are isolated from production; no schema, API or calculation changes.

## Baseline
- Existing mobile month editor at 375px hides parcel names in a fixed four-column grid.
- Month editor sends status/carryIn in PATCH; backend rejects those protected fields.
- Existing navigation: Painel, Meses, Despesas, Fecho e planeamento, Parcelas e metas, Carteira, Orçamento, Definições, Ajuda.

## Regression inventory
- Open every route through navigation; title and data visible, no page overflow or new console errors.
- Months: open existing month, edit salary using comma decimals, save, reopen, confirm persisted values.
- Division: see full parcel name, change fixed value and mode, verify calculated amount and remaining.
- Platforms: expand distribution, add/edit/save line; expand assets, add/edit/save percentage.
- Movements: open tab and create a synthetic expense on isolated QA database.
- New month: cancel must not create; create then edit.
- Closed month: edits disabled in UI and rejected by server.
- Theme/privacy: toggle and restore; desktop/mobile/desktop responsive transition.
- Dashboard, budget, goals, wallet: preserve shared calculation semantics.
- Data/help: tabs, documentation navigation and backup download.

## Requested delta
- 320/375/390px: month cards rather than wide table; duplicate/delete still available.
- Full-height mobile editor, scrollable body, visible tabs, totals and footer; keyboard-safe viewport.
- Division, platform and asset rows stack; no missing labels, no squashed monetary inputs.
- All routes fit mobile; dense secondary tables have their own deliberate horizontal scroll.
- Offline setup is explicit and requires access code, secure context and storage support.
- Cache shell only (never raw API responses); encrypted financial snapshot and pending batch.
- Offline month/allocation/platform/asset edits and expense creation persist; unsupported writes fail clearly.
- Reconnect/manual sync atomically replays once; stale baseline or closed month preserves pending changes.
- Reload offline and unlock with code; wrong code never reveals data.
- Offline save failure never reports success or discards drafts.
- Two off-happy-path cases: concurrent server edit, interrupted sync/retry.

## Delivery checks
- Run automated regressions and TypeScript check.
- Screenshot desktop and 375px initial views and dense mobile allocation state.
- Fresh hosted preview: load new version, open month and edit, navigate another route.
- Preview iframe may disallow service workers/CacheStorage: show an honest unsupported state.

## Coverage recorded on 2026-11-02
- TypeScript check and production build pass; 99 automated tests pass.
- All nine routes opened through menus at 375px and desktop; no new page errors observed.
- Month salary and allocation editing, decimal comma, platform amounts and asset percentages exercised.
- New month created on synthetic data; cancelling a new month creates nothing.
- Synthetic month closed through the confirmation dialog; division and salary save disabled afterwards.
- Backup JSON download, theme/privacy cycle, responsive desktop/mobile/desktop and help navigation exercised.
- Dialog checked at 320px and with a short keyboard-sized viewport. Dense secondary tables intentionally scroll within their container.
- Charts inspected after animations settled. Mobile chart details open on click; saved desktop layouts reflow into a stack, including after resizing.
- Mobile layout editing, save, reset and desktop/mobile transition exercised; saving the stacked layout intentionally applies that layout on desktop too.
- Isolated offline QA: existing salary/allocation edit and new expense survive offline reload; incorrect unlock code rejected.
- Reconnection produced one expense; encrypted payload contains neither the expense note nor the access code as plaintext.
- Concurrent server edit blocks sync. Conflict review explicitly applies listed local edits while retaining unrelated server notes.
- Empty queues are reloaded from encrypted storage on sync so that a conflict resolved in another tab does not leave a stale warning.
- Hosted preview backend reads and allocation writes exercised with synthetic seed data. No production database used.
- Hosted preview: all nine mobile routes load without document overflow; immediate salary save/reopen retains the decimal value; missing strong offline code produces the expected setup error.

## Limits of signoff
- Real iPhone/Android installation, OS keyboard behavior, biometric integration and browser storage eviction are not certified.
- The preview's Perplexity wrapper can present a Cloudflare challenge to automated Chromium; hosted content is checked through the deployment tool's temporary preview URL.
- Public-shell caching and encrypted offline storage were tested on a standalone localhost origin. Embedded preview storage/service-worker restrictions are reported rather than bypassed.
- No production publication, production-data import, destructive restore, external price feed or live-account integration was performed.
- This is not an exhaustive accessibility/security/dependency audit.

## Barra inferior (telemóvel, 375px)
- Start: #/ ; Steps: tocar em Meses, depois Mais, depois "Ajuda e documentação"
- Expect: separador Meses com aria-current; folha com 5 áreas; Mais ativo na Ajuda; sem scroll horizontal; barra oculta com teclado e no computador

## Ajuda do telemóvel
- Start: #/ajuda/usar-no-telemovel ; Steps: abrir "Índice", pesquisar "offline", escolher "Modo offline e instalação"
- Expect: conteúdo visível antes do índice; índice recolhe após escolher

## Documentação 1.9.1 e preparação de publicação
- Confirmar na Ajuda a versão 1.9.1, data 2026-11-15, notas de versão, instruções de submetas e grelhas compactas.
- Confirmar `/api/app-info` com a mesma versão; navegar nas nove áreas em telemóvel e computador, sem escritas financeiras.
- Reexecutar tipos, testes e compilação após os metadados/documentação.
- Produção antes da publicação: tentativa de abertura bloqueada pelo acesso privado da plataforma; não foi exportado backup. Não reutilizar autorização antiga para publicar sem backup.
- Resultado: tipos, 109 testes e compilação aprovados; 22 verificações locais nas duas larguras sem transbordo de documento/main ou erros de página. API local confirma 1.9.1.
- Pré-visualização alojada a 375 px: versão 1.9.1 confirmada; índice abre os artigos Painel e Usar no telemóvel com as novas instruções, sem transbordo de página.
- Publicação: o utilizador aceitou especificamente publicar 1.9.1 sem backup e com os avisos de segurança. Plataforma confirmou `published`, site existente e `Private` em 2026-11-15.
- Verificação pós-publicação: nova abertura foi encaminhada para a autenticação privada da plataforma. Versão, fluxos autenticados, registos e código de acesso da produção não puderam ser verificados; não afirmar preservação dos dados.
