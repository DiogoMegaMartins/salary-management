# Auditoria — servidor e Worker

2026-11-26 · âmbito: server/, worker/ e shared/ (48 ficheiros) · lentes: correção, segurança, manutenção

## Resumo

O servidor está em bom estado: 306 testes passam, os tipos passam, não há vulnerabilidades nas dependências e as rotas principais validam o corpo e exigem o código de acesso. Os problemas estão em casos pouco comuns. O servidor de desenvolvimento serve a base de dados a quem estiver na rede, o limite de tentativas do código tem falhas, e os caminhos menos usados (restauro de backup, cópia offline, duplicar mês) não seguem as regras das rotas normais. Convém começar pelo F1 (uma linha) e depois pelos F3, F6 e F7, que são pequenos e evitam perdas silenciosas de configuração.

| Gravidade | Confirmados | Plausíveis |
|---|---|---|
| Crítica | 0 | 0 |
| Alta | 1 | 0 |
| Média | 6 | 0 |
| Baixa | 7 | 0 |

Refutados na verificação: 0 de 14. Quatro verificadores baixaram a gravidade de F2, F3, F4, F8 e F9 depois de reproduzirem os casos.

## Backlog

| # | Id | Gravidade | Título | Local | Esforço | Modo | Estado |
|---|---|---|---|---|---|---|---|
| 1 | F1 | high | `npm run dev` entrega data.db e backups/ a qualquer pessoa na rede, sem código de acesso | `server/vite.ts:12` | S | full | por fazer |
| 2 | F3 | medium | Restaurar um backup apaga o modelo de divisão (plataformas e ativos por parcela) sem avisar | `server/routes.ts:632` | S | full | por fazer |
| 3 | F6 | medium | A sincronização offline ignora «parcela fora deste mês» e aceita meses inválidos que depois impedem o restauro de backups | `server/offline.ts:35` | S | full | por fazer |
| 4 | F7 | medium | Duplicar um mês volta a incluir parcelas que estavam excluídas | `server/routes.ts:231` | S | fast | por fazer |
| 5 | F2 | medium | O limite de tentativas do código de acesso tem duas falhas: um IP bloqueado continua a adivinhar (Node) e 60 falhas por minuto trancam o dono e a cópia para o R2 (Worker) | `server/middleware.ts:49` | M | full | por fazer |
| 6 | F4 | medium | Uma despesa offline com data num mês inexistente ou fechado bloqueia a sincronização e todas as escritas | `server/offline.ts:43` | M | full | por fazer |
| 7 | F5 | medium | Divisão em percentagens: o fecho mostra um défice de 0,01 € que não existe, e há cinco arredondamentos diferentes | `server/evo08.ts:104` | M | full | por fazer |
| 8 | F11 | low | No Worker, um segredo ACCESS_CODE com menos de 8 caracteres deixa a app aberta e qualquer pessoa pode definir o código | `server/access.ts:18` | S | full | por fazer |
| 9 | F8 | low | Em produção o Node confia em X-Forwarded-For por omissão: sem proxy à frente, o limite por IP deixa de valer | `server/middleware.ts:13` | S | full | por fazer |
| 10 | F10 | low | Quatro estilos de tratamento de erro nas rotas: algumas devolvem o texto interno do erro e não registam nada | `server/routes.ts:260` | S | fast | por fazer |
| 11 | F12 | low | O histórico de alterações de metas e submetas regista `{}` ao editar ou eliminar | `server/evo08.ts:81` | S | fast | por fazer |
| 12 | F13 | low | As migrações da base de dados engolem qualquer erro como se a coluna já existisse | `server/db.ts:96` | S | full | por fazer |
| 13 | F14 | low | Código morto e comentários que dizem o contrário do que o código faz (categorias) | `server/evo08.ts:268` | S | fast | por fazer |
| 14 | F9 | low | A validação do backup é uma cópia mais fraca das regras das rotas normais | `server/routes.ts:496` | M | full | por fazer |

