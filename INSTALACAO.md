# Instalação — Partição do Salário

Requisito: Node.js 24 (LTS), e npm 11+. Em Windows/macOS/Linux, o better-sqlite3 usa binários pré-compilados; se falhar, instale ferramentas de compilação (Windows: Visual Studio Build Tools; macOS: xcode-select --install; Linux: build-essential python3).

## macOS / Linux
```bash
unzip salary-app-codigo.zip && cd salary-app
cp .env.example .env
npm ci
npm run check && npm test && npm run build
npm run dev          # http://localhost:5000
npm start            # produção, após build
```
## Windows (PowerShell)
```powershell
Expand-Archive salary-app-codigo.zip .; cd salary-app
Copy-Item .env.example .env
npm ci
npm run check; npm test; npm run build
npm run dev   # desenvolvimento
npm start     # produção
```
Os scripts `dev` e `start` usam `cross-env` e funcionam em Windows, macOS e Linux. Requer Node 24.

Os dados ficam em data.db (criado no primeiro arranque). Este ZIP não contém dados pessoais.

Recomendado em produção: definir `ACCESS_CODE` (mínimo 8 caracteres) no ambiente.
