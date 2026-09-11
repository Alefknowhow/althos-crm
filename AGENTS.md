# AGENTS.md — Contrato Geral para Agentes de IA no Althos CRM

Este arquivo é **independente de modelo**. Vale para Claude Code, Codex, e qualquer outro agente automatizado que trabalhe neste repositório. Onde este documento fala de "agente", leia "qualquer IA operando sobre este código".

Para instruções específicas de Claude Code (context engineering, workflow detalhado), ver [CLAUDE.md](./CLAUDE.md). Para regras invioláveis de arquitetura, ver [.harness/invariants.md](./.harness/invariants.md). Para o protocolo de continuidade entre agentes/sessões, ver a § 0 abaixo e [.ai/](./.ai/).

---

## 0. Handoff Protocol (obrigatório, antes de qualquer tarefa relevante)

O diretório [`.ai/`](./.ai/) existe pra que um agente consiga continuar exatamente de onde outro parou — Claude Code, Codex, ou qualquer outro — **sem depender do histórico da conversa**. Tarefas triviais (1 arquivo, comportamento óbvio, sem estado a preservar) não precisam do ritual completo; use julgamento.

### Antes de começar uma tarefa relevante

1. Leia este arquivo (`AGENTS.md`).
2. Leia [`.ai/PROJECT_CONTEXT.md`](./.ai/PROJECT_CONTEXT.md) (contexto rápido e permanente do projeto).
3. Leia [`.ai/CURRENT_TASK.md`](./.ai/CURRENT_TASK.md) (o que está em andamento agora, se algo estiver).
4. Leia [`.ai/HANDOFF.md`](./.ai/HANDOFF.md) (estado deixado pelo agente anterior).
5. Rode `git status` e confira a branch atual (`git branch --show-current`).
6. Entenda qualquer alteração não commitada antes de editar arquivos — não presuma que o working tree está limpo.
7. **Concorrência**: se `CURRENT_TASK.md` tiver `Owner`/`Branch`/`Started At` preenchidos com uma tarefa diferente da sua, ou o `git status` mostrar mudanças que você não reconhece, pare e avalie o estado existente antes de editar — não sobrescreva trabalho de outro agente/pessoa em andamento. Se for claramente uma tarefa distinta e não conflitante, registre a sua própria entrada em vez de apagar a anterior.

### Antes de finalizar ou transferir uma tarefa

1. Revise as próprias mudanças (`git diff`).
2. Rode as validações apropriadas (ver § 4/5 abaixo — `npx tsc --noEmit`, `npm test`, `bash scripts/verify.sh` quando o ambiente permitir).
3. Atualize [`.ai/CURRENT_TASK.md`](./.ai/CURRENT_TASK.md) com o estado real (Status, Completed, In Progress, Pending).
4. Atualize [`.ai/HANDOFF.md`](./.ai/HANDOFF.md) § Agent Context (Summary, Completed, Pending, Recommended Next Steps, Continuation Instructions — a lista completa de campos está no próprio arquivo).
5. Se houve decisão arquitetural relevante (provider novo, mudança de schema importante, nova abstração, decisão de segurança/multi-tenancy), registre em [`.ai/DECISIONS.md`](./.ai/DECISIONS.md). Não registre decisões triviais.
6. Se sobrou um problema técnico real e não-trivial, registre em [`.ai/KNOWN_ISSUES.md`](./.ai/KNOWN_ISSUES.md).
7. Rode `npm run handoff` (`scripts/generate-handoff.mjs`) — atualiza automaticamente a seção "Automatic Context" de `HANDOFF.md` (branch, commits, git status, diff --stat). Nunca edite essa seção à mão; ela é sobrescrita a cada execução.
8. Deixe instruções claras pro próximo agente na seção "Continuation Instructions" de `HANDOFF.md`.

### Regras do handoff

- **Nunca** inclua no handoff: API keys, service role keys, tokens, senhas, credenciais, secrets de provider, ou qualquer valor de `.env`. Se um arquivo sensível (`.env*`, `credenciais*`, `*secret*`, `*.key`, `*.pem`, `*token*`) aparecer no `git status`/diff, registre só que existe alteração ali — nunca copie o conteúdo.
- Não copie diffs completos nem arquivos gigantes pro handoff — resumo (`git diff --stat`) é suficiente; o próximo agente lê o diff real quando precisar.
- Não sobrescreva trabalho não relacionado nem apague contexto útil deixado por outro agente — `HANDOFF.md`/`CURRENT_TASK.md` são atualizados, não recriados do zero, a menos que a tarefa anterior esteja genuinamente concluída.
- `scripts/generate-handoff.mjs` nunca faz `git add`/`commit`/`push` — commit e push seguem as mesmas regras de confirmação humana já estabelecidas no resto deste documento (§ 8).
- **Manutenção do contexto persistente**: se a tarefa alterou algo estruturalmente (novo módulo, nova integração/provider, nova tabela central, mudança de stack, novo padrão global, mudança relevante em auth/multi-tenancy), atualize [`.ai/PROJECT_CONTEXT.md`](./.ai/PROJECT_CONTEXT.md) de acordo. Para bugs e features pequenas, não mexa no contexto global.
- Para tarefas grandes o suficiente pra justificar plano formal (múltiplos módulos, schema, autorização), use o sistema já existente em [`.harness/tasks/`](./.harness/tasks/README.md) — `.ai/CURRENT_TASK.md` é o ponteiro rápido do "agora"; `.harness/tasks/active/<slug>.md` é o plano detalhado quando ele existir.

