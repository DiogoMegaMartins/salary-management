// Os ficheiros estáticos do Worker levam o mesmo CSP que as respostas do servidor Node.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const headers = readFileSync("client/public/_headers", "utf8");
const middleware = readFileSync("server/middleware.ts", "utf8");

test("_headers tem o CSP e os cabeçalhos de segurança", () => {
  for (const h of ["Content-Security-Policy:", "X-Content-Type-Options: nosniff", "Referrer-Policy: no-referrer"]) assert.ok(headers.includes(h), h);
  assert.ok(headers.includes("script-src 'self';"));
  assert.ok(headers.includes("object-src 'none'"));
});

test("cada diretiva do CSP do servidor Node está no _headers", () => {
  const body = middleware.slice(middleware.indexOf("const csp = ["), middleware.indexOf("].join"));
  const directives = [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(directives.length >= 10);
  for (const d of directives) assert.ok(headers.includes(d), `falta no _headers: ${d}`);
});

test("o service worker e o index.html não ficam em cache longa", () => {
  assert.match(headers, /\/sw\.js\n\s+Cache-Control: no-cache/);
  assert.match(headers, /\/index\.html\n\s+Cache-Control: no-cache/);
});
