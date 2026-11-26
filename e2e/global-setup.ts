import { ACCESS_CODE } from "./helpers";

/**
 * A base de testes nasce nova, por isso o arranque no primeiro uso apareceria em todos os testes. Dá-se como
 * feito aqui; o teste do arranque volta a pô-lo por fazer quando precisa dele. Também fica no modo Detalhado (como
 * quem já usa a app), onde está o painel completo que a maioria dos testes exercita; os testes do modo Básico
 * escolhem-no e repõem o Detalhado no fim.
 */
export default async function globalSetup(config: import("@playwright/test").FullConfig) {
  const base = config.projects[0].use.baseURL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? "5055"}`;
  const r = await fetch(`${base}/api/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-codigo-acesso": ACCESS_CODE, "x-sm-client": "1" },
    body: JSON.stringify({ onboardingDone: true, uiMode: "detalhado" }),
  });
  if (!r.ok) throw new Error(`Não foi possível dar o arranque como feito: ${r.status}`);
}
