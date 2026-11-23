# Fase 3: divisão renovada — plano

> Execução direta (escolhida pelo utilizador). Spec: `docs/superpowers/specs/2026-11-23-divisao-renovada-design.md`. Assenta na fase 2 (página Divisão).

**Objetivo:** escolher parcelas por mês, divisão de relance e fácil, detalhe opcional por plataforma e ativo, e divisão-modelo para meses novos.

## Restrições globais
Cálculos de disponível/alocado/restante não mudam, exceto que uma parcela fora do mês conta 0. Node e Worker (`server/db.ts`). Backups antigos restauram com tudo incluído. Mês fechado só de leitura. Versão 1.19.0, CHANGELOG, Ajuda. Um commit por tema.

## Foco da revisão
Parcela fora do mês não entra em alocado, restante, reconciliação, execução nem verificação de dados; aplicar modelo num mês com dados pede confirmação; mês novo nasce com o modelo; backup antigo sem campos novos restaura; excluir não apaga valor nem detalhe.

## Tarefas
1. **`included`** em `allocations` e `default_included` em `parcels`; `allocationAmount` devolve 0 se `included === 0`; verificação de dados ignora o detalhe de plataformas de parcelas fora; `PUT /api/allocations` aceita `included`. Testes unitários (`tests/divisao-incluida.test.ts`).
2. **Modelo no servidor:** tabelas `rule_platforms` e `rule_assets`; `save-as-rules` grava entra/modo/valor + plataformas + ativos; `apply-rules` aplica tudo (e `included`); mês novo (`POST /api/months`) nasce com o modelo; backup/restauro incluem as tabelas. Testes de API.
3. **Divisão renovada (interface):** cartão de resumo com barra e "Por distribuir"/"Tudo distribuído"; linhas de parcela com interruptor "entra neste mês", −/+, € e % lado a lado; "Distribuir o que sobra" com pré-visualização; botões "Guardar como modelo"/"Aplicar modelo" com confirmação. e2e.
4. **Detalhe por plataforma e ativo** dentro de cada parcela, fechado por defeito ("Detalhar por plataforma"), com "Por detalhar". e2e.
5. **Fecho:** versão 1.19.0, CHANGELOG, Ajuda, suite completa, imagens reais.
