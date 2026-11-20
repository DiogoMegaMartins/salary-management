/**
 * Substituto de `better-sqlite3` para o Worker da Cloudflare.
 *
 * O código do servidor usa a API síncrona do better-sqlite3 (`prepare().get/all/run`, `exec`,
 * `transaction`). Esta classe expõe a mesma API por cima do SQLite de um Durable Object
 * (`ctx.storage.sql`), que também é síncrono. O Durable Object guarda o armazenamento em
 * `globalThis.__DO_STORAGE` antes de importar o servidor.
 */

type Bindings = unknown[];

class Statement {
  private pluckOn = false;
  constructor(private readonly sql: SqlStorage, private readonly text: string) {}

  pluck(on = true) {
    this.pluckOn = on;
    return this;
  }

  private rows(args: Bindings): Record<string, unknown>[] {
    return this.sql.exec(this.text, ...(args as any[])).toArray() as Record<string, unknown>[];
  }

  get(...args: Bindings) {
    const row = this.rows(args)[0];
    if (row === undefined) return undefined;
    return this.pluckOn ? Object.values(row)[0] : row;
  }

  all(...args: Bindings) {
    const rows = this.rows(args);
    return this.pluckOn ? rows.map((r) => Object.values(r)[0]) : rows;
  }

  run(...args: Bindings) {
    const cursor = this.sql.exec(this.text, ...(args as any[]));
    cursor.toArray();
    const last = this.sql.exec("SELECT last_insert_rowid() AS id").one() as { id: number };
    return { changes: cursor.rowsWritten, lastInsertRowid: last.id };
  }
}

export default class Database {
  /** Usados pelo driver `drizzle-orm/durable-sqlite`, que espera um DurableObjectStorage. */
  readonly sql: SqlStorage;
  readonly transactionSync: <T>(fn: () => T) => T;
  private readonly storage: DurableObjectStorage;

  constructor(_path?: string) {
    const storage = (globalThis as { __DO_STORAGE?: DurableObjectStorage }).__DO_STORAGE;
    if (!storage) throw new Error("Armazenamento do Durable Object indisponível.");
    this.storage = storage;
    this.sql = storage.sql;
    this.transactionSync = (fn) => storage.transactionSync(fn);
  }

  prepare(text: string) {
    return new Statement(this.sql, text);
  }

  exec(text: string) {
    this.sql.exec(text);
    return this;
  }

  pragma(_text: string) {
    // WAL e checkpoints não se aplicam: o Durable Object gere a persistência.
    return undefined;
  }

  transaction<A extends unknown[], R>(fn: (...args: A) => R) {
    return (...args: A): R => this.storage.transactionSync(() => fn(...args));
  }

  close() {}

  backup(): never {
    throw new Error("Cópias de segurança em ficheiro não existem no Worker; usa a exportação da app.");
  }
}
