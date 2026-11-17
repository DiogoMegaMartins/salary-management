# Publicação

## Fluxo
1. Desenvolver e testar (`npm run check`, `npm test`, `npm run build`).
2. Pré-visualização na plataforma (usa a base de dados do sandbox).
3. Validar na pré-visualização.
4. Publicar só com autorização explícita, mantendo a visibilidade pretendida (Private).

## Parâmetros de publicação
- Comando de arranque: `NODE_ENV=production node dist/index.cjs`
- Instalação: `npm ci --omit=dev`
- Porta: 5000; pasta estática: `dist/public`

## Persistência
A produção tem a sua própria base de dados SQLite, separada da pré-visualização. Dados criados na pré-visualização não existem em produção. SQLite local não é persistência de produção durável: para dados duráveis, migrar para base de dados gerida (por exemplo Supabase) ou outro alojamento com armazenamento persistente.

## Antes de publicar
- Exportar backup JSON da produção.
- Confirmar que o código de acesso está definido.
- Rever avisos de segurança pendentes.
- Não usar a base local de pré-visualização como backup de produção nem incluí-la como substituta dos registos publicados.
- Se o acesso privado impedir a exportação dos dados reais, pedir ao proprietário um backup de produção. Uma aceitação de risco de uma publicação anterior não se aplica automaticamente a outra versão.
- A republicação pode perder dados locais; preservação não é garantida. Dados importantes exigem armazenamento durável e backups independentes.
- Comparar IDs, contagens e conteúdo dos registos com o backup depois de publicar; não declarar dados preservados sem essa verificação.

## Depois de publicar
Verificar menus, dados e exportação. Em caso de problema, restaurar o backup JSON. Se o navegador mostrar a versão antiga, refresh forçado.

## Revisão 1.9.1 | 2026-11-15

Inclui correções responsivas e documentação atualizada. A plataforma confirmou a publicação em https://salary-management.pplx.app, mantendo a visibilidade Private, no site `e9efc064-bb8a-4eb3-b60c-8a989675fedd`. A publicação foi executada após autorização específica do utilizador para esta revisão sem backup, incluindo aceitação do risco de perda de dados e dos [avisos de segurança atuais](SEGURANCA.md).

O navegador de verificação voltou a ser redirecionado para autenticação pelo controlo privado da plataforma. Não foi possível consultar a versão na interface de produção, validar os fluxos autenticados nem comparar os registos reais. A preservação dos dados e do código de acesso da produção não foi verificada. A base de pré-visualização não foi considerada um backup de produção; a autorização antiga de outra publicação não foi reutilizada.

Os controlos de publicação estão em https://www.perplexity.ai/computer/a/d0b63f6a-1ad0-4717-bcf5-29203f5625c2?open-publish=true. A visibilidade do site publicado é independente da partilha da pré-visualização.

## Cópias automáticas e CI
- `./backups/` guarda cópias diárias da base de dados (ver [BACKUP-E-RESTAURO.md](BACKUP-E-RESTAURO.md)); só ajudam se essa pasta sobreviver às republicações.
- Definir `ACCESS_CODE` no ambiente.
- `.github/workflows/ci.yml` corre em cada push, com Node 24 e três jobs em paralelo: `check` (tipos), `test` e `build` (inclui um teste de arranque em produção que chama `/api/health`).
- `.github/workflows/audit.yml` corre `npm audit --omit=dev --audit-level=high` às segundas-feiras e quando `package.json` ou o lock mudam; não bloqueia PRs.
- O CI não publica: a publicação continua a ser manual na plataforma.

## Onde ficam os dados
- `DATA_DIR` (ou `DB_PATH`) define onde ficam `data.db`, `backups/` e os `pre-import-backup-*.json`. Apontar para um volume que sobreviva às republicações; por omissão é a pasta de trabalho.
- `GET /api/health` devolve `{ "ok": true }` sem autenticação (para a plataforma ou monitorização).
- A app termina de forma ordenada com SIGTERM/SIGINT (consolida o WAL e fecha a base).
- Antes de trocar a base real por esta versão: `npm run check-db -- caminho\data.db` verifica uma cópia sem a alterar.
