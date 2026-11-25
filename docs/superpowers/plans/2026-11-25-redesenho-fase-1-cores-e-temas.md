# Redesenho "Calma", fase 1: cores e temas — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A app passa a ter 5 paletas de cor (Céu por defeito) e modo automático/claro/escuro, escolhidos em Definições › Aparência e guardados na conta.

**Architecture:** As cores já são variáveis CSS (`--background`, `--primary`, …) em `client/src/index.css`, com `.dark` para o escuro. Cada paleta passa a ser um bloco `:root[data-palette="x"]` (claro) e `:root[data-palette="x"].dark` (escuro) que redefine essas variáveis. Um `AppearanceProvider` (substitui o `ThemeProvider`) aplica `data-palette` e a classe `dark` no `<html>`, lê a escolha da conta e de uma cache local, e um script externo aplica a cache antes do primeiro desenho para não piscar.

**Tech Stack:** React 19, Tailwind 4, Express/Drizzle (better-sqlite3), zod 4, Playwright, `@fontsource-variable/figtree`.

**Spec:** `docs/superpowers/specs/2026-11-25-redesign-calma-design.md` (fase 1).

## Global Constraints

- Texto da interface em português de Portugal, simples.
- Paleta por defeito: `ceu`. Modo por defeito: `auto`. Chaves novas em `settings`: `palette`, `colorMode`.
- Valores de paleta (`palette`): `ceu`, `salvia`, `pessego`, `lavanda`, `mare`. Valores de modo (`colorMode`): `auto`, `claro`, `escuro`.
- CSP em produção: `script-src 'self'` e `font-src 'self'` (`client/public/_headers`, `server/middleware.ts`). Nada de scripts inline nem fontes de terceiros.
- Contraste mínimo 4,5:1 para texto normal (`foreground` sobre `background`/`card`, `primary-foreground` sobre `primary`, `muted-foreground` sobre `background`), em todas as paletas e nos dois modos.
- Respeitar `prefers-reduced-motion`: sem transições de cor novas.
- Cada fase leva versão nova (`package.json` e `package-lock.json`), entrada em `docs/CHANGELOG.md` e nota de versão em `client/src/lib/help-content.tsx`.
- Commits locais, um por tema, primeira linha em linguagem de utilizador; sem segredos. Push só no fim.

## Review Focus

- Pessoa com tema guardado no aparelho antes desta versão (`localStorage["sm.theme"]`): mantém claro/escuro como o tinha.
- Sistema operativo muda de claro para escuro com a app aberta e modo `auto`: a app acompanha sem recarregar.
- `localStorage` indisponível ou com lixo: a app abre com Céu/automático, sem erro.
- Cache local diz uma paleta e a conta outra (outro aparelho mudou): vence a conta e a cache atualiza.
- Pedido à API com paleta ou modo inválido: recusado com mensagem clara, sem gravar.
- Base de dados antiga sem as colunas novas: abre e assume `ceu`/`auto`.

---

## Mapa de ficheiros

- Criar `shared/appearance.ts`: valores permitidos, defeitos, `parsePalette`, `parseColorMode`, `resolveDark`.
- Criar `client/src/lib/appearance.tsx`: `AppearanceProvider`, `useAppearance`, `useTheme` (compatível).
- Criar `client/public/appearance-boot.js`: aplica a cache antes do primeiro desenho.
- Criar `client/src/components/appearance-settings.tsx`: separador Aparência.
- Modificar `shared/schema.ts`, `server/db.ts`, `server/validation.ts`: colunas e validação.
- Modificar `client/src/index.css`: blocos das paletas; `client/src/fonts.css`: Figtree.
- Modificar `client/src/lib/app.tsx` (remover `ThemeProvider`), `client/src/App.tsx`, `client/src/components/layout.tsx`, `client/src/pages/data.tsx`, `client/index.html`.
- Testes: `tests/aparencia.test.ts`, `tests/aparencia-api.test.ts`, `tests/paletas-contraste.test.ts`, `e2e/aparencia.spec.ts`.

## Tabela de paletas (valores a usar)

Claro / escuro, em hexadecimal; converter para HSL nas variáveis (`--background: H S% L%`, sem `hsl()`).

