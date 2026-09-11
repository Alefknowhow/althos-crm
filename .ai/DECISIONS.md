# Architectural Decisions

Registro de decisões arquiteturais **relevantes** — não trivial, não
reversível-sem-custo, ou algo que um agente futuro precisa saber "por quê"
antes de mexer. Não registre decisões óbvias ou já cobertas por
`.harness/invariants.md`/`AGENTS.md`.

Formato:

```
## YYYY-MM-DD — Nome da decisão

Context:
Decision:
Reason:
Impact:
```

---

## 2026-09-11 — Protocolo de handoff entre agentes (.ai/)

Context: o projeto já tinha `.harness/tasks/` (planejamento de tarefas
maiores, lifecycle backlog→completed) e `AGENTS.md`/`CLAUDE.md` (regras de
workflow), mas nada cobria a transição de estado *entre agentes/sessões*
sem depender do histórico de chat — um agente novo (Claude Code ou Codex)
não tinha como saber rapidamente "o que estava em andamento agora" sem
reconstruir contexto do zero.

Decision: criar `.ai/{PROJECT_CONTEXT,CURRENT_TASK,HANDOFF,DECISIONS,KNOWN_ISSUES}.md`
como camada de continuidade, complementar (não substituta) ao `.harness/tasks/`.
`CURRENT_TASK.md` é o ponteiro rápido pro "agora"; tarefas grandes continuam
sendo planejadas em `.harness/tasks/active/<slug>.md` com o template
existente. `HANDOFF.md` separa uma seção **Automatic Context** (gerada por
`scripts/generate-handoff.mjs`, nunca editada à mão) de uma seção **Agent
Context** (semântica, escrita pelo agente) — pra reduzir a manutenção manual
sem arriscar sobrescrever análise/decisões já registradas.

Reason: evitar retrabalho de discovery entre handoffs e reduzir o risco de
dois agentes pisarem no mesmo código sem saber. Optou-se por markdown puro
(sem banco/serviço externo) para manter zero dependência nova e ficar
versionado junto com o código no próprio commit.

Impact: `AGENTS.md` ganhou uma seção de protocolo obrigatório (ler antes de
começar, atualizar antes de finalizar/transferir). Nenhuma funcionalidade do
CRM foi alterada — é infraestrutura de desenvolvimento apenas.
