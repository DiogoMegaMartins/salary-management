import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeatures, featuresPatch, isFeatureOn, FEATURES } from "../shared/features";

const allOn = (f: Record<string, boolean>) => Object.values(f).every((v) => v === true);

test("funcionalidades: vazio, {} ou lixo = tudo ligado", () => {
  for (const j of ["", "{}", "lixo", "[1]", "null", undefined, null]) assert.ok(allOn(parseFeatures(j as any)), String(j));
  assert.equal(Object.keys(parseFeatures("{}")).length, FEATURES.length);
});

test("funcionalidades: desligar uma só desliga essa", () => {
  const f = parseFeatures('{"parcelas":false}');
  assert.equal(f.parcelas, false);
  assert.equal(f.divisao, true);
});

test("funcionalidades: reconciliação precisa de movimentos", () => {
  const f = parseFeatures('{"movimentos":false}');
  assert.equal(f.movimentos, false);
  assert.equal(f.reconciliacao, false);
  assert.equal(isFeatureOn('{"movimentos":false}', "reconciliacao"), false);
});

test("funcionalidades: valor que não é booleano conta como ligado", () => {
  assert.equal(parseFeatures('{"parcelas":"não"}').parcelas, true);
});

test("funcionalidades: featuresPatch guarda só o que está desligado", () => {
  assert.equal(featuresPatch("{}", "parcelas", false), '{"parcelas":false}');
  assert.equal(featuresPatch('{"parcelas":false}', "parcelas", true), "{}");
  assert.equal(featuresPatch("lixo", "divisao", false), '{"divisao":false}');
});

import { featuresFromProfile, profileFromFeatures } from "../shared/features";

test("arranque: só salário e despesas liga a divisão e os movimentos e desliga o resto", () => {
  const f = parseFeatures(featuresFromProfile({ invest: false, goals: false, irsJovem: false }));
  assert.equal(f.divisao, true);
  assert.equal(f.movimentos, true);
  assert.deepEqual([f.plataformas, f.parcelas, f.irsJovem, f.reconciliacao], [false, false, false, false]);
});

test("arranque: cada resposta liga só a sua funcionalidade", () => {
  const f = parseFeatures(featuresFromProfile({ invest: true, goals: false, irsJovem: true }));
  assert.deepEqual([f.plataformas, f.parcelas, f.irsJovem], [true, false, true]);
});

test("arranque: o perfil volta das funcionalidades atuais (e tudo ligado = tudo marcado)", () => {
  assert.deepEqual(profileFromFeatures("{}"), { invest: true, goals: true, irsJovem: true });
  assert.deepEqual(profileFromFeatures(featuresFromProfile({ invest: false, goals: true, irsJovem: false })), { invest: false, goals: true, irsJovem: false });
});
