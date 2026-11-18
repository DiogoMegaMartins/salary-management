# Segurança

## Acesso
- Código de acesso opcional (mínimo 8 caracteres), guardado **só como hash scrypt**. Nunca é devolvido pela API (`/api/state` mostra apenas `"set"`), nem vai nos backups JSON; importar um backup não altera nem remove o código.
- Enviado só por cabeçalho `x-codigo-acesso`, comparado em tempo constante.
- Limite de 5 falhas por IP em 15 minutos (resposta 429), em `POST /api/auth` **e** nos pedidos com cabeçalho errado.
- Variável de ambiente `ACCESS_CODE` (≥ 8 caracteres): define o código desde o primeiro arranque e impede que seja alterado pela API. **Recomendado em produção**: sem ela, quem aceder primeiro a uma instância sem código pode defini-lo.
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
- `npm audit --omit=dev` (dependências de produção) sem avisos à data de 2026-11-17; corre semanalmente no workflow `audit.yml`. As ferramentas de build podem ter avisos sem correção (ex.: `picomatch`, ReDoS em extglobs); não entram em produção. `xlsx` vem da distribuição oficial SheetJS (não do registo npm) e só é usado para exportar.
- SQLite local não é persistência durável de produção.
- A cópia offline é cifrada com uma chave derivada do código de acesso.

## Sessão de acesso
A sessão fica em sessionStorage do separador, expira após 30 minutos sem atividade, ao fechar o separador ou com 401.
