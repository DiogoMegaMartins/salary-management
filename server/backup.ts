import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { sqlite, dataDir } from "./storage";

/** Apaga os ficheiros mais antigos que casam com `pattern`, mantendo os `keep` mais recentes (o nome ordena por data). */
export function pruneFiles(dir: string, pattern: RegExp, keep: number) {
  let names: string[] = [];
  try { names = readdirSync(dir).filter((n) => pattern.test(n)).sort(); } catch { return; }
  for (const n of names.slice(0, Math.max(0, names.length - keep))) {
    try { rmSync(join(dir, n), { force: true }); } catch { /* melhor esforço */ }
  }
}

/** Cópia consistente da base de dados (API de backup do SQLite, segura com a app a escrever). */
export async function runBackup(dir: string, keep: number): Promise<string> {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, `data-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
  await sqlite.backup(file);
  pruneFiles(dir, /^data-.*\.db$/, keep);
  return file;
}

/**
 * Cópias automáticas: uma ao arrancar (após 15 s) e depois a cada BACKUP_INTERVAL_HOURS (24).
 * Mantém as últimas BACKUP_KEEP (7) em BACKUP_DIR (./backups). BACKUP_INTERVAL_HOURS=0 desliga.
 * Atenção: se a pasta estiver no mesmo disco da base de dados, protege de erros, não de perda do disco.
 */
export function startBackups(log: (m: string) => void) {
  const hours = Number(process.env.BACKUP_INTERVAL_HOURS ?? 24);
  if (!(hours > 0)) return;
  const dir = process.env.BACKUP_DIR || join(dataDir, "backups");
  const keep = Math.max(1, Number(process.env.BACKUP_KEEP ?? 7) || 7);
  const run = () => runBackup(dir, keep).then((f) => log(`cópia de segurança criada: ${f}`), (e) => console.error("Cópia de segurança falhou:", e));
  setTimeout(run, 15_000).unref();
  setInterval(run, hours * 3_600_000).unref();
}
