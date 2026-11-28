# Plano: entrar com uma conta em vez do código de acesso

Estado: **plano, nada implementado.** Serve para decidires o caminho antes de se escrever código.

## Onde estamos

- Há um único código de acesso, guardado como segredo `ACCESS_CODE` no Worker. Quem o souber entra.
- Não há contas nem utilizadores. Todos os dados são de uma pessoa (um único Durable Object, `principal`).
- Só os pedidos a `/api/*` passam pelo Worker. A interface (ficheiros estáticos) é servida diretamente pelo Cloudflare (`run_worker_first: ["/api/*"]` em `wrangler.jsonc`).
- O endereço de produção é o do Cloudflare (`…workers.dev`), sem domínio próprio.

## O que queres

1. Entrar com uma conta, em vez de escrever o código.
2. Só uma conta, a tua: ninguém consegue criar conta nem entrar.
3. Mais tarde, outras pessoas, cada uma com os seus dados.

## As duas maneiras

### A) Cloudflare Access (recomendada para começar)

O Cloudflare põe um ecrã de login à frente de tudo (interface e API). Tu defines **quem pode entrar** (a tua conta). A app só confirma que o pedido veio do Cloudflare e de quem esperamos.

Como funciona:
1. Tu abres o endereço. Se não tens sessão, o Cloudflare pede o login (código enviado por email, ou Google, ou GitHub, conforme escolheres).
2. Depois do login, cada pedido chega ao Worker com um cabeçalho assinado (`Cf-Access-Jwt-Assertion`) que diz o email.
3. O Worker valida a assinatura e o destino do cabeçalho e só então responde.

Vantagens:
- Não guardamos palavras-passe e não escrevemos ecrãs de login.
- Ninguém cria conta: só entra quem estiver na lista de emails permitidos.
- Verificação em dois passos e proteção contra tentativas vêm do Cloudflare.
- Para abrir a mais pessoas, acrescentas emails à lista.
- Gratuito até 50 pessoas (plano gratuito do Cloudflare Zero Trust).

Desvantagens e cuidados:
- Dependes do Cloudflare (já dependes, a app corre lá).
- A sessão expira (24 horas por defeito, configurável). Quando expira, os pedidos da app são redirecionados para o login. **A app tem de detetar isso** e pedir para entrar de novo, em vez de mostrar um ecrã preto.
- A cópia offline e o service worker da app guardam a interface. Depois de a sessão expirar, convém forçar um recarregamento para voltar ao login. Tem de ser testado.
- A conta Zero Trust pode pedir um cartão para o plano gratuito, sem cobrança (a confirmar no momento de criar).
- Os nomes exatos dos menus do Cloudflare mudam de vez em quando: segue os nomes no painel, não estes à letra.

### B) Login próprio na app

Contas, sessões e ecrã de entrada feitos por nós.

- Palavras-passe com hash são pesadas para o limite de CPU do plano gratuito do Worker (já tivemos este problema com o `scrypt`). Por isso seria com **chaves de acesso** (impressão digital ou Face ID) ou **entrada com Google**.
- Mais código, mais superfície de ataque (recuperar conta, sessões, tentativas, registo).
- Para «só uma conta minha» teríamos de desligar o registo à mão.
- Vantagem: independente do Cloudflare Access e útil se um dia abrires inscrições públicas.

### Comparação

| | A) Cloudflare Access | B) Login próprio |
|---|---|---|
| Trabalho de código | pouco | muito |
| Risco de segurança nosso | baixo | médio |
| Só uma conta | regra no painel | desligar registo |
| Vários utilizadores | acrescentar emails | já preparado |
| Independência do Cloudflare | não | sim |
| Palavras-passe guardadas | nenhuma | nenhuma (chaves) ou Google |

**Recomendação:** A agora. Se um dia fizer falta, B pode vir por cima sem deitar fora o trabalho de separar dados por utilizador.

## Plano em fases (caminho A)

### Fase 1: só tu entras (trabalho pequeno)

No Cloudflare (tu, no painel; eu digo-te o que escolher):
1. Criar a conta do Zero Trust (nome da equipa, por exemplo `private-finances`).
2. Ativar o Access para o endereço `workers.dev` do Worker (Workers & Pages › o Worker › Definições › Domínios e rotas). Isto cria a «aplicação» do Access.
3. Política: **permitir** apenas o teu email. Método de login: código por email (mais simples) e, se quiseres, Google.
4. Copiar dois dados: o **domínio da equipa** (`<equipa>.cloudflareaccess.com`) e a **AUD** da aplicação (um identificador).

No código (eu):
1. Duas variáveis do Worker (não são segredos): domínio da equipa e AUD, mais o email do dono permitido.
2. Validar o cabeçalho assinado em cada pedido à API: assinatura (chaves públicas do Cloudflare, guardadas em memória), destino (AUD), emissor, validade e email igual ao do dono. Sem isto válido, 401.
3. A app deixa de pedir o código quando o Access está ligado, e mostra o email com a sessão iniciada e «Terminar sessão» (que vai ao fim de sessão do Cloudflare).
4. Tratar a sessão expirada: se um pedido receber redirecionamento ou 401 de login, mostrar «A sessão terminou» e recarregar para voltar ao login.
5. A cópia diária para o R2 continua a funcionar (usa a senha interna, não passa pelo login).
6. Em local e nos testes (sem Cloudflare) continua a valer o código, até haver uma forma de teste própria (chaves de teste e um validador testado com assinaturas inventadas).

Testes:
- Unitários do validador: assinatura certa, errada, expirada, outro destino, outro email, cabeçalho em falta.
- E2E contra o Worker em local com o modo de teste.
- Manual em produção: entrar, sessão a expirar, telemóvel, cópia offline.

Reversão: o código de acesso fica como alternativa até confirmares que tudo funciona. Se algo correr mal, desligas o Access no painel e voltas ao código.

### Fase 2: separar os dados por utilizador (só quando houver mais pessoas)

- Hoje há um Durable Object `principal`. Passa a haver um por utilizador, escolhido pelo identificador estável da conta (não pelo email).
- Os dados atuais passam a ser do dono (migração, sem perder nada).
- Por utilizador: definições, cópias de segurança, limite de tentativas e a cópia para o R2 (uma pasta por pessoa).
- Entra um nível de «quem é este pedido» em todas as rotas. É a parte maior do trabalho e merece o seu próprio plano e testes.
- Acrescentar uma pessoa = acrescentar o email à política no Cloudflare.

### Fase 3 (opcional): login próprio

Só se quiseres sair do Cloudflare Access ou abrir inscrições. Chaves de acesso e/ou Google, com a Fase 2 já feita.

## O que preciso de ti para começar a Fase 1

1. Confirmares o caminho A.
2. Criares a conta do Zero Trust e a aplicação do Access (eu guio-te passo a passo), e enviares-me o domínio da equipa, a AUD e o email permitido. Não são segredos; nunca me envies chaves nem tokens.
3. Dizeres se queres só código por email ou também Google.

## Perguntas em aberto

- A sessão deve durar 24 horas ou mais (por exemplo 30 dias) no teu telemóvel?
- Queres manter o código de acesso como alternativa de emergência depois de o Access estar a funcionar?