Ordem: fórmula de pontuação (gravidade × confiança ÷ esforço). Ajustes: F6 passa à frente de F2 e F4 porque pode gravar meses inválidos que impedem restaurar backups; F11 sobe acima de F8 e F10 porque deixa os dados públicos (mesma pontuação); F9 fica no fim porque exige um ficheiro editado à mão.

### F1 — `npm run dev` entrega data.db e backups/ a qualquer pessoa na rede, sem código de acesso

- **Onde:** `server/vite.ts:12–28` (também `vite.config.ts:20`, `server/index.ts:30`)
- **Cenário:** Com `npm run dev`, GET /@fs/<raiz>/data.db e /@fs/<raiz>/backups/data-1.db respondem 200 com o conteúdo, também com Host: evil.example. O servidor escuta em 0.0.0.0 e /@fs não passa pelo código de acesso (só /api). O caminho absoluto aparece em qualquer módulo transformado.
- **Impacto:** Quem estiver na mesma rede (ou um site visitado, por DNS rebinding) descarrega a base com todos os dados financeiros e o hash do código, enquanto a app corre em modo de desenvolvimento.
- **Evidência:**
  ```
  const serverOptions = { middlewareMode: true, hmr: {...}, allowedHosts: true as const };
  ... server: serverOptions   // substitui o `server` de vite.config.ts e perde o fs.deny
  ```
- **Verificação:** confirmado. Reproduzido: 200 com o ficheiro falso; com o `fs` original junto, 403.
- **Correção:** `server: { ...viteConfig.server, ...serverOptions }`, `allowedHosts: ["localhost","127.0.0.1"]` e escutar em 127.0.0.1 em desenvolvimento. Teste: pedir /@fs/<raiz>/data.db e esperar 403.
- **Pedido para o build:** `/studio:build --skip-idea --full "[audit-servidor-worker F1] `server: { ...viteConfig.server, ...serverOptions }`, `allowedHosts: ['localhost','127.0.0.1']` e escutar em 127.0.0.1 em desenvolvimento. Problema: npm run dev entrega data.db e backups/ a qualquer pessoa na rede, sem código de acesso (server/vite.ts:12). Primeiro um teste que reproduz o problema e falha."`

### F3 — Restaurar um backup apaga o modelo de divisão (plataformas e ativos por parcela) sem avisar

- **Onde:** `server/routes.ts:632–656` (também `server/storage.ts:531`, `server/storage.ts:551`, `server/routes.ts:499`)
- **Cenário:** Guardar um modelo com 1 plataforma e 1 ativo, exportar (a exportação traz 1 e 1) e restaurar com POST /api/import: 200 e as duas tabelas ficam a 0. Um mês criado a seguir já não distribui por plataformas.
- **Impacto:** Quem restaura um backup perde a configuração do modelo mensal sem erro. Movimentos e divisões mensais ficam intactos e o modelo pode ser regravado com «Guardar como modelo».
- **Evidência:**
  ```
  storage.replaceAll({ platforms: body.platforms, ... })   // sem rulePlatforms nem ruleAssets
  storage.ts:531  db.delete(ruleAssets).run(); db.delete(rulePlatforms).run();
  ```
- **Verificação:** confirmado. Reproduzido: depois do restauro, 0 e 0.
- **Correção:** Passar `rulePlatforms` e `ruleAssets` a replaceAll e acrescentá-las a `colls` em validateBackupShape. Primeiro um teste export→import por HTTP. Depois derivar a lista das chaves de FullState para uma tabela nova passar a precisar de um só sítio.
- **Pedido para o build:** `/studio:build --skip-idea --full "[audit-servidor-worker F3] Passar `rulePlatforms` e `ruleAssets` a replaceAll e acrescentá-las a `colls` em validateBackupShape. Problema: Restaurar um backup apaga o modelo de divisão (plataformas e ativos por parcela) sem avisar (server/routes.ts:632). Primeiro um teste que reproduz o problema e falha."`

### F6 — A sincronização offline ignora «parcela fora deste mês» e aceita meses inválidos que depois impedem o restauro de backups

