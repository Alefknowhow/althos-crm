# Development Handoff

Arquivo principal de continuidade entre agentes (Claude Code, Codex, outros)
e entre sessões. Não depende do histórico de chat — tudo que um agente
precisa pra continuar de onde o anterior parou deve estar aqui, em
`CURRENT_TASK.md`, `DECISIONS.md` e `KNOWN_ISSUES.md`.

Duas partes:
- **Automatic Context**: gerada por `npm run handoff`
  (`scripts/generate-handoff.mjs`). Nunca edite esta seção à mão — ela é
  sobrescrita a cada execução do script, dentro dos marcadores HTML
  reservados logo abaixo do título "Automatic Context".
- **Agent Context**: escrita pelo agente. O script nunca toca aqui — só a
  seção Automatic Context é regenerada.

---

## Automatic Context

<!-- AUTO:BEGIN -->
**Generated At**: 2026-09-11T14:15:40.834Z
**Branch**: `master`
**Last Commit**: 34f9e52 docs(harness): atualiza CLAUDE.md e invariants com o estado real do repo (Alef Trentin, 2 minutes ago)

**Recent Commits**:
- 34f9e52 docs(harness): atualiza CLAUDE.md e invariants com o estado real do repo
- 77c1372 feat(cotacoes): mapa animado vira abertura única + mapa real de pins
- 2b81175 feat(cotacoes): mapa animado em Conteudo — aviao, rota e bandeiras
- 09b2659 refactor(whatsapp): remove barra lateral fixa, move itens para menu (...)
- 5e5acde fix(marketing): remove rotulos do grafico de Impressoes e CPM
- c55ec77 fix(marketing): inverte ordem das barras de custo por anuncio + rotulos so em topo/fundo
- 163b02e feat(marketing): ordena barras de "Custo por anuncio" por magnitude real + numeros visiveis em todos os graficos
- eb23fad refactor(voice): sidebar com 1 item só — demais seções viram abas do módulo
- 078b28b feat(voice): novo módulo Althos Voice — telefonia, SMS e Voice AI (Fases 1-6)
- 11c4535 fix(cotacoes): assinatura sempre puxa nome e foto do usuario logado

**Staged Files** (0):
_(nenhum)_

**Unstaged Changes** (3):
- M AGENTS.md
- M CLAUDE.md
- M package.json

**Untracked Files** (4):
- .ai/
- .claude/
- docs/handoffs/
- scripts/generate-handoff.mjs

**Staged Diff Summary**:
```
_(nenhuma alteração)_
```

**Unstaged Diff Summary**:
```
AGENTS.md    | 38 +++++++++++++++++++++++++++++++++++++-
 CLAUDE.md    |  4 +++-
 package.json |  3 ++-
 3 files changed, 42 insertions(+), 3 deletions(-)
```

**Verification Commands Available in This Repo**:
- `npm run lint` (disponível)
- `npx tsc --noEmit` (typecheck — sem script dedicado no package.json, convenção do projeto via AGENTS.md/CI)
- `npm test` (disponível)
- `npm run build` (disponível)
- `bash scripts/verify.sh` (pipeline completo — mesmo do CI)
<!-- AUTO:END -->

---

## Agent Context

### Previous Agent
Claude (Claude Code)

### Recommended Next Agent
Claude | Codex | Human | Other — qualquer um, o sistema é neutro por design.

### Task
Implementar o protocolo de handoff entre agentes (`.ai/` + `scripts/generate-handoff.mjs` + § 0 de `AGENTS.md`). Ver `.ai/DECISIONS.md` (2026-09-11).

### Summary
Criada a camada `.ai/` de continuidade entre agentes, complementar ao
`.harness/tasks/` já existente (que continua sendo o lugar pra planejar
tarefas grandes). `AGENTS.md` ganhou uma § 0 com o protocolo obrigatório
(ler antes de começar, atualizar antes de finalizar). `npm run handoff`
gera automaticamente a parte factual do handoff (git state) sem tocar na
parte semântica escrita pelo agente.

