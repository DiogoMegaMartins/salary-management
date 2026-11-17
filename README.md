# Partição do Salário

[![CI](https://github.com/DiogoMegaMartins/salary-management/actions/workflows/ci.yml/badge.svg)](https://github.com/DiogoMegaMartins/salary-management/actions/workflows/ci.yml)

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
Variável de ambiente: `PORT` (por omissão 5000). Os dados ficam em `data.db` (SQLite) na raiz do projeto.

## GitHub e integração contínua
O código está em [DiogoMegaMartins/salary-management](https://github.com/DiogoMegaMartins/salary-management) (repositório privado). O fluxo [`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre em cada `push` e `pull_request`, com Node 20, 22 e 24: `npm ci`, verificação de tipos, testes, `npm audit` e build. Se o `npm ci` falhar, confirmar o acesso a `cdn.sheetjs.com`, de onde vem a dependência `xlsx`.

## Documentação
| Ficheiro | Conteúdo |
|---|---|
| [docs/GUIA-UTILIZADOR.md](docs/GUIA-UTILIZADOR.md) | Como usar cada menu |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Estrutura, camadas e fluxo de dados |
| [docs/MODELO-DE-DADOS.md](docs/MODELO-DE-DADOS.md) | Tabelas, colunas e relações |
| [docs/REGRAS-DE-CALCULO.md](docs/REGRAS-DE-CALCULO.md) | Fórmulas e regras de arredondamento |
| [docs/API.md](docs/API.md) | Endpoints REST |
| [docs/BACKUP-E-RESTAURO.md](docs/BACKUP-E-RESTAURO.md) | Formato, importação e reversão |
| [docs/SEGURANCA.md](docs/SEGURANCA.md) | Código de acesso, medidas e riscos conhecidos |
| [docs/DESENVOLVIMENTO-E-TESTES.md](docs/DESENVOLVIMENTO-E-TESTES.md) | Ambiente, testes e convenções |
| [docs/PUBLICACAO.md](docs/PUBLICACAO.md) | Pré-visualização, publicação e persistência |
| [docs/EVOLUCAO-EVO01-07.md](docs/EVOLUCAO-EVO01-07.md) | Evolução EVO-01 a EVO-07, migração e reversão |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Histórico de alterações |
| [docs/revisao-responsiva-2026-11-15.md](docs/revisao-responsiva-2026-11-15.md) | Correções responsivas, cobertura Chromium e limitações |
