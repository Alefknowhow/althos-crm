# Plano — issues restantes: #15, #60 (+#59), #57, #58

- **Status**: active — plano aprovado para execução, nenhuma fase iniciada
- **Criado em**: 2026-09-25
- **Responsável**: Claude (Claude Code)
- **Plano irmão**: `.harness/tasks/active/trafego-22-23-27-finalizacao.md` (Tráfego). Os dois são independentes; se executar ambos, fazer o de Tráfego primeiro **ou** este — não intercalar fases (evita conflito em `lib/inngest/automation.ts` e `trigger-meta.ts`, que os dois tocam).

> **Regras de execução** (iguais ao plano de Tráfego — leia a seção "Validação" lá também):
> 1. Fases **na ordem** abaixo; passos em ordem de dependência. **Um commit por passo.**
> 2. Após cada commit: `tsc --noEmit` + `npm run lint` (0 erros; arquivo > 350 linhas é erro). Fim de fase: `next build` com o contorno do `xlsx`.
> 3. Push em `claude/vibrant-hawking-9ka67c` + fast-forward para `master` (se não for FF, `git merge origin/master`; nunca rebase/force).
> 4. **⛔ BLOQUEADO** = depende de algo externo; fazer só a parte marcada como segura. **❓ CHECKPOINT** = rodar a verificação; se divergir do esperado, parar e perguntar.
> 5. Migrations: próximo número livre em `ls supabase/migrations | tail -1` (os dois planos consomem números — sempre conferir, nunca assumir). Aplicar via `mcp__Supabase__apply_migration` (`project_id: boggtwpywbkpzkmvnbng`) + arquivo `.sql` idêntico no repo. Nunca editar migration aplicada.
> 6. Ao fim de cada fase: atualizar "Progresso" aqui, marcar checkboxes e comentar na issue; fechar a issue quando todos os critérios estiverem atendidos.

---

## 0. Estado real (consultado em produção em 2026-09-25)

| Fato | Impacto |
|---|---|
| `sale_contracts` = **0** linhas, `plan_contracts` = **0**, `contracts` (global) = 2 | **#60: não há histórico para migrar.** A "migração" vira: apontar Reservas/Tráfego para o módulo global e aposentar os fluxos legados. Risco muito menor do que o descrito na issue. |
| `social_automations` = **0** linhas | **#57 item 2: nenhuma org usa o motor antigo do Instagram.** Pode aposentar a tela/fallback sem migração (re-checar a contagem imediatamente antes). |
| `campaign_creatives` = **0** | Resolve o CHECKPOINT 1.4 do plano de Tráfego: pular migração de dados, só trocar o FK/picker. |
| `travel_sales`: sem coluna de vendedor; só `created_by`. Existe `operator` (texto = **operadora de turismo**, não pessoa) | **#15**: nome da coluna nova não pode ser `operator*` (colisão semântica). Vendedor hoje é implícito em `created_by`. |
| `travel_sales.vouchers` jsonb, itens só com `{name, url}` (14 de 16 reservas têm vouchers); URLs do bucket legado público `form-assets` | **#59**: vínculo com produto e status são extensão do jsonb, sem tabela nova. URLs públicas permanentes — não trocar para R2/URL assinada sem decisão (links impressos/enviados ao cliente dependem delas). |
| `tasks`: `assigned_to`, `sale_id`, `related_entity_type/id` | #15: tasks já têm responsável próprio — não tocar. |
| `whatsapp_conversations` já tem `assigned_agent_definition_id` e `assigned_agent_objective` (usados pelo step "Atribuir Agente IA") | #57 item 1: a correlação conversa↔agente já existe; falta sessão/resultado/retomada. |
| `automation_runs.status='waiting'` + `waiting_for_step_id` (retomada por inbound em `lib/social/generic-automation-bridge.ts` e no motor de grafo `lib/inngest/automation-run-graph.ts`) | #57: reaproveitar este mecanismo de pausa para "aguardar resultado do agente". |
| `agent_definitions` = 0 e `agent_assignments` = 0 em produção | Nenhuma org usa Agent Definitions ainda — mudanças no caminho de agente do WhatsApp afetam zero conversas até alguém configurar. |
| Nenhum `trace_id`/`correlation_id` no código | #58 item 3 é greenfield. |
| Webhook Instagram faz 2–3 queries síncronas (status de entrega/leitura) antes do `inngest.send` | #58 item 1: provavelmente aceitável; decidir com medição (Vercel runtime logs via MCP `mcp__Vercel__get_runtime_logs`). |
| `lib/automations/log-format.ts` já existe | #57 item 3 (log legível) pode estar parcialmente pronto — ler antes de implementar. |

