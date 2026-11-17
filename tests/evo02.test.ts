// Corre com: npm test  (node:test via tsx; usa uma base de dados temporária, nunca o data.db real)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.chdir(mkdtempSync(join(tmpdir(), "sm-test-")));
const { storage, migratePlatformsFromText, db } = await import("../server/storage");
const { parcels, parcelPlatforms, platforms } = await import("../shared/schema");

const state = () => storage.getState();
const throwsStatus = (fn: () => unknown, status: number) =>
  assert.throws(fn, (e: any) => e.status === status);

test("migração do texto legado cria catálogo único por nome normalizado e é idempotente", () => {
  const before = state().parcels.filter((p) => p.platforms).length;
  assert.ok(before > 0, "seed deve ter parcelas com plataformas");
  const names = state().platforms.map((p) => p.name.toLowerCase());
  assert.equal(new Set(names).size, names.length);
  const n = state().platforms.length;
  const links = state().parcelPlatforms.length;
  migratePlatformsFromText();
  migratePlatformsFromText();
  assert.equal(state().platforms.length, n);
  assert.equal(state().parcelPlatforms.length, links);
});

test("T04 nome duplicado normalizado é rejeitado; vazio também", () => {
  storage.createPlatform({ name: "Banco X" });
  throwsStatus(() => storage.createPlatform({ name: "  banco   x " }), 409);
  throwsStatus(() => storage.createPlatform({ name: "   " }), 400);
});

test("T01 renomear mantém IDs e ligações; texto legado acompanha", () => {
  const p = state().parcels.find((x) => x.platforms)!;
  const link = state().parcelPlatforms.find((l) => l.parcelId === p.id)!;
  storage.updatePlatform(link.platformId, { name: "Renomeada" });
  const after = state();
  assert.ok(after.parcelPlatforms.some((l) => l.id === link.id && l.platformId === link.platformId));
  assert.ok(after.parcels.find((x) => x.id === p.id)!.platforms.includes("Renomeada"));
  throwsStatus(() => storage.updatePlatform(link.platformId, { name: "banco x" }), 409);
});

test("T02/T03 plataforma em uso: eliminar bloqueado, arquivar permitido e histórico mantido", () => {
  const link = state().parcelPlatforms[0];
  throwsStatus(() => storage.deletePlatform(link.platformId), 409);
  storage.updatePlatform(link.platformId, { archived: 1 });
  assert.equal(state().platforms.find((p) => p.id === link.platformId)!.archived, 1);
  assert.ok(state().parcelPlatforms.some((l) => l.id === link.id));
  const free = storage.createPlatform({ name: "Sem uso" });
  storage.deletePlatform(free.id);
  assert.ok(!state().platforms.some((p) => p.id === free.id));
});

test("setParcelPlatforms valida IDs e atualiza ligações", () => {
  const parcel = state().parcels[0];
  const a = storage.createPlatform({ name: "P-A" });
  const b = storage.createPlatform({ name: "P-B" });
  storage.setParcelPlatforms(parcel.id, [a.id, b.id, a.id]);
  assert.deepEqual(
    state().parcelPlatforms.filter((l) => l.parcelId === parcel.id).map((l) => l.platformId).sort(),
    [a.id, b.id].sort(),
  );
  throwsStatus(() => storage.setParcelPlatforms(parcel.id, [99999]), 400);
  assert.equal(state().parcels.find((p) => p.id === parcel.id)!.platforms, "P-A | P-B");
});

test("T15 tipos de parcela personalizados: nome base reservado, duplicados, em uso não elimina", () => {
  throwsStatus(() => storage.createParcelType({ name: "Poupança", baseKind: "poupanca" }), 409);
  throwsStatus(() => storage.createParcelType({ name: "X", baseKind: "outro" }), 400);
  const t = storage.createParcelType({ name: "Fundo de viagens", baseKind: "poupanca" });
  throwsStatus(() => storage.createParcelType({ name: "fundo de  viagens", baseKind: "gastos" }), 409);
  const p = state().parcels[0];
  storage.updateParcel(p.id, { typeId: t.id, kind: t.baseKind });
  throwsStatus(() => storage.deleteParcelType(t.id), 409);
  storage.updateParcelType(t.id, { archived: 1 });
  assert.equal(state().parcels.find((x) => x.id === p.id)!.typeId, t.id);
});

test("tipos de movimento: natureza válida, em uso não elimina", () => {
  throwsStatus(() => storage.createTxType({ name: "Y", nature: "inventada" }), 400);
  const t = storage.createTxType({ name: "Subscrições", nature: "despesa" });
  const m = state().months[0];
  storage.createTransaction({ monthId: m.id, date: "2026-01-05", type: "expense", typeId: t.id, value: 9.99 } as any);
  throwsStatus(() => storage.deleteTxType(t.id), 409);
});

test("T24 backup novo: exportar e restaurar preserva catálogos e ligações", () => {
  const snap = JSON.parse(JSON.stringify(state()));
  storage.replaceAll(snap);
  const after = state();
  for (const k of ["platforms", "parcelPlatforms", "parcelTypes", "txTypes", "parcels", "months", "transactions"] as const)
    assert.equal(after[k].length, snap[k].length, k);
});

test("T25 backup antigo (sem catálogos) é migrado a partir do texto", () => {
  const snap = JSON.parse(JSON.stringify(state()));
  const old = { ...snap, platforms: undefined, parcelPlatforms: undefined, parcelTypes: undefined, txTypes: undefined };
  storage.replaceAll(old);
  const after = state();
  assert.ok(after.platforms.length > 0);
  assert.equal(after.parcels.length, snap.parcels.length);
});

test("T26 restauro inválido é atómico: o estado atual não é substituído", () => {
  const before = state();
  const bad = JSON.parse(JSON.stringify(before));
  bad.months.push({ ...bad.months[0] }); // ID duplicado → viola chave primária a meio do restauro
  assert.throws(() => storage.replaceAll(bad));
  const after = state();
  assert.equal(after.months.length, before.months.length);
  assert.equal(after.parcels.length, before.parcels.length);
  assert.equal(after.platforms.length, before.platforms.length);
});

test("apagar parcela remove as suas ligações a plataformas", () => {
  const parcel = state().parcels[0];
  storage.deleteParcel(parcel.id);
  assert.ok(!state().parcelPlatforms.some((l) => l.parcelId === parcel.id));
});