---

## 1. Discovery

Antes de alterar código:
- Leia o código real da área afetada — não assuma padrão a partir de memória de outros projetos.
- Se a tarefa cita uma tabela, rota ou função por nome, confirme que ela existe e leia sua implementação atual antes de propor mudança.
- Prefira grep/busca cirúrgica a varredura ampla de diretório.

## 2. Planning

- Para mudanças pequenas e localizadas (1 arquivo, comportamento claro), pode implementar direto.
- Para mudanças que tocam múltiplos módulos, schema de banco, autorização, ou billing: esboce o plano antes de editar. Se o ambiente tiver um modo de planejamento formal, use-o.
- Nunca proponha uma mudança destrutiva (drop de coluna/tabela, remoção de RLS, alteração de auth) sem sinalizar explicitamente o risco antes de executar.

## 3. Implementation

- Reutilize sistemas existentes. Antes de criar um componente, helper, ou padrão novo, procure se já existe equivalente (`components/ui/`, `lib/`, `actions/`).
- Siga as convenções já estabelecidas no arquivo/módulo que está editando, mesmo que discordem de uma preferência geral — consistência local vence estilo pessoal.
- Não adicione abstração, configuração, ou flag para um caso hipotético que a tarefa não pede.
- Comentários explicam o "porquê" não óbvio (uma decisão, uma limitação de API externa, um bug evitado) — nunca o "o quê" (isso o código já diz).

## 4. Testing

- Toda mudança em lógica de negócio, cálculo, ou parsing: rode os testes relacionados (`npm test`) e, se o padrão existente já cobre esse tipo de função, adicione um teste no mesmo estilo.
- Toda mudança em TypeScript: `npx tsc --noEmit` limpo antes de considerar a tarefa pronta.
- Não existe E2E configurado neste repo — não finja que existe nem invente um comando pra rodar um que não existe.

## 5. Verification

- Rode `scripts/verify.sh` antes de reportar a tarefa como concluída, sempre que o ambiente permitir.
- Se um passo do verify não se aplica ou não está configurado, isso deve aparecer como `NOT CONFIGURED` — nunca como sucesso forjado.

## 6. Security

- Toda entrada externa (formulário público, webhook, upload, parâmetro de rota) é hostil até prova em contrário — valide antes de usar.
- Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` ou qualquer secret de API no client, em log, ou em código versionado.
- Toda tabela nova com dado de organização precisa de RLS com isolamento por `organization_id` — isso não é opcional nem "para depois".
- Webhooks (Meta, Resend, Asaas, etc.) validam assinatura antes de processar payload — nunca confie em payload não assinado.

## 7. Scope

- Só altere o que a tarefa pede. Uma correção de bug não é convite para refatorar em volta.
- Se notar um problema não relacionado à tarefa atual, registre/sinalize — não conserte silenciosamente no mesmo diff, a menos que o custo de não fazer seja deixar o build quebrado.
- Nunca altere `.env.local`, credenciais, ou configuração de produção como efeito colateral de uma tarefa de código.

## 8. Production Safety

- Nenhuma migration destrutiva (drop, truncate, rename que quebra FK) sem confirmação explícita do humano.
- Nenhuma alteração em RLS, autenticação, ou RBAC sem entender o impacto de isolamento entre organizações — esse é o maior risco de negócio deste produto (vazamento de dado entre tenants).
- Deploy, push para `master`, e qualquer ação com efeito em produção seguem a política de confirmação do harness do agente que estiver rodando (ex.: Claude Code pede confirmação explícita antes de `git push`).

## 9. Escalation

Pare e peça decisão humana quando:
- A tarefa exige uma migration destrutiva ou mudança de RLS/auth.
- Há ambiguidade real sobre o que o usuário quer (não invente a interpretação mais conveniente).
- O código existente contradiz a descrição da tarefa de um jeito que sugere que a premissa está errada.
- A mudança pedida violaria um invariant listado em `.harness/invariants.md`.

## 10. Evidence

Ao reportar conclusão de uma tarefa, inclua:
- O que foi alterado (arquivos) e por quê (motivo, não descrição óbvia do diff).
- Quais comandos de verificação rodaram e o resultado (PASS/FAIL/NOT CONFIGURED).
- O que ficou de fora conscientemente, se algo ficou.

## 11. Completion Criteria

Uma tarefa está completa quando:
- O código compila (`tsc --noEmit` limpo).
- Os testes relacionados passam.
- O comportamento pedido foi verificado (manualmente, via preview, ou via teste automatizado — não só "parece certo pela leitura do código").
- Nenhum invariant de `.harness/invariants.md` foi violado.
- Nenhuma mudança fora do escopo pedido foi introduzida.
