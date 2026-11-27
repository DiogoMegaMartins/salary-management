import type { ReactNode } from "react";
import { APP_VERSION } from "@shared/version";

/**
 * SM-011: conteúdo estático do centro de ajuda. Escrito em português de
 * Portugal, sem dados pessoais nem exemplos reais. As fórmulas aqui
 * apresentadas espelham exatamente `shared/calc.ts` — qualquer alteração ao
 * cálculo deve ser replicada aqui.
 */
export type HelpSection = {
  slug: string;
  title: string;
  group: string;
  keywords?: string[];
  body: ReactNode;
};

const P = ({ children }: { children: ReactNode }) => <p className="leading-relaxed text-sm text-foreground/90">{children}</p>;
const H3 = ({ children }: { children: ReactNode }) => <h3 className="mt-5 text-sm font-semibold">{children}</h3>;
const UL = ({ children }: { children: ReactNode }) => <ul className="ml-4 list-disc space-y-1.5 text-sm text-foreground/90">{children}</ul>;
const OL = ({ children }: { children: ReactNode }) => <ol className="ml-4 list-decimal space-y-1.5 text-sm text-foreground/90">{children}</ol>;
const CODE = ({ children }: { children: ReactNode }) => (
  <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-muted/50 p-3 text-xs leading-relaxed tnum">
    <code>{children}</code>
  </pre>
);
const KBD = ({ children }: { children: ReactNode }) => (
  <code className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium">{children}</code>
);