- **Onde:** `server/offline.ts:35–49` (também `server/routes.ts:216`, `server/routes.ts:266`, `server/validation.ts:77`, `shared/offline.ts:24`)
- **Cenário:** Offline, desligar uma parcela (PUT /api/allocations com included:false): depois do sync o servidor continua com included=1 e a alteração desaparece. PATCH de mês com taxaSs 7, month 13, base -500 e label vazia: 400 online, 200 offline e fica gravado. Uma exportação feita a seguir é recusada no restauro («Mês com ano/mês inválido.»).
- **Impacto:** A divisão do mês fica diferente da que o utilizador escolheu, o resultado depende de a cópia offline estar ativa, e dados inválidos podem tornar os backups seguintes impossíveis de restaurar.
- **Evidência:**
  ```
  storage.updateMonth(Number(parts[3]), editableMonthPatch(d));   // sem monthPatchSchema
  storage.setAllocation(Number(d.monthId), Number(d.parcelId), d.mode, d.value);   // d.included descartado
  ```
- **Verificação:** confirmado. Reproduzido: included ficou 0; PATCH inválido gravado offline; export seguinte recusado.
- **Correção:** Passar `included` a setAllocation e validar o PATCH com monthPatchSchema (extraído para um módulo partilhado). Para despesas, escolher só os campos conhecidos. Teste: o mesmo corpo inválido dá 400 nas duas rotas.
- **Pedido para o build:** `/studio:build --skip-idea --full "[audit-servidor-worker F6] Passar `included` a setAllocation e validar o PATCH com monthPatchSchema (extraído para um módulo partilhado). Problema: A sincronização offline ignora «parcela fora deste mês» e aceita meses inválidos que depois impedem o restauro de backups (server/offline.ts:35). Primeiro um teste que reproduz o problema e falha."`

### F7 — Duplicar um mês volta a incluir parcelas que estavam excluídas

- **Onde:** `server/routes.ts:231–235` (também `server/storage.ts:216`, `server/storage.ts:421`)
- **Cenário:** Em março, «Férias» tem 200 € e included=0. Duplicar março para abril: createMonth cria as alocações com included=1 e setAllocation não recebe `included`, por isso «Férias» conta 200 € em abril.
- **Impacto:** O mês duplicado fica com mais dinheiro alocado do que o original e pode passar a «excede», sem explicação visível.
- **Evidência:**
  ```
  for (const a of state.allocations.filter((x) => x.monthId === src.id)) storage.setAllocation(created.id, a.parcelId, a.mode, a.value);
  ```
- **Verificação:** confirmado. Confirmado por traço de código sem lacunas (sem execução).
- **Correção:** Passar `a.included` como quinto argumento e juntar o caso a tests/integrity.test.ts:57.
- **Pedido para o build:** `/studio:build --skip-idea --fast "[audit-servidor-worker F7] Passar `a.included` como quinto argumento e juntar o caso a tests/integrity.test.ts:57. Problema: Duplicar um mês volta a incluir parcelas que estavam excluídas (server/routes.ts:231). Primeiro um teste que reproduz o problema e falha."`

### F2 — O limite de tentativas do código de acesso tem duas falhas: um IP bloqueado continua a adivinhar (Node) e 60 falhas por minuto trancam o dono e a cópia para o R2 (Worker)

- **Onde:** `server/middleware.ts:49–56` (também `server/access.ts:45`, `server/routes.ts:79`, `worker/index.ts:53`)
- **Cenário:** Node: depois de o dono entrar uma vez, um IP bloqueado envia códigos em x-codigo-acesso e recebe 429 (errado) ou 200 (certo): 200 palpites sem custo. Worker: o segredo vem em texto, knownGood é sempre falso; 61 códigos errados de IPs diferentes dão 429 ao dono e ao pedido interno da cópia agendada.
- **Impacto:** No Node, um código curto (8 dígitos) cai por força bruta. No Worker, um atacante sem conta mantém a app indisponível para o dono e as cópias diárias deixam de ser feitas. Gravidade baixada de high para medium porque um código de 8 ou mais caracteres continua difícil de adivinhar.
- **Evidência:**
  ```
  if (given && knownGood(code, given)) return next();   // antes do limitador
  if (given) { const wait = Math.max(authLimiter.retryAfterSeconds(ip), globalLimiter.retryAfterSeconds(GLOBAL_KEY)); if (wait) ... 429
  ```
