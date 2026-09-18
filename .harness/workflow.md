# Workflow — Issue → PR → Preview → Merge (Althos Harness)

Processo de engenharia oficial deste repositório, complementar a [`AGENTS.md`](../AGENTS.md) (contrato geral de agentes) e [`invariants.md`](./invariants.md) (regras invioláveis). Este arquivo é a fonte de verdade para **branch/commit/PR/review/deploy** — não duplique estas regras em outro lugar, referencie este arquivo.

> Nota histórica: antes deste workflow, trabalho de sessão (incluindo a fase 2/3 do repricing, ver `.ai/CURRENT_TASK.md`) foi feito direto em `master`. Isso deixou de ser o padrão a partir daqui — ver § 1.

---

## 0. Pipeline oficial

```
GitHub Issue
  → branch isolada
  → implementação
  → validações locais (scripts/verify.sh)
  → commits (Conventional Commits)
  → push da branch (nunca de master)
  → Pull Request (referenciando a Issue)
  → Codex Code Review automático
  → Vercel Preview
  → homologação humana
  → merge (autorizado pelo humano)
  → master
  → Vercel Production (auto-deploy)
```

| Papel | Responsabilidade |
|---|---|
| GitHub Issue | fonte da tarefa e dos critérios de aceite |
| Claude Code | implementador primário |
| Codex | revisor independente |
| Pull Request | gate de entrada para `master` |
| Vercel Preview | ambiente de homologação |
| Usuário/humano | aprovação final e autorização de merge |
| `master` | branch de produção — código aprovado para Production |
| Vercel Production | ambiente final dos usuários |

---

## 1. Production Safety

- `master` é a branch de produção deste repositório (não há `main` separada — `master` cumpre esse papel: ver `vercel.json`/CI, que já publicam a partir dela).
- **Nunca** usar `master` como branch normal de desenvolvimento a partir de agora, mesmo que sessões anteriores tenham feito isso.
- **Nunca** usar Production como ambiente primário de teste.
- **Nunca** fazer push direto para `master` durante desenvolvimento normal.
- **Nunca** fazer merge para `master` sem autorização explícita do usuário.
- **"Commit e push" não autoriza merge, push em `master`, nem deploy em Production.** Por padrão, "commit e push" significa: commit na branch de trabalho atual + push dessa branch.
- Nenhum agente pode interpretar "implementação concluída" como autorização para publicar.
- Silêncio do usuário não é aprovação.
- Vercel Preview é o ambiente de homologação antes do merge — ver § 8.

Isso formaliza (não substitui) o que já existia em `AGENTS.md § 8` sobre confirmação de push/deploy.

---

## 2. Issue-driven development

Issues do GitHub são a unidade preferencial de trabalho para features, bugs, melhorias, refatorações relevantes, performance, infraestrutura e segurança.

Quando o usuário disser **"Implemente a Issue #123 seguindo o Harness"**, isso é suficiente para iniciar o pipeline completo (§ 0). O agente deve:

1. Ler a Issue #123 por completo (via `gh issue view` ou equivalente).
2. Entender objetivo e critérios de aceite.
3. Seguir o Handoff Protocol de `AGENTS.md § 0` (ler `.ai/PROJECT_CONTEXT.md`, `.ai/CURRENT_TASK.md`, `.ai/HANDOFF.md`).
4. Confirmar estado atual do git (`git status`, `git branch --show-current`) — nunca presumir working tree limpo.
5. Garantir que não vai trabalhar direto em `master` (criar/trocar para branch — § 3).
6. Implementar.
7. Validar (§ 5).
8. Commitar (§ 4).
9. Push **somente da branch**.
10. Criar Pull Request relacionado à Issue (§ 6).
11. Atualizar `.ai/CURRENT_TASK.md`/`.ai/HANDOFF.md` quando aplicável.
12. **Não** fazer merge.

Não abrir nova Issue para ajustes pequenos que pertencem ao mesmo escopo de uma Issue já em andamento.

---

## 3. Branch strategy

Prefixos:

```
feat/<issue>-<descricao>
fix/<issue>-<descricao>
refactor/<issue>-<descricao>
perf/<issue>-<descricao>
chore/<descricao>
hotfix/<descricao>
```

Exemplos: `feat/247-sales-coach`, `fix/301-pipeline-owner-filter`, `perf/352-conversations-query`.

Incluir o número da Issue na branch sempre que ela existir.

Antes de criar a branch:
- verificar branch atual (`git branch --show-current`);
- verificar alterações não commitadas (`git status`) — nunca descartar trabalho existente sem confirmar com o usuário (ver regra geral de segurança do harness do agente);
- criar a branch a partir de `master` atualizada, salvo instrução contrária.

Nunca usar force push como procedimento normal (só com autorização explícita e nunca em `master`).

