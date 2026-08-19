# Task System — Althos Harness

Sistema simples de arquivos markdown para tarefas que justificam planejamento explícito (múltiplos módulos, schema de banco, autorização, ou qualquer coisa onde vale a pena registrar o plano antes de implementar). Tarefas triviais (1 arquivo, comportamento óbvio) não precisam passar por aqui.

## Lifecycle

```
BACKLOG → ACTIVE → IMPLEMENTATION → VERIFICATION → REVIEW → COMPLETED
```

Com o estado **BLOCKED** disponível a qualquer momento (dependência externa, decisão humana pendente, invariant violado sem solução clara).

- **BACKLOG** (`.harness/tasks/backlog/`): tarefa identificada, ainda não iniciada.
- **ACTIVE** (`.harness/tasks/active/`): sendo planejada/implementada agora.
- **IMPLEMENTATION**: sub-estado de ACTIVE — código sendo escrito.
- **VERIFICATION**: sub-estado de ACTIVE — `scripts/verify.sh` rodando, testes sendo confirmados.
- **REVIEW**: sub-estado de ACTIVE — Reviewer Agent (ou o humano) avaliando o diff final.
- **BLOCKED** (`.harness/tasks/blocked/`): parada, com o motivo documentado no arquivo.
- **COMPLETED** (`.harness/tasks/completed/`): finalizada, arquivo movido pra cá com o resultado final preenchido.

## Como usar

1. Copie `.harness/tasks/templates/feature.md` para `.harness/tasks/backlog/<slug-da-tarefa>.md`.
2. Preencha os campos que já dá pra saber antes de começar (title, objective, context, scope).
3. Ao começar a trabalhar, mova o arquivo pra `active/` e complete o resto conforme avança.
4. Se travar, mova pra `blocked/` com o motivo em "risks" ou numa seção nova "Blocked reason".
5. Ao terminar, preencha "verification" com o resultado real (PASS/FAIL/NOT CONFIGURED por item) e mova pra `completed/`.

## Regra

Não mova uma tarefa para `completed/` sem a seção "verification" preenchida com resultado real. Um arquivo em `completed/` sem verificação documentada é pior que não ter task system — passa segurança falsa.
