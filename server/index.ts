import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { installBase } from "./middleware";
import { startBackups } from "./backup";
import { sqlite } from "./storage";
import { createServer } from "node:http";

const app = express();
const httpServer = createServer(app);

installBase(app);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

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

(async () => {
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

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      // reusePort não existe no Windows (ENOTSUP); mantém-se noutras plataformas, como na plataforma de alojamento
      ...(process.platform === "win32" ? {} : { reusePort: true }),
    },
    () => {
      log(`serving on port ${port}`);
      startBackups(log);
    },
  );

  // paragem ordenada: termina pedidos, consolida o WAL e fecha a base de dados
  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    log(`${signal}: a terminar`);
    const done = () => {
      try { sqlite.pragma("wal_checkpoint(TRUNCATE)"); sqlite.close(); } catch { /* já fechada */ }
      process.exit(0);
    };
    httpServer.close(done);
    setTimeout(done, 5000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
