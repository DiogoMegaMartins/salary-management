import express from "express";
import type { Express } from "express";
import { storage } from "./storage";
import { authLimiter, globalLimiter, GLOBAL_KEY, ipKey, verifyCodeAsync, secretCode, isInternalRequest } from "./access";

/**
 * Configuração base partilhada pelo servidor e pelos testes: proxy, cabeçalhos, limites de corpo
 * e proteção CSRF (os pedidos que alteram dados exigem o cabeçalho `x-sm-client`, que um
 * formulário de outro site não consegue enviar sem pré-verificação CORS, que não está ativa).
 */
export function installBase(app: Express) {
  // Só se confia em X-Forwarded-For com TRUST_PROXY (ex.: TRUST_PROXY=1 atrás do proxy de uma plataforma).
  // Por omissão não: sem proxy à frente, qualquer pessoa podia forjar o cabeçalho e fugir ao limite por IP.
  const tp = (process.env.TRUST_PROXY ?? "").trim();
  if (tp && tp !== "false") app.set("trust proxy", /^\d+$/.test(tp) ? Number(tp) : tp === "true" ? true : tp);

  // CSP só em produção (o Vite em desenvolvimento usa scripts inline e WebSocket). Sem frame-ancestors:
  // a pré-visualização da plataforma mostra a app dentro de uma moldura. Estilos inline são usados pela interface.
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  const production = process.env.NODE_ENV === "production";
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (production) res.setHeader("Content-Security-Policy", csp);
    next();
  });

  // Código de acesso ANTES de ler corpos: um pedido sem código não faz o servidor descomprimir e
  // interpretar até 50 MB de JSON. Só por cabeçalho: o código nunca viaja em URLs (histórico/logs).
  app.use("/api", async (req, res, next) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      if (req.path === "/auth" || req.path === "/auth/status" || req.path === "/health") return next();
      // Worker: um segredo ACCESS_CODE curto não conta como código (secretCode devolve ""); em vez de deixar a app
      // aberta, recusa tudo até o segredo ser corrigido.
      if (process.env.ACCESS_CODE_FROM_SECRET === "1" && (process.env.ACCESS_CODE ?? "").trim() && !secretCode())
        return res.status(503).json({ ok: false, message: "O segredo ACCESS_CODE é demasiado curto (mínimo 8 caracteres). Corrige-o na Cloudflare." });
      if (isInternalRequest(req.headers["x-sm-interno"])) return next();
      const code = storage.getAccessCode().trim();
      if (!code) return next();
      const given = String(req.headers["x-codigo-acesso"] ?? "").trim();
      if (given) {
        // O limite vem ANTES de olhar para o código: um IP bloqueado leva 429 mesmo com o código certo. Se o certo
        // passasse, «429 ou 200» dizia a quem está bloqueado se acertou, e os palpites não custavam nada.
        const ip = ipKey(req.ip);
        const wait = Math.max(authLimiter.retryAfterSeconds(ip), globalLimiter.retryAfterSeconds(GLOBAL_KEY));
        if (wait) {
          res.setHeader("Retry-After", String(wait));
          return res.status(429).json({ ok: false, message: "Demasiadas tentativas. Tenta novamente dentro de alguns minutos." });
        }
        if (await verifyCodeAsync(code, given)) return next();
        authLimiter.fail(ip);
        globalLimiter.fail(GLOBAL_KEY);
      }
      res.status(401).json({ message: "Código de acesso inválido." });
    } catch (e) {
      next(e);
    }
  });

  // Importações de backup/CSV e sincronização offline precisam de corpos grandes; o resto não.
  // Sem `inflate`: a app não comprime pedidos, e descomprimir é a forma barata de inflar memória.
  app.use("/api/import", express.json({ limit: "50mb", inflate: false }));
  app.use("/api/offline", express.json({ limit: "10mb", inflate: false }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS" || req.path === "/auth") return next();
    if (req.get("x-sm-client") === "1") return next();
    res.status(403).json({ message: "Pedido recusado: cabeçalho de cliente em falta." });
  });
}