---

## Fase A — #15 Responsável operacional da Reserva (pequena, isolada)

### A.1 Schema
- **Migration** `travel_sales_backoffice_owner.sql`:
  - `alter table travel_sales add column seller_id uuid references profiles(id) on delete set null;` — **vendedor explícito**. Backfill: `update travel_sales set seller_id = created_by where seller_id is null;` (preserva o comportamento atual em que o criador é o vendedor).
  - `alter table travel_sales add column backoffice_owner_id uuid references profiles(id) on delete set null;` — responsável operacional (nullable, sem backfill).
  - Índices `(organization_id, seller_id)` e `(organization_id, backoffice_owner_id)`.
  - Comentários SQL explicando que `operator` é a operadora de turismo (evitar confusão futura).
  - RLS: tabela já tem; colunas novas não mudam policy.
- **❓ CHECKPOINT**: conferir se `profiles(id)` é o alvo certo de FK para usuário (outras tabelas usam `profiles(id)` — ex. `library_assets.created_by`). Validar também que o membro escolhido pertence à org **na action** (FK não garante isso).

### A.2 Actions
- Em `actions/travel-sales-crud.ts` (ou onde fica o update da reserva — grep `from('travel_sales').update`): aceitar `seller_id` e `backoffice_owner_id` no schema Zod; validar ambos contra `memberships` da org (`select 1 from memberships where organization_id=? and user_id=?`) — rejeitar senão.
- `createTravelSale*`: default `seller_id = user.id` (explícito, não depender só de `created_by`).
- Timeline: gravar `contato_activities` (`type: 'reserva_backoffice_owner_changed'`) ao trocar o responsável.
- Automação (padrão de baixo risco já documentado): evento `viagens.reserva.backoffice_assigned` com `data: { orgId, leadId: contato_id, saleId, backofficeOwnerId }` + entrada no `trigger-meta.ts` (`niche: 'viagens'`) + registrar numa function com slot livre (ou nova). Opcional — incluir só se couber sem estourar arquivos.

### A.3 UI
- Tela da Reserva (`TravelSalesViewSaleEditor*.tsx` — localizar o header/resumo): dois selects "Vendedor" e "Responsável operacional (backoffice)" com membros da org (`listOrgMembers` de `actions/team.ts`, já usado no plano de projetos).
- Lista de Reservas: filtro "Responsável operacional" (inclui "Sem responsável") e coluna/avatar. Filtro "Meus (backoffice)" como atalho.
- **Tasks**: não alterar nada automaticamente (critério da issue). Ao criar task manual a partir da reserva, **pré-selecionar** o responsável operacional como sugestão editável — só se o form de task já recebe um default; senão, deixar para depois (anotar).

### A.4 Fechamento
- Critérios do #15 conferidos um a um; comentar e fechar.

---

## Fase B — #60 Contratos unificados (+ #59 item 2: indicador na Reserva)

Premissa corrigida: legado vazio → **não há migração de dados**; o trabalho é fazer Reservas e Tráfego usarem o módulo global e aposentar os fluxos paralelos.

### B.1 Registro de campos de mesclagem por origem
- `lib/contracts/merge-fields.ts`: registry `{ entityType: 'reserva'|'venda'|'oportunidade'|'cliente'|'projeto', fields: [{ key: 'sale.destino', label, resolve(ctx) }] }` + `resolveMergeFields(supabase, orgId, entityType, entityId) => Record<string,string>`.
  - `reserva`: reaproveitar exatamente os campos `{{sale.*}}` que `actions/contracts-render.ts` já resolve a partir de `travel_sales` (destino, hotel, datas, operadora, valor, pagamento, políticas) + `{{org.*}}`.
  - `venda`: `sales` + `products` + `contatos` (+ campos de plano recorrente `service_start_date`/`duration_months` que `actions/plan-contracts-render.ts` usa para Tráfego).
  - `oportunidade`/`cliente`: `contatos` (nome, email, telefone, documento) + valor da oportunidade.
  - `{{org.*}}`: nome, CNPJ, endereço (mesmo que o render atual usa).
