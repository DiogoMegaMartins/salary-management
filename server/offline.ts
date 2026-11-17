import { createHash } from "node:crypto";
import type { Express } from "express";
import { storage, sqlite } from "./storage";
import { publicState } from "./access";
import { supportsOffline, type OfflineOp } from "../shared/offline";
import { editableMonthPatch } from "../shared/month-patch";
import { months } from "../shared/schema";
import { getTableColumns } from "drizzle-orm";

export function stateVersion(state: any) {
  // o histórico de alterações não faz parte da versão: não vai para o cliente e só cresce
  const { changeLog: _log, ...rest } = state;
  return createHash("sha256").update(JSON.stringify({ ...rest, settings: { ...state.settings, accessCode: "" } })).digest("hex");
}
const fail = (status: number, message: string): never => { throw Object.assign(new Error(message), { status }); };
export function registerOffline(app: Express) {
  // Additive only. A batch receipt and its financial writes commit in the SAME SQLite transaction.
  sqlite.exec("CREATE TABLE IF NOT EXISTS offline_receipts (id TEXT PRIMARY KEY, payload_hash TEXT NOT NULL)");
  app.post("/api/offline/sync", (req, res) => {
    try {
      const { id, version, operations } = req.body ?? {};
      if (typeof id !== "string" || id.length > 100 || !id || typeof version !== "string" || !Array.isArray(operations) || !operations.length || operations.length > 500)
        return res.status(400).json({ message: "Lote offline inválido (máximo 500 alterações)." });
      const hash = createHash("sha256").update(JSON.stringify({ version, operations })).digest("hex");
      const result = sqlite.transaction(() => {
        const receipt = sqlite.prepare("SELECT payload_hash FROM offline_receipts WHERE id=?").get(id) as any;
        if (receipt) {
          if (receipt.payload_hash !== hash) fail(409, "Identificador de sincronização reutilizado com conteúdo diferente.");
          return { replay: true };
        }
        if (stateVersion(storage.getState()) !== version) fail(409, "Conflito: os dados do servidor mudaram. As alterações locais foram preservadas. Exporta-as para revisão antes de substituir a cópia offline.");
        for (const op of operations as OfflineOp[]) {
          if (!supportsOffline(op.method, op.url) || !op.data || typeof op.data !== "object") fail(400, "Operação offline não permitida.");
          const d = op.data, parts = op.url.split("/");
          if (op.method === "PATCH") {
            const allowed = new Set(Object.keys(getTableColumns(months)).filter(k => !["id", "status", "carryIn"].includes(k)));
            if (Object.keys(d).some(k => !allowed.has(k))) fail(400, "Campos do mês não permitidos.");
            for (const [k, v] of Object.entries(d)) if (typeof v === "number" && !Number.isFinite(v)) fail(400, `Valor inválido: ${k}`);
            storage.updateMonth(Number(parts[3]), editableMonthPatch(d));
          } else if (op.url === "/api/allocations") {
            if (!Number.isFinite(d.value) || d.value < 0 || !["fixo", "percentagem"].includes(d.mode)) fail(400, "Alocação inválida.");
            storage.setAllocation(Number(d.monthId), Number(d.parcelId), d.mode, d.value);
          } else if (op.url === "/api/transactions") {
            if (d.type !== "expense" || !Number.isFinite(d.value) || d.value <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) fail(400, "Despesa inválida.");
            storage.createTransaction(d);
          } else if (parts[8] === "assets") {
            storage.setAssets(Number(parts[3]), Number(parts[5]), Number(parts[7]), d.lines);
          } else {
            storage.setDistribution(Number(parts[3]), Number(parts[5]), d.lines);
          }
        }
        sqlite.prepare("INSERT INTO offline_receipts (id,payload_hash) VALUES (?,?)").run(id, hash);
        return { replay: false };
      })();
      const state = storage.getState();
      res.json({ ...result, state: publicState(state), version: stateVersion(state) });
    } catch (e: any) {
      res.status(e.status ?? 400).json({ message: e.message ?? "Sincronização recusada. Alterações locais preservadas." });
    }
  });
}
