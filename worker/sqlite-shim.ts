import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Substituto de `better-sqlite3` para o Worker da Cloudflare.
 *
 * O código do servidor usa a API síncrona do better-sqlite3 (`prepare().get/all/run`, `exec`,
 * `transaction`). Esta classe expõe a mesma API por cima do SQLite de um Durable Object
 * (`ctx.storage.sql`), que também é síncrono.
 *
 * O Durable Object guarda o seu armazenamento em `globalThis.__DO_STORAGE` sempre que é criado. O
 * armazenamento NUNCA se guarda em variáveis do módulo: os módulos ficam em cache no processo e, quando
 * a Cloudflare descarta o objeto e cria outro, o código antigo continuava a usar o armazenamento do
 * objeto anterior ("Cannot perform I/O on behalf of a different Durable Object"). Por isso o
 * armazenamento atual é lido em cada operação.
 */

/** Armazenamento do pedido em curso: cada Durable Object corre o seu pedido dentro deste contexto. */
export const storageContext = new AsyncLocalStorage<DurableObjectStorage>();

const current = (): DurableObjectStorage => {
  const storage = storageContext.getStore() ?? (globalThis as { __DO_STORAGE?: DurableObjectStorage }).__DO_STORAGE;
  if (!storage) throw new Error("Armazenamento do Durable Object indisponível.");
  return storage;
};

type Bindings = unknown[];

class Statement {
  private pluckOn = false;
  constructor(private readonly text: string) {}

  private get sql(): SqlStorage {
    return current().sql;
  }

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
  /** Usados pelo driver `drizzle-orm/durable-sqlite`, que espera um DurableObjectStorage e lê `sql` a cada consulta. */
  get sql(): SqlStorage {
    return current().sql;
  }

  transactionSync<T>(fn: () => T): T {
    return current().transactionSync(fn);
  }

  constructor(_path?: string) {
    current(); // falha cedo se o armazenamento ainda não existir
  }

  prepare(text: string) {
    return new Statement(text);
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
    return (...args: A): R => current().transactionSync(() => fn(...args));
  }

  close() {}

  backup(): never {
    throw new Error("Cópias de segurança em ficheiro não existem no Worker; usa a exportação da app.");
  }
}