- `createContract` (`actions/contracts-global.ts`): quando há `templateId` + entidade, preencher `fieldValues` automaticamente via `resolveMergeFields` (valores passados explicitamente têm precedência).
- Teste Vitest das funções puras de formatação (datas/moeda).

### B.2 Gestão: origem obrigatória generalizada
- `NewContractDialog.tsx` hoje exige **Venda** (`sales`). Regra do usuário: "todo contrato ligado a uma venda/assinatura e a clientes". Generalizar mantendo a regra:
  - Nicho viagens → origem **Reserva** (`travel_sales`, que é a venda do nicho); demais → **Venda** (`sales`). Opcional secundário: Oportunidade. Cliente sempre derivado da origem.
  - Nova action `listContractOriginOptions(orgSlug, type, query)` (reserva/venda/oportunidade) no lugar de `listSalesForContractPicker` (manter o antigo como wrapper se ainda usado).
  - Aceitar `?origin=reserva&id=...` na URL de `/contratos` para abrir o diálogo pré-preenchido (usado pelos atalhos B.3).
- Painel de variáveis disponíveis no editor de modelos (`ContractTemplatesTab.tsx`): listar `{{chaves}}` do registry B.1 por tipo de origem, clicáveis para inserir no TipTap.

### B.3 Atalhos e indicador nos módulos consumidores
- Componente `components/features/contracts/ContractStatusIndicator.tsx`: dado `(entityType, entityId)` busca o contrato mais recente não cancelado (`contracts where related_entity_type/id`) e mostra **ícone + texto + tooltip** (nunca só cor): Assinado ✓ / Pendente (enviado, aguardando) / Rascunho / Ausente. Clique: existente → `/contratos/[id]`; ausente → `/contratos?origin=...&id=...`.
  - Action leve `getContractStatusFor(orgSlug, type, id)`; para listas, versão em lote `getContractStatusMap(orgSlug, type, ids[])` (evita N+1).
- Onde colocar:
  - **Reserva** (`TravelSalesViewSaleEditor*.tsx`, header) — fecha o item 2 do **#59**.
  - **Venda** (`/vendas`, `SalesTable.tsx` — hoje referencia contrato legado; trocar pela coluna com o indicador).
  - **Oportunidade** (`LeadDetailDrawer`) — botão "Criar contrato".
  - **Tráfego** (`ClientContractTab.tsx`): substituir o fluxo `PlanoContrato*` por lista de contratos globais do cliente (via vendas do contato) + indicador + "Criar contrato".
- `travel_sales.contrato_gerado_at`/`contrato_assinado_at` são usados no checklist de Reservas: ao criar/assinar contrato global com origem `reserva`, **atualizar esses timestamps** (em `createContract`, `sendContractForSignature`, webhook e `refreshContractStatus`) para o checklist continuar funcionando.

### B.4 Aposentar fluxos legados
- **❓ CHECKPOINT**: re-rodar `select count(*) from sale_contracts; select count(*) from plan_contracts;` — só seguir se continuarem 0.
- Remover da UI: `ContratoManagerDialog`/`ContratoManager*Card` (Reservas) e `PlanoContrato*` (Tráfego), trocando os pontos de entrada pelo indicador/atalho B.3. Remover actions legadas **só depois** de grep confirmar zero importadores (`actions/contracts-signature.ts`, `actions/contracts-render.ts` parte de render de venda, `actions/plan-contracts*.ts`, `lib/trafego/plan-contract-autocreate.ts` — este último: entender o que ele auto-cria e reimplementar sobre `contracts` se for comportamento desejado; **❓ perguntar** se não estiver claro).
- **Não** dropar tabelas nem remover o ramo `sale_contracts` do webhook nesta fase (custo zero mantê-los, evita risco). Anotar no follow-up.
- `organizations.contract_template_id` ("contrato padrão" de Reservas) → na criação a partir de Reserva, usar esse template como default do Select.

