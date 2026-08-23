# Mapa do Sistema — Core

> Gerado em 2026-08-22, baseado no código em HEAD (`22a4c2a fix(security): contratos (Reservas e Planos) sem checagem de permissão`).
>
> Este documento mapeia os módulos **Core** do Althos CRM — tudo que não é exclusivo de nenhuma vertical (Viagens, Tráfego, Clínicas, Imóveis, Seguros). Reaproveita e verifica contra o código o conteúdo de `docs/audit/*.md` (auditorias de 2026-07-29) e `docs/audit/core-vs-vertical-audit.md` (2026-08-20). Onde este mapa cita um "Achado", é uma constatação da auditoria original re-confirmada por leitura de código nesta passada.
>
> O gating de nicho é centralizado em `lib/niche.ts` (`isTravelNiche`, `isClinicNiche`, `isRealEstateNiche`, `isInsuranceNiche`, `isTrafficNiche`) + `lib/niche-modules.ts` (`isModuleEnabled(niche, ModuleKey)` — registry único que decide visibilidade de módulo vertical no menu). Um módulo é "Core" quando nenhum `ModuleKey` do registry o cobre — ou seja, `isModuleEnabled` retorna `true` para qualquer nicho.

## Índice

1. [Dashboard/Inicial](#1-dashboardinicial)
2. [Pipeline](#2-pipeline)
3. [Contatos](#3-contatos)
4. [Tarefas](#4-tarefas)
5. [Conversas (WhatsApp)](#5-conversas-whatsapp)
6. [Social (Instagram)](#6-social-instagram)
7. [Agente de IA](#7-agente-de-ia)
8. [Automações](#8-automações)
9. [Financeiro](#9-financeiro)
10. [Formulários públicos](#10-formulários-públicos)
11. [Marketing/Campanhas de Anúncio](#11-marketingcampanhas-de-anúncio)
12. [Campanhas de Envio (e-mail/WhatsApp)](#12-campanhas-de-envio-e-mailwhatsapp)
13. [Configurações](#13-configurações)
14. [Permissões](#14-permissões)
15. [Billing/Planos](#15-billingplanos)
16. [Super-admin](#16-super-admin)
17. [Relatórios](#17-relatórios)
18. [Saúde das integrações](#18-saúde-das-integrações)
19. [Backup & Disaster Recovery](#19-backup--disaster-recovery)
20. [Command Palette / busca global](#20-command-palette--busca-global)
21. [Notificações](#21-notificações)
22. [Agendamentos (calendário genérico)](#22-agendamentos-calendário-genérico)
23. [Catálogo/Vendas (CRM genérico não-viagem)](#23-catálogovendas-crm-genérico-não-viagem)

---

## 1. Dashboard/Inicial

**O que é**: página inicial da org (`/app/[orgSlug]`) — KPIs, funil, gráficos, insights automáticos e widgets fixáveis, com abas por área (Visão Geral/Pipeline/Vendas/Clientes/Equipe) + abas condicionais por vertical.

**Funcionalidades principais**: filtro de período/pipeline/vendedor; funil avançado (`getAdvancedFunnel`) com múltiplas fontes de atribuição; insights automáticos (`listDashboardInsights`); grid de cards fixáveis pelo usuário (`getDashboardLayout`/`PinnedCardsGrid`); banner de upgrade e checklist de onboarding; dock do Copiloto IA (FAB), gated pela permissão `insights`.

**Arquivos-chave**:
- Rota: `app/app/[orgSlug]/page.tsx`
- Actions: `actions/dashboard.ts` (funil, `getAdvancedFunnel`, `getFunnelSourceOptions`), `actions/dashboard-layout.ts` (`getDashboardLayout`), `actions/dashboard-insights.ts` (`listDashboardInsights`)
- Lib: `lib/dashboard/widget-registry.tsx` (tipo `WidgetCtx` compartilhado por todas as abas/widgets), `lib/dashboard/period.ts`, `lib/dashboard/sales-source.ts`, `lib/dashboard/insights-detectors.ts`
- Componentes: `components/features/dashboard/DashboardTabsShell.tsx`, `tabs/VisaoGeralTab.tsx`, `tabs/PipelineTab.tsx`, `tabs/VendasTab.tsx`, `tabs/ClientesTab.tsx`, `tabs/EquipeTab.tsx`, `PinnedCardsGrid.tsx`, `CopilotDock.tsx`, `InsightsStrip.tsx`

**Conexões**: lê `pipelines`, `contatos`/`negocios`, `financial_entries` (via widgets), `memberships` (filtro vendedor); Copiloto IA consome créditos de IA por conta (`lib/plans/server.ts`).

**Pontos de extensão por vertical**: `DashboardTabsShell` recebe 3 abas condicionais adicionais renderizadas só quando o nicho bate — `app/app/[orgSlug]/page.tsx:157-177`:
- `clinica` → `<ClinicaTab>` se `isClinicNiche(org.niche)`
- `imoveis` → `<ImobiliariaTab>` se `isRealEstateNiche(org.niche)`
- `trafego` → `<TrafegoTab>` se `isTrafficNiche(org.niche)`

Viagens não tem aba própria no dashboard hoje (usa as abas genéricas + `lib/dashboard/sales-source.ts:44`, que resolve "vendas" vs. `travel_sales` conforme o nicho).

---

## 2. Pipeline

**O que é**: kanban de leads/negociações — a tela central de vendas do CRM genérico.

**Funcionalidades principais**: múltiplos pipelines por org, drag-and-drop de card entre etapas, criação/edição rápida de lead, KPIs do pipeline (modal), busca/filtro por vendedor/tier/tags, view lista (mobile: acordeão por etapa).

**Arquivos-chave**:
- Rota: `app/app/[orgSlug]/pipeline/page.tsx`; CRUD de etapas em `app/app/[orgSlug]/configuracoes/pipelines/page.tsx`
- Actions: `actions/pipeline.ts` (`listPipelines`, `createPipeline`, `renamePipeline`, `setDefaultPipeline`, `deletePipeline`, `createStage`/`updateStage`/`reorderStages`/`deleteStage`); subconjunto de `actions/contatos.ts` (`createLead`, `updateLead`, `moveLeadToStage`, `getLead`, `assignLead`, `updateLeadValue`, `updateLeadTags`)
- Componentes: `components/features/pipeline/KanbanBoard.tsx`, `KanbanColumn.tsx`, `LeadCard.tsx`, `MobilePipelineList.tsx`, `LeadDetailDrawer.tsx`, `PipelineKpiBar.tsx`, `PipelineSwitcher.tsx`, `PipelineConfigDialog.tsx`
- Tabelas: `pipelines`, `pipeline_stages`, `contatos` (leads), `negocios` (espelho de negociação)

**Conexões**: leads do kanban **são** linhas de `contatos` (edição no Pipeline reflete direto em Contatos); `moveLeadToStage` espelha em `negocios`, converte lead em cliente automaticamente ao cair em etapa `is_won`, dispara eventos Inngest `lead.stage_changed`/`lead.tag_added` (consumidos por Automações), cria venda automática de viagem via `maybeCreateTravelSaleOnWon` (só nicho viagem), e envia evento Meta CAPI (`Purchase`/`NotQualified`).

**Achado de segurança** (`docs/audit/pipeline.md`): nenhuma das 10 actions de `actions/pipeline.ts` chama `checkMemberPermission` — enforcement só no menu lateral (`Sidebar.tsx:168-169`). Confirmar antes de reusar este achado numa tarefa nova, pois pode ter sido corrigido em commit recente (ver histórico do arquivo).

**Pontos de extensão por vertical**: nenhuma modificação direta na engine do Pipeline em si (etapas/`pipeline_stages` são 100% genéricas, sem coluna travel-only). A extensão acontece via efeito colateral de `moveLeadToStage`: em nicho Viagens, ganhar uma etapa `is_won` cria automaticamente uma venda (`maybeCreateTravelSaleOnWon`, dentro de `actions/contatos.ts`).

---

## 3. Contatos

**O que é**: CRM de leads/clientes — cadastro único de pessoa que alimenta Pipeline, Vendas/Reservas, Financeiro (indireto) e Conversas.

**Funcionalidades principais**: lista mestre com ~15 filtros via URL (busca, pipeline/etapa, tags, fonte, faixa de valor, dias sem contato, tier, status), painel de detalhe split (`?sel=`) e página de detalhe em tela cheia (`/contatos/[id]`); importação de CSV; upload de avatar/documentos; perfil de cliente (CPF/RG/passaporte/endereço); relacionamentos entre contatos; reabertura de negociação.

**Arquivos-chave**:
- Rotas: `app/app/[orgSlug]/contatos/page.tsx`, `contatos/[id]/page.tsx`, `contatos/importar/page.tsx`
- Actions: `actions/contatos.ts` (`createLead`, `updateLead`, `moveLeadToStage`, `updateLeadTags`, `bulkUpdateLeads`/`bulkDeleteLeads`, `listCustomers`/`getCustomer`, `upsertCustomerProfile`, `getContatoPanel`, `setContatoStatus`, `uploadContatoAvatar`, `listContatoDeals`/`reopenNegotiation`, `uploadCustomerDocument`, `getContatoTravelLinks`), `actions/relationships.ts`, `actions/saved_filters.ts`, `actions/import.ts` (`triggerCsvImport`)
- Componentes: `components/features/contatos/ContatosView.tsx` (1274 linhas, "god component"), `ContatoQuickEditCard.tsx`, `ContatoRelationships.tsx`, `CustomerProfileForm.tsx`, `CustomerDocuments.tsx`
- Tabelas: `contatos`, `contato_activities`, `contato_documents`, `contato_relationships`, `negocios`

**Conexões**: `pipeline_id`/`stage_id` posicionam no kanban (Pipeline); `getContatoTravelLinks` lê `travel_proposals`/`travel_sales` (Viagens); tarefas só na página completa, não no painel split; deep-link duplo pra Conversas (`?id=` vs `?lead=`); Meta CAPI ao ganhar/perder negociação; `canCreateLead` limita por plano (Billing).

**Achado de segurança** (`docs/audit/contatos.md:48`): `lib/permissions.ts` define chaves `leads`/`clients`, mas nenhuma action de `actions/contatos.ts`/`actions/relationships.ts` chama `checkMemberPermission` — bloqueio só na UI (link do Sidebar).

**Pontos de extensão por vertical**:
- **Viagens**: bloco de "Créditos de Viagem" injetado condicionalmente em `app/app/[orgSlug]/contatos/[id]/page.tsx:106,286` e `contatos/page.tsx:251` (via `isTravelNiche`), lendo `travel_credits` (`actions/travel-credits.ts`). Atalhos "Cotações enviadas"/"Reservas" (`getContatoTravelLinks`) também só aparecem para nicho viagem.
- Nenhuma modificação equivalente confirmada para Clínicas/Imóveis/Seguros/Tráfego nesta tela — a tabela `contatos` não tem coluna vertical-only (isolamento de dado correto); qualquer bloco extra dessas verticais, se existir, está nos módulos verticais dedicados, não em Contatos.

---

## 4. Tarefas

**O que é**: gerenciador de tarefas com kanban/lista/calendário, vinculável a um contato.

**Funcionalidades principais**: kanban de colunas customizáveis, view lista (buckets Atrasadas/Hoje/Próximas no mobile) e calendário; toggle de status; FAB mobile para criação rápida.

**Arquivos-chave**:
- Rota: `app/app/[orgSlug]/tarefas/page.tsx`
- Actions: `actions/tasks.ts` (`createTask`, `listTasksForSale`, `updateTask`/`deleteTask`, `toggleTaskStatus`, `setTaskStatus`/`setTaskPriority` [código morto], `listTaskColumns`/`createTaskColumn`/`renameTaskColumn`/`deleteTaskColumn`/`moveTaskToColumn`)
- Componentes: `components/features/tasks/TasksBoard.tsx`, `TaskDialog.tsx`, `SaleTasksList.tsx`, `TasksToday`/`TasksTodayWidget` (dashboard)
- Tabelas: `tasks`, `task_columns`

**Conexões**: `tasks.contato_id` FK pra Contatos; **achado principal** (`docs/audit/tarefas.md:38-46`): pelo menos 4-6 caminhos diferentes escrevem/leem `tasks` direto, bypassando `actions/tasks.ts` — `saveTravelSaleAndGenerateTasks` (Reservas/Viagens) insere tarefas direto sem passar pela validação Zod de `createTask`; `lib/inngest/automation.ts` (Automações) também insere direto; `actions/dashboard.ts`, `lib/ai/insights-tools.ts` leem direto.

**Achado de segurança**: `actions/tasks.ts` sem nenhuma chamada a `checkMemberPermission` — enforcement só no menu lateral.

**Pontos de extensão por vertical**: nenhuma extensão de UI por nicho encontrada em Tarefas propriamente — a extensão é indireta, via geração automática de tarefas fora da camada de actions (ex.: `saveTravelSaleAndGenerateTasks`, exclusivo de Viagens, em `actions/travel-sales.ts`).

---

## 5. Conversas (WhatsApp)

**O que é**: inbox de atendimento via WhatsApp Cloud API (Meta) — apesar do nome genérico "Conversas" no menu, cobre **só WhatsApp** (Instagram é módulo separado, ver seção 6).

**Funcionalidades principais**: lista + chat com filtros (vendedor/etapa), busca de mensagem, agendamento de envio (com fallback de template pra janela de 24h), templates de mensagem, criação de lead a partir da conversa, atribuição de conversa a membro.

**Arquivos-chave**:
- Rota: `app/app/[orgSlug]/conversas/page.tsx`; webhook: `app/api/webhooks/whatsapp/route.ts`
- Actions: `actions/whatsapp.ts` (595 linhas: `saveWhatsappConfig`, `connectWhatsappEmbedded`, `sendWhatsappMessage`, `markConversationAsRead`, `assignConversation`, `getConversationContext`, `createLeadFromConversation`, `scheduleWhatsappMessage`, `listScheduledMessages`, `cancelScheduledMessage`), `actions/whatsapp-templates.ts`
- Lib: `lib/whatsapp/meta-client.ts`, `lib/inngest/whatsapp-inbound.ts` (processa mensagem recebida + aciona o Agente de IA)
- Componentes: `components/features/conversas/WhatsappChat.tsx` (649 linhas), `ConversationDetailPanel.tsx`, `ScheduleMessageButton.tsx`
- Tabelas: `whatsapp_conversations`, `whatsapp_messages`, `scheduled_whatsapp_messages`, `contato_activities`

**Conexões**: `?lead=` resolve a conversa correspondente ao contato; `createLeadFromConversation` cria lead a partir de um número; `sendWhatsappMessage` grava `contato_activities`; Automações **não** têm gancho exposto no `WhatsappChat` (diferente do Instagram); templates linkam a `/whatsapp-templates`; gate de plano pela feature `whatsapp`.

**Achado de segurança** (`docs/audit/conversas.md:40,58-59`): `actions/whatsapp.ts` nunca chama `checkMemberPermission` — só checagem de feature de plano (não é permissão de papel); `actions/whatsapp-templates.ts` tem o mesmo gap e usa `createAdminClient()` (bypassa RLS).

**Pontos de extensão por vertical**: não há FK direta conversa→cotação/reserva no schema (`related_entity_id` inexistente) — nenhuma vertical estende esta tela diretamente hoje; o vínculo com Viagens é indireto, via `contato_id` + lookup manual.

---

## 6. Social (Instagram)

**O que é**: inbox de DM do Instagram — rota e componente completamente separados de Conversas/WhatsApp, não um hub unificado.

**Funcionalidades principais**: lista + chat de DMs, pausa de automação por conversa, automações simples do Instagram (funis, DM/comentário) em rota irmã (`/social` com abas via `InstagramTabsNav`).

**Arquivos-chave**:
- Rota: `app/app/[orgSlug]/social/inbox/page.tsx`; layout compartilhado `social/layout.tsx` + `InstagramTabsNav`; webhook: `app/api/webhooks/instagram/route.ts`
- Actions: `actions/social-inbox.ts` (`listConversations`, `getConversationMessages`, `sendManualMessage`, `toggleAutomationPause`, `markConversationRead` — todas com `guard()` que checa `checkMemberPermission(org.id, user.id, 'social')` **e** a feature de plano `instagram_automation`), `actions/social-automations.ts`, `actions/social-funnels.ts`
- Lib: `lib/social/engine.ts`
- Componentes: `components/features/social/SocialInbox.tsx` (222 linhas — bem mais simples que `WhatsappChat`, sem filtros/busca/agendamento/emoji/link-pro-lead)
- Tabelas: `social_conversations` (tem `contato_id`, mas a UI nunca usa pra linkar ao lead)

**Conexões**: automações de Instagram são um sistema **completamente separado** do builder de Automações genérico (`AutomationFlow`), gateado pela feature de plano `instagram_automation` e pela permissão `social` — não pela permissão `automations`.

**Pontos de extensão por vertical**: nenhuma extensão por vertical encontrada — Instagram é Core puro em todas as verticais.

---

## 7. Agente de IA

**O que é**: (a) atendimento conversacional automático no WhatsApp; (b) qualificação automática de lead por IA; (c) copiloto de insights no dashboard.

**Funcionalidades principais**: resposta automática a mensagens de WhatsApp dentro de horário/config da org; scoring/qualificação de lead; chat "sandbox" de teste do agente em Configurações; copiloto (FAB no dashboard) para perguntas sobre a org.

**Arquivos-chave**:
- Lib: `lib/ai/attendant-engine.ts` (motor **puro**, sem I/O — quem busca dados/chama a API é o caller), `lib/ai/run-qualification.ts`, `lib/ai/api-key.ts` (`getPlatformAiKey`/`hasPlatformAiKey` — chave de plataforma centralizada, não por-org), `lib/ai/insights-tools.ts`
- Caller real: `lib/inngest/whatsapp-inbound.ts` (produção) e `actions/ai_attendant.ts` (sandbox de configuração)
- Configuração: `app/app/[orgSlug]/configuracoes/agente-ia/page.tsx` + `AgenteIaTabs.tsx` (8 sub-abas — 3 são "Em breve" já em produção: `fluxos`, `ferramentas`, `memória`), gateado pela feature de plano `ai_attendant`
- Créditos: `consumeAiCredits()`/`checkFeatureAccess()` em `lib/plans/server.ts`

**Conexões**: consome créditos de IA por conta (não por-org — arquitetura antiga de chave por-org foi removida); qualificação dispara ao receber `lead.qualify_requested` (de Formulários e outros pontos de entrada); regra do projeto: **sempre validar `checkFeatureAccess`/créditos antes de chamar a API de IA, nunca depois**.

**Pontos de extensão por vertical**: o motor em si (`attendant-engine.ts`) é genérico; qualquer prompt/instrução específica de vertical (ex.: viagens) entraria via configuração de org (`agente-ia`), não via código hardcoded por nicho — não há branch de nicho identificado dentro do motor.

---

## 8. Automações

**O que é**: motor de automação de marketing/vendas — gatilho → passos (enviar WhatsApp/e-mail, mover etapa, criar tarefa, webhook) com builder visual.

**Funcionalidades principais**: construtor de fluxo visual (nós arrastáveis, conexões), execuções com timeline/logs, ativar/pausar automação, filtros de log paginados.

**Arquivos-chave**:
- Rotas: `app/app/[orgSlug]/automacoes/layout.tsx` (busca `getAutomations`), `[id]/page.tsx`, `logs/page.tsx`, `logs/[runId]/page.tsx`
- Actions: `actions/automations.ts` (`getAutomations`, `getAutomation`, `createAutomation`, `updateAutomation`, `deleteAutomation`, `toggleAutomation`, `getStepStats`), `actions/automation-logs.ts`
- Motor: `lib/inngest/automation.ts` (`processAutomationEvent`, `executeAutomationRun`), crons em `lib/inngest/automation-crons.ts`
- Componentes: `components/features/automations/AutomationsShell.tsx`, `AutomationEditor.tsx`, `AutomationFlow.tsx` (construtor visual — **sem adaptação mobile**, ver `docs/audit/automacoes.md`), `AutomationRunsPanel.tsx`
- Tabelas: `automations`, `automation_runs`, `automation_step_logs`

**Conexões — eventos consumidos por `processAutomationEvent`**:
| Evento | Disparado de |
|---|---|
| `form.submitted` | Formulários públicos |
| `lead.stage_changed` | Pipeline/Contatos (`moveLeadToStage`) |
| `lead.tag_added` | Pipeline/Contatos (2 pontos — criação e edição de lead) |
| `appointment.booked` | Agendamentos (`actions/appointments.ts`) |
| `task.overdue`, `lead.stale`, `customer.birthday` | Crons diários |

Execução escreve direto em `tasks`, `contatos.stage_id`/`tags`, dispara WhatsApp/e-mail/push/webhook de saída.

**Achado de segurança**: nenhuma rota/action de Automações chama `checkMemberPermission`; mutantes usam `createAdminClient()` (bypassa RLS) após resolver só o slug da org.

**Achado de documentação importante**: a premissa de que Automações de Instagram compartilham este builder é **incorreta** — são sistemas totalmente separados (ver seção 6, Social).

**Pontos de extensão por vertical**: nenhuma bifurcação por nicho encontrada no motor — `step_type`/`trigger_type` são strings livres, genéricas para qualquer vertical. Verticais participam só como **origem de eventos** (ex.: Reservas pode disparar eventos via `contatos`/`tasks` compartilhados), não como modificação do motor em si.

---

## 9. Financeiro

**O que é**: controle de lançamentos financeiros (receita/despesa), integrado ao Asaas para cobrança, com dashboard e DRE simplificado.

> **Restrição importante confirmada no código**: `app/app/[orgSlug]/financeiro/page.tsx` faz `redirect` se `!isTravelNiche(org.niche)` — ou seja, **hoje o módulo Financeiro só é alcançável por orgs do nicho Viagens**, apesar de as tabelas/actions serem 100% genéricas (nenhuma coluna travel-only em `financial_entries`). Do ponto de vista de dado é Core Puro; do ponto de vista de acesso, é gateado por nicho — um caso de "Core tecnicamente pronto, mas não exposto às outras verticais ainda". Vale confirmar com o dono do produto se isso é intencional antes de generalizar o link no menu para outras verticais.

**Funcionalidades principais**: lançamentos (receita/despesa, recorrência, anexos), configurações (categoria/subcategoria/centro de custo/conta/operadora/forma de pagamento), dashboard (KPIs, fluxo de caixa, DRE simplificado, próximos vencimentos), importação de CSV, sugestão de categoria via IA (Claude Haiku).

**Arquivos-chave**:
- Rota: `app/app/[orgSlug]/financeiro/page.tsx`
- Actions: `actions/financial.ts` (`syncSaleRevenueEntry` — ponte Reservas→Financeiro, `listFinancialEntries`, `createFinancialEntry`, `updateFinancialEntry`/`deleteFinancialEntry`, `bulkCreateFinancialEntries`, `suggestCategoryForEntry`, `uploadFinancialAttachment`, agregações de dashboard), `actions/financial-settings.ts`
- Componentes: `components/features/financeiro/FinanceiroTabs.tsx`, `FinancialDashboard.tsx`, `FinancialEntriesView.tsx`, `FinancialSettingsView.tsx`, `FinancialCsvImporter.tsx`
- Integração: `lib/asaas/` (Asaas — billing de assinatura, não confundir com lançamentos manuais de Financeiro)
- Tabelas: `financial_entries`, `financial_settings`

**Conexões**: `syncSaleRevenueEntry` é chamado por `saveTravelSaleAndGenerateTasks` (Reservas/Viagens) após salvar uma venda — cria/atualiza entrada de receita de comissão automaticamente; match do dia de pagamento do operador é por `ilike` contra `sale.operator` — se não bater, a entrada fica sem vencimento silenciosamente.

**Achado de segurança**: página só verifica nicho, não permissão `financial`; todas as actions de leitura não chamam `checkMemberPermission` (só as mutantes checam).

**Pontos de extensão por vertical**: nenhuma extensão de dado por vertical — o ponto de extensão é o **gate de acesso inteiro do módulo**, hoje restrito a Viagens (`isTravelNiche` no redirect da página) e o único produtor automático de lançamento é `syncSaleRevenueEntry`, específico de `travel_sales`.

---

## 10. Formulários públicos

**O que é**: formulários de captação de lead embutíveis/públicos, com builder visual, insights e respostas.

**Funcionalidades principais**: builder de schema (campos, boas-vindas, aparência, CTA WhatsApp/agendamento), preview clássico ou "uma pergunta por tela", antispam (honeypot, tempo mínimo, Turnstile — **efetivamente inerte**, rate limit por IP), insights (KPIs + Recharts), respostas com filtro/paginação.

**Arquivos-chave**:
- Rotas privadas: `app/app/[orgSlug]/forms/page.tsx`, `[id]/edit`, `[id]/insights`, `[id]/respostas`
- Rotas públicas: `app/(public)/f/[slug]/page.tsx`, `f/[slug]/preview/page.tsx`
- Actions: `actions/forms.ts` (`getForms`, `createForm`, `updateForm`, `deleteForm`, `toggleFormActive`), `actions/public_forms.ts` (`submitPublicForm`), `actions/form_submissions.ts` (`getFormInsights`, `getLeadFormResponses`, `getFormWithSubmissions`)
- Componentes: `components/features/forms/FormBuilder.tsx`, `FormInsightsView.tsx`, `FormResponsesView.tsx`, `PublicFormPreview.tsx`/`OneQuestionForm.tsx`
- Tabelas: `forms`, `form_submissions`

**Conexões**: `submitPublicForm` faz o pipeline completo — antispam → validação Zod → upsert de lead por e-mail → insere `form_submissions`+`contato_activities` → dispara `form.submitted`/`lead.qualify_requested` (Inngest, consumido por Automações e Qualificação de IA) → notificação push/in-app → evento Meta CAPI `Lead`; Marketing lê `form_submissions.utm_campaign` para atribuição de campanha (match exato, sem fuzzy — UTMs sem correspondência são descartados silenciosamente); `LeadFormResponsesButton` no `LeadCard` do Pipeline mostra respostas inline; CTA "Consultar horários" linka para Agendamentos (`/book/{orgSlug}/{eventTypeSlug}`).

**Achado de segurança/privacidade**: `/f/[slug]/preview` sem auth nem checagem de `is_active` — vaza design/copy de formulário rascunho para qualquer anônimo com o slug; `actions/form_submissions.ts` sem verificação de permissão.

**Pontos de extensão por vertical**: nenhuma extensão de schema por vertical encontrada — Formulários é Core puro; o CTA de agendamento é o único ponto que toca um módulo core-extensível (Agendamentos, ele mesmo oculto para Viagens).

---

## 11. Marketing/Campanhas de Anúncio

**O que é**: dashboard de desempenho de campanhas de anúncio (Meta/Google/TikTok) — CRUD manual + import de CSV, **sem integração de API real** com as plataformas de anúncio ainda (`external_id` existe "para futuras integrações" mas não é consumido).

**Funcionalidades principais**: overview com KPIs/gráfico/tabela por período, gestão de contas de anúncio, importação de CSV de campanhas, lançamento manual de gasto diário.

**Arquivos-chave**:
- Rotas: `app/app/[orgSlug]/marketing/page.tsx`, `marketing/contas/page.tsx`, `marketing/importar/page.tsx`
- Actions: `actions/marketing.ts` (`listAdAccounts`/CRUD, `listCampaigns`/CRUD, `recordCampaignMetric`/`bulkRecordCampaignMetrics`, `getMarketingOverview`)
- Componentes: `components/features/marketing/MarketingOverview.tsx`, `CampaignsTable.tsx`, `AdAccountsManager.tsx`, `CsvImporter.tsx`, `RecordSpendDialog.tsx`
- Tabelas: `ad_accounts`, `campaigns`, `campaign_metrics_daily`

**Conexões**: atribuição de leads via `form_submissions.utm_campaign` casado com `campaigns.utm_campaign` (não usa a tabela `marketing_leads`, que é um recurso não relacionado — captura pública do site institucional, plano Business). Meta Pixel/CAPI conecta de fato em Pipeline (`moveLeadToStage`) e Formulários públicos, não neste módulo.

**Achado de segurança grave** (`docs/audit/marketing.md:39,61`): a query de atribuição de leads dentro de `getMarketingOverview` (sobre `form_submissions`) **não filtra por `organization_id`** — vazamento cross-tenant se dois orgs usarem o mesmo `utm_campaign`. Este é o achado mais crítico entre todos os módulos Core auditados — recomenda-se verificar se já foi corrigido antes de considerar resolvido.

**Pontos de extensão por vertical**: nenhuma extensão por nicho encontrada — Core puro em todas as verticais.

---

## 12. Campanhas de Envio (e-mail/WhatsApp)

**O que é**: disparo de campanhas de e-mail/WhatsApp em massa para segmentos de contatos (distinto do módulo "Marketing" acima, que é sobre anúncios pagos).

**Arquivos-chave**: `actions/campaigns.ts`, `actions/send-campaigns.ts`, `lib/inngest/send-campaigns-cron.ts`

**Conexões**: usa Resend (e-mail) e a mesma infraestrutura de WhatsApp Cloud API para disparo; permissão dedicada `campaigns` (seção "Comunicação" em `PERMISSION_MODULES`, distinta de `marketing`).

**Pontos de extensão por vertical**: nenhum encontrado nesta rodada de leitura — recomenda-se checar `actions/campaigns.ts` em detalhe numa tarefa futura, pois não fazia parte de nenhum `docs/audit/*.md` existente.

---

## 13. Configurações

**O que é**: hub de configuração da org — geral, equipe, integrações, IA, billing, segurança.

**Funcionalidades principais** (14 sub-rotas): dados da empresa/branding/nicho (Geral), Agente de IA (8 sub-abas), Assinatura/billing, Equipe (owner/admin only), Google Business (OAuth), IA Qualificadora, hub de Integrações + Saúde, Meta Pixel/CAPI, Notificações, Multi-org, Pipelines (CRUD), MFA/Segurança, Instagram (+ exclusão de dados), WhatsApp.

**Arquivos-chave**:
- Rotas: `app/app/[orgSlug]/configuracoes/**` (raiz, `agente-ia`, `assinatura`, `equipe`, `google-business`, `ia`, `integracoes`, `integracoes/saude`, `meta`, `notificacoes`, `organizacoes`, `pipelines`, `seguranca`, `social`, `whatsapp`)
- Actions: `actions/organization.ts` (732 linhas — `getOrgGeneral`/`updateOrgNiche`, `updateOrgAppearance`, `getOrgCompany`/`updateOrgCompany`, `getMonthlyRevenueGoal`, multi-org, `getOrgMetaConfig`/`saveOrgMetaConfig`, `deleteOrganization`), `actions/team.ts`, `actions/ai_attendant.ts`, `actions/notifications.ts`, `actions/mfa.ts`, `actions/google-business.ts`, `actions/health.ts`
- Componentes: `SettingsTabsNav.tsx` (presente em só 7 das ~15 sub-páginas), `OrganizationsClient.tsx`, `CompanyBrandingCard.tsx`, `PipelinesManager.tsx`, `AgenteIaTabs.tsx`, `MetaConfigForm.tsx`

**Conexões**: `niche` (nível conta, espelhado na org) é o gate central de toda a visibilidade vertical no app inteiro — `updateOrgNiche` revalida o layout inteiro; `logo_url`/dados da empresa alimentam praticamente toda superfície de impressão (voucher, contrato, cotação, documento); `meta_pixel_id`/token alimentam CAPI em Pipeline e Formulários; chave de IA da plataforma alimenta toda feature de IA.

**Achado de segurança**: chave `settings` só checada no Sidebar; `equipe`/`organizacoes` usam checagem hardcoded de papel (`owner`/`admin`), bypassando o sistema granular; demais sub-páginas sem verificação nenhuma.

**Pontos de extensão por vertical**: `updateOrgNiche` (`actions/organization.ts`) é o ponto de entrada — mudar o nicho da org é o que ativa/desativa todos os módulos verticais via `lib/niche-modules.ts`. `TeamClient.tsx:58-59` usa `isTravelNiche` só para exibir badge no seletor de nicho (uso cosmético, não é gate).

---

## 14. Permissões

**O que é**: sistema de autorização de dois níveis — role (`owner`/`admin`/`member`) + permissões granulares por módulo (~40 chaves hoje, cresceu além das ~28 originais do CLAUDE.md conforme novas verticais foram adicionadas).

**Funcionalidades principais**: `canAccess(role, permissions, key)` — owner sempre passa; admin passa a menos que explicitamente negado (`false`); member precisa de concessão explícita (`true`). `groupedModules(isTravel)` agrupa módulos por seção para a UI de configuração de equipe, ocultando os que não se aplicam ao nicho da org.

**Arquivos-chave**:
- `lib/permissions.ts`: `PermissionKey` (união de chaves Core + por-vertical — viagens, clínicas, imóveis, seguros, tráfego todas na mesma union type), `PERMISSION_MODULES`, `canAccess`, `allPermissions`, `defaultMemberPermissions`, `groupedModules`
- `lib/permissions.server.ts`: `checkMemberPermission(orgId, userId, key)` — **server-only**, consulta `memberships.role`+`.permissions`

**Conexões**: é a camada nominalmente responsável por autorização em toda Server Action sensível — mas a auditoria por módulo (seções 2-13 acima) mostra que a maioria das actions **não chama `checkMemberPermission`**, dependendo só de `getCurrentOrganization`/RLS + esconder o link no Sidebar. Isso é um padrão recorrente e não um caso isolado — vale tratar como risco sistêmico do produto, não bug pontual de um módulo.

**Pontos de extensão por vertical**: `PermissionKey` já tem seções dedicadas por vertical (Viagens: `reservas`/`cotacoes`/`ofertas`/`embarques`/`bloqueios`/`explorar_voos`/`documentos`/`roteirista`; Clínicas: `profissionais`/`orcamentos_clinica`/etc.; Imóveis: `imoveis`; Seguros: `seguros`; Tráfego: `trafego`) — mas o **motor** (`canAccess`, `checkMemberPermission`) é 100% genérico, sem lógica hardcoded por nicho.

---

## 15. Billing/Planos

**O que é**: gestão de assinatura/plano por conta (não por org — uma conta pode ter N orgs compartilhando um plano), integrada ao Asaas.

**Funcionalidades principais**: checkout de assinatura (PIX/cartão, mensal/semestral/anual), consulta de feature/crédito de IA disponível, addons, limites de plano (nº de orgs, membros, leads).

**Arquivos-chave**:
- `lib/plans/server.ts` (autoritativo — `getAccountSubscription`, `checkFeatureAccess`/`checkFeatureAccessByOrgSlug`, `consumeAiCredits`, via SQL `account_has_feature`/`consume_ai_credits` SECURITY DEFINER)
- `lib/plans/config.ts` (mirror client-safe — `AI_CREDIT_COST`, `getPlanMeta`, `FeatureKey`, `PlanId`)
- `lib/billing/plans.ts`, `lib/billing/limits.ts`, `lib/billing/addons.ts`, `lib/billing/plan-features.ts`
- Actions: `actions/billing.ts` (`createCheckoutSession` via Asaas — cria/reusa customer Asaas, cria assinatura, retorna URL de pagamento)
- Integração: `lib/asaas/` (webhook ativa o plano após pagamento confirmado)
- Tabelas: `subscriptions` (1 por conta, join com catálogo `plans`)

**Conexões**: gate transversal — toda feature premium (`ai_attendant`, `instagram_automation`, `export_reports`, etc.) e todo limite (`canCreateLead`, nº de membros) passa por aqui; super-admin bypassa a maioria das checagens em SQL.

**Pontos de extensão por vertical**: nenhum — Billing é inteiramente agnóstico de nicho, opera no nível de conta/feature, não de vertical.

---

## 16. Super-admin

**O que é**: painel administrativo da plataforma (`/super-admin`), fora do escopo de qualquer org — métricas executivas, gestão de contas/usuários/planos, auditoria, backups.

**Funcionalidades principais**: visão executiva (MRR/ARR, contas pagantes, créditos de IA usados, distribuição de plano, novas orgs 7d/30d); gestão de orgs/usuários/convites; créditos de IA; alertas; auditoria; backups; configurações de plataforma; referrals; impersonação de org (com banner e auditoria, conforme CLAUDE.md).

**Arquivos-chave**:
- Rotas: `app/super-admin/page.tsx` (overview), `orgs/`, `users/`, `plans/`, `ai-credits/`, `alertas/`, `audit/`, `backups/`, `convites/`, `referrals/`, `settings/`, `activate/`
- Actions: `actions/super-admin.ts` (`getExecutiveMetrics`)

**Conexões**: bypassa RLS/permissões via checagem de `raw_user_meta_data->>is_super_admin` (sempre em SQL/RLS, nunca só client, conforme CLAUDE.md); lê agregados de `subscriptions`, `organizations`, `accounts`.

**Pontos de extensão por vertical**: nenhum — super-admin opera acima do conceito de nicho (visão de plataforma inteira).

---

## 17. Relatórios

**O que é**: exportação de datasets tabulares (PDF/Excel) — leads, vendas, agendamentos, comissão, imóveis.

**Funcionalidades principais**: geração de relatório com colunas/linhas/totais uniformes, alimentando tanto export CSV quanto view PDF imprimível; gate pela feature de plano `export_reports` (Business, super-admin bypassa).

**Arquivos-chave**:
- Actions: `actions/reports.ts` (`ReportType = 'leads' | 'sales' | 'appointments' | 'commission' | 'imoveis'`)
- Rota: `app/app/[orgSlug]/relatorios/page.tsx`

**Conexões**: leitura RLS-scoped por org; nomes de vendedor resolvidos via admin client (exceção documentada — vendedores vivem em `auth`, não em tabela RLS-friendly).

**Pontos de extensão por vertical**: o próprio `ReportType` já inclui `'imoveis'` como tipo de relatório dedicado a uma vertical — e o achado da auditoria anterior (`core-vs-vertical-audit.md`) aponta `actions/reports.ts:174` como ponto de ramificação por `isTravelNiche` para métricas de viagem (relatório `sales` ganha bloco de métricas específico de viagem quando o nicho bate — CORE EXTENSÍVEL). Vale reconfirmar linha exata em tarefa que tocar este arquivo, pois o arquivo tem cabeçalho de módulo diferente do lido nesta passada (196 linhas visíveis, checagem completa não feita além do topo).

---

## 18. Saúde das integrações

**O que é**: dashboard de saúde/observabilidade das integrações externas por org — substitui a ausência de uma ferramenta de observability tipo Sentry (que **não existe** no projeto, conforme CLAUDE.md).

**Funcionalidades principais**: probes bounded (timeout 8s) para WhatsApp, E-mail, Inngest, Supabase — cada probe retorna status (`healthy`/`warning`/`error`/`disconnected`) + sub-checks detalhados; rodam a cada org a cada 15 minutos via cron.

**Arquivos-chave**:
- Lib: `lib/health/checks.ts` (probes puros, nunca lançam exceção — sempre retornam `HealthResult`), `lib/health/run.ts`
- Actions: `actions/health.ts`
- Rota: `app/app/[orgSlug]/configuracoes/integracoes/saude/page.tsx`

**Conexões**: consome credenciais já configuradas em Configurações (WhatsApp, e-mail via Resend) para testar conectividade; grava histórico para timeline.

**Pontos de extensão por vertical**: nenhum — as 4 integrações monitoradas (`whatsapp`, `email`, `inngest`, `supabase`) são infraestrutura Core comum a todas as verticais.

---

## 19. Backup & Disaster Recovery

**O que é**: backup diário automatizado do banco Postgres + Storage, com retenção em camadas, criptografia e verificação de integridade obrigatória — Fase 1 (**sem restore automatizado**, conforme comentário no próprio código).

**Funcionalidades principais**: dump + compressão + checksum SHA-256 + criptografia + upload para R2 (multi-tier de retenção); nunca marca sucesso sem checar integridade; audit log de cada evento de backup.

**Arquivos-chave**:
- `lib/inngest/backup-cron.ts` (`backupDatabaseCronFn` — cron diário `0 3 * * *`)
- `lib/backup/db-dump.ts`, `lib/backup/crypto.ts`, `lib/backup/r2-backup-client.ts`, `lib/backup/manifest.ts`, `lib/backup/storage-backup.ts`, `lib/backup/retention.ts`, `lib/backup/alert.ts`
- Rota admin: `app/super-admin/backups/page.tsx`
- Tabelas: `backup_runs`, `backup_audit_log`
- Doc de referência: `docs/backup-disaster-recovery.md`

**Conexões**: `backupStorageObjects`/`backupLegacySupabaseBuckets` fazem backup de todos os 14 buckets do Supabase Storage listados no CLAUDE.md, sem distinção por vertical; alertas via `sendBackupAlert`.

**Pontos de extensão por vertical**: nenhum — infraestrutura de plataforma, opera sobre o banco inteiro sem consciência de nicho.

---

## 20. Command Palette / busca global

**O que é**: paleta de comando global (⌘K/Ctrl+K) com navegação, busca e ações rápidas.

**Funcionalidades principais**: navegação de um-toque para qualquer destino do Sidebar; busca debounced server-side sobre leads + clientes; toggle de tema; sair da conta.

**Arquivos-chave**:
- `components/features/CommandPalette.tsx`, `components/features/HeaderSearchBar.tsx`
- Actions: `actions/search.ts` (`searchEverything`)

**Conexões**: a lista de navegação espelha o Sidebar — qualquer módulo novo (Core ou vertical) precisa ser adicionado manualmente aqui também para aparecer na paleta (não é derivado automaticamente do registry `lib/niche-modules.ts`).

**Pontos de extensão por vertical**: nenhuma menção a nicho encontrada no arquivo lido (60 primeiras linhas) — a paleta lista entradas de navegação estáticas; se módulos verticais aparecem nela, seria preciso confirmar se há filtragem condicional mais abaixo no arquivo (não confirmado nesta passada).

---

## 21. Notificações

**O que é**: preferências de notificação in-app/push por usuário/org, com modelo opt-out (categoria fica ativa a menos que o usuário desative explicitamente).

**Funcionalidades principais**: leitura/atualização de preferências por categoria; helpers server-only para o dispatcher de push decidir quem notificar.

**Arquivos-chave**:
- Actions: `actions/notifications.ts` (`getNotificationPrefs`, `updateNotificationPrefs`, `isNotificationEnabled`, `filterUsersByCategory`)
- Lib: `lib/notifications/categories.ts` (`ALL_NOTIFICATION_CATEGORIES`, `withDefaults`, `isCategoryEnabled`)
- Rota: `app/app/[orgSlug]/configuracoes/notificacoes/page.tsx`
- Tabela: `notification_prefs`

**Conexões**: consumido por qualquer fluxo que dispare notificação — novo lead (Formulários), tarefa vencendo, execução de automação, etc.

**Pontos de extensão por vertical**: nenhum encontrado — categorias de notificação são genéricas; se uma vertical adiciona uma categoria própria (ex.: "embarque próximo" em Viagens), estaria em `lib/notifications/categories.ts`, não confirmado nesta passada (recomenda-se checar ao tocar este arquivo).

---

## 22. Agendamentos (calendário genérico)

**O que é**: módulo de agenda de compromissos do CRM genérico — **não usado por Viagens** (decisão de produto documentada em `core-vs-vertical-audit.md`: a operação de viagem não passa por um compromisso de agenda separado da venda/reserva).

**Registro no `ModuleKey`**: `agendamentos`, dentro de `GENERIC_ONLY` em `lib/niche-modules.ts` — visível para qualquer nicho que **não seja** Viagens; dentro de Imóveis é adicionalmente excluído (`NOT_REAL_ESTATE`, pois duplica "Visitas"/`property_visits`, Fase 2 da vertical de Imóveis).

**Arquivos-chave**: `actions/appointments.ts` (dispara `appointment.booked`, consumido por Automações); rota `/book/{orgSlug}/{eventTypeSlug}` (booking público, linkado de Formulários).

**Conexões**: `appointment.booked` → Automações; CTA em Formulários públicos linka pra cá quando `schema.booking.enabled`.

**Pontos de extensão por vertical**: é o inverso do padrão usual — este módulo **Core** é **desligado** para Viagens e para parte de Imóveis, ao invés de ganhar extensão. Clínicas usa Agendamentos normalmente (agenda de consultas é o mesmo conceito genérico).

---

## 23. Catálogo/Vendas (CRM genérico não-viagem)

**O que é**: par de módulos do CRM genérico — Catálogo (produtos/serviços) e Vendas (registro de venda avulsa) — que em Viagens são substituídos por Ofertas/Reservas, e em Tráfego foram recentemente transformados em "Planos" com contrato de assinatura recorrente (`plan_contracts`, ver commits `38d4cbd`/`0f64049`/`7bc19da`/`22a4c2a` no histórico recente — mudança "Vendas vira assinatura de plano com contrato").

**Registro no `ModuleKey`**: `catalogo`, `vendas`, dentro de `GENERIC_ONLY` em `lib/niche-modules.ts` — ocultos só para Viagens; dentro de Imóveis, `vendas`/`catalogo` também são excluídos (`NOT_REAL_ESTATE`: "vendas duplica Negociações/`property_deals`... catálogo não tem equivalente na vertical").

**Pontos de extensão por vertical** (o mais ativo dos módulos "genéricos condicionais" no momento):
- **Agências de Tráfego**: commits recentes (22a4c2a e anteriores) reescreveram este par especificamente para o nicho de Tráfego — Sidebar mostra "Planos" em vez de "Catálogo" (`0f64049`), Vendas virou assinatura de plano com contrato próprio em tabela `plan_contracts` (`7bc19da`, substituindo o uso anterior de `contracts` genérica), e o commit mais recente do repo (`22a4c2a`) corrigiu checagem de permissão faltante nos contratos tanto de Reservas (Viagens) quanto de Planos (Tráfego) — sinal de que este é o par de módulos com desenvolvimento mais ativo agora. Vale tratar como zona de mudança rápida: revalidar contra o código antes de qualquer tarefa que toque `actions/contracts.ts`/`actions/plan-contracts.ts` (ambos aparecem modificados no `git status` no momento desta auditoria, ainda não commitados).
- **Viagens**: substituído por Ofertas (`ofertas`) e Reservas (`reservas`), ambos `TRAVEL_ONLY`.
- **Imóveis**: excluído por completo (usa Negociações/Visitas em vez disso).

**Arquivos-chave a confirmar em tarefa futura**: `actions/contracts.ts`, `actions/plan-contracts.ts` (ambos com mudanças não commitadas no momento desta auditoria — ver `git status`), rota de Catálogo/Vendas/Planos no Sidebar.
