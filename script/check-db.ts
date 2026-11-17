/**
 * Verifica, SEM tocar no original, se uma base de dados real (data.db) migra e passa as verificações.
 * Faz uma cópia para uma pasta temporária, arranca as migrações nessa cópia e corre /api/verify.
 * Uso: npm run check-db -- caminho\para\data.db
 */
import { copyFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const source = process.argv[2];
if (!source || !existsSync(source)) {
  console.error("Uso: npm run check-db -- caminho\\para\\data.db");
  process.exit(1);
}
const dir = mkdtempSync(join(tmpdir(), "sm-checkdb-"));
const copy = join(dir, "data.db");
copyFileSync(resolve(source), copy);
for (const ext of ["-wal", "-shm"]) if (existsSync(resolve(source) + ext)) copyFileSync(resolve(source) + ext, copy + ext);
process.env.DB_PATH = copy;
process.env.DATA_DIR = dir;

const { storage } = await import("../server/storage");
const { verifyData } = await import("../server/evo08");
const { isHashed } = await import("../server/access");
const st = storage.getState();
const code = storage.getAccessCode();
console.log(`Cópia de trabalho: ${copy} (o original não foi alterado)`);
console.log(`Meses: ${st.months.length} | parcelas: ${st.parcels.length} | movimentos: ${st.transactions.length} | alocações: ${st.allocations.length}`);
console.log(`Código de acesso: ${code ? (isHashed(code) ? "com hash" : "em texto (passa a hash no 1.º arranque)") : "não definido"}`);
const v = verifyData();
console.log(`Verificação: ${v.errors} erro(s), ${v.warnings} aviso(s)`);
for (const i of v.issues.slice(0, 30)) console.log(` - [${i.severity}] ${i.where}: ${i.message}`);
process.exit(v.errors > 0 ? 2 : 0);
