# AGENTS.md — Contrato Geral para Agentes de IA no Althos CRM

Este arquivo é **independente de modelo**. Vale para Claude Code, Codex, e qualquer outro agente automatizado que trabalhe neste repositório. Onde este documento fala de "agente", leia "qualquer IA operando sobre este código".

Para instruções específicas de Claude Code (context engineering, workflow detalhado), ver [CLAUDE.md](./CLAUDE.md). Para regras invioláveis de arquitetura, ver [.harness/invariants.md](./.harness/invariants.md).

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
