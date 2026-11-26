# Retro — audit-servidor-worker

## Números por lente
- Correção: 4 achados -> 4 confirmados (3 com gravidade baixada: F4).
- Segurança: 5 achados -> 5 confirmados (F2, F8 baixados).
- Manutenção: 8 achados -> 8 confirmados (F3, F9 baixados).
- Fusões: 3 (F2, F5, F6). Refutados: 0 de 14.

## Falsos positivos recorrentes
Nenhum. A maioria dos descartes dos auditores era segurança «atrás do código» (rotas autenticadas), o que sugere acrescentar à rubrica de segurança: não reportar falta de validação em rotas que só o dono autenticado alcança, salvo se causar perda de dados.

## Itens corrigidos
(preencher no seguimento com `/studio:audit audit-servidor-worker`)
- F1, F3, F6, F7: por fazer.
