import { sqlite } from "./db";
import type { FailRecord, LimiterStore } from "./access";

/** Contadores de tentativas falhadas na base de dados: sobrevivem a reinícios (importante no Worker, que descarta o objeto). */
export const sqliteLimiterStore: LimiterStore = {
  get(scope, key) {
    const r = sqlite.prepare("SELECT n, first FROM auth_failures WHERE scope = ? AND key = ?").get(scope, key) as FailRecord | undefined;
    return r ? { n: Number(r.n), first: Number(r.first) } : undefined;
  },
  set(scope, key, rec) {
    sqlite.prepare("INSERT INTO auth_failures (scope, key, n, first) VALUES (?, ?, ?, ?) ON CONFLICT(scope, key) DO UPDATE SET n = excluded.n, first = excluded.first").run(scope, key, rec.n, rec.first);
    // limpeza ocasional de registos antigos (mais de um dia)
    if (rec.n === 1) sqlite.prepare("DELETE FROM auth_failures WHERE first < ?").run(Date.now() - 24 * 3_600_000);
  },
  delete(scope, key) {
    sqlite.prepare("DELETE FROM auth_failures WHERE scope = ? AND key = ?").run(scope, key);
  },
};
