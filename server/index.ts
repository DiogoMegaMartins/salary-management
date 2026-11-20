import "dotenv/config";
import { buildApp, log } from "./app";
import { serveStatic } from "./static";
import { startBackups } from "./backup";
import { sqlite } from "./storage";

export { log };

(async () => {
  const { app, httpServer } = await buildApp();

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
