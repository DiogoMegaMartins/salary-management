// Metas no Início: qual fica em destaque e que etiqueta tem cada estado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { featuredGoalId, goalChip } from "../shared/goals-view";

test("metas: o destaque é a que mais precisa de atenção", () => {
  assert.equal(featuredGoalId([{ id: 1, status: "no_ritmo", pct: 0.9 }, { id: 2, status: "atrasada", pct: 0.1 }, { id: 3, status: "prazo_passado", pct: 0.2 }]), 3);
  assert.equal(featuredGoalId([{ id: 1, status: "no_ritmo", pct: 0.9 }, { id: 2, status: "atrasada", pct: 0.1 }]), 2);
  assert.equal(featuredGoalId([{ id: 1, status: "sem_ritmo", pct: 0.5 }, { id: 2, status: "atrasada", pct: 0.1 }]), 1);
});

test("metas: sem nenhuma em atenção, destaca a mais adiantada por concluir", () => {
  assert.equal(featuredGoalId([{ id: 1, status: "atingida", pct: 1 }, { id: 2, status: "no_ritmo", pct: 0.4 }, { id: 3, status: "sem_prazo", pct: 0.7 }]), 3);
  assert.equal(featuredGoalId([{ id: 1, status: "atingida", pct: 1 }, { id: 2, status: "atingida", pct: 1 }]), 1);
  assert.equal(featuredGoalId([]), null);
});

test("metas: etiquetas por estado", () => {
  assert.deepEqual(goalChip("no_ritmo"), { text: "No ritmo", tone: "ok" });
  assert.deepEqual(goalChip("atrasada"), { text: "Atrasada", tone: "warn" });
  assert.deepEqual(goalChip("sem_ritmo"), { text: "Sem ritmo", tone: "bad" });
  assert.equal(goalChip("sem_objetivo"), null);
  assert.equal(goalChip("sem_prazo"), null);
});