### B.5 Envio, status e reenvio
- Reenvio do link de assinatura: `sendGlobalContractLinkByEmail(orgSlug, contractId, signerId?)` (padrão `getResend`/`clientEmailFrom`) e `...ByWhatsapp` (achar a conversa do contato: `whatsapp_conversations where contato_id` mais recente; se não houver, desabilitar o botão com motivo). Botões no `ContractSignersPanel` por signatário (cada signatário tem seu link na Autentique — **verificar** se `createAutentiqueDocument` devolve link por signatário; hoje só o do primeiro é salvo em `contracts.signature_link`. Se devolver, salvar por signatário: coluna `contract_signers.signature_link`).
- Status `rejected`/`viewed`: estender `app/api/webhooks/autentique/route.ts` (ramo global `handleGlobalContractSigned` → generalizar para `handleGlobalContractEvent`) para eventos de recusa/visualização da Autentique — **conferir os nomes reais de eventos** no payload já tratado (hoje só `signature.accepted`). Atualizar `contract_signers.status` e `contracts.status` + `contract_events`. `expired`: cron diário marca `sent` há > N dias (config por org, default 30) como `expired` — só se o usuário quiser; **❓ perguntar** (default: não implementar expiração automática).
- Painel de verificação: a aba Integração já lista eventos; adicionar filtro por status e por contrato.

### B.6 Eventos de Automação
- `contract.sent`, `contract.signed`, `contract.rejected` (`data: { orgId, leadId: contato do contrato, contractId }`) disparados em `sendContractForSignature`, webhook e `refreshContractStatus` (best-effort). Registrar em function com slot livre/nova + `trigger-meta.ts` (sem `niche`: é Core).
- Contato do contrato: derivar da origem (venda/reserva → `contato_id`); se não houver contato, não disparar (automação exige lead).

### B.7 Fechamento
- Fechar **#60**. No **#59**, marcar item 2 como feito (issue continua aberta pelo item 1 → Fase C).

---

## Fase C — #59 item 1: Vouchers reorganizados

### C.1 Referência visual
- **❓ CHECKPOINT**: ler a issue **#11** (origem) com `mcp__github__issue_read` e abrir as imagens anexadas (referência visual exigida pelo critério de aceite). Se as imagens não forem acessíveis pela sessão, pedir ao usuário que cole a referência.

### C.2 Modelo de dados (sem tabela nova)
- Estender o item do jsonb `travel_sales.vouchers` de `{name,url}` para `{ id, name, url, product_id?, kind?: 'hotel'|'aereo'|'transfer'|'passeio'|'seguro'|'outro', status?: 'recebido'|'conferido'|'enviado_cliente', uploaded_at?, source?: 'upload'|'agente' }` — todos opcionais, **retrocompatível** (itens antigos sem os campos continuam válidos). `id` gerado no client (`crypto.randomUUID()`) ao editar/criar; itens legados ganham `id` na primeira edição.
- Tipo TS central em `lib/travel/vouchers.ts` + normalizador `normalizeVoucherItems(json)` (tolera formato antigo). Teste Vitest do normalizador.
- `product_id` referencia os produtos da reserva (`sale_products`? — **conferir** a tabela real usada pela aba Produtos, `SaleProductInlineForm.tsx`).
- Não mudar storage (continua `uploadSaleVoucher` → `form-assets` público) — decisão documentada: URLs de voucher são entregues ao cliente e precisam ser permanentes; migração para R2 exigiria rota proxy com token. Fora de escopo.

### C.3 UI
- `TravelSalesViewSaleEditorVouchersTab.tsx`: agrupar por produto ("Hotel X", "Aéreo LATAM", "Sem produto vinculado"), cada voucher com ícone por tipo de arquivo, nome, **status com ícone+texto** (não só cor), select de produto vinculado, ações (baixar, extrair dados — manter `VoucherExtractDialog`, remover). Seguir a referência visual da C.1.
- `voucher_entregue_at` (checklist): marcar quando todos os vouchers estiverem `enviado_cliente` **ou** manter o comportamento atual — conferir onde é setado hoje e não quebrar.
- Vouchers continuam separados de Contratos (critério) — nada de renomear.

### C.4 Fechamento
- Fechar **#59**.

---

## Fase D — #57 Automações (menor risco primeiro; o item arriscado por último)

### D.1 Log legível na tela de execuções
- Ler `lib/automations/log-format.ts` e a tela de runs (grep `automation_step_logs` em `components/features/automations`). Se o formatador já existe mas não é usado na UI, só plugar. Senão: formatar cada step log como linha humana "09:00 · Gatilho disparado → Condição 'Tag VIP': verdadeiro → Enviar WhatsApp: enviado", com erro destacado e duração.
- Timeline por run com expandir detalhes técnicos (JSON) sob demanda.

