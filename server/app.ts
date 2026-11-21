import express, { Response, NextFunction } from "express";
import type { Request } from "express";
import { createServer } from "node:http";
import { registerRoutes } from "./routes";
import { installBase } from "./middleware";
import { setLimiterStore } from "./access";
import { sqliteLimiterStore } from "./limiter-store";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * Cria a app Express com as rotas e o tratamento de erros. Partilhada pelo servidor Node (`index.ts`)
 * e pelo Worker da Cloudflare (`worker/`). Quem chama trata dos ficheiros estáticos e de ouvir a porta.
 */
export async function buildApp() {
  const app = express();
  const httpServer = createServer(app);
  setLimiterStore(sqliteLimiterStore);

  installBase(app);

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        // sem corpo da resposta nos logs: contém dados financeiros e definições
        log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
      }
    });

    next();
  });

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    // erros inesperados (sem estado HTTP) não expõem detalhes internos
    const message = status >= 500 && !err.status && !err.statusCode ? "Erro interno do servidor." : err.message || "Erro interno do servidor.";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  return { app, httpServer };
}