| Paleta | Fundo | Cartão | Texto | Texto suave | Linha | Destaque (`primary`) | Destaque suave (`accent`) | Texto sobre destaque |
|---|---|---|---|---|---|---|---|---|
| ceu claro | #eff4fa | #ffffff | #11233a | #536880 | #dce6f1 | #2563b0 | #dbe9f8 | #ffffff |
| ceu escuro | #0e141c | #17202b | #e9f1fa | #93a8bd | #253141 | #7db4f0 | #1e3550 | #0b1520 |
| salvia claro | #eef3ef | #ffffff | #10231b | #52695d | #dbe6df | #1f7a54 | #dcefe4 | #ffffff |
| salvia escuro | #0f1512 | #18211c | #eaf4ee | #93a99d | #26332c | #6fcf9f | #1f3a2e | #0d1a13 |
| pessego claro | #fbf3ee | #ffffff | #33201a | #7a5f55 | #f0dfd6 | #c4512f | #fbe3d8 | #ffffff |
| pessego escuro | #181210 | #241a17 | #f8ece6 | #bfa398 | #382923 | #f09a7b | #4a2a1f | #1d0e08 |
| lavanda claro | #f3f1fa | #ffffff | #1f1a33 | #625b80 | #e2def0 | #5b45c4 | #e6e1f8 | #ffffff |
| lavanda escuro | #131120 | #1c1930 | #eeebfa | #a49dc7 | #2b2745 | #aa9cf5 | #2c2552 | #120d28 |
| mare claro | #f2f6f4 | #ffffff | #0f2a2c | #4f6b6d | #dbe7e5 | #0e7c86 | #d3ede9 | #ffffff |
| mare escuro | #0d1516 | #152022 | #e6f3f2 | #8fb0b1 | #233335 | #5fd0d0 | #173a3d | #08191a |

Mapeamento: fundo→`--background` e `--sidebar`; cartão→`--card`/`--popover`; texto→`--foreground`/`--card-foreground`/`--popover-foreground`/`--sidebar-foreground`; texto suave→`--muted-foreground`; linha→`--border`/`--card-border`/`--sidebar-border`/`--input`; destaque→`--primary`/`--ring`/`--sidebar-primary`/`--sidebar-ring`; destaque suave→`--muted`/`--secondary`/`--accent`/`--sidebar-accent`; texto sobre destaque→`--primary-foreground`/`--sidebar-primary-foreground`. As variáveis `--destructive*` e `--chart-*` mantêm-se.

---

### Task 1: Valores permitidos e resolução do modo

**Files:**
- Create: `shared/appearance.ts`
- Test: `tests/aparencia.test.ts`

**Interfaces:**
- Produces:
  - `PALETTES: readonly ["ceu","salvia","pessego","lavanda","mare"]`, `type Palette`
  - `COLOR_MODES: readonly ["auto","claro","escuro"]`, `type ColorMode`
  - `DEFAULT_PALETTE: Palette` (`"ceu"`), `DEFAULT_COLOR_MODE: ColorMode` (`"auto"`)
  - `parsePalette(v: unknown): Palette` e `parseColorMode(v: unknown): ColorMode`: devolvem o valor se válido, senão o defeito.
  - `resolveDark(mode: ColorMode, systemPrefersDark: boolean): boolean`
  - `PALETTE_LABELS: Record<Palette, { nome: string; descricao: string }>`

- [ ] **Step 1: Escrever os testes que falham** em `tests/aparencia.test.ts`: `parsePalette("mare") === "mare"`; `parsePalette("roxo")`, `parsePalette(undefined)` e `parsePalette(42)` dão `"ceu"`; `parseColorMode("escuro")` ok, `parseColorMode("noite")` dá `"auto"`; `resolveDark("auto", true) === true`, `resolveDark("auto", false) === false`, `resolveDark("claro", true) === false`, `resolveDark("escuro", false) === true`; todas as paletas têm etiqueta em `PALETTE_LABELS`.
- [ ] **Step 2: Correr e ver falhar:** `npx tsx --test tests/aparencia.test.ts` (ou o comando de `npm test` restrito a este ficheiro; confirmar em `package.json`). Esperado: falha por módulo inexistente.
- [ ] **Step 3: Implementar `shared/appearance.ts`** com as assinaturas acima. Etiquetas: Céu "Azul claro, fresco", Sálvia "Verde suave, calmo", Pêssego "Coral e areia, caloroso", Lavanda "Lilás suave, delicado", Maré "Turquesa, leve".
- [ ] **Step 4: Correr e ver passar** o mesmo comando. Esperado: PASS.
- [ ] **Step 5: Commit** `Aparência: valores permitidos de cor e modo` (corpo: base para as paletas, ainda sem efeito visível).