### D.2 Aposentar motor antigo do Instagram
- **❓ CHECKPOINT**: `select count(*) from social_automations;` imediatamente antes — seguir só se 0.
- `/social/automacoes`: virar redirect para o editor genérico de Automações com filtro/atalho "Instagram" (trigger `instagram.dm.received`/`instagram.comment.received` pré-selecionado na criação).
- `lib/social/engine.ts`: remover o fallback que consulta `social_automations` (código morto com 0 linhas) — manter funis (`funnel-engine.ts`) e a ponte genérica intactos. Remover actions/componentes exclusivos da tela antiga após grep de importadores.
- **Não** dropar a tabela (follow-up).

### D.3 Retries, idempotência e rate limits por integração
- Auditar os steps que chamam APIs externas no motor (`lib/inngest/automation-run-graph.ts` e steps WhatsApp/e-mail/SMS/webhook/Instagram): garantir que cada chamada externa está dentro de `step.run()` com id **determinístico** (evita reenvio em retry) e que erros 4xx permanentes **não** são re-tentados (usar `NonRetriableError` do Inngest) enquanto 5xx/timeout são.
- Rate limit por integração com `throttle` do Inngest nas functions de envio (não na function de automação inteira): WhatsApp por `phone_number_id` da org, Instagram por conta conectada. Valores iniciais conservadores documentados em comentário (conferir limites atuais na doc da Meta via WebSearch antes de fixar números).

### D.4 Aguardar resultado do Agente IA (maior risco — por último)
- **Contexto**: step "Atribuir Agente IA" já grava `whatsapp_conversations.assigned_agent_definition_id/assigned_agent_objective`. `whatsapp-inbound.ts` ainda responde via `respondAsAttendant` — **ler como ele usa hoje `assigned_agent_definition_id`** antes de mudar.
- **Schema** — tabela `agent_conversation_runs`: `id, organization_id, agent_definition_id, contato_id, conversation_id, automation_run_id, automation_step_id, objective, status ('in_progress'|'completed'|'timeout'|'handoff'|'cancelled'), result_type text, result_data jsonb, expires_at timestamptz, created_at, completed_at`. Unique parcial: 1 sessão `in_progress` por `conversation_id` (**ownership** — garante que só um processo "possui" a conversa). RLS padrão.
- **Step novo** `wait_agent_result` no builder: cria a sessão (status in_progress, `expires_at = now + timeout configurável`, default 24h), atribui o agente na conversa (reusa o step existente internamente), pausa o run (`status='waiting'`, mesmo mecanismo de `wait_for_reply`). Edges de saída por `result_type` (novo tipo de condição de edge `agent_result`, análogo a `field_result`) + edge obrigatório `timeout`.
- **Pipeline WhatsApp** (`whatsapp-inbound.ts`): se existir sessão `in_progress` para a conversa → responder com `invokeAgentDefinition()` (que tem `emit_result`) em vez de `respondAsAttendant`; mesma cobrança de créditos, mesma gravação de outbound, mesmo handoff. Se o agente chamar `emit_result` → marcar sessão `completed` com `result_type/data` e `inngest.send('automation/agent.result', { runId, stepId, resultType, resultData })`. **Sem sessão ativa → caminho atual intocado** (SDR padrão).
- **Retomada**: handler de `automation/agent.result` retoma o run pelo edge correspondente ao `result_type` (seguir exatamente como o grafo retoma após `wait_for_reply`).
- **Timeout**: cron a cada 15 min marca sessões expiradas `timeout` e retoma pelo edge `timeout`; libera `assigned_agent_definition_id` da conversa.
- **Proteção**: tudo atrás de env `AUTOMATION_AGENT_WAIT_ENABLED` — sem a env, o step não aparece no builder e o pipeline nunca entra no ramo novo. Com 0 `agent_definitions` em produção, o risco real é zero mesmo ligado, mas a env evita surpresa.
- **⛔ BLOQUEADO para liberação**: teste ponta-a-ponta exige número de WhatsApp de teste da org (webhook real → resposta → retomada). Implementar, validar com testes unitários do roteamento de edges e do estado da sessão, e **não** ligar a env em produção sem o usuário executar o roteiro de teste (escrever o roteiro no comentário da issue).

### D.5 Fechamento
- Comentar no #57 com o roteiro de teste manual do D.4. Fechar o #57 **somente** após o usuário confirmar o teste; senão deixar aberto com "aguardando QA manual".

---

## Fase E — #58 Backend/observabilidade