- **Verificação:** confirmado. Reproduzido nos dois cenários (200 palpites com 429; dono com 429 no Worker).
- **Correção:** Verificar o limitador antes do knownGood, ou melhor, /api/auth devolve um token de sessão e só esse token passa por cima do limitador. O pedido interno de backupJson passa por um cabeçalho interno que o Worker retira dos pedidos externos.
- **Pedido para o build:** `/studio:build --skip-idea --full "[audit-servidor-worker F2] Verificar o limitador antes do knownGood, ou melhor, /api/auth devolve um token de sessão e só esse token passa por cima do limitador. Problema: O limite de tentativas do código de acesso tem duas falhas: um IP bloqueado continua a adivinhar (Node) e 60 falhas por minuto trancam o dono e a cópia para o R2 (Worker) (server/middleware.ts:49). Primeiro um teste que reproduz o problema e falha."`

### F4 — Uma despesa offline com data num mês inexistente ou fechado bloqueia a sincronização e todas as escritas

- **Onde:** `server/offline.ts:43–58` (também `shared/offline.ts:27`, `server/storage.ts:281`, `client/src/lib/offline.ts:118`)
- **Cenário:** No painel de movimentos (aceita qualquer data), registar offline uma despesa com data de dezembro antes de criar dezembro. O lote inteiro falha com 409 «Não existe o mês 05/2031…», a mensagem não começa por «Conflito:» e o cliente não abre a revisão. Cada nova tentativa falha igual e as escritas online ficam recusadas («Sincroniza primeiro…»).
- **Impacto:** Não se perdem dados (a fila fica), mas o utilizador fica sem poder gravar até criar o mês noutro dispositivo ou limpar a cópia. Acontece na viragem do mês. Gravidade baixada de high para medium porque existe uma saída, embora obscura.
- **Evidência:**
  ```
  storage.createTransaction(d);   // normalizeTransaction: 409 «Não existe o mês» ou 423 «mês fechado»
  conflict = e.status === 409 && e.message.startsWith("Conflito:");
  ```
- **Verificação:** confirmado. Reproduzido: 409 «Não existe o mês 05/2031»; 423 com o mês fechado.
- **Correção:** Validar no código partilhado (projectOffline) o mês da data, como faz normalizeTransaction, e fazer o servidor devolver a operação que falhou para o cliente a poder rever ou descartar.
- **Pedido para o build:** `/studio:build --skip-idea --full "[audit-servidor-worker F4] Validar no código partilhado (projectOffline) o mês da data, como faz normalizeTransaction, e fazer o servidor devolver a operação que falhou para o cliente a poder rever ou descartar. Problema: Uma despesa offline com data num mês inexistente ou fechado bloqueia a sincronização e todas as escritas (server/offline.ts:43). Primeiro um teste que reproduz o problema e falha."`

### F5 — Divisão em percentagens: o fecho mostra um défice de 0,01 € que não existe, e há cinco arredondamentos diferentes

- **Onde:** `server/evo08.ts:104–106` (também `shared/evo08.ts:84`, `shared/calc/month.ts:142`, `server/storage.ts:250`, `server/db.ts:329`, `shared/calc/distribution.ts:17`)
- **Cenário:** Disponível 1000,01 € e duas parcelas a 50%: monthSummary dá restante -0,01 (o fecho diz «défice de 0,01 €» e não deixa transportar), /api/verify devolve o erro `dist_excede`, mas computeMonth e divisionStatus dizem «completo». Além disso 2,135 grava 2,13 numa rota (+Number.EPSILON) e 2,14 noutra (+1e-9).
- **Impacto:** Quem divide em percentagens vê um défice e um erro que não existem, e o valor a transportar fica errado em 1 cêntimo. Só acontece com meios cêntimos exatos.
- **Evidência:**
  ```
  const allocated = sumEuros(st.allocations.map((a) => allocationAmount(a, available)));   // arredonda cada linha
  // 1000,01 € a 50%+50%: 500,005 -> 500,01 + 500,01 = 1000,02
  ```
