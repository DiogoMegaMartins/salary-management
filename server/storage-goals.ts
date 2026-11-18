/** Saldos iniciais, ajustes, submetas, atribuições de aportes e taxas de conversão (EVO-04). */
import type { Subgoal, GoalEntry, ContributionLink, FxRate } from "@shared/schema";
import { eq } from "drizzle-orm";
import { parcels, transactions, platforms, subgoals, goalEntries, contributionLinks, fxRates, normName } from "@shared/schema";
import { db, sqlite, httpError, roundCents } from "./db";

export const goalMethods = {
  createGoalEntry(d: { parcelId: number; subgoalId?: number | null; kind: string; amount: number; currency?: string; date: string; note?: string }): GoalEntry {
    const parcel = db.select().from(parcels).where(eq(parcels.id, Number(d.parcelId))).get();
    if (!parcel) throw httpError(404, "Meta não encontrada.");
    if (!["inicial", "ajuste"].includes(d.kind)) throw httpError(400, "Tipo inválido.");
    if (!Number.isFinite(Number(d.amount))) throw httpError(400, "Valor inválido.");
    d = { ...d, amount: roundCents(Number(d.amount)) };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date))) throw httpError(400, "Data inválida (AAAA-MM-DD).");
    let currency = parcel.currency || "EUR";
    const subgoalId = d.subgoalId == null ? null : Number(d.subgoalId);
    if (subgoalId != null) {
      const sg = db.select().from(subgoals).where(eq(subgoals.id, subgoalId)).get();
      if (!sg || sg.parcelId !== parcel.id) throw httpError(400, "Submeta inválida.");
      currency = sg.currency;
    }
    if (d.kind === "inicial" && Number(d.amount) < 0) throw httpError(400, "O saldo inicial não pode ser negativo.");
    if (d.kind === "ajuste" && Number(d.amount) === 0) throw httpError(400, "Um ajuste de 0 não altera nada.");
    return sqlite.transaction(() => {
      if (d.kind === "inicial") {
        // um único saldo inicial por meta/submeta: substitui, mantendo ajustes
        const prev = db.select().from(goalEntries).where(eq(goalEntries.parcelId, parcel.id)).all()
          .filter((e) => e.kind === "inicial" && (e.subgoalId ?? null) === subgoalId);
        for (const e of prev) db.delete(goalEntries).where(eq(goalEntries.id, e.id)).run();
      }
      return db.insert(goalEntries).values({ parcelId: parcel.id, subgoalId, kind: d.kind, amount: Number(d.amount), currency, date: d.date, note: String(d.note ?? "") }).returning().get();
    })();
  },
  /** Edita valor, data e nota de um saldo inicial ou ajuste (o tipo e a meta/submeta não mudam). */
  updateGoalEntry(id: number, patch: { amount?: number; date?: string; note?: string }): GoalEntry {
    const cur = db.select().from(goalEntries).where(eq(goalEntries.id, id)).get();
    if (!cur) throw httpError(404, "Registo não encontrado.");
    const set: Partial<GoalEntry> = {};
    if (patch.amount !== undefined) {
      const n = Number(patch.amount);
      if (!Number.isFinite(n)) throw httpError(400, "Valor inválido.");
      const amount = roundCents(n);
      if (cur.kind === "inicial" && amount < 0) throw httpError(400, "O saldo inicial não pode ser negativo.");
      if (cur.kind === "ajuste" && amount === 0) throw httpError(400, "Um ajuste de 0 não altera nada.");
      set.amount = amount;
    }
    if (patch.date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(patch.date))) throw httpError(400, "Data inválida (AAAA-MM-DD).");
      set.date = String(patch.date);
    }
    if (patch.note !== undefined) set.note = String(patch.note).slice(0, 500);
    if (!Object.keys(set).length) return cur;
    return db.update(goalEntries).set(set).where(eq(goalEntries.id, id)).returning().get();
  },
  deleteGoalEntry(id: number) {
    db.delete(goalEntries).where(eq(goalEntries.id, id)).run();
  },

  createSubgoal(d: { parcelId: number; name: string; platformId?: number | null; currency?: string; target?: number | null; deadline?: string | null }): Subgoal {
    const name = String(d.name ?? "").trim().replace(/\s+/g, " ");
    if (!name) throw httpError(400, "O nome da submeta é obrigatório.");
    const parcel = db.select().from(parcels).where(eq(parcels.id, Number(d.parcelId))).get();
    if (!parcel) throw httpError(404, "Meta não encontrada.");
    if (db.select().from(subgoals).where(eq(subgoals.parcelId, parcel.id)).all().some((x) => normName(x.name) === normName(name)))
      throw httpError(409, `Já existe uma submeta "${name}" nesta meta.`);
    const currency = String(d.currency || parcel.currency || "EUR").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw httpError(400, "Moeda inválida (ex.: EUR, USD).");
    if (d.platformId != null && !db.select().from(platforms).where(eq(platforms.id, Number(d.platformId))).get())
      throw httpError(400, "Plataforma inexistente.");
    const target = d.target == null || d.target === ("" as any) ? null : Number(d.target);
    if (target != null && (!Number.isFinite(target) || target < 0)) throw httpError(400, "Objetivo inválido.");
    return db.insert(subgoals).values({ parcelId: parcel.id, name, platformId: d.platformId ?? null, currency, target, deadline: d.deadline || null }).returning().get();
  },
  updateSubgoal(id: number, patch: Partial<Subgoal>): Subgoal {
    const cur = db.select().from(subgoals).where(eq(subgoals.id, id)).get();
    if (!cur) throw httpError(404, "Submeta não encontrada.");
    const set: Partial<Subgoal> = {};
    if (patch.name != null) {
      const name = String(patch.name).trim().replace(/\s+/g, " ");
      if (!name) throw httpError(400, "O nome da submeta é obrigatório.");
      if (db.select().from(subgoals).where(eq(subgoals.parcelId, cur.parcelId)).all().some((x) => x.id !== id && normName(x.name) === normName(name)))
        throw httpError(409, `Já existe uma submeta "${name}" nesta meta.`);
      set.name = name;
    }
    if (patch.platformId !== undefined) set.platformId = patch.platformId;
    if (patch.target !== undefined) set.target = patch.target == null ? null : Number(patch.target);
    if (patch.deadline !== undefined) set.deadline = patch.deadline || null;
    if (patch.currency != null && patch.currency !== cur.currency) {
      const used = db.select().from(goalEntries).where(eq(goalEntries.subgoalId, id)).all().length;
      if (used) throw httpError(409, "Não é possível mudar a moeda de uma submeta com saldos registados.");
      set.currency = String(patch.currency).toUpperCase();
    }
    return db.update(subgoals).set(set).where(eq(subgoals.id, id)).returning().get();
  },
  /** Bloqueia se houver movimentos atribuídos ou saldos/ajustes: nunca apaga silenciosamente. */
  deleteSubgoal(id: number) {
    const links = db.select().from(contributionLinks).where(eq(contributionLinks.subgoalId, id)).all().length;
    const entries = db.select().from(goalEntries).where(eq(goalEntries.subgoalId, id)).all().length;
    if (links || entries)
      throw httpError(409, `A submeta tem ${links} movimento(s) atribuído(s) e ${entries} saldo(s)/ajuste(s). Remove-os ou reatribui antes de eliminar.`);
    db.delete(subgoals).where(eq(subgoals.id, id)).run();
  },

  /** Atribui parte de um aporte/retirada a uma submeta; a soma atribuída nunca excede o valor do movimento. */
  createContributionLink(d: { transactionId: number; subgoalId: number; amount: number }): ContributionLink {
    const tx = db.select().from(transactions).where(eq(transactions.id, Number(d.transactionId))).get();
    const sg = db.select().from(subgoals).where(eq(subgoals.id, Number(d.subgoalId))).get();
    if (!tx || !sg) throw httpError(404, "Movimento ou submeta inexistente.");
    if (!["contribution", "withdrawal"].includes(tx.type) || tx.parcelId !== sg.parcelId)
      throw httpError(400, "Só aportes/retiradas da mesma meta podem ser atribuídos a uma submeta.");
    if (sg.currency !== (db.select().from(parcels).where(eq(parcels.id, sg.parcelId)).get()?.currency ?? "EUR"))
      throw httpError(400, "Os movimentos estão em moeda da meta; usa saldo inicial/ajustes em submetas de outra moeda.");
    const amount = Number(d.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw httpError(400, "Montante inválido.");
    const used = db.select().from(contributionLinks).where(eq(contributionLinks.transactionId, tx.id)).all().reduce((a, l) => a + Math.round(l.amount * 100), 0);
    if (used + Math.round(amount * 100) > Math.round(tx.value * 100))
      throw httpError(409, `Só restam ${((Math.round(tx.value * 100) - used) / 100).toFixed(2)} € por atribuir neste movimento.`);
    return db.insert(contributionLinks).values({ transactionId: tx.id, subgoalId: sg.id, amount }).returning().get();
  },
  deleteContributionLink(id: number) {
    db.delete(contributionLinks).where(eq(contributionLinks.id, id)).run();
  },

  createFxRate(d: { fromCurrency: string; toCurrency: string; rate: number; date: string }): FxRate {
    const from = String(d.fromCurrency ?? "").toUpperCase();
    const to = String(d.toCurrency ?? "").toUpperCase();
    if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || from === to) throw httpError(400, "Moedas inválidas.");
    const rate = Number(d.rate);
    if (!Number.isFinite(rate) || rate <= 0) throw httpError(400, "A taxa tem de ser positiva.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date))) throw httpError(400, "Data inválida (AAAA-MM-DD).");
    return db.insert(fxRates).values({ fromCurrency: from, toCurrency: to, rate, date: d.date, source: "manual" }).returning().get();
  },
  deleteFxRate(id: number) {
    db.delete(fxRates).where(eq(fxRates.id, id)).run();
  },
};