### E.1 Correlação de logs (trace_id)
- `lib/observability/trace.ts`: `newTraceId()` (uuid), `withTrace(data, traceId)` e helper de log `logWithTrace(traceId, scope, message, extra)` (prefixo consistente `[trace:<id>]` — compatível com o console atual; o projeto não tem logger central além da regra de lint `quality/no-direct-console`: **usar o helper de logging do projeto** que a regra de lint sugere — grep para achá-lo).
- Gerar `trace_id` nos pontos de entrada: webhooks WhatsApp, Instagram, Autentique, Twilio/Voice, formulário público, e server actions que disparam eventos Inngest de automação. Propagar em `event.data.traceId`.
- **Migration**: coluna `trace_id text` (nullable, indexada) em `automation_runs`, `automation_step_logs`, `agent_audit_log`, `capi_event_log` (se já criada pelo plano de Tráfego), `contract_events`. Gravar onde houver traceId disponível.
- Tela/uso: na tela de execução de automação, mostrar o `trace_id` com botão copiar; documentar em `docs/BACKEND_ARCHITECTURE.md` como reconstruir o caminho de uma mensagem (query por `trace_id` nas tabelas + busca do prefixo nos logs da Vercel/Inngest).

### E.2 Auditoria do pipeline do Instagram
- Mapear em `docs/BACKEND_ARCHITECTURE.md` o fluxo completo (webhook → status updates síncronos → `inngest.send('instagram/inbound.received')` → `lib/social/engine.ts` → funil / automação genérica → envio) no mesmo formato já usado para WhatsApp.
- **Medir** com `mcp__Vercel__get_runtime_logs`/observability (listar projeto/time primeiro): duração p50/p95 da rota `/api/webhooks/instagram` nos últimos dias. Se p95 < 1s, documentar "manter"; se alto, mover as atualizações de status de entrega/leitura para dentro de uma function Inngest (`instagram/status.received`).

### E.3 Decisão Voice AI (Vercel × Railway)
- Medir duração/erros das rotas de voz (`app/api/voice/*`, grep para listar) nos logs da Vercel; cruzar com timeouts da função (plano Vercel). Escrever decisão com números em `docs/BACKEND_ARCHITECTURE.md` (manter na Vercel, ou migrar seguindo o padrão `services/sales-coach-realtime/`).
- **Implementação da migração, se a decisão for migrar: fora deste plano** (vira issue própria — escopo de infra nova).

### E.4 Rate limits/concorrência por integração
- Coberto em D.3 (mesmas functions). Aqui só documentar a tabela final de limites por integração em `docs/BACKEND_ARCHITECTURE.md`.

### E.5 Fechamento
- Fechar **#58** se E.1–E.4 feitos e a decisão de Voice AI documentada (a implementação Railway, se decidida, vira issue nova).

---

## Ordem de commits sugerida
A.1 · A.2 · A.3 · (fecha #15) · B.1 · B.2 · B.3 · B.4 · B.5 · B.6 · (fecha #60) · C.2 · C.3 · (fecha #59) · D.1 · D.2 · D.3 · E.1 · E.2 · E.3 · (fecha #58) · D.4 (último; #57 aguarda QA).

## Riscos
- **B.3/B.4** mexem no fluxo de contrato de Reservas em produção (checklist `contrato_gerado_at`/`contrato_assinado_at`) — por isso sincronizar esses timestamps a partir do módulo global antes de remover o fluxo antigo, e checkpoint de contagem imediatamente antes.
- **B.5** depende do formato real do payload da Autentique para recusa/visualização — nunca adivinhar nome de evento; ler o que o webhook recebe (logs) ou a doc oficial.
- **D.2** remove código de produção — só com a contagem 0 re-confirmada.
- **D.4** toca o pipeline de mensageria WhatsApp — atrás de env, sem sessão ativa o caminho é idêntico ao atual, liberação só após QA manual do usuário.
- **E.1** adiciona colunas em tabelas de log de alto volume — colunas nullable sem default (não reescreve a tabela no Postgres 17).

## Progresso

| Passo | Status | Commit | Notas |
|---|---|---|---|
| A (#15) | pendente | | |
| B (#60, #59.2) | pendente | | |
| C (#59.1) | pendente | | |
| D.1–D.3 | pendente | | |
| E (#58) | pendente | | |
| D.4 | pendente | | aguarda QA manual do usuário |