/** Diagrama simples da arquitetura; usa as cores do tema para funcionar em claro e escuro. */
function ArchitectureDiagram() {
  const box = { fill: "hsl(var(--card))", stroke: "hsl(var(--border))", strokeWidth: 1.5 } as const;
  const pill = { fill: "hsl(var(--muted))", stroke: "none" } as const;
  const accent = { stroke: "hsl(var(--primary))", strokeWidth: 2, fill: "none" } as const;
  const label = { fill: "currentColor", fontSize: 13 } as const;
  const title = { fill: "currentColor", fontSize: 14, fontWeight: 600 } as const;
  const small = { fill: "hsl(var(--muted-foreground))", fontSize: 12 } as const;
  return (
    <figure className="mt-3 text-foreground">
      <svg viewBox="0 0 720 350" role="img" aria-labelledby="arq-titulo arq-desc" className="h-auto w-full">
        <title id="arq-titulo">Arquitetura da aplicação</title>
        <desc id="arq-desc">
          O navegador ou telemóvel fala com o servidor por pedidos à API. O servidor valida os pedidos e grava numa base de dados SQLite
          com cópias automáticas. Com a cópia offline ativa, as alterações feitas sem ligação seguem em lote ao voltar a ligação.
        </desc>
        <defs>
          <marker id="arq-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="hsl(var(--primary))" />
          </marker>
        </defs>

        <rect x="10" y="10" width="290" height="250" rx="10" {...box} />
        <text x="26" y="34" {...title}>Navegador ou telemóvel</text>
        <rect x="26" y="48" width="258" height="34" rx="6" {...pill} />
        <text x="38" y="70" {...label}>Interface (ecrãs e gráficos)</text>
        <rect x="26" y="90" width="258" height="34" rx="6" {...pill} />
        <text x="38" y="112" {...label}>Cálculos dos valores no ecrã</text>
        <rect x="26" y="132" width="258" height="34" rx="6" {...pill} />
        <text x="38" y="154" {...label}>Cópia offline cifrada (opcional)</text>
        <rect x="26" y="174" width="258" height="34" rx="6" {...pill} />
        <text x="38" y="196" {...label}>Ficheiros da app guardados</text>
        <text x="26" y="236" {...small}>Sem dados financeiros nesses ficheiros.</text>

        <rect x="420" y="10" width="290" height="160" rx="10" {...box} />
        <text x="436" y="34" {...title}>Servidor</text>
        <rect x="436" y="48" width="258" height="34" rx="6" {...pill} />
        <text x="448" y="70" {...label}>Código de acesso e limites</text>
        <rect x="436" y="90" width="258" height="34" rx="6" {...pill} />
        <text x="448" y="112" {...label}>Validação dos pedidos</text>
        <rect x="436" y="132" width="258" height="26" rx="6" {...pill} />
        <text x="448" y="150" {...label}>Regras e gravação</text>

        <rect x="420" y="210" width="290" height="100" rx="10" {...box} />
        <text x="436" y="234" {...title}>Base de dados SQLite</text>
        <text x="436" y="262" {...label}>Os teus dados (um só ficheiro)</text>
        <text x="436" y="286" {...label}>Cópias automáticas diárias</text>

        <path d="M300 70 H416" {...accent} markerEnd="url(#arq-seta)" />
        <text x="308" y="62" {...small}>pedidos</text>
        <path d="M416 120 H300" {...accent} markerEnd="url(#arq-seta)" />
        <text x="318" y="138" {...small}>respostas</text>
        <path d="M300 158 H416" {...accent} strokeDasharray="5 4" markerEnd="url(#arq-seta)" />
        <text x="308" y="180" {...small}>lote sem ligação</text>
        <path d="M565 170 V206" {...accent} markerEnd="url(#arq-seta)" />

        <rect x="10" y="280" width="290" height="60" rx="10" {...box} />
        <text x="26" y="304" {...title}>Mesmas fórmulas</text>
        <text x="26" y="324" {...small}>Ecrã e servidor usam o mesmo código.</text>
      </svg>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        As setas seguem o sentido da informação. A seta tracejada só existe com a cópia offline ativa.
      </figcaption>
    </figure>
  );
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    slug: "comecar-rapidamente",
    title: "Começar rapidamente",
    group: "Introdução",
    keywords: ["primeiro mês", "criar mês", "guia rápido", "setup"],
    body: (
      <>
        <P>Sequência recomendada para configurar o primeiro mês na aplicação.</P>
        <OL>
          <li>Abre <KBD>Meses</KBD> e cria ou seleciona o mês a tratar.</li>
          <li>Introduz os rendimentos e descontos; confirma o valor de líquido disponível apresentado.</li>
          <li>Regista despesas por categoria no menu <KBD>Divisão</KBD>, separador <KBD>Movimentos</KBD>, ou usa a divisão por parcelas para o modelo agregado.</li>
          <li>Distribui o dinheiro pelas parcelas, se aplicável (poupança, investimento, etc.).</li>
          <li>Verifica o valor <em>por alocar</em> e decide se deve ficar disponível ou ser alocado a uma parcela.</li>
          <li>Consulta o <KBD>Painel</KBD> e revê alertas, taxa de poupança e progresso das metas.</li>
          <li>Exporta um backup JSON regularmente em <KBD>Definições, separador Backups e importação</KBD>.</li>
        </OL>
        <P>Todo o conteúdo desta página é genérico — não reflete dados pessoais introduzidos na aplicação.</P>
      </>
    ),
  },
  {
    slug: "visao-geral",
    title: "Visão geral",
    group: "Introdução",
    keywords: ["propósito", "fluxo mensal", "parcelas", "património"],
    body: (
      <>
        <P>
          O Partição do Salário ajuda a planear e acompanhar a divisão do rendimento líquido mensal
          entre despesas, poupança e investimento, mês a mês.
        </P>
        <H3>Três conceitos distintos</H3>
        <UL>
          <li><strong>Fluxo mensal</strong> — o vencimento e os descontos de um mês específico, e o valor líquido disponível resultante.</li>
          <li><strong>Parcelas</strong> — categorias de destino do dinheiro disponível (ex.: Fundos de Emergência, ETFs, Gastos Mensais), com uma regra de alocação (fixo ou percentagem) e, opcionalmente, uma meta.</li>
          <li><strong>Património</strong> — a página <KBD>Carteira</KBD> mostra a evolução acumulada do que foi alocado a cada parcela ao longo do tempo, não apenas o mês corrente.</li>
        </UL>
        <P>
          Desde a versão com movimentos individuais, cada mês pode continuar a usar apenas alocações
          agregadas (o modelo histórico) ou registar despesas e aportes como lançamentos individuais
          com categoria, data e nota — os dois modelos coexistem e são somados na reconciliação do mês.
        </P>
      </>
    ),
  },
  {
    slug: "como-funciona",
    title: "Como a aplicação funciona",
    group: "Introdução",
    keywords: ["arquitetura", "diagrama", "servidor", "base de dados", "sqlite", "offline", "backup", "segurança"],
    body: (
      <>
        <P>
          A aplicação é uma só peça: o servidor entrega o ecrã que vês e guarda os dados numa base de dados SQLite.
          Não usa serviços externos para os teus dados.
        </P>
        <ArchitectureDiagram />
        <H3>O caminho de uma alteração</H3>
        <OL>
          <li>Ao abrir, a interface pede ao servidor o estado completo e calcula no ecrã os totais, gráficos e metas.</li>
          <li>Quando guardas algo (uma despesa, um mês, um saldo), a interface envia um pedido ao servidor.</li>
          <li>O servidor confirma o código de acesso, valida o pedido e só depois grava. Se algo estiver errado, devolve uma mensagem em português e não grava nada.</li>
          <li>Com a gravação feita, a interface volta a pedir o estado e atualiza o ecrã.</li>
        </OL>
        <H3>Sem ligação</H3>
        <P>
          Com a cópia offline ativa (<KBD>Definições</KBD>), as alterações feitas sem ligação ficam numa fila cifrada com o teu código de acesso.
          Ao voltar a ligação seguem em lote; se houver conflitos, a aplicação pede-te que os reveja antes de aplicar.
        </P>
        <H3>Proteção e cópias</H3>
        <UL>
          <li>O código de acesso fica guardado só como impressão digital e há limite de tentativas erradas.</li>
          <li>Os pedidos que alteram dados são validados no servidor, que recusa campos que não conhece.</li>
          <li>O servidor faz cópias automáticas da base de dados (por omissão, uma por dia, guardando as últimas sete). Só protegem se a pasta das cópias sobreviver às republicações.</li>
          <li>Exporta um backup JSON regularmente em <KBD>Definições, separador Backups e importação</KBD>. É a cópia que guardas fora da aplicação.</li>
        </UL>
      </>
    ),
  },
  {
    slug: "painel",
    title: "Painel",
    group: "Áreas da aplicação",
    keywords: ["kpi", "dashboard", "gráficos", "alertas", "período", "comparação"],
    body: (
      <>
        <P>O Painel resume o período selecionado no filtro (mês, ano, intervalo personalizado ou preset).</P>
        <H3>KPIs</H3>
        <UL>
          <li><strong>Líquido total</strong> — soma do vencimento líquido de todos os meses no período filtrado.</li>
          <li><strong>Média mensal</strong> — líquido total dividido pelo número de meses do período.</li>
          <li><strong>Taxa de poupança</strong> — ver <a href="#formulas-e-calculos" className="underline underline-offset-2">Fórmulas e cálculos</a>.</li>
          <li><strong>Gastos</strong> — soma dos valores alocados/lançados à parcela do tipo "gastos" no período. É clicável: abre um painel lateral com os movimentos individuais que compõem o valor.</li>
          <li><strong>Carga fiscal efetiva</strong> — descontos totais (IRS + Segurança Social) a dividir pelo rendimento bruto total.</li>
          <li><strong>Por alocar</strong> — ver fórmula em <a href="#formulas-e-calculos" className="underline underline-offset-2">Fórmulas e cálculos</a>. É clicável para investigar os movimentos do período.</li>
        </UL>
        <H3>Comparação com o período anterior</H3>
        <P>
          Sempre que o período filtrado tem um equivalente imediatamente anterior com o mesmo número de
          meses (ex.: "últimos 3 meses" compara com os 3 meses antes desses), os KPIs de líquido, taxa
          de poupança e gastos mostram a variação percentual, com seta a indicar subida ou queda.
        </P>
        <H3>Alertas</H3>
        <P>
          Um alerta aparece sempre que o valor "por alocar" de um mês é negativo — ou seja, foi alocado
          ou gasto mais do que o disponível nesse mês.
        </P>
        <H3>Gráfico "Parcelas no período"</H3>
        <P>Cada linha da tabela é clicável e abre os movimentos individuais dessa parcela no período filtrado.</P>
        <H3>Metas e submetas</H3>
        <P>No cartão Metas, cada meta tem um botão independente para mostrar ou esconder todas as suas submetas. Ficam escondidas por omissão e voltam a esse estado ao recarregar. Abrir uma meta não abre as restantes.</P>
        <P>As submetas mostram o acumulado, o objetivo, o valor em falta e o progresso, na moeda respetiva. Um aviso identifica conversões incompletas; expandir ou recolher não altera dados nem duplica os totais.</P>
        <H3>Ritmo das metas</H3>
        <P>
          Quando uma meta tem objetivo e <KBD>Data alvo</KBD>, o cartão Metas compara o ritmo dos últimos 3 meses com o prazo.
          Se, a esse ritmo, o objetivo só chega depois do prazo, aparece um aviso a dizer em que mês chega e quanto seria preciso
          poupar por mês para chegar a tempo. Também avisa quando não há contribuições recentes ou o prazo já passou. As metas fora do
          ritmo ficam resumidas numa faixa no topo do Painel. Sem data alvo, a meta mostra só o tempo estimado.
        </P>
        <H3>Comparação mensal e anual</H3>
        <P>
          Compara o líquido, o rendimento bruto, os descontos, a carga fiscal, os gastos, a poupança, a taxa de poupança e o total por
          parcela. O primeiro botão, <em>Tipo de comparação</em>, tem duas opções: <em>Comparar com ano</em> e <em>Comparar com mês</em>.
        </P>
        <UL>
          <li><strong>Comparar com ano:</strong> o segundo botão tem primeiro os anos e, por baixo, os meses do ano escolhido (com <em>Selecionar todos</em> ou <em>Limpar seleção</em>). O terceiro botão lista só os outros anos. A tabela só aparece depois de escolheres o ano de comparação: não há ano por omissão.</li>
          <li><strong>Comparar com mês:</strong> escolhes um ano, depois os meses de <em>Base (inicial)</em> e a seguir os de <em>Comparação (final)</em>. A variação vai da base para a comparação; com tamanhos diferentes, compara médias mensais.</li>
          <li><strong>Memória:</strong> a escolha fica guardada neste dispositivo e vale também no Orçamento. <em>Repor</em> volta aos meses do filtro e limpa o ano de comparação.</li>
        </UL>
        <P>Se nenhum dos meses escolhidos tiver par no ano de comparação, o cartão explica porquê.</P>
        <H3>Despesas fora do padrão</H3>
        <P>
          Está na página Despesas e olha para o mês escolhido ali. Assinala as categorias que ficaram bem acima do habitual: mais de duas
          vezes o desvio dos até 12 meses anteriores, pelo menos 1,5 vezes a média e acima de 20 €. Uma categoria sem gasto nos meses
          anteriores aparece como <em>Novo</em> a partir de 40 €. São precisos pelo menos 3 meses anteriores com dados.
        </P>
        <H3>Relatório em PDF</H3>
        <P>
          O botão <KBD>Relatório</KBD> (no Painel e no Orçamento) gera uma fotografia em PDF. Em <em>O que incluir</em> escolhes o
          período filtrado (indicadores, orçamento contra o real, parcelas e meses incluídos) ou um <strong>ano completo</strong>
          (resumo contra o ano anterior, mês a mês, parcelas, despesas por categoria e valor da carteira). O ficheiro é criado no teu
          dispositivo e a opção <em>Ocultar valores de património</em> troca os montantes por marcadores.
        </P>
      </>
    ),
  },
  {
    slug: "meses",
    title: "Meses",
    group: "Áreas da aplicação",
    keywords: ["criar mês", "duplicar", "concluir", "editar"],
    body: (
      <>
        <P>A página <KBD>Meses</KBD> lista todos os meses registados, com o resumo de bruto, descontos, líquido e restante.</P>
        <UL>
          <li><strong>Criar</strong> — botão "Novo mês" no topo da página.</li>
          <li><strong>Editar</strong> — clicar numa linha abre o editor do vencimento, com um resumo da divisão e um botão para abrir a Divisão desse mês.</li>
          <li><strong>Duplicar</strong> — disponível no menu de ações de cada mês, copia rendimentos e divisão como ponto de partida para o mês seguinte.</li>
          <li><strong>Concluir/rever</strong> — a reconciliação do mês mostra o estado (zero, excedente ou défice) e, quando há excedente relevante, sugere uma distribuição editável antes de aplicar.</li>
        </UL>
      </>
    ),
  },
  {
    slug: "rendimentos-e-descontos",
    title: "Rendimentos e descontos",
    group: "Áreas da aplicação",
    keywords: ["salário bruto", "irs", "segurança social", "subsídio de refeição", "líquido"],
    body: (
      <>
        <P>Cada mês guarda os seguintes campos de rendimento:</P>
        <UL>
          <li><strong>Vencimento base</strong> (<code>base</code>)</li>
          <li><strong>Retribuição extraordinária</strong> (<code>extraordinaria</code>)</li>
          <li><strong>Outros rendimentos sujeitos a IRS e SS</strong> (<code>outrosIrsSs</code>)</li>
          <li><strong>Outros rendimentos sujeitos apenas a IRS</strong> (<code>outrosIrs</code>)</li>
          <li><strong>Rendimentos isentos</strong> (<code>isentos</code>)</li>
        </UL>
        <P>
          Os descontos (Segurança Social e IRS) podem ser calculados automaticamente a partir de taxas
          configuráveis, ou introduzidos manualmente quando o modo do mês é "manual". O subsídio de
          refeição é diário e pode, opcionalmente, contar para o valor disponível a dividir (configurável
          em Definições).
        </P>
      </>
    ),
  },
  {
    slug: "despesas-e-categorias",
    title: "Despesas e categorias",
    group: "Áreas da aplicação",
    keywords: ["categoria", "orçamento mensal", "essencial", "movimentos", "transação"],
    body: (
      <>
        <P>
          As categorias criam-se em <KBD>Definições</KBD> ou diretamente na página <KBD>Orçamento</KBD>,
          com nome, orçamento mensal e uma marcação de essencial/não essencial.
        </P>
        <P>
          Ao registar um movimento do tipo "Despesa" num mês, pode escolher uma categoria existente na
          lista ou escrever uma categoria livre. Categorias marcadas como essenciais entram no cálculo
          de despesa essencial média, usado no runway da reserva de emergência.
        </P>
      </>
    ),
  },
  {
    slug: "parcelas-e-metas",
    title: "Parcelas e metas",
    group: "Áreas da aplicação",
    keywords: ["alocação", "meta", "progresso", "previsão"],
    body: (
      <>
        <P>
          Cada parcela tem um tipo (gastos, poupança ou investimento), uma regra de alocação por defeito
          (valor fixo ou percentagem do disponível) e, opcionalmente, um valor-meta e uma data-alvo.
        </P>
        <P>
          O acumulado de uma parcela é a soma de tudo o que lhe foi alocado ao longo dos meses (histórico).
          Se definires um saldo inicial, passa a ser: saldo inicial + contribuições a partir do mês da data de
          referência (inclusive) + aportes e retiradas registados desde essa data + ajustes. Sem saldo inicial, o
          valor continua a ser exatamente o histórico. O progresso mostra a percentagem do acumulado em relação à
          meta definida. Os detalhes estão em &quot;Plataformas, distribuição e metas avançadas&quot;.
        </P>
      </>
    ),
  },
  {
    slug: "plataformas-e-metas-avancadas",
    title: "Plataformas, distribuição e metas avançadas",
    group: "Áreas da aplicação",
    keywords: ["plataforma", "distribuir", "ativos", "saldo inicial", "ajuste", "submeta", "moeda", "taxa", "despesas"],
    body: (
      <>
        <H3>Catálogo de plataformas e tipos</H3>
        <P>
          Em Definições, separador Catálogos crias, renomeias, arquivas e eliminas plataformas e tipos personalizados. Os nomes são
          únicos sem distinguir maiúsculas, acentos ou espaços a mais. Uma plataforma em uso só pode ser arquivada: continua
          no histórico mas deixa de aparecer em novas seleções. Os tipos personalizados herdam o comportamento base
          (gastos, poupança, investimento; despesa, entrada, transferência, ajuste), por isso os indicadores não mudam.
        </P>
        <H3>Assistente</H3>
        <P>
          O botão redondo no canto do ecrã abre o assistente. Escolhe uma tarefa e responde às perguntas: escreve valores como 1450 ou 12,99, e datas como 22/11 ou
          22/11/2026 (ou usa &quot;Hoje&quot; e &quot;Ontem&quot;). Antes de gravar mostra um cartão &quot;Vou registar…&quot; com o que vai acontecer; só grava quando carregas em
          Confirmar. Esc fecha o assistente. Se não o queres, desliga-o em Definições › Funcionalidades.
        </P>
        <H3>Assistente com IA (opcional)</H3>
        <P>
          Se o servidor tiver uma chave de API da Anthropic e ligares &quot;Assistente com IA&quot; em Definições › Funcionalidades, o assistente passa a ter uma caixa para escreveres frases
          como &quot;gastei 40 no supermercado ontem&quot;. A frase, a data de hoje e os nomes das categorias saem da app para a Anthropic; os teus valores e saldos nunca saem. A IA só preenche os
          campos: o cartão de confirmação é o mesmo e só grava quem confirma. Há um limite de 50 pedidos por dia. Como ativar: <KBD>docs/ASSISTENTE-IA.md</KBD>.
        </P>
        <H3>Dividir o salário pelas parcelas</H3>
        <P>
          No menu Divisão, o resumo mostra o disponível, uma barra com o peso de cada parcela e o que falta distribuir (a verde, &quot;Tudo distribuído&quot;).
          Cada parcela tem um interruptor &quot;entra neste mês&quot;: se ficar de fora, não conta, mas o valor fica guardado para quando voltar.
          Ajusta com − e + ou escrevendo, em € ou em %. &quot;Distribuir o que sobra&quot; mostra o resultado antes de aplicar (tudo para uma parcela ou proporcional).
        </P>
        <H3>Modelo para os meses novos</H3>
        <P>
          &quot;Guardar como modelo&quot; guarda, por parcela, se entra, o valor, as plataformas e os ativos do mês aberto. Um mês novo já nasce com o modelo aplicado;
          &quot;Aplicar modelo&quot; também o repõe num mês existente (pede confirmação se já tiver divisão). Um mês duplicado copia o mês de origem, não o modelo.
        </P>
        <H3>Detalhar por plataforma (mês)</H3>
        <P>
          Em cada parcela, &quot;Detalhar por plataforma&quot; (opcional) reparte o valor de uma parcela por
          plataformas, por valor (€) ou por percentagem, nunca os dois ao mesmo tempo. Sem linhas, o valor fica todo na
          parcela; uma distribuição parcial mostra o restante; exceder o total bloqueia a gravação. Em percentagem, os
          valores recalculam quando a parcela muda; em valor, reduzir a parcela abaixo da soma exige corrigir primeiro.
          Arredondamento em cêntimos por soma acumulada: distribuído + restante = total.
        </P>
        <H3>Distribuição por ativos</H3>
        <P>
          Dentro de cada plataforma distribuída podes listar ativos ou classes com nome, percentagem e nota. O valor é
          calculado sobre o montante da plataforma e não é editável. A soma não pode exceder 100%; o que falta fica por
          distribuir. Não há preço, quantidade nem cotação.
        </P>
        <H3>Meta, submetas, histórico e definições</H3>
        <P>Em Parcelas e metas, escolhe uma parcela na lista. O detalhe tem quatro separadores:</P>
        <UL>
          <li><strong>Meta:</strong> acumulado (o que puseste), meta e data alvo, progresso e de onde vem o total. Botões &quot;Registar entrada/saída&quot; e &quot;Registar valor de mercado&quot;.</li>
          <li><strong>Entrada/saída:</strong> dinheiro que entrou ou saiu fora da divisão dos meses; muda o acumulado. &quot;Corrigir total&quot; regista a diferença para o total que escreveres. &quot;Transferir&quot; passa dinheiro entre a meta principal e uma submeta (na mesma moeda) sem mudar o total.</li>
          <li><strong>Valor de mercado:</strong> quanto vale a parcela numa data (ex.: o saldo da corretora). Não muda o acumulado; mostra o ganho ou a perda face ao que puseste até essa data. Também aparece na Carteira.</li>
          <li><strong>Submetas:</strong> partes da parcela com saldo próprio, marcadas como Objetivo (ex.: Casa) ou Plataforma (ex.: XTB), com moeda, objetivo e prazo. As alocações dos meses ficam em &quot;não distribuído&quot; até as transferires. Aportes e retiradas das Despesas podem ser repartidos pelas submetas.</li>
          <li><strong>Moedas:</strong> numa submeta noutra moeda, a taxa (1 moeda = taxa × euros) aparece junto dela, com &quot;atualizar&quot;. Sem taxa, a submeta fica fora do total, que é marcado como incompleto.</li>
          <li><strong>Histórico:</strong> saldo inicial, entradas, saídas e valores de mercado da parcela, do mais recente para o mais antigo. O lápis edita valor, data e nota; o caixote remove.</li>
          <li><strong>Definições:</strong> nome, cor, tipo, regra de divisão, plataformas e saldo inicial (o que já lá tinhas antes de uma data: o mês dessa data e os seguintes contam como novos). Arquivar e Eliminar ficam aqui.</li>
        </UL>
        <P>Estas distribuições e saldos são planeamento: não criam movimentos nem posições na Carteira.</P>
        <H3>Despesas por mês e dia</H3>
        <P>
          O menu Despesas mostra os movimentos do mês agrupados por dia, com totais diários e do mês. É a mesma lista dos
          Meses: editar numa vista atualiza a outra. Mudar a data move o registo para o mês correto (o mês tem de existir).
          O total inclui despesas e retiradas e exclui transferências e aportes. Reembolsos não são compensados automaticamente.
        </P>
      </>
    ),
  },
  {
    slug: "orcamento-e-alertas",
    title: "Orçamento e alertas",
    group: "Áreas da aplicação",
    keywords: ["real", "desvio", "limite de alerta"],
    body: (
      <>
        <P>
          A tabela "Orçamento vs. real por categoria" compara o orçamento mensal definido em cada
          categoria com a soma real das despesas dessa categoria no período filtrado.
        </P>
        <UL>
          <li><strong>Orçamento</strong> — valor mensal definido na categoria.</li>
          <li><strong>Real</strong> — soma das despesas com essa categoria no período.</li>
          <li><strong>Desvio</strong> — real menos orçamento, em euros e em percentagem.</li>
          <li><strong>Alerta</strong> — assinalado quando o desvio percentual atinge ou excede o limite configurado (10% por defeito).</li>
        </UL>
        <P>Para investigar um desvio, use o drill-down do Painel a partir do KPI de Gastos ou de uma parcela.</P>
        <H3>Comparação mensal e anual</H3>
        <P>
          Em baixo, o Orçamento mostra a despesa por categoria contra os mesmos meses do ano que escolheres (com a variação em euros e em
          percentagem), com a escolha do Painel. As categorias que fugiram ao habitual ficam na página Despesas.
        </P>
      </>
    ),
  },
  {
    slug: "fecho-e-planeamento",
    title: "Fecho e planeamento",
    group: "Áreas da aplicação",
    keywords: ["fecho", "transporte", "recorrências", "reservas", "simulador", "csv", "verificar dados"],
    body: (
      <>
        <P>O menu "Fecho e planeamento" reúne o fecho mensal, as recorrências e reservas, o simulador de metas e a composição dos totais.</P>
        <H3>Fecho mensal</H3>
        <OL>
          <li>Reveja rendimentos, despesas, distribuições e pendências.</li>
          <li>Se sobrar dinheiro, decide o destino do restante: transportar para o mês seguinte (já vem escolhido, desde que o mês seguinte exista e esteja aberto), reforçar uma parcela/meta ou manter como não atribuído. Sem restante, ou com o mês em défice, fecha-se sem escolher nada.</li>
          <li>Feche o mês. Um mês fechado recusa alterações financeiras; reabra-o indicando o motivo.</li>
        </OL>
        <P>O transporte aparece no mês seguinte como "Transporte" e nunca conta como rendimento, mas entra no que há por distribuir: a Divisão mostra-o e inclui-o no disponível e no "Por distribuir". Também podes fechar o mês com o assistente ("Fechar o mês").</P>
        <H3>Recorrências e reservas</H3>
        <UL>
          <li>As recorrências criam ocorrências pendentes: confirmar cria a despesa uma única vez; ignorar retira-a.</li>
          <li>Uma reserva não é uma despesa paga. A sugestão mensal considera o já reservado e os meses até ao prazo.</li>
        </UL>
        <H3>Simulador e composição</H3>
        <P>O simulador usa contribuição mensal, reforço, pausa e prazo, sem rentabilidade, e não altera dados. A composição mostra de onde vem cada acumulado, com os registos de origem.</P>
        <H3>Verificar dados e importar CSV</H3>
        <P>Em Definições, separador Backups e importação, "Verificar dados" aponta erros e avisos sem corrigir nada sozinho. "Importar CSV" faz pré-visualização com erros por linha e duplicados antes de confirmar.</P>
        <H3>Ocultar montantes</H3>
        <P>O ícone do olho desfoca os montantes no ecrã. Não é controlo de acesso.</P>
      </>
    ),
  },
  {
    slug: "usar-no-telemovel",
    title: "Usar no telemóvel",
    group: "Telemóvel e offline",
    keywords: ["iphone", "android", "barra inferior", "dividir valores", "toque", "ecrã pequeno"],
    body: (
      <>
        <P>No telemóvel, a navegação principal fica numa barra no fundo do ecrã, ao alcance do polegar.</P>
        <H3>Barra inferior</H3>
        <UL>
          <li><KBD>Painel</KBD>, <KBD>Meses</KBD>, <KBD>Divisão</KBD> e <KBD>Despesas</KBD> abrem diretamente a área correspondente; o separador ativo fica destacado.</li>
          <li><KBD>Mais</KBD> abre as restantes áreas: Fecho e planeamento, Parcelas e metas, Carteira, Orçamento, Definições e esta ajuda.</li>
          <li>Um ponto de aviso aparece em <KBD>Mais</KBD> quando existem alterações guardadas só neste dispositivo, ou um conflito para rever.</li>
          <li>A barra esconde-se enquanto o teclado está aberto, para não tapar o campo que estás a editar.</li>
        </UL>
        <H3>Dividir valores por mês</H3>
        <OL>
          <li>Em <KBD>Meses</KBD>, toca em <KBD>Dividir valores</KBD> no cartão do mês.</li>
          <li>A janela abre diretamente na divisão, em ecrã inteiro. O resumo de disponível, alocado e restante fica sempre visível.</li>
          <li>Cada parcela é um cartão com o nome completo, o modo (valor fixo, percentagem ou restante), o valor e o montante calculado.</li>
          <li>Os valores da divisão são guardados ao sair de cada campo. A distribuição por plataformas e ativos está no mesmo cartão.</li>
          <li>Toca em <KBD>Concluir</KBD> para fechar. Um mês fechado não aceita alterações até ser reaberto.</li>
        </OL>
        <H3>Gráficos</H3>
        <P>Toca num ponto do gráfico para ver os valores desse mês. No computador, basta passar o rato.</P>
        <H3>Tablet, campos e layouts</H3>
        <P>Os formulários adaptam as colunas ao espaço disponível no próprio cartão. Janelas e painéis respeitam a largura e a altura do ecrã; tabelas financeiras largas podem ter deslocação horizontal dentro da tabela, sem alargar a página.</P>
        <P>A navegação lateral persistente aparece a partir de 1024 px de largura do ecrã. Os cartões personalizados empilham abaixo de 900 px de largura útil, sem alterar automaticamente as posições guardadas para computador. Guardar um layout no modo compacto continua a aplicar esse layout globalmente, conforme o aviso no editor.</P>
        <P>Para mudar a disposição, usa o botão Editar layout (ícone de grelha) no cabeçalho, junto de mostrar valores e do tema. Existe no Painel, na Carteira e no Orçamento; cada cartão, incluindo os indicadores de topo, move-se e redimensiona-se sozinho.</P>
      </>
    ),
  },
  {
    slug: "modo-offline",
    title: "Modo offline e instalação",
    group: "Telemóvel e offline",
    keywords: ["sem internet", "pwa", "ecrã principal", "instalar", "preparar dispositivo", "cifrado", "código"],
    body: (
      <>
        <P>Depois de preparado, o dispositivo permite consultar e editar os dados mesmo sem ligação.</P>
        <H3>Preparar o dispositivo</H3>
        <OL>
          <li>Abre a aplicação no teu endereço HTTPS próprio (a pré-visualização incorporada pode bloquear o armazenamento offline).</li>
          <li>Em <KBD>Definições</KBD>, define um código de acesso com pelo menos 8 caracteres e volta a entrar.</li>
          <li>Em <KBD>Definições</KBD>, separador <KBD>Segurança</KBD>, na secção <KBD>Aplicação no telemóvel e offline</KBD>, toca em <KBD>Preparar este dispositivo</KBD>.</li>
          <li>No menu do navegador, escolhe <KBD>Adicionar ao ecrã principal</KBD> para a abrir como uma aplicação.</li>
        </OL>
        <P>Não prepares dispositivos partilhados. A cópia local fica cifrada e o código é pedido ao abrir uma nova sessão.</P>
        <H3>O que funciona sem internet</H3>
        <UL>
          <li>Consultar os dados já descarregados e as vistas calculadas a partir deles.</li>
          <li>Editar vencimentos e divisões de meses abertos, incluindo plataformas e ativos.</li>
          <li>Registar despesas.</li>
        </UL>
        <H3>O que exige ligação</H3>
        <UL>
          <li>Criar, duplicar ou eliminar meses; fechar ou reabrir meses.</li>
          <li>Aplicar regras em massa, alterar catálogos, importar ficheiros e verificar dados no servidor.</li>
          <li>Outros tipos de movimento e a edição de movimentos existentes.</li>
        </UL>
        <P>O navegador pode apagar o armazenamento local. Continua a exportar backups JSON regularmente.</P>
      </>
    ),
  },
  {
    slug: "sincronizacao-e-conflitos",
    title: "Sincronização e conflitos",
    group: "Telemóvel e offline",
    keywords: ["sincronizar", "conflito", "rever conflito", "fila", "duplicado", "alterações por sincronizar"],
    body: (
      <>
        <P>As alterações feitas neste dispositivo ficam primeiro numa fila local cifrada e são enviadas ao servidor quando a ligação regressa.</P>
        <UL>
          <li>A sincronização corre sozinha ao voltar a ter internet ou ao regressar à aplicação. Também podes tocar em <KBD>Sincronizar agora</KBD>.</li>
          <li>Cada lote é aplicado por inteiro ou não é aplicado. Repetir o envio não duplica despesas.</li>
          <li>Se os dados do servidor mudaram entretanto, a sincronização pára e nada é perdido: as tuas alterações continuam guardadas no dispositivo.</li>
        </UL>
        <H3>Rever um conflito</H3>
        <OL>
          <li>Toca em <KBD>Rever conflito</KBD> para comparar o valor do servidor com a tua alteração local.</li>
          <li>Se quiseres, usa <KBD>Exportar cópia</KBD> antes de decidir.</li>
          <li>Toca em <KBD>Aplicar valores locais listados</KBD> para reaplicar só os campos mostrados; as restantes alterações do servidor mantêm-se.</li>
          <li>Com <KBD>Cancelar</KBD>, nada é alterado. Meses entretanto fechados continuam protegidos.</li>
        </OL>
      </>
    ),
  },
  {
    slug: "formulas-e-calculos",
    title: "Fórmulas e cálculos",
    group: "Referência",
    keywords: ["fórmula", "cálculo", "runway", "taxa de poupança", "carga fiscal"],
    body: (
      <>
        <P>Estas são as fórmulas efetivamente usadas pela aplicação (correspondem a <code>shared/calc.ts</code>).</P>
        <H3>Rendimento bruto</H3>
        <CODE>{`brutoMes = base + extraordinaria + outrosIrsSs + outrosIrs + isentos`}</CODE>
        <H3>Descontos (modo automático)</H3>
        <CODE>{`ss = (base + outrosIrsSs) × taxaSs
irs = (base + outrosIrs) × taxaIrsBase + outrosIrsSs × taxaIrsExtra
descontos = ss + irs`}</CODE>
        <P>No modo "manual", o valor de descontos é introduzido diretamente e substitui este cálculo.</P>
        <H3>Vencimento líquido</H3>
        <CODE>{`liquido = bruto - descontos - (outrosIrs, se "excluir outros IRS do líquido" estiver ativo)`}</CODE>
        <H3>Valor disponível para dividir</H3>
        <CODE>{`disponivel = liquido + subsidioRefeicao  (só se "incluir subsídio" estiver ativo)`}</CODE>
        <H3>Por alocar (reconciliação do mês)</H3>
        <CODE>{`despesasTotais = soma(movimentos do tipo "despesa" e "retirada")
alocacoesTotais = soma(alocações fixo/percentagem) + soma(movimentos do tipo "aporte")
porAlocar = disponivel - despesasTotais - alocacoesTotais`}</CODE>
        <P>Transferências entre parcelas não contam para despesas nem para alocações — apenas movem saldo entre parcelas.</P>
        <H3>Taxa de poupança</H3>
        <CODE>{`taxaPoupanca = (alocado a poupança + alocado a investimento) / disponivel`}</CODE>
        <H3>Carga fiscal efetiva</H3>
        <CODE>{`cargaFiscalEfetiva = descontosTotais / brutoTotal`}</CODE>
        <H3>Despesa essencial média e runway</H3>
        <CODE>{`mediaDespesasEssenciais = soma(despesas essenciais nos últimos N meses) / N
runwayMeses = saldoReservaElegivel / mediaDespesasEssenciais`}</CODE>
        <P>N é a janela configurável (3, 6 ou 12 meses) e o saldo elegível é a soma das parcelas marcadas como reserva de emergência.</P>
        <H3>Meses incompletos</H3>
        <P>
          Um mês sem nenhum valor de rendimento preenchido entra nos totais com zero, mas continua a
          contar para a média a menos que seja excluído do filtro de período.
        </P>
      </>
    ),
  },
  {
    slug: "dados-e-backups",
    title: "Definições (dados e backups)",
    group: "Referência",
    keywords: ["exportar", "importar", "restaurar", "validar", "json", "excel"],
    body: (
      <>
        <P>Na página <KBD>Definições</KBD>:</P>
        <UL>
          <li><strong>Exportar JSON</strong> — cópia completa e fiel de todos os dados, usada para restauro integral.</li>
          <li><strong>Exportar Excel</strong> — mesma informação em formato de folha de cálculo, organizada por ano, mais uma folha de parcelas.</li>
          <li><strong>Importar/Restaurar</strong> — carrega um ficheiro JSON exportado anteriormente e substitui os dados atuais após confirmação.</li>
          <li><strong>Validar</strong> — verifica a estrutura de um ficheiro antes de restaurar, sem alterar dados.</li>
        </UL>
        <P>
          Recomenda-se exportar um backup JSON após alterações relevantes e sempre antes de importar
          dados novos. Guarde as exportações num local privado e protegido — o ficheiro contém todos os
          seus dados financeiros em texto simples.
        </P>
      </>
    ),
  },
  {
    slug: "privacidade-e-seguranca",
    title: "Privacidade e segurança",
    group: "Referência",
    keywords: ["código de acesso", "sessão", "segurança"],
    body: (
      <>
        <P>
          A aplicação é um espaço privado: os dados residem apenas nesta instância e não são partilhados
          com terceiros pela aplicação.
        </P>
        <UL>
          <li>O código de acesso protege a entrada na sessão da aplicação, mas <strong>não substitui backups independentes</strong> — não há recuperação de código esquecido sem acesso à página de Definições já autenticada.</li>
          <li>O código é pedido sempre que a aplicação é aberta; pode ser alterado em <KBD>Definições, separador Backups e importação</KBD>.</li>
          <li>Esta documentação nunca inclui códigos de acesso, valores pessoais, exemplos reais ou dados importados.</li>
          <li>Guarde exportações de backup apenas em locais privados e protegidos (não em partilhas públicas ou email não encriptado).</li>
        </UL>
      </>
    ),
  },
  {
    slug: "perguntas-frequentes",
    title: "Perguntas frequentes",
    group: "Referência",
    keywords: ["faq", "dúvidas", "erro"],
    body: (
      <>
        <H3>O valor "por alocar" está negativo. O que significa?</H3>
        <P>Foi gasto ou alocado mais do que o valor disponível nesse mês. Reveja as despesas e alocações do mês em causa, ou ajuste a divisão.</P>
        <H3>Porque é que a taxa de poupança pode passar de 100%?</H3>
        <P>Acontece quando o valor alocado a poupança/investimento no período excede o disponível desse período — normalmente por transferências de saldo acumulado de meses anteriores.</P>
        <H3>Os meses antigos não têm movimentos individuais no drill-down. É um erro?</H3>
        <P>Não. Meses criados antes da funcionalidade de movimentos individuais continuam representados apenas por alocações agregadas por parcela, sem detalhe de transação — por desenho, para não alterar dados históricos retroativamente.</P>
        <H3>Como corrijo um valor de um mês passado?</H3>
        <P>Abra o mês em <KBD>Meses</KBD> e edite os campos de vencimento, divisão ou movimentos diretamente. Não há bloqueio de edição de meses passados.</P>
      </>
    ),
  },
  {
    slug: "glossario",
    title: "Glossário",
    group: "Referência",
    keywords: ["definições", "termos"],
    body: (
      <>
        <UL>
          <li><strong>Líquido disponível</strong> — vencimento líquido, mais subsídio de refeição se configurado para contar.</li>
          <li><strong>Por alocar</strong> — parte do disponível que ainda não foi gasta nem alocada a nenhuma parcela nesse mês; pode ser negativo.</li>
          <li><strong>Alocação</strong> — regra que define quanto de cada mês vai para uma parcela, em valor fixo ou percentagem do disponível.</li>
          <li><strong>Parcela</strong> — destino do dinheiro (ex.: Fundos de Emergência, ETFs); tem um tipo (gastos/poupança/investimento) e pode ter uma meta.</li>
          <li><strong>Despesa essencial</strong> — despesa cuja categoria está marcada como essencial em Definições; usada no cálculo de runway.</li>
          <li><strong>Taxa de poupança</strong> — percentagem do disponível que foi alocada a poupança ou investimento.</li>
          <li><strong>Runway</strong> — número de meses que o saldo da reserva de emergência cobriria, ao ritmo médio de despesas essenciais.</li>
        </UL>
      </>
    ),
  },
  {
    slug: "notas-de-versao",
    title: "Notas de versão",
    group: "Referência",
    keywords: ["changelog", "versão", "novidades"],
    body: (
      <>
        <H3>1.36.0</H3>
        <UL>
          <li>Em Organizar › Movimentos vês todos os movimentos de todos os meses, filtras por mês, categoria, parcela e tipo e pesquisas por nota, categoria ou valor.</li>
          <li>Podes escolher vários movimentos (ou todos) e, de uma vez, mudar a categoria, mudar a parcela ou eliminá-los. É tudo ou nada: se algum estiver num mês fechado, nenhum muda. Só funciona com ligação.</li>
        </UL>
        <H3>1.35.1</H3>
        <UL>
          <li>Sem ligação, uma despesa com data num mês que não existe ou está fechado é recusada logo, com uma explicação, em vez de bloquear a sincronização.</li>
          <li>Com percentagens, o fecho do mês já não mostra um défice de 0,01 € que não existia, e os valores arredondam-se sempre da mesma maneira.</li>
          <li>Ao restaurar um backup, a app confirma os valores (taxas, limites, movimentos) como nos ecrãs normais. Um ficheiro editado à mão com valores impossíveis é recusado e nada muda.</li>
          <li>Não se elimina uma categoria que já tem movimentos: arquiva-se.</li>
          <li>O histórico de alterações das metas e submetas passa a mostrar o que mudou ao editar e eliminar.</li>
          <li>Correções de segurança no servidor: depois de várias tentativas falhadas, o acesso fica bloqueado alguns minutos mesmo com o código certo (antes ainda dava para ir adivinhando). A cópia diária para a Cloudflare deixa de falhar quando alguém esgota o limite.</li>
        </UL>
        <H3>1.35.0</H3>
        <UL>
          <li>Em Organizar, as parcelas e metas têm agora a mesma lista das categorias e plataformas: procurar, criar, renomear, arquivar e eliminar. Só se elimina o que não tem movimentos, recorrências nem reservas; o resto arquiva-se. Para mexer em valores e metas há uma ligação para o ecrã completo.</li>
        </UL>
        <H3>1.34.1</H3>
        <UL>
          <li>Restaurar um backup já não apaga o modelo de divisão (plataformas e ativos de cada parcela).</li>
          <li>Duplicar um mês mantém fora do mês as parcelas que estavam fora no original.</li>
          <li>Alterações feitas sem ligação passam a ser validadas como online; a opção &quot;parcela fora deste mês&quot; também é guardada.</li>
        </UL>
        <H3>1.34.0</H3>
        <UL>
          <li>Nos gráficos, podes carregar num item da legenda para esconder ou mostrar essa série. A última série visível fica sempre.</li>
          <li>Novo menu &quot;Organizar&quot; (em Mais): resume as parcelas e metas, as categorias, as plataformas e os movimentos. Em Categorias e Plataformas podes procurar, criar, renomear, arquivar e eliminar. Só se elimina o que não está em uso; o resto arquiva-se.</li>
        </UL>
        <H3>1.33.0</H3>
        <UL>
          <li>No modo Básico, o Início também deixa editar o layout (botão com os quatro quadrados, no topo). Podes mover e redimensionar os cartões e o layout fica guardado.</li>
          <li>Os dois cartões de cima do Início Básico têm sempre a mesma altura, mesmo sem despesas.</li>
        </UL>
        <H3>1.32.2</H3>
        <UL>
          <li>Os cartões dos vários menus ficaram alinhados e com o mesmo aspeto: no Plano do mês, em Parcelas e metas, em Definições e no Orçamento.</li>
          <li>Em Recorrências e reservas, cada campo tem agora o seu nome por cima.</li>
        </UL>
        <H3>1.32.1</H3>
        <UL>
          <li>No Início (modo Detalhado), o cartão do resumo do mês passa a acabar na mesma linha que os cartões pequenos da direita, mesmo com um layout guardado.</li>
        </UL>
        <H3>1.32.0</H3>
        <UL>
          <li>No modo Básico, o Início mostra o valor disponível ao lado de para onde vai o dinheiro (com um anel por categoria), três números do dia a dia (quanto gastaste, quanto podes gastar por dia e a última despesa) e as últimas despesas.</li>
          <li>O cartão de Metas, no modo Detalhado, põe em destaque a meta que mais precisa de atenção, com as submetas, e mostra as outras metas em anéis com o estado de cada uma.</li>
        </UL>
        <H3>1.31.0</H3>
        <UL>
          <li>O Plano do mês ficou mais claro: os 3 passos (Quanto entra, Para onde vai, Fechar o mês) estão numa coluna à esquerda e o que escolhes abre à direita. As outras ferramentas (Gastos do mês, Parcelas e metas, Recorrências e reservas, Simulador de metas, Composição dos totais) estão por baixo.</li>
          <li>Em &quot;Quanto entra&quot; vês o total para repartir, o salário do mês e quanto foi transportado do mês anterior.</li>
          <li>Em &quot;Fechar o mês&quot; há primeiro uma lista do que falta para fechar.</li>
        </UL>
        <H3>1.30.0</H3>
        <UL>
          <li>Dividir passou a chamar-se Plano do mês. O ecrã ficou mais leve, com os 3 passos num só cartão e mais espaço entre os blocos.</li>
          <li>No Início (modo Detalhado), o resumo do mês e os cartões pequenos ficam lado a lado, alinhados na mesma grelha.</li>
          <li>Na barra lateral, &quot;Mais&quot; é agora um botão que mostra e esconde as outras opções. Abre sozinho quando estás numa delas e lembra a tua escolha.</li>
          <li>Ao registar uma despesa, se a categoria ainda não existir, podes criá-la ali mesmo em &quot;+ Criar categoria…&quot;.</li>
        </UL>
        <H3>1.29.0</H3>
        <UL>
          <li>Acessibilidade: a app diz melhor o que cada controlo faz a quem usa leitor de ecrã, tem um botão &quot;Saltar para o conteúdo&quot; no primeiro Tab e respeita o pedido de movimento reduzido do sistema.</li>
        </UL>
        <H3>1.28.0</H3>
        <UL>
          <li>Visual novo em todas as páginas: cabeçalho em faixa suave e cartões mais redondos. No modo Básico, Despesas, Orçamento, Carteira e Definições mostram só o essencial; o Detalhado mostra tudo.</li>
        </UL>
        <H3>1.27.0</H3>
        <UL>
          <li>O Plano do mês (antes Dividir) juntou a divisão do salário, as parcelas e metas e o fecho do mês, com um cartão de 3 passos (salário, repartir, fechar) que mostra onde estás. No modo Básico vês o passo em curso; no Detalhado, todos os separadores. As ligações antigas continuam a funcionar.</li>
        </UL>
        <H3>1.26.0</H3>
        <UL>
          <li>O Painel passou a Início: abre com o valor disponível este mês (gastos planeados menos despesas registadas, e muda para &quot;Gasto acima do planeado&quot; se o ultrapassares) e para onde vai o dinheiro. No modo Básico vês só isto; no Detalhado, também os gráficos de sempre. Ao registar uma despesa escolhes a parcela (por defeito, a de gastos).</li>
        </UL>
        <H3>1.25.0</H3>
        <UL>
          <li>Menu mais simples: Início, Plano do mês e Meses à vista, e o resto em &quot;Mais&quot;. Há agora um botão &quot;Registar despesa&quot; sempre à mão, no fundo de cada página, no modo Básico. O modo (Básico ou Detalhado) escolhe-se em Definições › Funcionalidades; quem já usa a app fica no Detalhado.</li>
        </UL>
        <H3>1.24.0</H3>
        <UL>
          <li>Nova secção Definições › Aparência: escolhe a cor da app (Céu, Sálvia, Pêssego, Lavanda ou Maré) e o modo claro, escuro ou automático. A escolha fica guardada na tua conta. Valores e percentagens a subir ou a descer aparecem a verde, âmbar ou vermelho. A app tem agora uma letra nova, mais redonda.</li>
        </UL>
        <H3>1.23.2</H3>
        <UL>
          <li>Mãozinha ao passar o rato por botões, separadores e interruptores. As barras de separadores já não se sobrepõem ao conteúdo ao descer e, no telemóvel, deslocam só na horizontal. A Divisão deixou de ter o resumo a tapar as parcelas no telemóvel.</li>
        </UL>
        <H3>1.23.1</H3>
        <UL>
          <li>Assistente com IA: também percebe &quot;fechar o mês&quot; (continua desligado até haver chave e ligares a opção).</li>
        </UL>
        <H3>1.23.0</H3>
        <UL>
          <li>Fecho do mês: se sobrar dinheiro, &quot;transportar para o mês seguinte&quot; já vem escolhido (se o mês seguinte existir e estiver aberto). Sem restante, ou em défice, fecha-se o mês sem escolher destino.</li>
          <li>Divisão: o transporte recebido do mês anterior conta no disponível e no &quot;Por distribuir&quot;, com uma nota a dizer quanto é.</li>
          <li>Assistente: nova tarefa &quot;Fechar o mês&quot;.</li>
        </UL>
        <H3>1.22.0</H3>
        <UL>
          <li>Assistente com IA para frases livres (&quot;gastei 40 no supermercado ontem&quot;): pronto mas desligado. Só aparece se o servidor tiver uma chave de API e ligares a opção em Definições › Funcionalidades. A IA só interpreta a frase (nunca vê os teus valores nem grava); tens sempre de confirmar. Limite de 50 pedidos por dia.</li>
        </UL>
        <H3>1.21.0</H3>
        <UL>
          <li>Assistente: um botão flutuante abre uma conversa passo a passo com quatro tarefas: registar o mês, registar uma despesa, distribuir o que sobra e ver como estás este mês. Mostra sempre o que vai gravar e só grava quando confirmas; &quot;Voltar atrás&quot; corrige a resposta anterior. Desliga-se em Definições › Funcionalidades › Assistente.</li>
        </UL>
        <H3>1.20.0</H3>
        <UL>
          <li>Arranque no primeiro uso: uma pergunta (&quot;O que queres acompanhar?&quot;) e a app liga só o que precisas, ou liga tudo. Quem já usava a app não o vê. Em Definições › Funcionalidades há &quot;Repetir o arranque&quot;.</li>
        </UL>
        <H3>1.19.0</H3>
        <UL>
          <li>Divisão renovada: resumo com barra e &quot;Por distribuir&quot;, interruptor &quot;entra neste mês&quot; por parcela, botões − e +, e &quot;Distribuir o que sobra&quot; com pré-visualização.</li>
          <li>Modelo por parcela (valor, plataformas e ativos) para os meses novos: &quot;Guardar como modelo&quot; e &quot;Aplicar modelo&quot; (antes chamavam-se regras).</li>
          <li>Detalhe por plataforma fechado por defeito, com &quot;Por detalhar&quot;.</li>
        </UL>
        <H3>1.18.0</H3>
        <UL>
          <li>Nova página Divisão: a divisão do salário por parcelas e os movimentos de cada mês passam para um menu próprio, com seletor de mês. O editor do mês fica só com o vencimento e mostra um resumo com um botão para abrir a Divisão. No telemóvel, a Carteira passa para &quot;Mais&quot;.</li>
        </UL>
        <H3>1.17.0</H3>
        <UL>
          <li>Novo separador Definições › Funcionalidades: liga ou desliga Divisão do salário, Movimentos, Parcelas e metas, Plataformas e carteira, IRS Jovem e Reconciliação. O que desligas some do menu, do mês e do Painel; os dados ficam guardados e voltam quando ligas de novo. Quem já usava a app continua com tudo ligado.</li>
        </UL>
        <H3>1.16.0</H3>
        <UL>
          <li>Separadores com linha verde em Definições, Fecho e planeamento, editor de Mês e parcelas. Em ecrãs pequenos deslocam na horizontal em vez de quebrar em duas linhas, e ficam fixos no topo em Definições e Fecho.</li>
        </UL>
        <H3>1.15.0</H3>
        <UL>
          <li>Bibliotecas principais atualizadas (React 19, Vite 8, Tailwind 4, Recharts 3, TypeScript 7). Sem alterações às fórmulas nem aos dados.</li>
        </UL>
        <H3>1.14.0</H3>
        <UL>
          <li>Parcelas e metas: lista à esquerda e o detalhe da parcela à direita, com separadores Meta, Submetas, Histórico e Definições.</li>
          <li>&quot;Registar entrada/saída&quot; muda o acumulado (também corrige o total ou transfere para uma submeta); &quot;Registar valor de mercado&quot; só mostra o ganho ou a perda.</li>
          <li>Taxas de câmbio junto de cada submeta noutra moeda. Campos de mês em português em todos os navegadores.</li>
          <li>&quot;Terminar sessão&quot; no menu; versão e último backup passaram para o topo desta página. O ano da comparação anual escolhe-se à mão.</li>
          <li>Cartões vazios ocupam menos espaço no Painel e no Orçamento.</li>
        </UL>
        <H3>1.13.0</H3>
        <UL>
          <li>Carteira: "Valor atual e rentabilidade". Escreves quanto vale cada parcela de poupança ou investimento e vês o ganho ou a perda face ao que lá puseste.</li>
          <li>Relatório anual em PDF (botão <KBD>Relatório</KBD>, em "O que incluir").</li>
          <li>Despesas: pesquisa em todos os meses e "Desfazer" depois de remover.</li>
          <li>Atalhos de teclado (<KBD>?</KBD> mostra a lista) e o estado do último backup no menu lateral.</li>
          <li>Layout: indicadores alinhados, valores com vírgula em Definições e menos espaço vazio. A oferta offline passou para Definições, separador Segurança.</li>
        </UL>
        <H3>1.12.7</H3>
        <UL>
          <li>Comparação mensal e anual: "Total alocado por parcela" passa a ser uma linha normal, com totais e variação, e as parcelas ficam por baixo como subindicadores.</li>
          <li>Campos de parcelas e do editor de mês com nome para leitores de ecrã. Sem alterações às fórmulas nem ao esquema de dados.</li>
        </UL>
        <H3>1.12.6</H3>
        <UL>
          <li>Metas sem saldo inicial: atribuir um aporte a uma submeta já não aumenta o total da meta.</li>
          <li>Editar um aporte ou retirada não pode deixá-lo abaixo do valor atribuído a submetas, nem mudar o seu tipo ou parcela enquanto houver atribuições.</li>
          <li>"Aplicar regras" é tudo ou nada. A verificação de consistência avisa quando a distribuição por plataformas passa o total da parcela.</li>
          <li>Com dois meses do mesmo ano e mês (ex.: "Dezembro" e "Dezembro (subsídio)"), as datas e as recorrências usam o mês aberto.</li>
        </UL>
        <H3>1.12.5</H3>
        <UL>
          <li>Carregamento inicial mais leve: o código da base de dados e da validação deixou de ir no pacote da interface.</li>
          <li>Limpeza interna (código e dependências sem uso) e documentação reorganizada. Sem alterações à interface, às fórmulas nem ao esquema de dados.</li>
        </UL>
        <H3>1.12.4</H3>
        <UL>
          <li>A aplicação passa a exigir Node 24 (antes aceitava Node 20): <code>engines</code>, tipos (<code>@types/node</code> 24) e instruções de instalação atualizados. Sem alterações à interface, às fórmulas nem ao esquema de dados.</li>
        </UL>
        <H3>1.12.3</H3>
        <UL>
          <li>Uma ação que falha (apagar, duplicar, aplicar sugestão) mostra sempre um aviso; se os dados não carregarem, aparece o erro com "Tentar de novo" em vez de ficar a carregar.</li>
          <li>Fechar o editor de mês com alterações por guardar pede confirmação; eliminar um movimento ou uma categoria também.</li>
          <li>Definições: um campo de taxa esvaziado ou sem alteração já não grava 0%.</li>
          <li>Acessibilidade: filtros de Tipo e Parcelas utilizáveis só com o teclado, campos do mês ligados aos rótulos, linhas de parcela do Painel acessíveis por teclado e melhor contraste nos avisos.</li>
          <li>Despesas e Fecho mensal explicam o que fazer quando ainda não há meses.</li>
        </UL>
        <H3>1.12.2</H3>
        <UL>
          <li>Segurança: o código de acesso é verificado antes de ler o corpo dos pedidos; limite de tentativas por IP (IPv6 por /64) e global; a verificação já não bloqueia o servidor.</li>
          <li>Quem já introduziu o código certo não fica trancado por tentativas falhadas de outros no mesmo IP.</li>
          <li>O servidor de desenvolvimento deixa de servir a base de dados e as cópias de segurança.</li>
        </UL>
        <H3>1.12.1</H3>
        <UL>
          <li>Um movimento com data num mês fechado já não é movido para esse mês: o servidor recusa e pede para o reabrir.</li>
          <li>Reconciliação: "Aplicar como lançamentos" usa uma data dentro do mês reconciliado, por isso o mês fecha a zero e o mês seguinte não é afetado.</li>
          <li>Não é possível eliminar uma parcela com alocação em meses fechados (arquiva-se); a divisão do excedente fecha a zero ao cêntimo.</li>
          <li>Categorias comparam-se sem maiúsculas; a projeção anual conta os meses do calendário; as datas de "hoje" usam o fuso local; na comparação com ano fixo, as categorias somam os mesmos meses que os totais.</li>
        </UL>
        <H3>1.12.0</H3>
        <UL>
          <li>Comparação mensal e anual: em <em>Comparar com ano</em> escolhes primeiro o ano e depois os meses; o ano de comparação só mostra os outros anos.</li>
          <li>Em <em>Comparar com mês</em> aparecem primeiro os meses de base (iniciais) e depois os de comparação (finais); a variação lê-se da base para a comparação.</li>
          <li>Removida a opção "ano anterior" do ano de comparação. Sem alterações às fórmulas financeiras nem ao esquema de dados.</li>
        </UL>
        <H3>1.11.0</H3>
        <UL>
          <li>Comparação mensal e anual: escolha do tipo de comparação, dos meses a comparar e do ano de comparação, com a escolha guardada e partilhada entre o Painel e o Orçamento.</li>
          <li>Novas métricas na comparação: rendimento bruto, descontos, carga fiscal efetiva e total por parcela.</li>
          <li>Relatório mensal: a descarga em Markdown foi removida; fica só o PDF.</li>
          <li>Sem alterações às fórmulas financeiras nem ao esquema de dados.</li>
        </UL>
        <H3>1.10.0</H3>
        <UL>
          <li>Ritmo das metas: aviso quando, ao ritmo atual, uma meta não chega ao objetivo na data alvo, com o que seria preciso poupar por mês.</li>
          <li>Comparação com o ano anterior no Painel e no Orçamento (por indicador e por categoria).</li>
          <li>Despesas fora do padrão: categorias do mês escolhido bem acima do habitual.</li>
          <li>Relatório mensal em PDF (deixa de haver descarga em Markdown).</li>
          <li>Rotas da API validadas com esquemas formais: pedidos com campos desconhecidos ou identificadores inválidos são recusados.</li>
          <li>Sem alterações às fórmulas financeiras ou ao esquema de dados.</li>
        </UL>
        <H3>1.9.1</H3>
        <UL>
          <li>Revisão responsiva de campos, formulários, cartões, gráficos, janelas e Ajuda em computador, tablet e telemóvel.</li>
          <li>Submetas no Painel com acumulado, objetivo, valor em falta e progresso; botão independente por meta, recolhido por omissão.</li>
          <li>Layouts personalizados empilhados em espaços compactos e geometria inválida normalizada para a grelha.</li>
          <li>Sem alterações às fórmulas financeiras ou ao esquema de dados. A versão não certifica todos os navegadores ou dispositivos físicos.</li>
        </UL>
        <H3>1.9.0</H3>
        <UL>
          <li>Interface adaptada a telemóvel, com barra de navegação inferior e divisão mensal em cartões.</li>
          <li>Modo offline opcional com cópia local cifrada, fila de alterações e revisão de conflitos.</li>
          <li>Corrigido o erro ao atualizar um mês aberto.</li>
        </UL>
        <H3>P3</H3>
        <UL>
          <li>Catálogo de plataformas e tipos personalizados; backup versão 3 com restauro atómico.</li>
          <li>Distribuição das parcelas mensais por plataformas e por ativos.</li>
          <li>Saldo inicial, ajustes, submetas e conversão manual de moedas.</li>
          <li>Menu Despesas por mês e dia.</li>
        </UL>
        <H3>P2</H3>
        <UL>
          <li>Filtros temporais consistentes entre Painel e Orçamento, com presets e comparação com o período anterior.</li>
          <li>Drill-down de KPIs e gráficos com edição e eliminação de movimentos.</li>
          <li>Relatório mensal arquivável em Markdown, com opção de ocultar valores.</li>
          <li>Centro de ajuda e documentação da aplicação.</li>
        </UL>
        <H3>P1</H3>
        <UL>
          <li>Orçamento por categoria, projeção de final de ano, reserva de emergência/runway e sugestão de distribuição do excedente.</li>
        </UL>
        <H3>P0</H3>
        <UL>
          <li>Base da aplicação: meses, rendimentos, descontos, parcelas, painel e carteira.</li>
        </UL>
      </>
    ),
  },
];

export const HELP_VERSION = APP_VERSION;
export const HELP_UPDATED_AT = "2026-11-21";
