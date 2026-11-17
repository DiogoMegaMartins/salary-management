import { test } from "node:test";
import assert from "node:assert/strict";
import { editableMonthPatch } from "../shared/month-patch";

test("month editor never sends protected state/carry fields", () => {
  assert.deepEqual(editableMonthPatch({ id: 5, base: 1200, status: "aberto", carryIn: 300 }), { base: 1200 });
});
test("month editor sends only changes, avoiding stale overwrites", () => {
  assert.deepEqual(editableMonthPatch({ base: 1200, notes: "nova", status: "aberto" }, { base: 1200, notes: "antiga" }), { notes: "nova" });
});