---

## 4. Commits

Conventional Commits. Exemplos:

```
feat(conversations): add unified inbox
fix(pipeline): refresh cards after owner change
refactor(ai): isolate provider adapters
perf(dashboard): reduce redundant queries
chore(deps): update dependencies
test(auth): add organization isolation coverage
```

Evitar mensagens vagas ("fix", "update", "ajustes", "teste", "mudanças"). Preferir commits pequenos, coerentes e reversíveis.

---

## 5. Validation gate (antes de abrir o PR)

Rodar as validações reais do projeto (confirmar comandos em `package.json`, não inventar):

- `npx tsc --noEmit`
- `npm run lint`
- `npm test`
- `npm run build` (quando a mudança justificar — sempre antes do PR final)
- `bash scripts/verify.sh` cobre os itens acima na mesma ordem do CI (ver `.github/workflows/ci.yml`) — preferir rodar ele sozinho quando o ambiente permitir.

Não usar sem justificativa registrada: `@ts-ignore`, `eslint-disable`, `any`, suppressions, casts inseguros, remoção/alteração artificial de teste só para passar.

Se uma validação não puder rodar no ambiente atual, registrar explicitamente: qual, por quê, impacto, o que ainda precisa ser validado manualmente (não fingir sucesso — mesma regra de `scripts/verify.sh`, que reporta `NOT CONFIGURED` em vez de mascarar).

---

## 6. Pull Request

Toda implementação relevante chega a `master` via PR. Conteúdo do PR, quando aplicável:

- Issue relacionada (`Closes #<issue>` quando apropriado);
- objetivo;
- resumo da implementação;
- principais módulos/arquivos alterados;
- decisões técnicas relevantes;
- testes executados e resultado;
- migrations (se houver — sinalizar se são destrutivas);
- novas variáveis de ambiente;
- alterações de configuração;
- riscos conhecidos;
- pendências;
- instruções de homologação (passo a passo objetivo — ver exemplo em § 11).

Claude Code **não faz merge automaticamente**, nunca.

---

## 7. Codex Code Review

Este repositório usa Codex Code Review automático em Pull Requests.

- **Claude Code = implementador.** **Codex = revisor independente.**
- O implementador nunca considera a própria implementação aprovada só porque compilou, passou no lint, nos testes, ou buildou — isso é o piso, não a aprovação.
- O Code Review é uma camada adicional de segurança, não uma formalidade.

Ver checklist completo de revisão em [`.harness/agents/reviewer.md`](./agents/reviewer.md) § Code Review Rules — o mesmo padrão vale para Codex e para o Reviewer Agent interno do Harness.

### Severidade

| Nível | Significado |
|---|---|
| BLOCKER | não pode chegar a Production |
| HIGH | deve ser corrigido antes do merge |
| MEDIUM | relevante, deve ser avaliado/corrigido |
| LOW | melhoria não bloqueante |

Tratar como BLOCKER/HIGH (dependendo do impacto real): vazamento cross-tenant, bypass de autorização, perda/corrupção de dados, secret exposto, migration destrutiva inesperada, quebra crítica de fluxo, vulnerabilidade séria — qualquer um desses é, por padrão, violação de um `[ENFORCED]` em `invariants.md`.

### Codex Review → Claude correction

Quando o usuário disser **"Leia o review do Codex no PR #XYZ e corrija os findings seguindo o Harness"**:

1. Permanecer na mesma branch.
2. Ler o review completo.
3. Validar cada finding contra o código real (não corrigir cegamente um finding tecnicamente incorreto — documentar a justificativa quando discordar).
4. Corrigir os problemas confirmados, sem mudança fora do escopo do finding.
5. Rodar novamente a validação (§ 5).
6. Novo(s) commit(s), push na mesma branch.
7. Atualizar PR/Handoff quando aplicável.
8. **Não** fazer merge.

---

## 8. Vercel Preview

```
Pull Request / branch → Vercel Preview
master → Vercel Production
```

Preview é o ambiente normal de homologação. Depois do Code Review e das validações técnicas, o usuário faz a validação visual/funcional no Preview — isso **não é substituído** pelo Code Review automático.

### Quando Preview é obrigatório

Homologação em Vercel Preview é **obrigatória** para qualquer PR que altere produto, comportamento, UI, APIs, banco, integrações ou runtime — ou seja, qualquer coisa executável. Isso inclui (não exaustivo): componentes/páginas/rotas, Server Actions, endpoints (`app/api/**`), migrations/schema/RLS, Inngest functions, webhooks, providers de integração (WhatsApp/Instagram/Asaas/Twilio/ElevenLabs/Storage/IA), configuração que afeta comportamento em runtime (env vars consumidas pelo app, `middleware.ts`, `vercel.json` com efeito funcional).