### Completed
- `.ai/PROJECT_CONTEXT.md`, `.ai/CURRENT_TASK.md`, `.ai/HANDOFF.md`, `.ai/DECISIONS.md`, `.ai/KNOWN_ISSUES.md` criados.
- `docs/handoffs/README.md` criado (arquivo histórico opcional/manual).
- `scripts/generate-handoff.mjs` criado e testado — gera a seção Automatic Context de `HANDOFF.md` sem tocar na seção Agent Context.
- `npm run handoff` adicionado ao `package.json`.
- `AGENTS.md` § 0 (Handoff Protocol) adicionada.
- `CLAUDE.md` atualizado com 2 referências curtas ao protocolo (Camada 1 + nota no topo) — sem duplicar conteúdo.
- Bug real encontrado e corrigido durante o teste: `.trim()` no helper `sh()` comia o espaço inicial da primeira linha de `git status --porcelain`, desalinhando o parse de status/nome de arquivo (ex.: "package.json" virava "ackage.json" e era classificado como staged em vez de unstaged). Corrigido com um helper separado (`shRaw`) que só remove newline final, nunca espaços à esquerda. Também corrigido um bug de auto-referência: o texto explicativo no topo de `HANDOFF.md` citava os marcadores `<!-- AUTO:BEGIN/END -->` como texto literal, e o script encontrava essa ocorrência (na prosa) em vez da seção real — reescrito pra não repetir os tokens literalmente fora da seção real.

### Pending
Nenhum item pendente desta tarefa — está concluída. (Ver "Known Problems" abaixo pra uma limitação consciente, não um pendente.)

### Current Implementation State
Sistema completo e funcional. `.ai/CURRENT_TASK.md` está deliberadamente no
estado "vazio" (Status: DONE, sem tarefa ativa) — é o estado correto entre
tarefas.

### Important Files
- `AGENTS.md` (§ 0 — protocolo)
- `.ai/HANDOFF.md` (este arquivo)
- `.ai/CURRENT_TASK.md`
- `scripts/generate-handoff.mjs`

### Architectural Decisions
Ver `.ai/DECISIONS.md` — "2026-09-11 — Protocolo de handoff entre agentes (.ai/)".

### Database Changes
Nenhuma.

### API Changes
Nenhuma. Nenhuma funcionalidade do CRM foi alterada — só ambiente/documentação de desenvolvimento.

### Environment / Config Changes
Nenhuma variável de ambiente nova.

### Tests Executed
`npx tsc --noEmit`, `npm test`, `npx eslint scripts/generate-handoff.mjs`, execução manual repetida de `npm run handoff` (incluindo o cenário que expôs os 2 bugs acima, corrigidos e re-testados).

### Test Results
- `npx tsc --noEmit`: PASS (nenhum erro)
- `npm test`: PASS (105/105, 16 arquivos)
- `npx eslint scripts/generate-handoff.mjs`: PASS com 7 warnings (complexidade da função + uso de `console.*` — aceitável em script CLI de dev, mesmo padrão de `scripts/install-deps.mjs`)
- `npm run build`: NOT EXECUTED (nenhum código de app/runtime foi tocado — só `.md`, um `.mjs` novo em `scripts/`, e uma linha nova em `package.json.scripts`; build não é necessário pra validar essa mudança)

### Known Problems
Nenhum novo. Ver `.ai/KNOWN_ISSUES.md` (vazio até agora).

### Risks
Baixo — mudança é só de ambiente de desenvolvimento/documentação, não toca em código do produto, schema, ou runtime.

### Do Not Change
- A separação Automatic Context / Agent Context em `HANDOFF.md` (marcadores `AUTO:BEGIN`/`AUTO:END`) — é o que permite regenerar sem perder contexto semântico. Não remova os marcadores nem escreva o texto exato deles fora da seção real (foi exatamente esse bug que corrigimos).
- `scripts/generate-handoff.mjs` não deve ganhar `git add`/`commit`/`push` automático — decisão deliberada (AGENTS.md § 8, política de confirmação humana).

### Recommended Next Steps
Nenhum obrigatório. Opcional: na próxima tarefa real, popular `.ai/CURRENT_TASK.md` no início e testar o ciclo completo (start → handoff intermediário → finish) num caso de uso real, não sintético.

### Continuation Instructions

```
Read AGENTS.md, .ai/PROJECT_CONTEXT.md, .ai/CURRENT_TASK.md and .ai/HANDOFF.md.

Inspect git status and the current diff before making changes.

Continue the current task from the Pending and Recommended Next Steps sections.

Do not redesign completed architecture unless you identify a concrete issue.
```
