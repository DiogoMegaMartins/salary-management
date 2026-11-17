import { scryptSync, randomBytes, timingSafeEqual, createHash } from "node:crypto";

/** Código de acesso: guardado só como hash scrypt; comparação em tempo constante. */
const PREFIX = "scrypt$";
export const isHashed = (s: string) => s.startsWith(PREFIX);
export const MIN_CODE_LENGTH = 8;

export function hashCode(code: string): string {
  const salt = randomBytes(16);
  return `${PREFIX}${salt.toString("hex")}$${scryptSync(code, salt, 32).toString("hex")}`;
}

const same = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);
// scrypt custa ~50 ms: guarda-se (em memória) o resultado positivo para não o repetir em cada pedido
const okCache = new Set<string>();

/** `stored` pode ser um hash ou (bases antigas / testes) o código em claro. */
export function verifyCode(stored: string, given: string): boolean {
  stored = stored.trim();
  if (!isHashed(stored)) return same(Buffer.from(stored), Buffer.from(given));
  const key = createHash("sha256").update(`${stored}\0${given}`).digest("hex");
  if (okCache.has(key)) return true;
  const [, saltHex, hashHex] = stored.split("$");
  if (!saltHex || !hashHex) return false;
  const good = same(scryptSync(given, Buffer.from(saltHex, "hex"), 32), Buffer.from(hashHex, "hex"));
  if (good) {
    if (okCache.size > 50) okCache.clear();
    okCache.add(key);
  }
  return good;
}

/** Limitador de falhas por IP (janela fixa). */
export function makeLimiter(max: number, windowMs: number) {
  const fails = new Map<string, { n: number; first: number }>();
  const live = (ip: string) => {
    const r = fails.get(ip);
    if (r && Date.now() - r.first > windowMs) { fails.delete(ip); return undefined; }
    return r;
  };
  return {
    retryAfterSeconds(ip: string): number {
      const r = live(ip);
      return r && r.n >= max ? Math.ceil((windowMs - (Date.now() - r.first)) / 1000) : 0;
    },
    fail(ip: string) {
      if (fails.size > 1000) for (const k of Array.from(fails.keys())) live(k);
      const r = live(ip);
      fails.set(ip, { n: (r?.n ?? 0) + 1, first: r?.first ?? Date.now() });
    },
    reset(ip: string) { fails.delete(ip); },
  };
}

/** O estado enviado ao cliente nunca inclui o código nem o hash: só um marcador "set". */
export function publicSettings<T extends { accessCode?: string }>(s: T): T {
  return { ...s, accessCode: s.accessCode ? "set" : "" };
}
/** Estado para o cliente: sem código e sem o histórico de alterações (tem rota própria, /api/change-log). */
export function publicState<T extends { settings: { accessCode?: string } }>(state: T): T {
  const { changeLog: _log, ...rest } = state as any;
  return { ...rest, settings: publicSettings(state.settings) } as T;
}
