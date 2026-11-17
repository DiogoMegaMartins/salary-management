import { hashCode, verifyCode, isHashed, makeLimiter, publicState, publicSettings, MIN_CODE_LENGTH } from "./access";
import { settingsPatchSchema, monthCreateSchema, monthPatchSchema, parcelCreateSchema, parcelPatchSchema, categoryCreateSchema, issueMessage } from "./validation";
import type { ZodType } from "zod";
import * as evo8 from "./evo08";
import type { Express } from "express";
import type { Server } from "node:http";
import { storage, httpError, sqlite, dataDir } from "./storage";
import {
  computeMonth,
  sortMonths,
  MONTH_NAMES,
  descontosOf,
  grossOf,
  mealOf,
} from "@shared/calc";
import * as XLSX from "xlsx";
import { writeFileSync } from "node:fs";
import { pruneFiles } from "./backup";
import { join } from "node:path";
import { registerOffline, stateVersion } from "./offline";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  /** Valida o corpo com um esquema; erro 400 com mensagem clara. */
  const parse = <T>(schema: ZodType<T>, body: unknown): T => {
    const r = schema.safeParse(body ?? {});
    if (!r.success) throw httpError(400, issueMessage(r.error));
    return r.data;
  };

  /* ------------------------------------------------- codigo de acesso */
  // O código guarda-se só como hash. Se ACCESS_CODE estiver definido no ambiente, é ele que manda
  // (não pode ser alterado pela API): protege a instância desde o primeiro arranque.
  const envCode = (process.env.ACCESS_CODE ?? "").trim();
  const envManaged = envCode.length >= MIN_CODE_LENGTH;
  if (envCode && !envManaged) console.warn(`ACCESS_CODE ignorado: tem de ter pelo menos ${MIN_CODE_LENGTH} caracteres.`);
  {
    const stored = storage.getAccessCode().trim();
    if (envManaged) {
      if (!isHashed(stored) || !verifyCode(stored, envCode)) storage.updateSettings({ accessCode: hashCode(envCode) } as any);
    } else if (stored && !isHashed(stored)) {
      storage.updateSettings({ accessCode: hashCode(stored) } as any); // migra códigos antigos em claro
    }
  }
  const currentCode = () => storage.getAccessCode().trim();

  // estado de saúde para a plataforma/monitorização: sem dados, sem autenticação
  app.get("/api/health", (_req, res) => {
    try { sqlite.prepare("SELECT 1").get(); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
  });

  app.get("/api/auth/status", (_req, res) => {
    res.json({ enabled: currentCode().length > 0, managed: envManaged });
  });

  // 5 falhas por IP em 15 minutos bloqueiam novas tentativas, tanto em /api/auth como no cabeçalho
  const limiter = makeLimiter(5, 15 * 60 * 1000);
  const tooMany = (res: any, ip: string) => {
    res.setHeader("Retry-After", String(limiter.retryAfterSeconds(ip)));
    return res.status(429).json({ ok: false, message: "Demasiadas tentativas. Tenta novamente dentro de alguns minutos." });
  };
  app.post("/api/auth", (req, res) => {
    const code = currentCode();
    const given = String(req.body?.code ?? "").trim();
    if (!code) return res.json({ ok: true });
    const ip = String(req.ip ?? "?");
    if (limiter.retryAfterSeconds(ip)) return tooMany(res, ip);
    if (verifyCode(code, given)) {
      limiter.reset(ip);
      return res.json({ ok: true });
    }
    limiter.fail(ip);
    res.status(401).json({ ok: false, message: "Código incorreto." });
  });

  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.path === "/auth" || req.path === "/auth/status" || req.path === "/health") return next();
    const code = currentCode();
    if (!code) return next();
    // só por cabeçalho: o código nunca viaja em URLs (histórico/logs)
    const given = String(req.headers["x-codigo-acesso"] ?? "").trim();
    const ip = String(req.ip ?? "?");
    if (given && limiter.retryAfterSeconds(ip)) return tooMany(res, ip);
    if (given && verifyCode(code, given)) return next();
    if (given) limiter.fail(ip);
    res.status(401).json({ message: "Código de acesso inválido." });
  });

  app.get("/api/state", (_req, res) => {
    const state = storage.getState();
    res.setHeader("X-State-Version", stateVersion(state));
    res.setHeader("Cache-Control", "no-store");
    res.json(publicState(state));
  });

  app.patch("/api/settings", (req, res) => {
    const parsed = settingsPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: issueMessage(parsed.error) });
    const patch: any = parsed.data;
    if ("accessCode" in patch) {
      if (envManaged) return res.status(403).json({ message: "O código de acesso é definido pela variável de ambiente ACCESS_CODE." });
      patch.accessCode = patch.accessCode ? hashCode(patch.accessCode) : "";
    }
    if (!Object.keys(patch).length) return res.json(publicSettings(storage.getState().settings));
    res.json(publicSettings(storage.updateSettings(patch)));
  });

  /* ---------------------------------------------------------- parcelas */
  app.post("/api/parcels", (req, res) => {
    const { platformIds, platforms: _legacy, ...raw } = req.body ?? {};
    let rest;
    try { rest = parse(parcelCreateSchema, raw); } catch (e: any) { return res.status(e.status ?? 400).json({ message: e.message }); }
    const parcel = storage.createParcel(rest);
    if (Array.isArray(platformIds) && platformIds.length) {
      try {
        storage.setParcelPlatforms(parcel.id, platformIds);
      } catch (e: any) {
        return res.status(e.status ?? 400).json({ message: e.message });
      }
    }
    res.json(parcel);
  });
  app.patch("/api/parcels/:id", (req, res) => {
    // `platforms` (texto) deriva do catálogo; não aceitar escrita direta
    const { platforms: _legacy, platformIds, ...raw } = req.body ?? {};
    const id = Number(req.params.id);
    let patch: any;
    try { patch = parse(parcelPatchSchema, raw); } catch (e: any) { return res.status(e.status ?? 400).json({ message: e.message }); }
    if (!storage.getState().parcels.some((p) => p.id === id)) return res.status(404).json({ message: "Parcela não encontrada." });
    if (patch.typeId != null) {
      const t = storage.getState().parcelTypes.find((x) => x.id === Number(patch.typeId));
      if (!t) return res.status(400).json({ message: "Tipo inexistente." });
      patch.kind = t.baseKind; // o comportamento base mantém os cálculos
    }
    try {
      if (Array.isArray(platformIds)) storage.setParcelPlatforms(id, platformIds);
    } catch (e: any) {
      return res.status(e.status ?? 400).json({ message: e.message });
    }
    res.json(Object.keys(patch).length ? storage.updateParcel(id, patch) : storage.getState().parcels.find((p) => p.id === id));
  });

  /* --------------------------------------------- catálogos (EVO-02) */
  const guard = (fn: (req: any, res: any) => any) => (req: any, res: any) => {
    try {
      res.json(fn(req, res));
    } catch (e: any) {
      if (!e.status) console.error(e);
      res.status(e.status ?? 500).json({ message: e.status ? e.message : "Erro interno." });
    }
  };
  /* --------------------------------- metas: saldos, submetas, taxas (EVO-04) */
  app.post("/api/goal-entries", guard((req) => storage.createGoalEntry(req.body ?? {})));
  app.patch("/api/goal-entries/:id", guard((req) => storage.updateGoalEntry(Number(req.params.id), req.body ?? {})));
  app.delete("/api/goal-entries/:id", guard((req) => (storage.deleteGoalEntry(Number(req.params.id)), { ok: true })));
  app.post("/api/subgoals", guard((req) => storage.createSubgoal(req.body ?? {})));
  app.patch("/api/subgoals/:id", guard((req) => storage.updateSubgoal(Number(req.params.id), req.body ?? {})));
  app.delete("/api/subgoals/:id", guard((req) => (storage.deleteSubgoal(Number(req.params.id)), { ok: true })));
  app.post("/api/contribution-links", guard((req) => storage.createContributionLink(req.body ?? {})));
  app.delete("/api/contribution-links/:id", guard((req) => (storage.deleteContributionLink(Number(req.params.id)), { ok: true })));
  app.post("/api/fx-rates", guard((req) => storage.createFxRate(req.body ?? {})));
  app.delete("/api/fx-rates/:id", guard((req) => (storage.deleteFxRate(Number(req.params.id)), { ok: true })));

  app.put("/api/months/:monthId/parcels/:parcelId/distribution/:platformId/assets", guard((req) =>
    storage.setAssets(Number(req.params.monthId), Number(req.params.parcelId), Number(req.params.platformId), req.body?.lines ?? [])));
  app.post("/api/platforms", guard((req) => storage.createPlatform(req.body ?? {})));
  app.patch("/api/platforms/:id", guard((req) => storage.updatePlatform(Number(req.params.id), req.body ?? {})));
  app.delete("/api/platforms/:id", guard((req) => (storage.deletePlatform(Number(req.params.id)), { ok: true })));
  app.post("/api/parcel-types", guard((req) => storage.createParcelType(req.body ?? {})));
  app.patch("/api/parcel-types/:id", guard((req) => storage.updateParcelType(Number(req.params.id), req.body ?? {})));
  app.delete("/api/parcel-types/:id", guard((req) => (storage.deleteParcelType(Number(req.params.id)), { ok: true })));
  app.post("/api/tx-types", guard((req) => storage.createTxType(req.body ?? {})));
  app.patch("/api/tx-types/:id", guard((req) => storage.updateTxType(Number(req.params.id), req.body ?? {})));
  app.delete("/api/tx-types/:id", guard((req) => (storage.deleteTxType(Number(req.params.id)), { ok: true })));
  app.delete("/api/parcels/:id", guard((req) => (storage.deleteParcel(Number(req.params.id)), { ok: true })));

  /* ------------------------------------------------------------- meses */
  app.post("/api/months", guard((req) => storage.createMonth(parse(monthCreateSchema, req.body) as any)));
  app.patch("/api/months/:id", guard((req) => {
    const id = Number(req.params.id);
    if (!storage.getState().months.some(m => m.id === id)) throw Object.assign(new Error("Mês não encontrado."), { status: 404 });
    const b = req.body ?? {};
    // status/carryIn seguem para o armazenamento, que os recusa (e exige mês aberto) como antes
    const protectedFields: any = {};
    if ("status" in b) protectedFields.status = b.status;
    if ("carryIn" in b) protectedFields.carryIn = b.carryIn;
    return storage.updateMonth(id, { ...(parse(monthPatchSchema, b) as any), ...protectedFields });
  }));
  app.delete("/api/months/:id", guard((req) => (storage.deleteMonth(Number(req.params.id)), { ok: true })));

  /** Duplica um mês (valores do vencimento e alocações) para um novo mês, sempre aberto e sem transporte. */
  app.post("/api/months/:id/duplicate", guard((req) => {
    const state = storage.getState();
    const src = state.months.find((m) => m.id === Number(req.params.id));
    if (!src) throw httpError(404, "Mês não encontrado.");
    const { id: _id, status: _status, carryIn: _carry, ...rest } = src;
    const year = Number(req.body?.year ?? src.year);
    const month = Number(req.body?.month ?? src.month);
    const label = String(req.body?.label ?? MONTH_NAMES[month - 1] ?? "").trim();
    const target = parse(monthCreateSchema, { ...rest, year, month, label });
    // tudo ou nada: se algo falhar, não fica um mês a meio
    return storage.transaction(() => {
      const created = storage.createMonth(target as any);
      for (const a of state.allocations.filter((x) => x.monthId === src.id)) storage.setAllocation(created.id, a.parcelId, a.mode, a.value);
      return created;
    });
  }));

  /** Aplica as regras por omissão de cada parcela (fixo ou % do disponível). */
  app.post("/api/months/:id/apply-rules", (req, res) => {
    const state = storage.getState();
    const monthId = Number(req.params.id);
    // só aplica parcelas com regra definida, para não apagar alocações existentes
    try {
      for (const p of state.parcels.filter((x) => !x.archived && x.defaultValue !== 0)) {
        storage.setAllocation(monthId, p.id, p.defaultMode, p.defaultValue);
      }
    } catch (e: any) {
      return res.status(e.status ?? 500).json({ message: e.message });
    }
    res.json(publicState(storage.getState()));
  });

  app.post("/api/months/:id/save-as-rules", (req, res) => {
    const state = storage.getState();
    const monthId = Number(req.params.id);
    const allocs = state.allocations.filter((a) => a.monthId === monthId);
    for (const a of allocs) {
      storage.updateParcel(a.parcelId, { defaultMode: a.mode, defaultValue: a.value });
    }
    res.json(publicState(storage.getState()));
  });

  /* -------------------------------------------------------- alocações */
  app.put("/api/allocations", (req, res) => {
    const { monthId, parcelId, mode, value } = req.body ?? {};
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0) return res.status(400).json({ message: "Valor inválido." });
    if (mode !== "fixo" && mode !== "percentagem") return res.status(400).json({ message: "Modo inválido." });
    try {
      res.json(storage.setAllocation(Number(monthId), Number(parcelId), String(mode), v));
    } catch (e: any) {
      res.status(e.status ?? 500).json({ message: e.message });
    }
  });

  /** Distribuição planeada de uma parcela mensal por plataformas (EVO-03). */
  app.put("/api/months/:monthId/parcels/:parcelId/distribution", (req, res) => {
    try {
      const lines = Array.isArray(req.body?.lines) ? req.body.lines : null;
      if (!lines) return res.status(400).json({ message: "Linhas em falta." });
      res.json(storage.setDistribution(Number(req.params.monthId), Number(req.params.parcelId), lines));
    } catch (e: any) {
      res.status(e.status ?? 500).json({ message: e.message });
    }
  });

  /* -------------------------------------------------------- movimentos */
  const TX_TYPES = new Set(["expense", "transfer", "withdrawal", "contribution"]);

  app.get("/api/months/:id/transactions", (req, res) => {
    res.json(storage.listTransactions(Number(req.params.id)));
  });

  app.post("/api/transactions", (req, res) => {
    const b = req.body ?? {};
    let typeId: number | null = null;
    if (b.typeId != null && b.typeId !== "") {
      const t = storage.getState().txTypes.find((x) => x.id === Number(b.typeId));
      if (!t) return res.status(400).json({ message: "Tipo de movimento inexistente" });
      typeId = t.id;
      // a natureza do tipo personalizado decide o comportamento base (cálculos inalterados)
      b.type = ({ despesa: "expense", entrada: "contribution", transferencia: "transfer", ajuste: "withdrawal" } as any)[t.nature];
    }
    if (!TX_TYPES.has(b.type)) {
      return res.status(400).json({ message: "Tipo de movimento inválido" });
    }
    if (b.type === "transfer" && (!b.parcelId || !b.targetParcelId)) {
      return res.status(400).json({ message: "Transferência exige origem e destino" });
    }
    try {
    res.json(
      storage.createTransaction({
        monthId: Number(b.monthId),
        date: String(b.date ?? new Date().toISOString().slice(0, 10)),
        type: b.type,
        typeId,
        value: Number(b.value) || 0,
        parcelId: b.parcelId != null ? Number(b.parcelId) : null,
        targetParcelId: b.targetParcelId != null ? Number(b.targetParcelId) : null,
        category: String(b.category ?? ""),
        note: String(b.note ?? ""),
      }),
    );
    } catch (e: any) {
      res.status(e.status ?? 500).json({ message: e.message });
    }
  });

  app.patch("/api/transactions/:id", (req, res) => {
    const b = req.body ?? {};
    if (b.type && !TX_TYPES.has(b.type)) {
      return res.status(400).json({ message: "Tipo de movimento inválido" });
    }
    try {
      const allowed = ["date", "value", "parcelId", "targetParcelId", "category", "note", "type", "monthId"];
      const patch: any = {};
      for (const k of allowed) if (k in b) patch[k] = b[k];
      res.json(storage.updateTransaction(Number(req.params.id), patch));
    } catch (e: any) {
      res.status(e.status ?? 500).json({ message: e.message });
    }
  });

  app.delete("/api/transactions/:id", (req, res) => {
    storage.deleteTransaction(Number(req.params.id));
    res.json({ ok: true });
  });

  /* ---------------------------------------------------------- categorias (SM-004) */
  /* ---------------------------------------------------- EVO-08 */
  evo8.installGuards();
  registerOffline(app);
  const h = (fn: (req: any) => any) => (req: any, res: any) => {
    try { res.json(fn(req) ?? { ok: true }); } catch (e: any) { res.status(e.status ?? 500).json({ message: e.status ? e.message : "Erro interno." }); }
  };
  app.get("/api/app-info", h(() => ({ version: evo8.APP_VERSION, environment: evo8.ENV_NAME, schemaVersion: SCHEMA_VERSION })));
  app.get("/api/verify", h(() => evo8.verifyData()));
  app.get("/api/change-log", h(() => evo8.listChangeLog()));
  app.get("/api/months/:id/summary", h((r) => evo8.monthSummary(Number(r.params.id))));
  app.post("/api/months/:id/close", h((r) => evo8.closeMonth(Number(r.params.id), r.body ?? {})));
  app.post("/api/months/:id/reopen", h((r) => evo8.reopenMonth(Number(r.params.id), String(r.body?.note ?? ""))));
  app.get("/api/closures", h((r) => evo8.closureHistory(r.query.monthId ? Number(r.query.monthId) : undefined)));
  app.get("/api/recurring", h(() => evo8.listRecurring()));
  app.post("/api/recurring", h((r) => evo8.saveRecurring(r.body ?? {})));
  app.patch("/api/recurring/:id", h((r) => evo8.saveRecurring(r.body ?? {}, Number(r.params.id))));
  app.delete("/api/recurring/:id", h((r) => evo8.deleteRecurring(Number(r.params.id))));
  app.get("/api/recurring/pending", h(() => evo8.pending()));
  app.post("/api/recurring/confirm", h((r) => evo8.confirmOccurrence(String(r.body?.key ?? ""))));
  app.post("/api/recurring/skip", h((r) => evo8.skipOccurrence(String(r.body?.key ?? ""))));
  app.get("/api/reserves", h(() => evo8.listReserves()));
  app.post("/api/reserves", h((r) => evo8.saveReserve(r.body ?? {})));
  app.patch("/api/reserves/:id", h((r) => evo8.saveReserve(r.body ?? {}, Number(r.params.id))));
  app.delete("/api/reserves/:id", h((r) => evo8.deleteReserve(Number(r.params.id))));
  app.post("/api/reserves/:id/pay", h((r) => evo8.payReserve(Number(r.params.id), r.body ?? {})));
  app.post("/api/import/csv/preview", h((r) => evo8.csvPreview(r.body ?? {})));
  app.post("/api/import/csv", h((r) => evo8.csvImport(r.body ?? {})));

  app.get("/api/categories", (_req, res) => {
    res.json(storage.listCategories());
  });
  app.post("/api/categories", guard((req) => {
    const b = req.body ?? {};
    return (
      storage.createCategory({
        name: parse(categoryCreateSchema, { name: b.name }).name,
        monthlyBudget: Number(b.monthlyBudget) || 0,
        essential: b.essential ? 1 : 0,
        active: 1,
        sortOrder: Number(b.sortOrder) || 0,
      })
    );
  }));
  app.patch("/api/categories/:id", (req, res) => {
    const b = req.body ?? {};
    const patch: any = {};
    if (b.name != null) patch.name = String(b.name).trim();
    if (b.monthlyBudget != null) patch.monthlyBudget = Number(b.monthlyBudget) || 0;
    if (b.essential != null) patch.essential = b.essential ? 1 : 0;
    if (b.active != null) patch.active = b.active ? 1 : 0;
    if (b.sortOrder != null) patch.sortOrder = Number(b.sortOrder) || 0;
    res.json(storage.updateCategory(Number(req.params.id), patch));
  });
  app.delete("/api/categories/:id", (req, res) => {
    storage.deleteCategory(Number(req.params.id));
    res.json({ ok: true });
  });

  /** Justificação do défice/excedente do mês (SM-001). */
  app.patch("/api/months/:id/reconciliation", (req, res) => {
    const { deficitReason, deficitNote } = req.body ?? {};
    res.json(
      storage.updateMonth(Number(req.params.id), {
        deficitReason: String(deficitReason ?? ""),
        deficitNote: String(deficitNote ?? ""),
      }),
    );
  });

  /* --------------------------------------------------- backup / export */
  const SCHEMA_VERSION = 3;

  app.get("/api/export/json", (_req, res) => {
    const full = storage.getState();
    const state = { ...full, settings: { ...full.settings, accessCode: "" } }; // o backup leva tudo, menos o código
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="backup-salario-${stamp}.json"`);
    res.send(
      JSON.stringify(
        {
          schemaVersion: SCHEMA_VERSION,
          version: SCHEMA_VERSION,
          currency: "EUR",
          createdAt: new Date().toISOString(),
          exportedAt: new Date().toISOString(),
          ...state,
        },
        null,
        1,
      ),
    );
  });

  app.get("/api/export/xlsx", (_req, res) => {
    const state = storage.getState();
    const parcels = [...state.parcels].sort((a, b) => a.sortOrder - b.sortOrder);
    const wb = XLSX.utils.book_new();
    const years = Array.from(new Set(state.months.map((m) => m.year))).sort();

    for (const year of years) {
      const rows: any[] = [];
      for (const m of sortMonths(state.months.filter((x) => x.year === year))) {
        const c = computeMonth(m, state.allocations, state.parcels, state.settings);
        const row: any = {
          Mês: m.label,
          "Vencimento Base": m.base,
          "Retribuição Extraordinária": m.extraordinaria,
          "Outros Rend. Suj. a IRS e SS": m.outrosIrsSs,
          "Outros Rend. Suj. a IRS": m.outrosIrs,
          "Rendimentos Isentos": m.isentos,
          Bruto: round2(grossOf(m)),
          Descontos: round2(descontosOf(m)),
          "Vencimento Líquido": round2(c.net),
          "Subsídio Alimentação": round2(mealOf(m)),
          "Valor Disponível": round2(c.available),
        };
        for (const p of parcels) row[p.name] = round2(c.byParcel[p.id] ?? 0);
        row["Valor Restante"] = round2(c.remaining);
        row["Taxa de Poupança"] = round2(c.savingsRate * 100);
        rows.push(row);
      }
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, String(year));
    }

    const parcelRows = parcels.map((p) => ({
      Parcela: p.name,
      Tipo: p.kind,
      Plataformas: p.platforms,
      "Regra": p.defaultMode === "percentagem" ? `${p.defaultValue}%` : `${p.defaultValue} €`,
      Meta: p.targetAmount ?? "",
      "Data alvo": p.targetDate ?? "",
      Acumulado: round2(
        state.months.reduce((acc, m) => {
          const c = computeMonth(m, state.allocations, state.parcels, state.settings);
          return acc + (c.byParcel[p.id] ?? 0);
        }, 0),
      ),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(parcelRows), "Parcelas");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="particao-do-salario-${stamp}.xlsx"`);
    res.send(buf);
  });

  /** Valida tipos, enums e limites de um backup antes de aplicar. Devolve mensagem de erro ou null. */
  function validateBackupShape(body: any): string | null {
    const isNum = (v: any) => typeof v === "number" && Number.isFinite(v);
    const isDate = (v: any) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);
    const colls = ["monthClosures", "recurringExpenses", "recurrenceSkips", "reserves", "importBatches", "changeLog", "months", "parcels", "allocations", "transactions", "categories", "platforms", "parcelPlatforms", "parcelTypes", "txTypes", "allocationPlatforms", "allocationAssets", "subgoals", "goalEntries", "contributionLinks", "fxRates"];
    for (const k of colls) {
      const arr = body[k];
      if (arr === undefined) continue;
      if (!Array.isArray(arr) || arr.length > 100000) return `Coleção "${k}" inválida.`;
      for (const x of arr) if (!x || typeof x !== "object" || !isNum(x.id)) return `Coleção "${k}" contém registos sem id numérico.`;
    }
    for (const m of body.months) if (!isNum(m.year) || !isNum(m.month) || m.month < 1 || m.month > 12) return "Mês com ano/mês inválido.";
    for (const a of body.allocations ?? []) if (!["fixo", "percentagem"].includes(a.mode) || !isNum(a.value)) return "Alocação inválida.";
    for (const t of body.transactions ?? []) {
      if (!["expense", "transfer", "withdrawal", "contribution"].includes(t.type) || !isNum(t.value) || !isDate(t.date)) return "Movimento inválido.";
    }
    for (const l of body.allocationPlatforms ?? []) if (!["fixo", "percentagem"].includes(l.mode) || !isNum(l.value) || l.value < 0) return "Distribuição por plataforma inválida.";
    for (const x of body.allocationAssets ?? []) {
      if (typeof x.name !== "string" || !x.name.trim() || !isNum(x.percent) || x.percent <= 0 || x.percent > 100) return "Ativo inválido.";
    }
    for (const x of body.subgoals ?? []) if (typeof x.name !== "string" || !x.name.trim() || !/^[A-Z]{3}$/.test(String(x.currency))) return "Submeta inválida.";
    for (const e of body.goalEntries ?? []) {
      if (!["inicial", "ajuste"].includes(e.kind) || !isNum(e.amount) || !isDate(e.date)) return "Saldo/ajuste inválido.";
    }
    for (const l of body.contributionLinks ?? []) if (!isNum(l.amount) || l.amount <= 0) return "Atribuição inválida.";
    for (const r of body.fxRates ?? []) {
      if (!/^[A-Z]{3}$/.test(String(r.fromCurrency)) || !/^[A-Z]{3}$/.test(String(r.toCurrency)) || !isDate(r.date)) return "Taxa de conversão inválida.";
    }
    return null;
  }

  /** Valida referências de um backup antes de aplicar (EVO-02). Devolve mensagem de erro ou null. */
  function validateBackupRefs(body: any): string | null {
    const ids = (a: any[] | undefined) => new Set((a ?? []).map((x: any) => x.id));
    const parcelIds = ids(body.parcels);
    const monthIds = ids(body.months);
    const platformIds = ids(body.platforms);
    const pTypeIds = ids(body.parcelTypes);
    const tTypeIds = ids(body.txTypes);
    for (const l of body.parcelPlatforms ?? []) {
      if (!parcelIds.has(l.parcelId) || !platformIds.has(l.platformId)) return "Backup com ligação parcela/plataforma inválida.";
    }
    for (const p of body.parcels ?? []) if (p.typeId != null && !pTypeIds.has(p.typeId)) return `Parcela "${p.name}" refere um tipo inexistente.`;
    for (const t of body.transactions ?? []) {
      if (t.typeId != null && !tTypeIds.has(t.typeId)) return "Movimento com tipo inexistente.";
      if (!monthIds.has(t.monthId)) return "Movimento com mês inexistente.";
    }
    for (const a of body.allocations ?? []) if (!monthIds.has(a.monthId) || !parcelIds.has(a.parcelId)) return "Alocação com referência inválida.";
    const subIds = ids(body.subgoals);
    const txIds = ids(body.transactions);
    for (const sg of body.subgoals ?? []) if (!parcelIds.has(sg.parcelId)) return "Submeta com meta inexistente.";
    for (const e of body.goalEntries ?? []) {
      if (!parcelIds.has(e.parcelId) || (e.subgoalId != null && !subIds.has(e.subgoalId))) return "Saldo/ajuste com referência inválida.";
    }
    for (const l of body.contributionLinks ?? []) {
      if (!subIds.has(l.subgoalId) || !txIds.has(l.transactionId)) return "Atribuição a submeta com referência inválida.";
    }
    for (const r of body.fxRates ?? []) if (!(Number(r.rate) > 0)) return "Taxa de conversão inválida (tem de ser positiva).";
    const allocIds = ids(body.allocations);
    for (const l of body.allocationPlatforms ?? []) {
      if (!allocIds.has(l.allocationId) || !platformIds.has(l.platformId)) return "Distribuição por plataforma com referência inválida.";
    }
    const platOf = new Map((body.allocationPlatforms ?? []).map((l: any) => [`${l.allocationId}:${l.platformId}`, 1]));
    for (const x of body.allocationAssets ?? []) {
      if (!platOf.has(`${x.allocationId}:${x.platformId}`)) return "Distribuição por ativos sem plataforma correspondente.";
      if (!(Number(x.percent) > 0 && Number(x.percent) <= 100)) return "Percentagem de ativo inválida.";
    }
    return null;
  }

  /** Valida a estrutura e devolve um resumo, sem alterar dados (SM-003). */
  app.post("/api/import/preview", (req, res) => {
    const body = req.body;
    if (!body || !Array.isArray(body.months) || !Array.isArray(body.parcels)) {
      return res.status(400).json({ message: "Ficheiro de backup inválido: faltam meses ou parcelas" });
    }
    const schemaVersion = Number(body.schemaVersion ?? body.version ?? 1);
    if (!Number.isFinite(schemaVersion) || schemaVersion > SCHEMA_VERSION) {
      return res.status(400).json({
        error: `Versão do backup (${schemaVersion}) mais recente do que a aplicação suporta (${SCHEMA_VERSION}).`,
      });
    }
    const refErr = validateBackupShape(body) ?? validateBackupRefs(body);
    if (refErr) return res.status(400).json({ message: refErr });
    const goals = (body.parcels ?? []).filter((p: any) => p.targetAmount != null).length;
    res.json({
      ok: true,
      schemaVersion,
      exportedAt: body.exportedAt ?? body.createdAt ?? null,
      resumo: {
        meses: body.months.length,
        movimentos: Array.isArray(body.transactions) ? body.transactions.length : 0,
        parcelas: body.parcels.length,
        objetivos: goals,
        categorias: Array.isArray(body.categories) ? body.categories.length : 0,
        plataformas: Array.isArray(body.platforms) ? body.platforms.length : 0,
        tiposParcela: Array.isArray(body.parcelTypes) ? body.parcelTypes.length : 0,
        submetas: Array.isArray(body.subgoals) ? body.subgoals.length : 0,
        saldosEAjustes: Array.isArray(body.goalEntries) ? body.goalEntries.length : 0,
        taxasManuais: Array.isArray(body.fxRates) ? body.fxRates.length : 0,
        distribuicoesAtivos: Array.isArray(body.allocationAssets) ? body.allocationAssets.length : 0,
        distribuicoesPlataforma: Array.isArray(body.allocationPlatforms) ? body.allocationPlatforms.length : 0,
        tiposMovimento: Array.isArray(body.txTypes) ? body.txTypes.length : 0,
      },
    });
  });

  app.post("/api/import", (req, res) => {
    const body = req.body;
    if (!body || !Array.isArray(body.months) || !Array.isArray(body.parcels)) {
      return res.status(400).json({ message: "Ficheiro de backup inválido" });
    }
    const importVersion = Number(body.schemaVersion ?? body.version ?? 1);
    if (!Number.isFinite(importVersion) || importVersion > SCHEMA_VERSION) {
      return res.status(400).json({ message: `Versão do backup (${importVersion}) mais recente do que a aplicação suporta (${SCHEMA_VERSION}).` });
    }
    const refErr = validateBackupShape(body) ?? validateBackupRefs(body);
    if (refErr) return res.status(400).json({ message: refErr });
    // copia de seguranca automatica do estado atual antes de substituir (SM-003)
    const before = storage.snapshotState();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    try {
      writeFileSync(
        join(dataDir, `pre-import-backup-${stamp}.json`),
        JSON.stringify({ schemaVersion: SCHEMA_VERSION, autoBackupBeforeImportAt: new Date().toISOString(), ...before, settings: { ...(before as any).settings, accessCode: "" } }),
        { mode: 0o600 },
      );
    } catch {
      /* melhor esforço: nao bloquear a importacao se a escrita falhar */
    }
    pruneFiles(dataDir, /^pre-import-backup-.*\.json$/, 10); // guarda só as 10 últimas
    try {
      storage.replaceAll({
      platforms: body.platforms,
      parcelPlatforms: body.parcelPlatforms,
      parcelTypes: body.parcelTypes,
      txTypes: body.txTypes,
      allocationPlatforms: body.allocationPlatforms,
      allocationAssets: body.allocationAssets,
      subgoals: body.subgoals,
      goalEntries: body.goalEntries,
      contributionLinks: body.contributionLinks,
      fxRates: body.fxRates,
      monthClosures: body.monthClosures,
      recurringExpenses: body.recurringExpenses,
      recurrenceSkips: body.recurrenceSkips,
      reserves: body.reserves,
      importBatches: body.importBatches,
      changeLog: body.changeLog,
      settings: body.settings && typeof body.settings === "object" ? (({ accessCode: _c, ...rest }: any) => rest)(body.settings) : undefined, // o restauro nunca altera o código de acesso
      parcels: body.parcels,
      months: body.months,
      allocations: body.allocations ?? [],
      transactions: body.transactions ?? [],
      categories: body.categories ?? [],
      });
    } catch (e: any) {
      return res.status(400).json({ message: `Restauro falhou e nada foi alterado: ${e.message}` });
    }
    storage.updateSettings({ lastRestoreAt: new Date().toISOString() });
    res.json(publicState(storage.getState()));
  });

  return httpServer;
}

function round2(n: number) {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}