### Task 2: Guardar a escolha na conta

**Files:**
- Modify: `shared/schema.ts` (junto de `aiModel`), `server/db.ts` (migração, padrão de `ai_enabled`), `server/validation.ts` (schema parcial de settings)
- Test: `tests/aparencia-api.test.ts` (seguir o padrão de `tests/ia-frases-api.test.ts` para arrancar o servidor e fazer pedidos autenticados)

**Interfaces:**
- Consumes: `PALETTES`, `COLOR_MODES` de `shared/appearance.ts`.
- Produces: `settings.palette: string` (defeito `"ceu"`), `settings.colorMode: string` (defeito `"auto"`), aceites em `PATCH /api/settings`.

- [ ] **Step 1: Escrever os testes que falham:** (a) `GET /api/settings` em base nova devolve `palette: "ceu"` e `colorMode: "auto"`; (b) PATCH com `{palette:"mare",colorMode:"escuro"}` grava e o GET seguinte devolve-os; (c) PATCH com `{palette:"roxo"}` e com `{colorMode:"noite"}` dão 400 e não alteram o gravado; (d) migração: processo-filho com `DATA_DIR` temporário, base criada, `ALTER TABLE settings DROP COLUMN palette` e `DROP COLUMN color_mode`, reiniciar e verificar que voltam com os defeitos (mesmo método do teste de migração existente em `tests/arranque.test.ts`).
- [ ] **Step 2: Correr e ver falhar.**
- [ ] **Step 3: Implementar:** colunas `palette TEXT NOT NULL DEFAULT 'ceu'` e `color_mode TEXT NOT NULL DEFAULT 'auto'` em `shared/schema.ts`; `ALTER TABLE ... ADD COLUMN` com `try/catch` em `server/db.ts`; em `server/validation.ts` `palette: z.enum(PALETTES)` e `colorMode: z.enum(COLOR_MODES)`. Confirmar se o Worker (`worker/`) reutiliza `server/db.ts`; se tiver o seu próprio esquema, aplicar lá a mesma migração.
- [ ] **Step 4: Correr os testes** e `npm run check`, `npm run check:worker`. Esperado: PASS.
- [ ] **Step 5: Commit** `Aparência: a escolha de cor e modo fica guardada na conta`.

### Task 3: Paletas em CSS e contraste

**Files:**
- Modify: `client/src/index.css` (dentro de `@layer utilities`, a seguir ao bloco `.dark`)
- Test: `tests/paletas-contraste.test.ts`

**Interfaces:**
- Consumes: `PALETTES`.
- Produces: seletores `:root[data-palette="<p>"]` (claro) e `:root[data-palette="<p>"].dark` (escuro) para as 5 paletas, com as variáveis da tabela. Sem atributo `data-palette`, a app mantém os valores atuais de `:root` e `.dark`.

- [ ] **Step 1: Escrever o teste que falha** em `tests/paletas-contraste.test.ts`: lê `client/src/index.css`; para cada paleta e cada modo, extrai o bloco com o seletor acima (falha se faltar) e lê `--background`, `--card`, `--foreground`, `--muted-foreground`, `--primary`, `--primary-foreground` (formato `H S% L%`); converte para sRGB e calcula o contraste WCAG. Assertivas: `foreground/background >= 7`, `foreground/card >= 7`, `muted-foreground/background >= 4.5`, `muted-foreground/card >= 4.5`, `primary-foreground/primary >= 4.5`, `primary/background >= 3` (componentes gráficos).
- [ ] **Step 2: Correr e ver falhar** (blocos inexistentes).
- [ ] **Step 3: Escrever os 10 blocos** com a tabela de paletas. Se algum valor da tabela não cumprir um limiar do teste, ajustar a luminosidade desse valor o mínimo necessário e registar a alteração no corpo do commit.
- [ ] **Step 4: Correr o teste** até passar. Esperado: PASS para as 10 combinações.
- [ ] **Step 5: Commit** `Aparência: cinco paletas de cor, em claro e escuro`.