Nesses casos, o PR **não é considerado pronto para merge** sem:
1. Deploy de Preview gerado e acessível;
2. instruções objetivas de homologação (ver exemplo abaixo);
3. confirmação humana de que a homologação no Preview foi feita.

### Quando Preview pode ser dispensado

Homologação em Preview pode ser dispensada **somente** para mudanças exclusivamente documentais/operacionais — arquivos de processo/documentação do Harness (`.harness/**`, `AGENTS.md`, `CLAUDE.md`, `.ai/**`, `docs/**`), comentários, ou qualquer alteração comprovadamente sem impacto executável (não toca código de app, schema, configuração de runtime, nem é consumida em build/deploy).

A dispensa não é automática por "parecer só doc" — o agente deve confirmar e declarar explicitamente no PR que:
- nenhum arquivo executável (código de app, migration, config de runtime) foi alterado;
- o diff foi revisado com esse critério em mente.

Na dúvida (arquivo misto, doc que também é lido em runtime, mudança de config ambígua), tratar como impacto executável e exigir Preview — o padrão é conservador, não o contrário.

### Instruções de homologação no PR

O PR deve trazer instruções objetivas de homologação quando Preview for obrigatório, por exemplo:

```
Como testar:
1. abrir Clientes;
2. selecionar cliente;
3. alterar responsável;
4. confirmar atualização;
5. testar mobile.
```

Quando Preview for dispensado (§ acima), o PR deve declarar isso explicitamente em vez de instruções de teste, por exemplo:

```
Preview dispensado: mudança exclusivamente documental (.harness/workflow.md),
sem alteração em código de app, schema, ou configuração de runtime.
```

---

## 9. Human approval

Aprovação humana é obrigatória antes do merge no fluxo normal. Só o usuário/responsável decide quando algo está pronto para Production.

Nenhum agente pode: fazer merge por conta própria, publicar direto em Production, interpretar silêncio como aprovação, ou tratar "Code Review aprovado" como autorização de merge.

---

## 10. Handoff

O mecanismo de Handoff já existente (`AGENTS.md § 0`, `.ai/`) continua sendo o ponto de continuidade entre sessões/agentes — este workflow se integra a ele, não o substitui.

Ao encerrar trabalho relevante no novo pipeline, registrar em `.ai/HANDOFF.md`/`.ai/CURRENT_TASK.md` (quando aplicável, e sem duplicar o que já está no PR — referenciar o PR em vez de copiar):

- Issue e PR (número/link);
- branch;
- objetivo e estado atual;
- principais arquivos/módulos alterados;
- decisões relevantes (ou pointer para `.ai/DECISIONS.md`);
- validações rodadas e resultado;
- findings de review relevantes ainda pendentes;
- riscos e pendências;
- instruções de homologação;
- estado do Vercel Preview;
- próximo passo.

---

## 11. Hotfix

Procedimento separado para incidentes críticos de Production. Hotfix nunca vira justificativa para trabalhar normalmente em `master`.

```
Incidente em Production
  → Issue/registro do incidente
  → branch hotfix/<descricao>
  → correção mínima (sem aproveitar pra refatorar em volta)
  → validação (§ 5, ao menos os itens críticos)
  → PR
  → review quando possível (não pular Codex/humano salvo emergência real, registrada)
  → merge autorizado
  → Production
```

Qualquer exceção a este fluxo precisa ser explícita e registrada (no PR ou no Handoff).

---

## 12. Agent safety

Nenhum agente deve, sem autorização explícita do usuário:

- executar operação destrutiva em Production;
- apagar dados;
- alterar secrets de Production;
- alterar billing;
- alterar DNS;
- executar migration destrutiva;
- force push;
- reescrever histórico compartilhado;
- apagar branches importantes;
- fazer merge;
- desabilitar proteção de branch;
- desabilitar testes;
- reduzir segurança para fazer uma implementação "funcionar".

Isso formaliza o que `AGENTS.md § 6/8/9` e o comportamento padrão do Claude Code (confirmação antes de ações irreversíveis) já estabelecem — nada aqui afrouxa essas regras.

---

## 13. Source of truth

```
.harness/invariants.md   → regras invioláveis de arquitetura/segurança
.harness/workflow.md     → este arquivo: processo de git/PR/review/deploy
AGENTS.md                → contrato geral de agentes (discovery, planning,
                            testing, security, escalation) + Handoff Protocol
                            (§ 0), com pointer para este arquivo em § 8
CLAUDE.md                → instruções específicas de Claude Code (context
                            engineering), sem duplicar o processo — aponta
                            para este arquivo
.ai/                      → estado transitório entre sessões/agentes
GitHub Issue              → definição da tarefa
Pull Request               → implementação proposta + evidências de validação
```

Não copie o conjunto de regras inteiro para múltiplos arquivos — referencie.
