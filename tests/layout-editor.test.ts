import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutEditor } from "../client/src/lib/layout-editor";

test("botão Editar layout do cabeçalho: pedidos, disponibilidade e fim da edição", () => {
  let calls = 0;
  const off = layoutEditor.subscribe(() => calls++);
  const start = layoutEditor.getState().request;
  layoutEditor.setAvailable(true);
  layoutEditor.setEditing(true);
  layoutEditor.requestEdit();
  assert.equal(layoutEditor.getState().request, start + 1);
  assert.equal(layoutEditor.getState().available, true);
  assert.equal(layoutEditor.getState().editing, true);
  // sair da página (grelha desmontada) tira o botão e termina a edição
  layoutEditor.setAvailable(false);
  assert.equal(layoutEditor.getState().available, false);
  assert.equal(layoutEditor.getState().editing, false);
  assert.ok(calls >= 4);
  off();
  layoutEditor.requestEdit();
  assert.equal(calls >= 4, true);
});