### Task 4: Letra Figtree

**Files:**
- Modify: `package.json`, `package-lock.json`, `client/src/fonts.css`, `client/src/index.css:346`

**Interfaces:** Produces: `--font-sans: Figtree, Inter, ui-sans-serif, system-ui, sans-serif`.

- [ ] **Step 1: Instalar:** `npm install @fontsource-variable/figtree` (versão exata no `package.json`, como as outras fontes).
- [ ] **Step 2: Em `client/src/fonts.css`** acrescentar `@font-face` "Figtree" (latim, `font-display: swap`, intervalo de peso do ficheiro variável) a apontar para `node_modules/@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2`, no mesmo formato dos blocos de Inter e JetBrains Mono; atualizar `--font-sans`.
- [ ] **Step 3: Verificar:** `npm run build` e confirmar que o `.woff2` está em `dist/public/assets` e que `grep -r "fonts.googleapis" dist/public` não devolve nada. Esperado: build sem erros.
- [ ] **Step 4: Commit** `Aparência: letra Figtree, alojada na própria app`.

### Task 5: Aplicar paleta e modo na app

**Files:**
- Create: `client/src/lib/appearance.tsx`, `client/public/appearance-boot.js`
- Modify: `client/src/lib/app.tsx` (remover `ThemeProvider`/`ThemeContext`/`useTheme`, linhas ~202-229), `client/src/App.tsx:7,55,68`, `client/src/components/layout.tsx:4,173,222`, `client/index.html`
- Test: `e2e/aparencia.spec.ts` (parte 1)

**Interfaces:**
- Consumes: `parsePalette`, `parseColorMode`, `resolveDark`, `AppState["settings"]` (`palette`, `colorMode`), `useSave().settings.mutate`.
- Produces: `AppearanceProvider({children})`; `useAppearance(): { palette: Palette; mode: ColorMode; dark: boolean; setPalette(p): void; setMode(m): void }`; `useTheme(): { theme: "light" | "dark"; toggle(): void }` mantém o contrato antigo para o botão do cabeçalho (`toggle` fixa o modo contrário ao atual, `claro` ou `escuro`). Cache local: chave `sm.appearance`, valor JSON `{"palette":"ceu","mode":"auto"}`.

- [ ] **Step 1: Escrever os testes e2e que falham** (`e2e/aparencia.spec.ts`, com `entrar()` de `e2e/helpers.ts`): (a) primeira abertura: `<html>` tem `data-palette="ceu"`; (b) com `page.emulateMedia({colorScheme:"dark"})` o `<html>` tem a classe `dark`, e depois de `emulateMedia({colorScheme:"light"})` sem recarregar a classe sai; (c) sem flash: com `localStorage["sm.appearance"]={"palette":"mare","mode":"escuro"}` posto antes de carregar (`addInitScript`), o `data-palette="mare"` e a classe `dark` já existem no evento `DOMContentLoaded`, antes de o React montar; (d) legado: só `localStorage["sm.theme"]="dark"`, a app abre escura; (e) `localStorage` com lixo (`sm.appearance="{"`) abre em Céu automático sem erros na consola.
- [ ] **Step 2: Correr e ver falhar:** `npm run build` e depois `E2E_TARGET=worker E2E_PORT=5057 npx playwright test e2e/aparencia.spec.ts --trace off`.
- [ ] **Step 3: Implementar `appearance-boot.js`:** script síncrono, sem módulos, que lê `sm.appearance` (ou, se não existir, `sm.theme` legado como `claro`/`escuro`), valida contra as listas, e define `data-palette` e a classe `dark` em `document.documentElement`, tudo dentro de `try/catch`. Referenciá-lo em `client/index.html` com `<script src="./appearance-boot.js"></script>` no `<head>`, antes do módulo da app.
- [ ] **Step 4: Implementar `AppearanceProvider`:** estado inicial vem da cache (mesma lógica do boot, partilhada por uma função pura exportada para teste); quando as definições chegam da API, a conta vence e a cache é reescrita; `setPalette`/`setMode` atualizam estado, cache e conta (`settings.mutate`), este último só depois de as definições estarem carregadas; no modo `auto` ouvir `matchMedia("(prefers-color-scheme: dark)")` e atualizar a classe `dark`. Atualizar também `<meta name="theme-color">` com a cor de fundo da paleta ativa.
- [ ] **Step 5: Ligar:** `App.tsx` usa `AppearanceProvider`; `layout.tsx` importa `useTheme` de `@/lib/appearance`; remover o código antigo de `app.tsx` e qualquer import órfão.
- [ ] **Step 6: Correr** `npm run check`, `npm run check:worker`, build, e o e2e acima. Esperado: PASS.
- [ ] **Step 7: Commit** `Aparência: a app aplica a cor e o modo escolhidos, sem piscar ao abrir`.