- **Verificação:** confirmado. Reproduzido com as funções reais: 1000.02 vs 1000.01; 2.13 vs 2.14.
- **Correção:** Passo 1: teste de caracterização das 5 funções em x.xx5 e negativos. Passo 2: `toCents` como única primitiva. Passo 3: um único cálculo do total alocado (arredondar a soma uma vez) usado por monthSummary, checkConsistency e executionOfMonth.
- **Pedido para o build:** `/studio:build --skip-idea --full "[audit-servidor-worker F5] Passo 1: teste de caracterização das 5 funções em x.xx5 e negativos. Problema: Divisão em percentagens: o fecho mostra um défice de 0,01 € que não existe, e há cinco arredondamentos diferentes (server/evo08.ts:104). Primeiro um teste que reproduz o problema e falha."`

### F11 — No Worker, um segredo ACCESS_CODE com menos de 8 caracteres deixa a app aberta e qualquer pessoa pode definir o código

- **Onde:** `server/access.ts:18–22` (também `server/routes.ts:47`, `server/routes.ts:106`)
- **Cenário:** Com o segredo `abc1234` (7 caracteres), getAccessCode devolve "", o middleware deixa passar tudo e PATCH /api/settings aceita que um visitante defina o código e tranque o dono fora. O único sinal é um aviso nos registos.
- **Impacto:** Um erro de configuração plausível deixa os dados financeiros públicos. O mínimo de 8 está documentado e o aviso existe, por isso a gravidade é baixa.
- **Evidência:**
  ```
  return code.length >= MIN_CODE_LENGTH ? code : "";   // segredo curto é ignorado
  ```
- **Verificação:** confirmado. Reproduzido: GET /api/x sem código deu 200.
- **Correção:** No Worker, se ACCESS_CODE existir mas for curto, falhar fechado: 503 em /api com mensagem clara.
- **Pedido para o build:** `/studio:build --skip-idea --full "[audit-servidor-worker F11] No Worker, se ACCESS_CODE existir mas for curto, falhar fechado: 503 em /api com mensagem clara. Problema: No Worker, um segredo ACCESS_CODE com menos de 8 caracteres deixa a app aberta e qualquer pessoa pode definir o código (server/access.ts:18). Primeiro um teste que reproduz o problema e falha."`

### F8 — Em produção o Node confia em X-Forwarded-For por omissão: sem proxy à frente, o limite por IP deixa de valer

- **Onde:** `server/middleware.ts:13–14` (também `server/access.ts:69`)
- **Cenário:** `npm start` sem proxy: 40 códigos errados, cada um com um X-Forwarded-For diferente, dão 40 respostas 401 e nenhum 429. Sobra o teto global de 60 por minuto.
- **Impacto:** Só afeta quem expõe o Node diretamente (o padrão está documentado em docs/SEGURANCA.md). O Worker reescreve o cabeçalho e não é afetado. Em cadeia com F2, uma só máquina satura o teto global e tranca o dono.
- **Evidência:**
  ```
  const tp = (process.env.TRUST_PROXY ?? (process.env.NODE_ENV === "production" ? "1" : "")).trim();
  ```
- **Verificação:** confirmado. Reproduzido: 40 × 401, nenhum 429.
- **Correção:** Desligar a confiança em proxies por omissão e documentar `TRUST_PROXY=1` para as plataformas com proxy.
- **Pedido para o build:** `/studio:build --skip-idea --full "[audit-servidor-worker F8] Desligar a confiança em proxies por omissão e documentar `TRUST_PROXY=1` para as plataformas com proxy. Problema: Em produção o Node confia em X-Forwarded-For por omissão: sem proxy à frente, o limite por IP deixa de valer (server/middleware.ts:13). Primeiro um teste que reproduz o problema e falha."`

### F10 — Quatro estilos de tratamento de erro nas rotas: algumas devolvem o texto interno do erro e não registam nada

