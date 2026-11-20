import { DurableObject } from "cloudflare:workers";
import { handleAsNodeRequest } from "cloudflare:node";
import { storageContext } from "./sqlite-shim";

interface Env {
  SALARY: DurableObjectNamespace<SalaryDO>;
  ACCESS_CODE?: string;
  ASSETS: Fetcher;
}

const PORT = 8080;

type Globais = { __DO_STORAGE?: DurableObjectStorage; __SALARY_READY?: Promise<void> };
const g = globalThis as Globais;

/**
 * Um único objeto (`principal`) guarda todos os dados e corre a app Express.
 *
 * A Cloudflare pode descartar o objeto e criar outro no mesmo processo, que mantém os módulos em cache. Por isso:
 * o armazenamento atual é registado em cada criação (o substituto do SQLite lê-o a cada operação) e a app Express
 * só se cria uma vez por processo, sem voltar a abrir a porta.
 */
export class SalaryDO extends DurableObject<Env> {
  private ready: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      g.__DO_STORAGE = ctx.storage;
      if (env.ACCESS_CODE) {
        process.env.ACCESS_CODE = env.ACCESS_CODE;
        process.env.ACCESS_CODE_FROM_SECRET = "1";
      }
      g.__SALARY_READY ??= (async () => {
        // importado aqui porque o servidor abre a base de dados ao carregar
        const { buildApp } = await import("../server/app");
        const { httpServer } = await buildApp();
        httpServer.listen(PORT);
      })().catch((err) => {
        g.__SALARY_READY = undefined; // deixa o pedido seguinte tentar de novo
        throw err;
      });
      await g.__SALARY_READY;
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
    return storageContext.run(this.ctx.storage, () => handleAsNodeRequest(PORT, new Request(request, { headers })));
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