### Task 6: Definições › Aparência

**Files:**
- Create: `client/src/components/appearance-settings.tsx`
- Modify: `client/src/pages/data.tsx` (novo `TabsTrigger value="aparencia"` a seguir a Funcionalidades, `data-testid="settings-tab-aparencia"`, e o `TabsContent` correspondente)
- Test: `e2e/aparencia.spec.ts` (parte 2)

**Interfaces:** Consumes: `useAppearance`, `PALETTES`, `PALETTE_LABELS`. Produces: `AppearanceSettings()` com `data-testid="appearance-settings"`; cada paleta é um botão de rádio acessível com `data-testid="palette-<p>"` e cada modo `data-testid="mode-<m>"`.

- [ ] **Step 1: Escrever os testes e2e que falham:** (a) abrir Definições › Aparência, escolher "Maré": `<html>` fica com `data-palette="mare"`; recarregar a página mantém; (b) escolher modo "Escuro": classe `dark` presente; "Claro": ausente; "Automático" volta a seguir `emulateMedia`; (c) só se pode ter uma paleta e um modo selecionados (`aria-checked`); (d) navegar só com o teclado (setas dentro do grupo, Espaço seleciona); (e) o texto da paleta ativa é lido pelo leitor de ecrã (grupo com `aria-label`, cada opção com nome e descrição); (f) `afterEach` repõe `ceu`/`auto` na conta.
- [ ] **Step 2: Correr e ver falhar.**
- [ ] **Step 3: Implementar** o componente com `SectionCard` (como `features-settings.tsx`), grelha de amostras: cada amostra mostra 3 cores da paleta (fundo, cartão, destaque) e o nome; secção "Modo" com três opções. Usar `role="radiogroup"` e `role="radio"` com seleção por setas. Texto de ajuda: "A cor e o modo ficam guardados na tua conta."
- [ ] **Step 4: Correr** o e2e, `npm run check`, `npm run check:worker`. Esperado: PASS.
- [ ] **Step 5: Commit** `Definições: nova secção Aparência para escolher a cor e o modo`.

### Task 7: Versão, documentação e validação final

**Files:** `package.json`, `package-lock.json` (1.24.0), `docs/CHANGELOG.md`, `client/src/lib/help-content.tsx`, `docs/superpowers/specs/2026-11-25-redesign-calma-design.md` (estado da fase 1).

- [ ] **Step 1:** Subir a versão para 1.24.0 nos dois ficheiros; entrada no CHANGELOG e nota de versão na Ajuda: "Escolhe a cor da app (Céu, Sálvia, Pêssego, Lavanda, Maré) e o modo claro, escuro ou automático em Definições › Aparência".
- [ ] **Step 2:** Atualizar o documento do desenho: fase 1 entregue.
- [ ] **Step 3: Validar tudo:** `npm test`, `npm run check`, `npm run check:worker`, `npm run build`, `E2E_TARGET=worker E2E_PORT=5057 npx playwright test --trace off`. Esperado: tudo verde (o teste "os filtros do Painel funcionam só com o teclado" já era instável antes; se falhar só ele, repetir uma vez e registar).
- [ ] **Step 4: Imagens para validar:** com `E2E_PORT=5059 node e2e/serve-worker.mjs`, capturar o Painel e Definições › Aparência nas 5 paletas, em claro e escuro, computador e telemóvel; mostrar ao utilizador antes de pedir o merge.
- [ ] **Step 5: Commit** `Versão 1.24.0: cores e temas` e, só depois da validação do utilizador, push para a branch do PR.
