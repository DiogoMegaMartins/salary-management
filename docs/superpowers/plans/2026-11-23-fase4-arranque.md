# Fase 4: arranque no primeiro uso — plano

> Execução direta. Spec: `docs/superpowers/specs/2026-11-23-meses-e-funcionalidades-design.md` (decisão 2) e imagem 1 do desenho validado.

**Objetivo:** quem abre a app pela primeira vez responde a uma pergunta ("O que queres acompanhar?") e a app liga só as funcionalidades certas. Pode repetir-se em Definições.

## Restrições globais
Quem já usa a app (tem meses) nunca vê o arranque. Tudo se muda depois em Definições › Funcionalidades. Node e Worker. Versão 1.20.0, CHANGELOG, Ajuda. Acessível (foco preso no diálogo, rótulos, teclado). Um commit por tema.

## Mapeamento (decisão minha, ver abaixo)
Sempre ligadas: Divisão e Movimentos. Reconciliação desligada (só em "Ligar tudo"). "Também invisto" liga Plataformas e carteira; "Tenho metas e poupanças" liga Parcelas e metas; "Tenho IRS Jovem" liga IRS Jovem. "Ligar tudo" liga todas.

## Foco da revisão
Base existente com meses → arranque já feito (não aparece); base nova → aparece; repetir em Definições pré-seleciona o estado atual; fechar sem escolher não é possível por engano (Esc não fecha); backups antigos sem o campo não reabrem o arranque.

## Tarefas
1. **Servidor:** coluna `settings.onboarding_done` (por defeito 0; ao migrar uma base com meses fica 1), validação `onboardingDone` (booleano), teste de API. E2E: `globalSetup` marca o arranque como feito.
2. **Regras puras** em `shared/features.ts`: `featuresFromProfile({ invest, goals, irsJovem })` e `profileFromFeatures(json)`; testes.
3. **Diálogo de arranque** (`client/src/components/onboarding.tsx`), montado depois do acesso; botão "Repetir arranque" em Funcionalidades; e2e.
4. **Fecho:** versão 1.20.0, CHANGELOG, Ajuda, suite completa, imagens reais, envio.
