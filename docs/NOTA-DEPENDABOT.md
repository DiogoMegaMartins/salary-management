# Nota: Dependabot e segurança das dependências

Estado em 2026-11-19, versão 1.12.6.

## O que está configurado
- `.github/dependabot.yml`: npm é verificado **semanalmente** (segunda-feira, 07:00 de Lisboa). As atualizações de versão estão desligadas (`open-pull-requests-limit: 0`), por isso só chegam PRs de segurança. GitHub Actions é verificado mensalmente, com no máximo um PR agrupado.
- `.github/workflows/audit.yml`: `npm audit --omit=dev` toda a semana e quando `package*.json` muda.

## Como funciona (e o que o horário muda)
Os PRs de **segurança** do Dependabot abrem-se quando surge um aviso numa dependência que o projeto usa, não no horário do `schedule`. O horário governa a verificação periódica de versões. Com o limite a 0, o resultado prático do horário semanal é que o Dependabot revê o repositório todas as semanas e passa a reagir aos avisos dentro dessa cadência de atualização do grafo de dependências.

## O que pode ser alterado, e porquê
1. **Confirmar que os alertas e as atualizações de segurança estão ligados** em *Settings → Advanced Security* (Dependabot alerts e Dependabot security updates). Sem isto, o ficheiro não gera PRs de segurança. É a verificação mais importante e não se vê no código.
2. **`xlsx` está fora do radar.** Vem de um URL da SheetJS (`cdn.sheetjs.com`), não do registo npm: o Dependabot e o `npm audit` não o veem, e está em `devDependencies`, que o `audit.yml` ignora. Hoje só serve para exportar. Rever a versão à mão em cada release, ou migrar para outra biblioteca de exportação publicada no npm.
3. **Actions mensal vs semanal.** Mensal gasta menos minutos de CI (cada PR corre o CI completo, cerca de 5 minutos). Semanal apanha correções mais cedo. Só vale a pena semanal se aparecerem avisos de segurança em Actions.
4. **Agrupar PRs de segurança** (`groups` com `applies-to: security-updates`) se vários avisos chegarem juntos, para correr o CI uma vez em vez de várias.
5. **Fixar Actions por SHA** em vez de `@v7`/`@v4`. Protege contra uma etiqueta alterada, com o custo de PRs de atualização mais ruidosos. Risco baixo hoje, porque só se usam Actions oficiais (`actions/*`) com `contents: read` e sem segredos.
6. **Regra de verificações obrigatórias na `main`:** ter `check`, `test`, `build` e `e2e` obrigatórios faz com que um PR do Dependabot só se integre com tudo verde.

## O que não vale a pena alterar
- Ligar as atualizações de versão do npm: traria PRs frequentes sem benefício de segurança, e cada um custa um CI completo.
- Aumentar a frequência do `audit.yml`: já corre semanalmente e a cada mudança de dependências.
