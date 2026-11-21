# Regras para quem trabalha neste repositório (pessoas e agentes)

Escreve em português de Portugal, de forma simples, para quem não é programador.

## Commits
- Faz os commits locais e só no fim, com tudo feito e testado, envia (`git push`) para a branch do PR. Não envies a mesma coisa para duas branches (cada push gasta minutos de CI).
- **Primeira linha:** diz o que mudou para quem usa a aplicação (ex.: "Metas e submetas: melhor visualização no telemóvel"), não o nome de ficheiros.
- **Corpo (quase sempre):** uma ou duas frases a explicar o porquê e o efeito, e se for útil uma lista curta com o que mudou. Sem jargão desnecessário.
- Um commit por tema. Não misturar uma correção com uma funcionalidade nova.

## Pull requests (manuais e automáticos)
A descrição de **todos** os PRs conta o que mudou, em linguagem fácil de ler por pessoas, com base nos commits do PR:
1. **Resumo:** o que o PR faz, em duas ou três frases.
2. **O que mudou:** os pontos importantes, agrupados por tema, com o porquê. Para quem usa a app: o que vê de diferente. Para quem mantém: o que foi preciso corrigir pelo caminho.
3. **Como foi testado:** testes unitários, interface (e onde), tipos, e o que não foi testado.
4. **Antes do merge:** o que a pessoa tem de fazer (variáveis, configuração, ordem dos merges), se houver.

O workflow "Auto PR" (`.github/workflows/auto-pr.yml`) cria o PR em rascunho e escreve a descrição a partir das mensagens dos commits, atualizando-a a cada push. Por isso as mensagens dos commits têm de estar bem escritas (ver acima). Se a descrição for escrita à mão (sem a marca `<!-- auto-pr -->` na primeira linha), o workflow deixa-a como está.

Nunca ponhas segredos, tokens ou códigos de acesso nos commits nem nos PRs.

## Testes e CI
- `npm test` (unitários), `npm run check` e `npm run check:worker` (tipos), `npm run build`, e a interface com `npm run test:e2e` (servidor Node) ou `E2E_TARGET=worker npx playwright test` (Worker, o que corre em produção). Mais em `docs/DESENVOLVIMENTO-E-TESTES.md`.
- Sobe a versão (`package.json`) e escreve a entrada em `docs/CHANGELOG.md` e nas notas de versão da Ajuda (`client/src/lib/help-content.tsx`) quando há alterações para o utilizador.