- **Onde:** `server/routes.ts:260–270` (também `server/routes.ts:244`, `server/routes.ts:320`, `server/app.ts:48`)
- **Cenário:** PUT /api/allocations com ids inválidos devolve 500 «NOT NULL constraint failed: allocations.month_id». `deleteMonth(NaN)` passa em silêncio e o histórico regista «mês NaN».
- **Impacto:** Comportamento diferente por rota e falhas sem rasto nos registos. A exposição é pequena (app de um só utilizador, atrás do código; só nomes de tabelas).
- **Evidência:**
  ```
  } catch (e: any) { res.status(e.status ?? 500).json({ message: e.message }); }   // vs guard(): «Erro interno.» + console.error
  ```
- **Verificação:** confirmado. Reproduzido no storage; códigos de estado por leitura de código.
- **Correção:** Remover os try/catch manuais (o Express 5 já encaminha para o handler de app.ts) e usar `pid()` em vez de `Number(req.params.id)`. Teste: o mesmo erro simulado dá a mesma resposta em todas as rotas.
- **Pedido para o build:** `/studio:build --skip-idea --fast "[audit-servidor-worker F10] Remover os try/catch manuais (o Express 5 já encaminha para o handler de app.ts) e usar `pid()` em vez de `Number(req.params.id)`. Problema: Quatro estilos de tratamento de erro nas rotas: algumas devolvem o texto interno do erro e não registam nada (server/routes.ts:260). Primeiro um teste que reproduz o problema e falha."`

### F12 — O histórico de alterações de metas e submetas regista `{}` ao editar ou eliminar

- **Onde:** `server/evo08.ts:81–84` (também `server/evo08.ts:41`, `server/routes.ts:347`)
- **Cenário:** updateGoalEntry(id,…) e deleteGoalEntry(id) recebem um número: o change_log guarda `alterar {}` e `eliminar {}`. deleteParcel, plataformas, câmbios e valorizações nunca são registados.
- **Impacto:** O registo de alterações não diz o que mudou em metade das ações de metas. Sem perda de dados.
- **Evidência:**
  ```
  JSON.stringify(typeof a[0] === "object" ? { kind: a[0].kind, amount: a[0].amount, name: a[0].name } : {})
  ```
- **Verificação:** confirmado. Reproduzido: resumos `{}` para alterar e eliminar.
- **Correção:** Gerar o resumo a partir do resultado (update) ou do registo lido antes de apagar (delete), como deleteTransaction.
- **Pedido para o build:** `/studio:build --skip-idea --fast "[audit-servidor-worker F12] Gerar o resumo a partir do resultado (update) ou do registo lido antes de apagar (delete), como deleteTransaction. Problema: O histórico de alterações de metas e submetas regista {} ao editar ou eliminar (server/evo08.ts:81). Primeiro um teste que reproduz o problema e falha."`

### F13 — As migrações da base de dados engolem qualquer erro como se a coluna já existisse

- **Onde:** `server/db.ts:96–163` (também `server/db.ts:127`, `server/storage.ts:121`)
- **Cenário:** Se um ALTER falhar por outro motivo (base ocupada), o arranque continua e as queries falham com «no such column». Nos pares ALTER+UPDATE (onboarding_done), se o UPDATE falhar, nunca volta a correr.
- **Impacto:** Atualizações que falham a meio ficam silenciosas. A falha do UPDATE é hipotética e rara; só confirmado por leitura de código.
- **Evidência:**
  ```
  try { sqlite.exec(stmt); } catch { /* coluna ja existe */ }
  ```
- **Verificação:** confirmado. Traço de código sem lacunas; falha não reproduzida.
- **Correção:** Helper `addColumn` que só ignora «duplicate column name», e `schema_migrations` para correr cada UPDATE uma só vez.
- **Pedido para o build:** `/studio:build --skip-idea --full "[audit-servidor-worker F13] Helper `addColumn` que só ignora «duplicate column name», e `schema_migrations` para correr cada UPDATE uma só vez. Problema: As migrações da base de dados engolem qualquer erro como se a coluna já existisse (server/db.ts:96). Primeiro um teste que reproduz o problema e falha."`

