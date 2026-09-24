# Orquestrador Global e Agentes de IA Contextuais (issue #19)

- **Status**: active — fase de auditoria concluída, aguardando decisão sobre quebra em sub-issues
- **Criado em**: 2026-09-23
- **Responsável**: Claude (Claude Code)
- **Issue**: https://github.com/Alefknowhow/Althos-crm/issues/19

## Objective
A issue #19 pede uma arquitetura de Orquestrador Global (Win+J) + agentes contextuais por módulo + Business Context compartilhado + Agent Definition configurável + Atribuições + integração com entitlements. É um épico de várias semanas, não uma tarefa de sessão única. Princípio explícito da própria issue: "antes de criar qualquer nova infraestrutura, auditar e reutilizar o que já existe" — esta primeira fase é essa auditoria, servindo de base para quebrar a issue em sub-issues executáveis.

## Auditoria — o que já existe hoje

### 1. Atendimento WhatsApp / motor conversacional (robusto, reaproveitado 3x)
- `lib/ai/attendant-engine.ts` (`respondAsAttendant`/`respondAsAttendantStream`) — motor puro sem I/O, loop de tool-use Anthropic (até `maxIterations`), prompt caching, `claude-haiku-4-5` default.
- `lib/ai/attendant-engine-core.ts` — `buildSystemBlocks()` (persona → business context → KB → handoff → guided steps → tools → out-of-hours → lead profile), `detectHandoff()`.
- `lib/inngest/whatsapp-inbound.ts` — orquestra I/O real: feature check, config, créditos, histórico, chama o motor, grava outbound, handoff.
- **Já reaproveitado por**: Voice AI (`lib/voice/ai-conversation.ts::runVoiceAgentTurn`) e Copiloto (`actions/ai_insights.ts`, `app/api/copilot/chat/route.ts`) — prova que o motor genérico já suporta múltiplos contextos de invocação.

### 2. Qualificação automática de lead
- `lib/ai/run-qualification.ts::runLeadQualification()` — Claude ou Gemini, consome crédito `lead_scoring`, persiste `ai_score/ai_tier/ai_summary` em `contatos`.

