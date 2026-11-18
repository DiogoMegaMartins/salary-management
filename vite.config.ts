import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      // ficheiros dotfile, a base de dados, as cópias de segurança e os backups de importação nunca saem do servidor de desenvolvimento
      deny: ["**/.*", "**/*.db", "**/*.db-*", "**/*.sqlite*", "**/backups/**", "**/pre-import-backup-*.json"],
    },
  },
});
