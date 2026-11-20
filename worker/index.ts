import { DurableObject } from "cloudflare:workers";
import { handleAsNodeRequest } from "cloudflare:node";

interface Env {
  SALARY: DurableObjectNamespace<SalaryDO>;
  ACCESS_CODE?: string;
  ASSETS: Fetcher;
}

const PORT = 8080;

/** Um único objeto (`principal`) guarda todos os dados e corre a app Express. */
export class SalaryDO extends DurableObject<Env> {
  private ready: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      (globalThis as { __DO_STORAGE?: DurableObjectStorage }).__DO_STORAGE = ctx.storage;
      if (env.ACCESS_CODE) {
        process.env.ACCESS_CODE = env.ACCESS_CODE;
        process.env.ACCESS_CODE_FROM_SECRET = "1";
      }
      // importado aqui porque o servidor abre a base de dados ao carregar
      const { buildApp } = await import("../server/app");
      const { httpServer } = await buildApp();
      httpServer.listen(PORT);
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    // O Express usa o IP do cliente para limitar tentativas. A Cloudflare dá-o em cf-connecting-ip
    // (não falsificável); sem isto todos os visitantes partilhavam o mesmo IP e o mesmo limite.
    const headers = new Headers(request.headers);
    const ip = request.headers.get("cf-connecting-ip");
    if (ip) headers.set("x-forwarded-for", ip);
    else headers.delete("x-forwarded-for");
    return handleAsNodeRequest(PORT, new Request(request, { headers }));
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await env.SALARY.getByName("principal").fetch(request);
    } catch (err) {
      // Sem isto a Cloudflare responde só "error code: 1101". O texto do erro vai nos registos e, truncado, na resposta.
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.error("O Worker falhou:", detail, err instanceof Error ? (err.stack ?? "") : "");
      return Response.json({ message: "O servidor falhou ao responder.", detail: detail.slice(0, 300) }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