### 3. MCP / Agent Layer para agentes externos (robusto, já com entitlements)
- `app/api/mcp/route.ts` + `lib/agent/context.ts::resolveAgentContext()` (token pessoal → org/role/permissions) + `lib/agent/execute.ts::executeTool()` (permissão → capability → handler → audit sempre).
- `lib/agent/tools/crud.ts::buildModuleTools()` — CRUD genérico declarativo por módulo (allowlist de colunas/campos), `confirm:true` obrigatório em update/delete (preview sem confirm — mecanismo real, não decorativo, dado transporte stateless).
- `lib/agent/tools/registry.ts` — cobertura por nicho (CRM genérico + viagens + clínicas/imóveis + seguros/tráfego), ~25 tools.
- **Capabilities (issue #31, já mergeada — PRs #36/#38/#40/#41/#42)**: `lib/capabilities/resolve.server.ts::hasCapability()` compõe permissão + feature de plano + módulo de nicho/kill-switch + vertical efetiva. **Isso já é a "integração com entitlements" que a #19 pede — implementada, e o Agent Layer MCP já consome.**

### 4. Agentes de módulo (Financeiro / Formulários / Automações) — mesmo padrão, prompts hardcoded
- `actions/financial-ai.ts`, `actions/forms-ai.ts`, `actions/automations-ai.ts` — todos: `checkMemberPermission` → `hasPlatformAiKey()` → `consumeAiCredits()` → `resolveAnthropicEngine()` → chamada Anthropic com `tool_choice` forçado numa única tool de output estruturado (`propose_form`, `propose_automation`, `propor_lancamento`). Padrão distinto do attendant-engine (sem loop livre de tool-use).
- Prompts/persona hardcoded no código, não configuráveis — não existe "Agent Definition" pra nenhum desses.

### 5. Instagram/Social
- `lib/social/engine.ts::processInboundInteraction()` — pipeline com funil → automação genérica → fallback `social_automations` (`response_type: 'ai'` chama `lib/social/ai.ts::generateAiReply()`, texto simples sem tools, sem o motor genérico).

### 6. Voice AI (parcial — gap já documentado no próprio código)
- Reaproveita `respondAsAttendant()` integralmente para 1 turno texto→texto. Falta o serviço de streaming bidirecional real-time fora da Vercel (mesmo gap do IA Sales Coach, ver `.harness/tasks/active/ia-sales-coach.md`).

### 7. Créditos/chave de IA (maduro, centralizado)
- `lib/credits/engine.ts` (Credit Engine único), `lib/ai/api-key.ts::resolveAnthropicEngine()`, `lib/plans/server.ts::checkFeatureAccess()`. Padrão replicado manualmente em cada action (não há wrapper único "AI call").

### 8. Permissões
- `lib/permissions.ts`/`lib/permissions.server.ts` — `PermissionKey` + `canAccess(role, permissions, key)`, camada mais baixa que `hasCapability()` já compõe.

### 9. Copiloto (dock lateral, Ctrl/Cmd+? não mapeado a atalho dedicado)
- `actions/copilot.ts` + `app/api/copilot/chat/route.ts` (streaming) — usa attendant-engine + `lib/ai/insights-tools.ts` (analytics read-only por nicho). UI: `CopilotDock*.tsx`, `CopilotProvider.tsx`.

### 10. Atalhos — Ctrl/Cmd+K existe, Win+J não existe
- `components/features/CommandPalette.tsx` (`mod+k`), `lib/shortcuts/registry.ts` (infra genérica de `ShortcutEntry`, pronta para registrar novo combo sem trabalho de baixo nível).

## Gaps confirmados (o que a #19 pede e não existe em lugar nenhum hoje)

1. **Orquestrador Global** — nenhum roteador único direciona intenção entre agentes de módulo. Cada chat (financeiro/forms/automações/copiloto) é isolado.
2. **Business Context realmente compartilhado** — `organizations.ai_business_context` existe mas só alguns motores o consomem (attendant, qualifier, categorização financeira); forms-ai/automations-ai/insights não.
3. **Agent Definition configurável** — só existe para WhatsApp (`ai_attendant_config`) e Voice AI (`voice_ai_agents`); Financeiro/Forms/Automações têm prompt fixo no código.
4. **Atribuições / autorização própria do agente** — hoje o Agent Layer age em nome do usuário dono do token; não há escopo/papel independente do agente em si.
5. **Approval flow assíncrono** — `lib/agent/execute.ts` já bloqueia `requiresApproval: true` dizendo "não suportado nesta fase".
6. **Voice AI realtime** — gap conhecido, fora de escopo aqui (ver IA Sales Coach, mesmo problema de infra).
7. **Win+J** — não existe, mas a infra de `ShortcutEntry`/`ShortcutProvider` suporta registrar sem trabalho de baixo nível.
8. **Biblioteca/Agent Knowledge unificada** — 3 bases isoladas (`ai_knowledge_items`, `lib/sales-coach/knowledge.ts`, `roteirista_knowledge_items`), nenhuma com retrieval/embeddings, nenhuma compartilhável.
9. **Auditoria unificada entre todos os agentes** — `agent_audit_log` só cobre MCP; chats internos usam tabelas próprias sem log padronizado.
10. **Multi-tool orchestration cross-módulo** — agentes de módulo usam `tool_choice` forçado numa tool só; não conseguem chamar tools de outros módulos no meio da conversa (só o Copiloto/insights faz isso, e só leitura).

## Proposta de quebra em sub-issues (sequência sugerida)

A ordem respeita dependências: Business Context e Agent Definition são pré-requisito de tudo que vem depois; o Orquestrador em si é o que mais depende do resto já existir.

1. **Business Context compartilhado** — extrair/consolidar `organizations.ai_business_context` (e o que mais a issue lista: posicionamento, ICP, políticas, catálogo) numa camada única (`lib/ai/business-context.ts` ou similar) que todo motor de IA (attendant, qualifier, financial-ai, forms-ai, automations-ai, social ai, insights) passa a consumir da mesma forma. Menor risco, maior alavancagem — destrava os itens seguintes.
2. **Agent Definition + Business Context/Persona/Knowledge separados** — nova entidade configurável (banco + UI mínima) reaproveitando o padrão já existente em `ai_attendant_config`/`voice_ai_agents` em vez de um por módulo. Definir contrato de Tools/Skills permitidas por definição.
3. **Auditoria unificada** — estender `agent_audit_log` (ou criar visão comum) para cobrir os chats internos, não só MCP.
4. **Orquestrador Global (Win+J)** — UI + roteamento de intenção usando os Agent Definitions do item 2, reaproveitando tools já existentes (MCP registry) via chamada server-side (não HTTP externo). Menor peça nova de infraestrutura; maior peça de produto.
5. **Atribuições** — regras simples "canal/cenário → Agent Definition padrão", começando pelo caso já real (WhatsApp SDR).
6. **Biblioteca/Agent Knowledge unificada** — consolidar as 3 bases de conhecimento isoladas; avaliar se retrieval/embeddings entram nesta fase ou ficam para depois (MVP pode ser busca por categoria, como já é no `ai_knowledge_items`).
7. **Approval flow assíncrono** — implementar o que `requiresApproval: true` hoje só bloqueia.
8. Fora de escopo desta issue (gaps de infra maiores, já rastreados em outro lugar): Voice AI realtime.

## Progresso

### #45 Business Context compartilhado — feito
`lib/ai/business-context.ts` (`formatBusinessContext`/`appendBusinessContext`) + wiring nos 5 pontos que ignoravam `organizations.ai_business_context`: `app/api/financial-ai/chat/route.ts`, `actions/forms-ai.ts`, `actions/forms-ai-insights.ts`, `actions/automations-ai.ts`, `actions/ai_insights.ts` + `app/api/copilot/chat/route.ts`.

### #46 Agent Definition configurável — feito (backend; sem UI nesta fatia)
- Migration `0267_agent_definitions.sql` (aplicada em produção via MCP Supabase) — tabela `agent_definitions`, RLS padrão.
- `lib/agent-definitions/types.ts` — `AgentDefinition`, `AgentRuntimeContext` (Runtime Invocation), `AgentResultEvent` (resultado estruturado extensível), `AgentInvocationResult`.
- `lib/agent-definitions/context.ts::resolveMemberRuntimeContext()` — resolve Runtime Context a partir da sessão real (nunca confia na definição).
- `lib/agent-definitions/prompt.ts::buildPersonaPromptFromDefinition()` — compõe personaPrompt separando Personalidade/Persona/Regras/Handoff/etc.
- `lib/agent-definitions/tools.ts` — `resolveAnthropicTools()` (allowed_tools ∩ `TOOL_REGISTRY`, conversão zod→JSON Schema via `z.toJSONSchema` nativo do Zod v4, + tool `emit_result` sempre disponível) e `buildToolExecutor()` (tools do registry passam por `executeTool()` — permissão+capability+auditoria reais; `emit_result` só acumula estruturado).
- `lib/agent-definitions/invoke.ts::invokeAgentDefinition()` — Agent Runtime Invocation: reaproveita `respondAsAttendant()`, nunca consome créditos/checa feature sozinho (responsabilidade do caller, mesmo padrão do attendant-engine puro), autorização de tool sempre a partir do Runtime Context real, nunca da definição.
- `actions/agent-definitions.ts` — CRUD completo (list/get/create/update/delete), permissão `settings`.
- Teste: `tests/unit/agent-definitions.test.ts` (prompt building; `resolveAnthropicTools` não é testável neste runner — puxa Server Actions via `lib/agent/tools/registry.ts`, fora do escopo do vitest.config.ts deste projeto).
- **Não incluído nesta fatia** (por decisão de escopo, ver "não fazer" da issue): UI de configuração, migração do WhatsApp/Voice AI pra esta infra, consumo de créditos (fica com o caller quando #48/#49 existirem).
- `npx tsc --noEmit` limpo, lint 0 erros, `npm test` 220/220. `npm run build` em andamento (build de produção deste repo é longo).

### #47 Auditoria unificada de execuções de IA — feito
`agent_audit_log` (já genérico, sem CHECK em `agent_label`) virou o log unificado: `lib/agent/audit.ts::logAiExecution()` é o novo ponto único de escrita; `logAgentToolCall()` (MCP) passou a ser um wrapper fino sobre ele, sem mudar o formato já gravado hoje (`agent_label` do token, sem prefixo novo).
Instrumentados (`agentLabel` convenção `internal:<módulo>`): `actions/forms-ai.ts` (tool `propose_form`), `actions/forms-ai-insights.ts` (`report_insights`), `actions/automations-ai.ts` (`propose_automation`), `app/api/financial-ai/chat/route.ts` e `app/api/copilot/chat/route.ts` (cada tool call real + uma linha `chat_reply` resumindo o turno, sucesso ou erro), `actions/ai_insights.ts::sendInsightMessage` (variante não-streaming, mesmo padrão), `lib/social/engine.ts` + `lib/social/funnel-engine.ts` + `lib/inngest/automation-step-instagram.ts` (`internal:social_ai`, `userId: null` pois não há usuário humano agindo).
`lib/agent-definitions/invoke.ts` também instrumentado desde a criação — tool calls individuais já auditados via `executeTool()`, mais uma linha `chat_reply` por invocação (sucesso ou erro), cobrindo também turnos sem nenhuma tool call.
`npx tsc --noEmit` limpo, lint 0 erros (127 warnings pré-existentes, nenhum novo tipo introduzido), `npm test` 220/220, `npm run build` completo passou (precisou de `NODE_OPTIONS=--max-old-space-size=8192` — a primeira tentativa deu OOM no worker de type-check do Next, limitação do sandbox local, não do código).

### #48 Orquestrador Global (mod+j) — feito
- `app/api/orchestrator/chat/route.ts` — chat streaming (NDJSON, mesmo formato do Copiloto), SEM sessão persistida (histórico vive no client enquanto o painel está aberto, mesmo padrão stateless de forms-ai/automations-ai). Oferece TODAS as tools de `TOOL_REGISTRY` (a restrição real é por chamada, via `executeTool()`/capabilities — nunca pelo que é oferecido, mesmo trade-off já aceito no Agent Layer MCP). Reaproveita `resolveMemberRuntimeContext()` e `resolveAnthropicTools()`/`buildToolExecutor()` da #46, auditoria automática via `logAiExecution()` (#47) tanto pro turno quanto por tool call individual (já embutido em `buildToolExecutor`).
- `lib/ai/orchestrator-prompt.ts` — persona hardcoded (issue explicitamente excluiu Agent Definition configurável aqui), com bloco de contexto de página opcional.
- `components/features/OrchestratorPalette.tsx` — modal de chat sem sessão persistida, aberto via `mod+j` (`useShortcut`, mesma infra do `mod+k` existente — "Windows+J"/"Windows+K" da issue é a forma como o usuário nomeia o modificador `mod`, que na prática é Ctrl no Windows/Cmd no Mac, olhando o `comboFromEvent()` já usado pelo `mod+k` do CommandPalette). Contexto automático (issue: "módulo atual, rota, registro aberto") resolvido via `pathname` + `document.title` enviados a cada turno — sem tentar resolver "registro aberto" por rota (o modelo usa tools sob demanda pra isso).
- Montado em `app/app/[orgSlug]/layout.tsx`, gateado pela mesma flag `canUseCopilot` (permissão `insights`) já usada pelo Copiloto — sem novo botão de header, seguindo decisão de produto já registrada no código ("Copiloto de IA removido do header").
- `npx tsc --noEmit` limpo, lint 0 erros. Build de produção completo rodando em background pra confirmar (heap maior, mesmo ajuste necessário nas fatias anteriores).
- **Verificação interativa (login) não foi possível nesta sessão** — sem credenciais de teste disponíveis no ambiente. Mitigação: o atalho reaproveita literalmente a mesma infraestrutura (`useShortcut`/`ShortcutProvider`/`comboFromEvent`) que já sustenta `mod+k` em produção, então o risco residual de o evento de teclado não disparar é baixo — o que não foi verificado visualmente é o fluxo de chat/streaming/tool-calling em si.

### #49 Atribuições — feito (WhatsApp/SDR integrado; Instagram deliberadamente fora)
- Migration `0268_agent_assignments.sql` (aplicada em produção) — `agent_assignments {organization_id, scenario_key, agent_definition_id, is_active}`, unique por (org, scenario_key). Ausência de linha = comportamento legado, sempre.
- `lib/agent-definitions/assignments.ts::resolveAssignedAgentDefinition()` — resolve a definição ativa atribuída a um cenário, ou `null`.
- `actions/agent-assignments.ts` — CRUD (list/set upsert/delete), permissão `settings`, valida que a definição pertence à org antes de vincular.
- **Integração real, mas deliberadamente conservadora**: `lib/inngest/whatsapp-inbound.ts` (pipeline de produção do atendente WhatsApp) agora resolve uma atribuição pro cenário `whatsapp.inbound`; se existir e estiver ativa, `buildPersonaPromptFromDefinition()` substitui `attendant.persona_prompt` e `definition.model` substitui o modelo — **só isso**. Créditos, memória entre conversas, horário de atendimento, handoff, filtro de tools e toda a idempotência continuam exatamente como já eram, sem duplicar lógica. Nenhuma org tem hoje uma linha em `agent_assignments`, então **o comportamento de produção não muda pra ninguém** até alguém explicitamente criar uma atribuição — risco de regressão zero, verificado por leitura completa do diff (não foi possível testar webhook do WhatsApp de ponta a ponta neste ambiente, sem credenciais Meta).
- Instagram (`lib/social/engine.ts`/`funnel-engine.ts`) citado como exemplo na issue mas **não foi integrado** — decisão deliberada de escopo pra manter o diff pequeno e revisável; a mesma função `resolveAssignedAgentDefinition()` já serve de base quando isso for retomado.
- `npx tsc --noEmit` limpo, lint 0 erros (warnings pré-existentes na função do WhatsApp, nenhum novo), `npm test` 220/220, `npm run build` completo passou (sem servidor de dev concorrente — a tentativa anterior deu OOM por disputa de memória com o `next dev` que estava rodando em paralelo, não por causa do código).

### #50 Biblioteca unificada — feito (camada nova, sem migrar as 3 bases legadas)
- Migration `0269_library_items.sql` (aplicada) — `library_items {organization_id, source_module, category, title, content, priority, is_active}`. Decisão de escopo: camada NOVA aditiva, sem migrar `ai_knowledge_items`/`roteirista_knowledge_items`/sales-coach — evita risco de mexer em dado de produção de 3 features diferentes só pra atender "evitar armazenamento paralelo daqui pra frente".
- `lib/ai/library.ts` — `getActiveLibraryItems()` + `libraryItemsToKnowledgeBase()` (mapeia title/content → question/answer, reaproveitando o bloco "Base de conhecimento" que `buildSystemBlocks()` já sabe renderizar, sem mudar o motor).
- `actions/library.ts` — CRUD, permissão `settings`.
- Consumida por: `lib/agent-definitions/invoke.ts` (automática, todo Agent Definition passa a herdar), Orquestrador (`app/api/orchestrator/chat/route.ts`, antes mandava `knowledgeBase: []`), e WhatsApp (`whatsapp-inbound.ts`, soma à FAQ própria via `ai_knowledge_items` — nunca substitui, array vazio hoje = zero mudança de comportamento pra qualquer org existente).
- Teste: `tests/unit/library.test.ts` (função pura de conversão).
- `npx tsc --noEmit` limpo, lint 0 erros, `npm test` 223/223.

### #51 Approval flow assíncrono — feito
- Migration `0270_agent_pending_approvals.sql` (aplicada) — `agent_pending_approvals {organization_id, user_id, agent_label, tool, input, status, reviewed_by, reviewed_at, review_note, result}` + amplia o CHECK de `agent_audit_log.status` pra incluir `pending_approval` (constraint real confirmada via `pg_get_constraintdef` antes de alterar).
- `lib/agent/execute.ts::executeTool()` — quando `tool.requiresApproval`, enfileira (`enqueueApproval`) + notifica (`createNotification`, reaproveitando `actions/notifications.ts` existente) em vez de bloquear com "ainda não suportado". **Nenhuma tool declara `requiresApproval: true` hoje** (auditado em `lib/agent/tools/*.ts`) — infra pronta, sem tool exercitando o caminho ainda.
- `lib/agent/approvals.ts::resolvePendingApproval()` — aprovar RE-EXECUTA o handler original reconstruindo o contexto a partir do `user_id` que disparou a ação (nunca do revisor) e **revalidando permissão/capability na hora**, não confia que ainda são válidas desde o enfileiramento; rejeitar só marca, não executa.
- `actions/agent-approvals.ts` (list/approve/reject, permissão `settings`) + UI mínima em `app/app/[orgSlug]/configuracoes/aprovacoes/` (`AgentApprovalsView.tsx` — pendentes + histórico, aprovar/rejeitar), registrada em `CONFIG_SUB_ITEMS` (nav de Configurações).
- `npx tsc --noEmit` limpo, lint 0 erros, `npm test` 223/223. `get_advisors` (security) sem novos achados nas tabelas criadas.

## Status: issue #19 — 7 de 7 sub-issues concluídas (#45–#51)
Build de produção final (todas as fatias juntas) rodando — ver Verification.

## Verification
