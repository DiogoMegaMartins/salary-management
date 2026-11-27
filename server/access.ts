import { scryptSync, scrypt, randomBytes, timingSafeEqual, createHash } from "node:crypto";

/** Código de acesso: guardado só como hash scrypt; comparação em tempo constante. */
const PREFIX = "scrypt$";
export const isHashed = (s: string) => s.startsWith(PREFIX);
export const MIN_CODE_LENGTH = 8;

export function hashCode(code: string): string {
  const salt = randomBytes(16);
  return `${PREFIX}${salt.toString("hex")}$${scryptSync(code, salt, 32).toString("hex")}`;
}

/**
 * No Worker da Cloudflare o código vem do segredo ACCESS_CODE (guardado pela própria Cloudflare) e compara-se
 * em texto, em tempo constante. O scrypt custa ~50 ms de CPU, mais do que o limite do plano gratuito (10 ms).
 * Ligado por `ACCESS_CODE_FROM_SECRET=1`, que só o Worker define.
 */
export function secretCode(): string {
  if (process.env.ACCESS_CODE_FROM_SECRET !== "1") return "";
  const code = (process.env.ACCESS_CODE ?? "").trim();
  return code.length >= MIN_CODE_LENGTH ? code : "";
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

/**
 * Senha só deste processo, para os pedidos que o próprio Worker faz a si mesmo (a cópia agendada para o R2).
 * Não sai do processo nem é previsível, por isso um visitante não a consegue enviar; assim estes pedidos
 * não dependem do código de acesso nem ficam presos no limite de tentativas quando alguém o esgota.
 */
export const INTERNAL_TOKEN = randomBytes(24).toString("hex");
export const isInternalRequest = (given: unknown) =>
  typeof given === "string" && given.length === INTERNAL_TOKEN.length && timingSafeEqual(Buffer.from(given), Buffer.from(INTERNAL_TOKEN));

/** Já foi verificado como certo (cache em memória): não custa scrypt e não passa pelo limitador. */
export function knownGood(stored: string, given: string): boolean {
  stored = stored.trim();
  if (!isHashed(stored)) return false;
  return okCache.has(createHash("sha256").update(`${stored}\0${given}`).digest("hex"));
}

const scryptAsync = (pw: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => scrypt(pw, salt, 32, (e, k) => (e ? reject(e) : resolve(k))));

/** Como `verifyCode`, mas o scrypt corre fora do thread principal (uma tentativa falhada não bloqueia o servidor). */
export async function verifyCodeAsync(stored: string, given: string): Promise<boolean> {
  stored = stored.trim();
  if (!isHashed(stored) || knownGood(stored, given)) return verifyCode(stored, given);
  const [, saltHex, hashHex] = stored.split("$");
  if (!saltHex || !hashHex) return false;
  const good = same(await scryptAsync(given, Buffer.from(saltHex, "hex")), Buffer.from(hashHex, "hex"));
  if (good) {
    if (okCache.size > 50) okCache.clear();
    okCache.add(createHash("sha256").update(`${stored}\0${given}`).digest("hex"));
  }
  return good;
}

/** Chave do limitador: IPv4 inteiro; IPv6 agrupado por /64 (um atacante com um /64 tem 2^64 endereços). */
export function ipKey(ip: string | undefined): string {
  const v = String(ip ?? "?");
  if (v.includes(":") && !v.includes(".")) return v.split(":").slice(0, 4).join(":");
  return v;
}

export type FailRecord = { n: number; first: number };
/** Onde se guardam as falhas. Em memória por omissão; a app liga-o à base de dados (ver `server/limiter-store.ts`). */
export interface LimiterStore {
  get(scope: string, key: string): FailRecord | undefined;
  set(scope: string, key: string, rec: FailRecord): void;
  delete(scope: string, key: string): void;
}

function memoryStore(): LimiterStore {
  const m = new Map<string, FailRecord>();
  const k = (scope: string, key: string) => `${scope}\0${key}`;
  return {
    get: (scope, key) => m.get(k(scope, key)),
    set(scope, key, rec) {
      if (m.size > 1000) m.clear();
      m.set(k(scope, key), rec);
    },
    delete: (scope, key) => void m.delete(k(scope, key)),
  };
}

let store: LimiterStore = memoryStore();
/**
 * Num Worker da Cloudflare o objeto é descartado quando está inativo, e contadores só em memória voltavam
 * a zero: o limite de tentativas não protegia. Com o armazenamento na base de dados, sobrevive aos reinícios.
 */
export function setLimiterStore(s: LimiterStore) {
  store = s;
}

/** Limitador de falhas por IP (janela fixa). `scope` separa os contadores no armazenamento. */
export function makeLimiter(max: number, windowMs: number, scope = "auth") {
  const live = (ip: string) => {
    const r = store.get(scope, ip);
    if (r && Date.now() - r.first > windowMs) { store.delete(scope, ip); return undefined; }
    return r;
  };
  return {
    retryAfterSeconds(ip: string): number {
      const r = live(ip);
      return r && r.n >= max ? Math.ceil((windowMs - (Date.now() - r.first)) / 1000) : 0;
    },
    fail(ip: string) {
      const r = live(ip);
      store.set(scope, ip, { n: (r?.n ?? 0) + 1, first: r?.first ?? Date.now() });
    },
    reset(ip: string) { store.delete(scope, ip); },
  };
}

/** O estado enviado ao cliente nunca inclui o código nem o hash: só um marcador "set". */
export function publicSettings<T extends { accessCode?: string }>(s: T): T {
  return { ...s, accessCode: s.accessCode || secretCode() ? "set" : "" };
}
/** Estado para o cliente: sem código e sem o histórico de alterações (tem rota própria, /api/change-log). */
export function publicState<T extends { settings: { accessCode?: string } }>(state: T): T {
  const { changeLog: _log, ...rest } = state as any;
  return { ...rest, settings: publicSettings(state.settings) } as T;
}

/** 5 falhas por IP (ou /64) em 15 minutos, mais um teto global de 60 falhas por minuto contra rotação de IPs. */
export const authLimiter = makeLimiter(5, 15 * 60 * 1000, "auth");
export const globalLimiter = makeLimiter(60, 60 * 1000, "global");
export const GLOBAL_KEY = "*";
