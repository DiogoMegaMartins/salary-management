import express from "express";
import type { Express } from "express";

/**
 * Configuração base partilhada pelo servidor e pelos testes: proxy, cabeçalhos, limites de corpo
 * e proteção CSRF (os pedidos que alteram dados exigem o cabeçalho `x-sm-client`, que um
 * formulário de outro site não consegue enviar sem pré-verificação CORS, que não está ativa).
 */
export function installBase(app: Express) {
  // Atrás do proxy da plataforma o IP real vem em X-Forwarded-For; sem isto todos partilham um IP.
  const tp = (process.env.TRUST_PROXY ?? (process.env.NODE_ENV === "production" ? "1" : "")).trim();
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

  // Importações de backup/CSV e sincronização offline precisam de corpos grandes; o resto não.
  app.use("/api/import", express.json({ limit: "50mb" }));
  app.use("/api/offline", express.json({ limit: "10mb" }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS" || req.path === "/auth") return next();
    if (req.get("x-sm-client") === "1") return next();
    res.status(403).json({ message: "Pedido recusado: cabeçalho de cliente em falta." });
  });
}