### F14 — Código morto e comentários que dizem o contrário do que o código faz (categorias)

- **Onde:** `server/evo08.ts:268–273` (também `server/storage.ts:331`, `server/routes.ts:238`, `server/routes.ts:345`)
- **Cenário:** csvImport lê todas as categorias e descarta o resultado. deleteCategory apaga mesmo sem verificar uso, ao contrário do comentário (reproduzido).
- **Impacto:** Confunde quem altera o import ou as categorias e dá uma garantia falsa. Impacto baixo.
- **Evidência:**
  ```
  const known = new Set(...categories...); ... void known;
  // storage.ts:331 «nunca apagar categorias com historico» ... db.delete(categories)...
  ```
- **Verificação:** confirmado. Reproduzido: a categoria foi apagada sem verificação.
- **Correção:** Apagar `known`, corrigir ou cumprir o comentário (409 se houver movimentos com a categoria) e remover os comentários duplicados.
- **Pedido para o build:** `/studio:build --skip-idea --fast "[audit-servidor-worker F14] Apagar `known`, corrigir ou cumprir o comentário (409 se houver movimentos com a categoria) e remover os comentários duplicados. Problema: Código morto e comentários que dizem o contrário do que o código faz (categorias) (server/evo08.ts:268). Primeiro um teste que reproduz o problema e falha."`

### F9 — A validação do backup é uma cópia mais fraca das regras das rotas normais

- **Onde:** `server/routes.ts:496–527` (também `server/storage.ts:250`, `server/validation.ts:62`, `server/routes.ts:607`)
- **Cenário:** Um backup editado com taxaSs 7, base 1e12, movimentos de -50 e 0 e kind «lixo» é aceite (200) e gravado. A aplicação grava antes uma cópia automática no Node.
- **Impacto:** Exige um ficheiro editado ou corrompido carregado pelo próprio utilizador. Gravidade baixada de medium para low.
- **Evidência:**
  ```
  for (const m of body.months) if (!isNum(m.year) || !isNum(m.month) || m.month < 1 || m.month > 12) ...   // só valida year/month
  ```
- **Verificação:** confirmado. Reproduzido: 200 e valores inválidos gravados.
- **Correção:** Mover as validações para `server/backup-routes.ts` sem mudar comportamento; depois aplicar monthPatchSchema e parcelPatchSchema e exigir valor > 0. Um PR por passo, cada um com um teste de ficheiro inválido.
- **Pedido para o build:** `/studio:build --skip-idea --full "[audit-servidor-worker F9] Mover as validações para `server/backup-routes.ts` sem mudar comportamento; depois aplicar monthPatchSchema e parcelPatchSchema e exigir valor > 0. Problema: A validação do backup é uma cópia mais fraca das regras das rotas normais (server/routes.ts:496). Primeiro um teste que reproduz o problema e falha."`

## Também observado

- O cliente (client/) e os testes de interface ficaram fora do âmbito.
- Não foram lidos a fundo shared/calc/insights.ts, budget.ts, pdf.ts, annual-report.ts nem server/storage-catalogs.ts (só as somas, sem problema relevante).
- A paridade do sqlite-shim do Worker com o SQLite real não foi verificada.

## Baseline

306 testes unitários passam (0 falham); `npm run check` e `check:worker` sem erros; `npm audit` sem vulnerabilidades; sem lint configurado; cobertura não medida; `npm run build` não executado. Histórico git só desde 17/11/2026 (233 commits): ficheiros mais alterados server/storage.ts, server/evo08.ts, shared/schema.ts, server/routes.ts (666 linhas), server/db.ts.

## Recomendações fora do backlog

- Para F1, F2, F8 e F11 (segurança), correr uma auditoria profunda com `/claude-security`.
- Testes de caracterização para o caminho export→import por HTTP (F3, F6, F9), que hoje só é testado diretamente no storage.
- Medir a cobertura de testes de server/ e shared/calc/.
