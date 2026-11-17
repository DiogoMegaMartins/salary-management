# Backup e restauro

## Exportar
Definições, separador Backups e importação > Exportar JSON (`schemaVersion` 3, todas as tabelas) ou XLSX (folhas de leitura). O download é feito com pedido autenticado por cabeçalho; o código de acesso nunca vai no URL.

## Importar
1. Pré-visualização: valida versão, estrutura, tipos, enums, datas, números e referências entre registos.
2. Confirmação explícita.
3. Antes de substituir, grava `pre-import-backup-*.json` (sem código de acesso, permissões 0600).
4. O restauro corre numa única transação SQLite: se falhar, nada muda.
Backups v1/v2 são aceites; versões mais novas são recusadas.

## Boas práticas
- Exportar um JSON mensalmente (a aplicação lembra conforme `backup_reminder_days`).
- Antes de atualizar a aplicação em dados reais, exportar um backup ou copiar `data.db` (e `-wal`/`-shm`).
- Não guardar ficheiros `pre-import-backup-*` em repositórios ou pacotes publicados.

## Reversão
Parar a aplicação e repor `data.db`, ou importar o backup JSON anterior.

## EVO-08
O backup passa a incluir `monthClosures`, `recurringExpenses`, `recurrenceSkips`, `reserves`, `importBatches` e `changeLog`, mais `status`/`carryIn` nos meses. O formato mantém `schemaVersion` 3 (campos novos opcionais): backups v1, v2 e v3 anteriores restauram com valores por omissão. Validação antes do restauro e restauro transacional mantêm-se. O restauro deve testar-se num ambiente isolado (pasta temporária) antes de tocar em dados reais; os testes automáticos fazem-no.

## Cópias automáticas
O servidor copia a base de dados ao arrancar (após 15 s) e a cada 24 h para `./backups/` (`data-AAAA-MM-DDT….db`), mantendo as 7 últimas. Variáveis: `BACKUP_DIR`, `BACKUP_KEEP`, `BACKUP_INTERVAL_HOURS` (0 desliga). Para restaurar: parar a app e substituir `data.db` por uma cópia. Na mesma máquina/disco, protegem de erros e de importações falhadas, **não** da perda do disco: continua a exportar o JSON e guardá-lo fora. Os ficheiros `pre-import-backup-*.json` ficam limitados aos 10 mais recentes.
