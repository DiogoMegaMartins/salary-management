# Segurança

## Acesso
- Código de acesso opcional (mínimo 8 caracteres), guardado **só como hash scrypt**. Nunca é devolvido pela API (`/api/state` mostra apenas `"set"`), nem vai nos backups JSON; importar um backup não altera nem remove o código.
- Enviado só por cabeçalho `x-codigo-acesso`, comparado em tempo constante.
- Limite de 5 falhas por IP em 15 minutos (resposta 429), em `POST /api/auth` **e** nos pedidos com cabeçalho errado. Os contadores ficam na base de dados (`auth_failures`), por isso sobrevivem a reinícios; no Worker da Cloudflare o objeto é descartado quando está inativo e contadores em memória voltariam a zero.
- Variável de ambiente `ACCESS_CODE` (≥ 8 caracteres): define o código desde o primeiro arranque e impede que seja alterado pela API. **Recomendado em produção**: sem ela, quem aceder primeiro a uma instância sem código pode defini-lo.
- O código é verificado **antes** de ler o corpo do pedido (`server/middleware.ts`): um pedido sem código válido não faz o servidor ler nem interpretar até 50 MB de JSON. Os corpos grandes (`/api/import`, `/api/offline`) não aceitam compressão (`inflate: false`).
- O scrypt de verificação corre fora do thread principal. O limite é por IP (IPv6 agrupado por /64) e há um teto global de 60 falhas por minuto contra rotação de endereços. Um código já verificado passa sempre, para quem partilha o IP de um atacante não ficar trancado.
- O limite de tentativas (5 por IP em 15 minutos, 60 por minuto no total) aplica-se antes de verificar o código: um IP bloqueado recebe 429 mesmo com o código certo, para não servir de teste a quem adivinha. Se o limite for esgotado por alguém, o dono espera alguns minutos. A cópia agendada do Worker não é afetada (usa uma senha interna do processo).
- `TRUST_PROXY=1` só deve ser definido quando há um proxy à frente (o IP real vem em `X-Forwarded-For`). Por omissão está desligado: sem proxy, um visitante podia forjar o cabeçalho e fugir ao limite de tentativas por IP. No Worker da Cloudflare o IP vem de `cf-connecting-ip` e isto não se aplica.
- No Worker, um segredo `ACCESS_CODE` com menos de 8 caracteres faz a API responder 503 até ser corrigido (antes deixava a app aberta).
- Sem código de acesso, a API fica aberta (comportamento documentado). Em produção, o arranque regista um aviso. Define sempre `ACCESS_CODE` em instâncias publicadas.
- O servidor de desenvolvimento (`npm run dev`) não serve `*.db`, `backups/` nem `pre-import-backup-*.json`. Não o exponhas à rede.
- Atrás de proxy (produção) usa-se `trust proxy` (`TRUST_PROXY`, por omissão 1 em produção) para o limite ser por IP real.
- Pedidos que alteram dados exigem o cabeçalho `x-sm-client: 1` (anti-CSRF); formulários de outros sites são recusados (403).
- Códigos antigos em texto simples são convertidos em hash no primeiro arranque.

## Medidas
- Meses, parcelas, categorias e definições validados no servidor (tipos, limites, campos desconhecidos recusados).
- Catálogos (plataformas e tipos), saldos e ajustes, submetas, atribuições, taxas, recorrências, reservas e fecho/reabertura de mês têm esquema zod nas rotas (`server/route-schemas.ts`): tipos, limites e valores permitidos; campos desconhecidos e identificadores de rota inválidos dão 400. As regras de domínio (duplicados, moedas, saldos) ficam no armazenamento.
- Limite de corpo de 1 MB (50 MB só em importações, 10 MB na sincronização offline).
- Validação de transações, importações e catálogos; SQL só via Drizzle.
- Content-Security-Policy estrita em produção (`default-src 'self'`, sem scripts inline; estilos inline permitidos; sem `frame-ancestors`, porque a pré-visualização da plataforma usa uma moldura).
- Logs sem corpos de resposta; `X-Content-Type-Options` e `Referrer-Policy`.

## Riscos conhecidos
- `npm audit --omit=dev` (dependências de produção) sem avisos à data de 2026-11-17; corre semanalmente no workflow `audit.yml`. As ferramentas de build podem ter avisos sem correção (ex.: `picomatch`, ReDoS em extglobs); não entram em produção. `xlsx` vem da distribuição oficial SheetJS (não do registo npm) e só é usado para exportar. Está em `devDependencies` (é empacotado no build), por isso o `npm audit --omit=dev` não o vê e, por vir de URL, o registo npm também não avisa: reve-o à mão a cada release em https://cdn.sheetjs.com.
- SQLite local não é persistência durável de produção.
- A cópia offline é cifrada com uma chave derivada do código de acesso.

## Sessão de acesso
A sessão fica em sessionStorage do separador, expira após 30 minutos sem atividade, ao fechar o separador ou com 401.

Ver também [NOTA-DEPENDABOT.md](NOTA-DEPENDABOT.md): o que o Dependabot cobre, o que fica de fora e o que pode ser alterado.
