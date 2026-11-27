# Partição do Salário

Aplicação web pessoal para dividir o rendimento mensal em parcelas (gastos, poupança, investimento), registar despesas, acompanhar metas e submetas e guardar cópias de segurança. Interface em português (Portugal), moeda base EUR.

## Funcionalidades
- Painel com indicadores, gráficos e progresso de metas/submetas; expansão independente por meta, fechada por omissão
- Meses: rendimento, descontos (SS/IRS), subsídio de alimentação e alocação por parcela
- Despesas com categorias, transferências, aportes e retiradas
- Parcelas e metas: plataformas, tipos, saldo inicial, ajustes, submetas e taxas de conversão manuais
- Carteira: acumulado por parcela, por ano e por plataforma
- Orçamento: orçado vs real, reserva de emergência, runway e sugestão de excedente
- Definições: exportação JSON/XLSX, importação com validação e catálogos
- Fecho mensal, recorrências, reservas, simulador de metas e composição dos totais
- Verificação de dados, importação CSV e histórico de alterações
- Leituras sobre o histórico: ritmo das metas face ao prazo, comparação com o ano anterior e despesas fora do padrão
- Relatório do período em PDF, com opção de ocultar valores
- Ajuda integrada e código de acesso opcional
- Layouts responsivos em computador, tablet e telemóvel, com campos adaptados à largura do cartão e grelhas personalizadas empilhadas em espaços compactos

## Arranque rápido
```bash
npm install
npm run dev        # http://localhost:5000
npm test           # testes (bases temporárias, não tocam em data.db)
npm run check      # verificação de tipos
npm run build      # produz dist/ (cliente em dist/public, servidor em dist/index.cjs)
npm start          # produção (NODE_ENV=production node dist/index.cjs)
```
Requisitos: Node.js 24 e npm 11+. O `better-sqlite3` usa binários pré-compilados; se falhar, instala as ferramentas de compilação (Windows: Visual Studio Build Tools; macOS: `xcode-select --install`; Linux: `build-essential python3`). Os scripts `dev` e `start` usam `cross-env` e funcionam em Windows, macOS e Linux. Usa `npm ci` para uma instalação reprodutível.

Os dados ficam em `data.db` (SQLite) na raiz do projeto, criado no primeiro arranque.

### Variáveis de ambiente
| Variável | Para quê |
|---|---|
| `PORT` | Porta do servidor (omissão 5000) |
| `ACCESS_CODE` | Código de acesso (mínimo 8 caracteres); recomendado em produção |
| `DATA_DIR` | Pasta de `data.db`, `backups/` e `pre-import-backup-*.json`; aponta para um volume persistente |
| `TRUST_PROXY` | `1` quando há um proxy à frente (plataformas como Render ou Railway): usa o IP do `X-Forwarded-For` no limite de tentativas. Por omissão desligado; sem proxy, ligá-lo deixaria qualquer pessoa forjar o IP |
| `DB_PATH` | Caminho do ficheiro da base de dados (alternativa a `DATA_DIR`) |
| `TRUST_PROXY` | Proxies à frente do servidor (omissão 1 em produção); define o IP real para o limite de tentativas |
| `BACKUP_DIR` | Pasta das cópias automáticas (omissão `backups/` dentro de `DATA_DIR`) |
| `BACKUP_KEEP` | Quantas cópias automáticas manter (omissão 7) |
| `BACKUP_INTERVAL_HOURS` | Intervalo entre cópias automáticas (omissão 24; `0` desliga) |
| `NODE_ENV` | `production` no arranque em produção (`npm start` já o define) |

## Documentação
| Ficheiro | Conteúdo |
|---|---|
| [docs/GUIA-UTILIZADOR.md](docs/GUIA-UTILIZADOR.md) | Como usar cada menu |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Estrutura, camadas e fluxo de dados |
| [docs/MODELO-DE-DADOS.md](docs/MODELO-DE-DADOS.md) | Tabelas, colunas e relações |
| [docs/REGRAS-DE-CALCULO.md](docs/REGRAS-DE-CALCULO.md) | Fórmulas e regras de arredondamento |
| [docs/API.md](docs/API.md) | Endpoints REST |
| [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md) | Deploy na Cloudflare (Worker e Durable Object) |
| [docs/BACKUP-E-RESTAURO.md](docs/BACKUP-E-RESTAURO.md) | Formato, importação e reversão |
| [docs/SEGURANCA.md](docs/SEGURANCA.md) | Código de acesso, medidas e riscos conhecidos |
| [docs/DESENVOLVIMENTO-E-TESTES.md](docs/DESENVOLVIMENTO-E-TESTES.md) | Ambiente, testes e convenções |
| [docs/PUBLICACAO.md](docs/PUBLICACAO.md) | Pré-visualização, publicação e persistência |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Histórico de alterações |
| [docs/historico/](docs/historico/) | Documentos históricos (EVO-01 a 07, revisão responsiva, QA offline, revisão de segurança de 2026-09, FLOWS). Não descrevem o estado atual |
