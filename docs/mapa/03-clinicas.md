# Mapa da vertical Clínicas

Gerado em: 2026-08-22, baseado no código em HEAD.

Nicho gate: `isClinicNiche(niche)` em `lib/niche.ts:15-18` — `niche` (case-insensitive) contém `clinic` ou `clínic`. Valor canônico salvo em `organizations.niche`: `'Clínicas'` (`lib/niche.ts:53`).

Construída em 13 fases sequenciais (ver `git log --oneline --all | grep -i clinic`, do commit `d69fc92` "fundação" ao `6e79f94` "IA para clínicas"). Cada fase tem sua migration numerada (`0164`–`0171`) e um princípio de design repetido em quase todo commit: **nunca duplicar entidade do Core** — paciente é sempre `contatos`, agenda é sempre `appointments`/`event_types`, financeiro é sempre `financial_entries`, tarefas são sempre `tasks`, automação é sempre o motor Inngest genérico.

## Sumário

1. [Fundação — Especialidades, Profissionais, Salas e contexto clínico](#1-fundação)
2. [Lembrete automático de agendamento (24h)](#2-lembrete-automático)
3. [Orçamentos](#3-orçamentos)
4. [Atendimentos](#4-atendimentos)
5. [Tratamentos e Pacotes](#5-tratamentos-e-pacotes)
6. [Lista de Espera](#6-lista-de-espera)
7. [Comissões](#7-comissões)
8. [Retornos](#8-retornos)
9. [Dashboard clínico](#9-dashboard-clínico)
10. [Auditoria LGPD (fase 11)](#10-auditoria-lgpd)
11. [Eventos de automação (fase 12)](#11-eventos-de-automação)
12. [Copiloto IA para Clínicas (fase 13)](#12-copiloto-ia)
13. [Permissões e menu](#13-permissões-e-menu)
14. [Onde esta vertical modifica o Core](#onde-esta-vertical-modifica-o-core)

---

## 1. Fundação

**O que é**: catálogo de recursos da clínica (especialidades, profissionais, salas) + duas tabelas de contexto 1:1 que "penduram" dado clínico sobre entidades Core já existentes, sem alterá-las.

**Funcionalidades**: CRUD de especialidades/profissionais/salas; upsert de contexto clínico de serviço (preço, especialidade, sala padrão) sobre um `event_type`; upsert de contexto clínico de agendamento (profissional, sala, status operacional) sobre um `appointment`; máquina de estados operacional do agendamento (`clinic_status`), separada do `appointments.status` genérico do Core.

**Arquivos-chave**:
- Migration: `supabase/migrations/0164_clinic_vertical_foundation.sql` — cria `clinic_specialties`, `clinic_professionals`, `clinic_rooms`, `clinic_service_context` (PK = `event_type_id`), `clinic_appointment_context` (PK = `appointment_id`). RLS padrão (`get_user_organizations()` + super-admin) em todas.
- Actions: `actions/clinic.ts` — CRUD de especialidades/profissionais/salas (linhas 26-181), `getClinicServiceContext`/`upsertClinicServiceContext` (183-213), `listClinicAppointmentContexts`/`upsertClinicAppointmentContext` (215-265), `setClinicAppointmentStatus` (271-379, ver seção Core abaixo).
- Constantes: `lib/clinic-constants.ts` — `CLINIC_STATUSES` (8 estados: `aguardando_confirmacao`, `agendado`, `confirmado`, `em_atendimento`, `realizado`, `cancelado`, `reagendado`, `no_show`) e labels PT-BR.
- Rota/UI: `app/app/[orgSlug]/profissionais/page.tsx` + `ProfissionaisClient.tsx`.
- `app/app/[orgSlug]/agendamentos/page.tsx:11-16,37-57,90-95` — injeta dados clínicos (especialidades/profissionais/salas/contextos) na tela de Agendamentos quando `isClinicNiche(org.niche)`.

**Conexões**: `clinic_service_context.event_type_id` → `event_types` (Core, "serviço"); `clinic_appointment_context.appointment_id` → `appointments` (Core, "agenda"); paciente = `appointments.lead_id` → `contatos` (Core), nunca duplicado.

**Regra de status**: `clinic_status` é a máquina de estados fina da clínica; `appointments.status` do Core continua só `scheduled`/`canceled`/`completed` e é sincronizado de forma mínima por `setClinicAppointmentStatus` (nunca o CHECK constraint do Core é alterado, para não quebrar agenda de outros nichos).

---

## 2. Lembrete automático

**O que é**: envio automático de WhatsApp (template Meta) 24h antes de cada agendamento, específico para orgs de Clínicas.

**Funcionalidades**: criação de um template padrão (`lembrete_agendamento_24h`, categoria UTILITY) como rascunho local; card de status no topo de Agendamentos (rascunho → aguardando aprovação Meta → aprovado → lembretes ativos); cron a cada 30 min que varre agendamentos na janela 23h30–24h30 à frente, sem lembrete enviado, com template aprovado, e envia via `sendTemplateMessage`.

**Arquivos-chave**:
- Migration: `supabase/migrations/0165_clinic_reminder_template.sql` — coluna `org_settings.clinic_reminder_template_name`.
- Actions: `actions/clinic.ts:390-455` — `getClinicReminderSettings`, `ensureClinicReminderTemplate`.
- Cron: `lib/inngest/clinic-crons.ts` — function `clinic-appointment-reminder`, `{ cron: '*/30 * * * *' }`. Filtra: org é `isClinicNiche` → tem `clinic_reminder_template_name` configurado → template correspondente tem `status='approved'` em `whatsapp_templates` → agendamento com `clinic_status` em `('agendado','confirmado')`, `reminder_sent_at IS NULL`, `appointments.status='scheduled'`, `start_time` na janela. Marca `reminder_sent_at` após envio (idempotência).
- Componente: `components/features/appointments/ClinicReminderCard.tsx`.
- Precisa estar registrada em `app/api/inngest/route.ts` (ver Inngest global) — confirme lá se aparece na lista de functions ativas.

**Inngest**: cron `clinic-appointment-reminder`. Não usa evento (`triggers: [{ cron }]`), roda direto contra o banco via `createAdminClient()`.

---

## 3. Orçamentos

**O que é**: orçamento comercial (não é "prontuário") vinculado a um paciente, com itens (serviço opcional + descrição + qtd + preço) e fluxo de status.

**Funcionalidades**: CRUD completo com full-replace dos itens em edição; transições de status `rascunho → enviado → visualizado → aprovado`, com saídas alternativas `recusado`/`expirado`/`cancelado` (não força ordem estrita); ao aprovar, dispara comissão automática (se profissional com `commission_pct` vinculado) e evento de automação.

**Arquivos-chave**:
- Migration: `supabase/migrations/0166_clinic_quotes.sql` — `clinic_quotes` (status CHECK 7 valores) + `clinic_quote_items` (RLS via join no `quote_id`).
- Actions: `actions/clinic-quotes.ts` — `listClinicQuotes`, `getClinicQuote`, `createClinicQuote`, `updateClinicQuote`, `deleteClinicQuote`, `setClinicQuoteStatus` (linha 211-251, dispara `maybeCreateClinicCommission` + `inngest.send('clinic.quote.approved')` quando `status==='aprovado'`).
- Rota/UI: `app/app/[orgSlug]/orcamentos/page.tsx` + `OrcamentosClient.tsx`.
- Permissão: `orcamentos_clinica`.

**Conexões**: `patient_contato_id` → `contatos` (Core); `professional_id` → `clinic_professionals`; item `event_type_id` → `event_types` (Core, opcional). Aprovação alimenta Comissões (seção 7) e o motor de Automações (seção 11).

---

## 4. Atendimentos

**O que é**: registro operacional pós-consulta — deliberadamente **não é prontuário médico** (sem diagnóstico/CID/prescrição por design, ver auditoria LGPD).

**Funcionalidades**: criação manual (atendimento avulso sem agendamento prévio) e — majoritariamente — criação **automática** quando um agendamento vira `realizado` via `setClinicAppointmentStatus`; campos: observações, recomendações, sugestão de próximo retorno (`next_return_date`).

**Arquivos-chave**:
- Migration: `supabase/migrations/0167_clinic_attendances.sql` — `clinic_attendances`, com `UNIQUE INDEX ... (appointment_id) WHERE appointment_id IS NOT NULL` para idempotência da criação automática.
- Actions: `actions/clinic-attendances.ts` — CRUD (listagem/criação/edição/exclusão manual).
- Criação automática: `actions/clinic.ts:302-371` dentro de `setClinicAppointmentStatus`, ramo `status === 'realizado'` — insere `clinic_attendances`, e se houver `event_type_id` com `price_cents` cadastrado em `clinic_service_context`, chama `maybeCreateClinicCommission` (sourceType `'atendimento'`) e dispara `inngest.send('clinic.attendance.completed')`.
- Rota/UI: `app/app/[orgSlug]/atendimentos/page.tsx` + `AtendimentosClient.tsx`.
- Permissão: `atendimentos_clinica`.

**Conexões**: `treatment_id`/`package_id` (adicionados na fase 6, ver migration 0168) opcionalmente vinculam a sessão a um Tratamento ou consomem sessão de um Pacote — mas nada no código lido consome automaticamente essas colunas ao criar o atendimento a partir do agendamento (ficam nulas na criação automática; teriam que ser setadas manualmente/por outra tela não coberta pelas actions lidas). `next_return_date` alimenta o módulo Retornos (seção 8).

---

## 5. Tratamentos e Pacotes

**O que é**: dois conceitos distintos na mesma migration — **Tratamento** = plano de N sessões acompanhadas por progresso (sem cobrança embutida); **Pacote** = lote de sessões pré-pago, com lançamento financeiro.

**Funcionalidades Tratamentos**: CRUD; `registerClinicTreatmentSession` incrementa `sessions_done` (cap em `total_sessions`) e marca `concluido` automaticamente ao bater o total; `setClinicTreatmentStatus` para transições manuais (`planejado/em_andamento/concluido/pausado/cancelado`).

**Funcionalidades Pacotes**: criação gera um `financial_entries` (Core) do tipo receita/categoria "Pacote clínico" quando `value_cents > 0`, guardando `financial_entry_id`; também dispara comissão automática (sourceType `'pacote'`) se houver profissional vinculado; `consumeClinicPackageSession` decrementa/incrementa `sessions_used`, marca `utilizado` ao esgotar.

**Arquivos-chave**:
- Migration: `supabase/migrations/0168_clinic_treatments_packages.sql` — `clinic_treatments`, `clinic_packages` (+ `financial_entry_id` FK), e colunas `treatment_id`/`package_id` em `clinic_attendances`.
- Actions: `actions/clinic-treatments.ts`, `actions/clinic-packages.ts`.
- Rota/UI: `app/app/[orgSlug]/tratamentos/page.tsx` + `TratamentosClient.tsx` (cobre ambos — tratamentos e pacotes na mesma tela, a julgar pelo path único).
- Permissão: `tratamentos_clinica`.

**Conexões**: Pacotes → Financeiro Core (`financial_entries`) e Comissões (seção 7); ambos → `contatos` (paciente), `clinic_professionals`, `event_types` (opcional).

---

## 6. Lista de Espera

**O que é**: fila de pacientes que queriam um profissional/serviço num período sem vaga disponível.

**Funcionalidades**: CRUD com campos de preferência (`preferred_from`/`preferred_until` datas, `preferred_time` texto livre tipo "manhã"/"após 18h"); status `aguardando/contatado/agendado/cancelado`. **Decisão de design explícita**: sem disparo automático — a equipe consulta a lista e contata manualmente (comentário na migration cita isso como decisão do prompt original).

**Arquivos-chave**:
- Migration: `supabase/migrations/0169_clinic_waitlist.sql` — `clinic_waitlist`.
- Actions: `actions/clinic-waitlist.ts`.
- Rota/UI: `app/app/[orgSlug]/lista-espera/page.tsx` + `ListaEsperaClient.tsx`.
- Permissão: `lista_espera_clinica`.

**Conexões**: paciente = `contatos`; `professional_id`/`event_type_id` opcionais. Nenhuma integração com Inngest/automação.

---

## 7. Comissões

**O que é**: cálculo rastreável de comissão por profissional — **nunca move dinheiro**, só registra o cálculo; o pagamento em si é lançamento manual no Financeiro Core, fora deste módulo.

**Funcionalidades**: `maybeCreateClinicCommission` (helper interno, não é action pública/autenticada por si — roda dentro de outra action já autorizada) calcula `commission_cents = baseAmountCents * commission_pct / 100` a partir do `commission_pct` cadastrado no profissional; idempotente via `UNIQUE INDEX (source_type, source_id) WHERE source_id IS NOT NULL` + `upsert(..., ignoreDuplicates: true)`; chamada a partir de três pontos: orçamento aprovado (`actions/clinic-quotes.ts:233-240`), atendimento realizado (`actions/clinic.ts:352-361`), pacote vendido (`actions/clinic-packages.ts:119-128`); também suporta lançamento manual (`createManualClinicCommission`, sourceType `'manual'`, sem `source_id`); `setClinicCommissionStatus` alterna `pendente`/`pago`.

**Arquivos-chave**:
- Migration: `supabase/migrations/0170_clinic_commissions.sql` — `clinic_commissions` + coluna `clinic_packages.professional_id` (retroativa).
- Actions: `actions/clinic-commissions.ts`.
- Rota/UI: `app/app/[orgSlug]/comissoes/page.tsx` + `ComissoesClient.tsx`.
- Permissão: `comissoes_clinica`.

**Conexões**: `source_type` referencia Orçamentos, Atendimentos ou Pacotes (rastreabilidade obrigatória, exceto `manual`); alimenta o dashboard clínico (seção 9) e o Copiloto IA (seção 12).

---

## 8. Retornos

**O que é**: painel sobre a sugestão de retorno já capturada em `clinic_attendances.next_return_date` (fase 5) — **não é entidade nova**, é um estado (`return_status`) + ações sobre atendimentos existentes.

**Funcionalidades**: lista atendimentos com `next_return_date` não nulo, ordenados por data; `createClinicReturnTask` cria uma tarefa real no Core (`tasks`, primeira coluna de `task_columns` da org, prioridade normal, atribuída ao usuário atual) com título `"Retorno: {paciente} — {serviço}"` e vencimento = `next_return_date`; marca `return_status='tarefa_criada'` e grava `return_task_id`; `setClinicReturnStatus` permite marcar manualmente `agendado`/`dispensado`/voltar a `pendente`.

**Arquivos-chave**:
- Migration: `supabase/migrations/0171_clinic_returns.sql` — adiciona `return_status` (CHECK 4 valores) e `return_task_id` (FK `tasks`) em `clinic_attendances`.
- Actions: `actions/clinic-returns.ts`.
- Rota/UI: `app/app/[orgSlug]/retornos/page.tsx` + `RetornosClient.tsx`.
- Permissão: reaproveita `atendimentos_clinica` (não tem chave própria — ver `requireAccess` em `actions/clinic-returns.ts:16-22`), mas o menu usa a flag de módulo `retornos_clinica` (`lib/niche-modules.ts`) para decidir se mostra o item.

**Conexões**: 100% sobre `clinic_attendances`; cria registros em `tasks` (Core) — sem sistema de tarefas paralelo.

---

## 9. Dashboard clínico

**O que é**: 6ª aba ("Clínica") no Dashboard/Início, renderizada só quando `isClinicNiche(org)`.

**Métricas** (`actions/dashboard-clinic.ts` — `getClinicDashboardMetrics`), todas com dado real, sem placeholder:
- `attendancesToday` — contagem `clinic_attendances` do dia.
- `noShowRate30d` — `clinic_appointment_context` com `clinic_status IN ('realizado','no_show')` nos últimos 30 dias, `no_show / total`.
- `pendingCommissionsCents` — soma `clinic_commissions.commission_cents` com `status='pendente'`.
- `pendingReturns` — contagem `clinic_attendances.return_status='pendente'`.
- `waitlistOpen` — contagem `clinic_waitlist.status='aguardando'`.
- `attendancesByProfessional` — agrupamento 30d.
- `revenueByService` — preço de `clinic_service_context.price_cents` × contagem de atendimentos por `event_type`, 30d.

**Arquivos-chave**:
- Actions: `actions/dashboard-clinic.ts`.
- `app/app/[orgSlug]/page.tsx` — injeta a aba (ver seção Core abaixo).
- `components/features/dashboard/DashboardTabsShell.tsx` — prop opcional `clinica` (grid 5→6 colunas só quando presente).
- `components/features/dashboard/tabs/ClinicaTab.tsx` — render da aba.

---

## 10. Auditoria LGPD

Documento dedicado já existe: `docs/audit/clinicas-lgpd.md` (snapshot 2026-08-20, cobre fases 1–10). Achados-chave:
- **Nenhum campo estruturado de diagnóstico/CID/prescrição/histórico médico** em nenhuma das 12 tabelas `clinic_*` — decisão de design explícita, não acidente.
- **Zona cinzenta = campos de texto livre**: `clinic_attendances.notes`, `clinic_attendances.recommendations`, `clinic_waitlist.notes` são `TEXT` sem nenhum controle de conteúdo — nada impede um profissional de digitar dado de saúde sensível ali. Principal risco LGPD identificado.
- RLS cobre isolamento entre orgs mas não distingue dado comercial de dado clínico sensível dentro da mesma org; RBAC (`checkMemberPermission`) limita quem vê a *tela*, não o que pode ser digitado.
- Herança do Core: exclusão de um `contato` propaga via `ON DELETE CASCADE` (não `SET NULL`) para `clinic_attendances`/`clinic_treatments`/`clinic_packages`/`clinic_waitlist` — apagar o contato remove o rastro clínico associado.
- Nenhum dado clínico é enviado a terceiros além do lembrete de agendamento, que usa só nome + data/hora (nunca `notes`/`recommendations`).

Este mapa não repete o documento inteiro — ver o arquivo original para a lista completa de lacunas (seção 4 do doc, não lida integralmente aqui).

---

## 11. Eventos de automação

**Decisão de arquitetura** (commit `0967a37`): em vez de criar uma engine de eventos paralela para Clínicas, plugaram 3 eventos no motor de automação genérico já existente do Core — mesmo caminho que `form.submitted`/`lead.stage_changed`/`appointment.booked` já usam.

**Eventos**:
| Evento | Disparado em | Payload |
|---|---|---|
| `clinic.appointment.confirmed` | `actions/clinic.ts:287-300`, dentro de `setClinicAppointmentStatus` quando `status==='confirmado'` | `{ orgId, leadId, appointmentId }` |
| `clinic.quote.approved` | `actions/clinic-quotes.ts:241-244`, dentro de `setClinicQuoteStatus` quando `status==='aprovado'` | `{ orgId, leadId, quoteId }` |
| `clinic.attendance.completed` | `actions/clinic.ts:364-369`, ao criar `clinic_attendances` automaticamente | `{ orgId, leadId, attendanceId }` |

**Arquivos-chave**:
- `lib/inngest/automation.ts:90-95` — registra os 3 eventos nos `triggers` de `processAutomationEvent` (mesma function que processa todos os outros eventos de automação do Core).
- `components/features/automations/AutomationFlow.tsx:61-63,132-134` — UI: adiciona os 3 gatilhos à lista de "Quando" configurável em Automações, com labels e descrição de preview.

**Conexão com Core**: zero código de execução novo — reaproveita 100% do motor genérico (`handleAutomationEvent`). A org configura em `/automacoes` (tela já existente) uma automação (WhatsApp/tarefa/webhook/etc.) usando qualquer um desses 3 gatilhos.

---

## 12. Copiloto IA

**Decisão de arquitetura** (commit `6e79f94`, última fase): em vez de motor de IA próprio para clínica, estende o Copiloto IA / Analista de Dados já existente do dashboard — mesma infra que já respeita RBAC (permissão `insights`), plano/créditos de IA (`checkFeatureAccess`/`ai_insights`) e RLS.

**Duas tools novas** (`lib/ai/insights-tools.ts`):
- `consultar_atendimentos_clinicos` (linhas 194-201 definição, 973-1015 implementação) — atendimentos no período + taxa de no-show + atendimentos por profissional.
- `consultar_comissoes_clinicas` (linhas 202-210 definição, 1017-1050 implementação) — pendente vs. pago por profissional.

Ambas retornam **só dado operacional/comercial** (contagens, status, valores, nomes) — nunca o conteúdo de `notes`/`recommendations`.

**Guardrail explícito e inegociável** em `lib/ai/insights-prompt.ts:45`: a IA "é uma analista de dados operacionais/comerciais, NUNCA uma assistente clínica" — proibida de fornecer diagnóstico, sugestão de tratamento, prescrição, interpretação de sintoma ou qualquer decisão clínica, mesmo se pedido diretamente; deve recusar e explicar que é responsabilidade do profissional de saúde. Consistente com o risco identificado na auditoria LGPD (seção 10).

**Dispatcher**: `lib/ai/insights-tools.ts:246-249` — casos `consultar_atendimentos_clinicos`/`consultar_comissoes_clinicas` em `executeAnalyticsTool`.

---

## 13. Permissões e menu

**Chaves de permissão** (`lib/permissions.ts:27-32,81-86,156-161`): `profissionais`, `orcamentos_clinica`, `atendimentos_clinica`, `tratamentos_clinica`, `lista_espera_clinica`, `comissoes_clinica` — todas na seção "Clínicas" do painel de permissões, default `false`. `NON_TRAVEL_ONLY_KEYS` (`lib/permissions.ts:177`) inclui essas chaves — só fazem sentido fora do nicho viagens.

**Nota**: não há chave de permissão dedicada `retornos_clinica` em `lib/permissions.ts` — o módulo Retornos reaproveita `atendimentos_clinica` para autorização de action (`actions/clinic-returns.ts:16-22`), mas `lib/niche-modules.ts:17,31` define `retornos_clinica` como `ModuleKey` (controla só visibilidade de menu/módulo, não permissão de action).

**Gate de módulo por nicho** (`lib/niche-modules.ts:31,44-58`): `CLINIC_ONLY` lista os 7 módulos (`profissionais`, `orcamentos_clinica`, `atendimentos_clinica`, `tratamentos_clinica`, `lista_espera_clinica`, `comissoes_clinica`, `retornos_clinica`) — só aparecem quando `isClinicNiche(niche)`.

**Menu lateral** (`components/features/Sidebar.tsx:348-406`): cada item checa `can(permissionKey) && isModuleEnabled(org.niche, moduleKey)` — dupla checagem (permissão do usuário + módulo habilitado no nicho da org). Itens: Profissionais, Orçamentos, Atendimentos, Retornos, Tratamentos, Lista de Espera, Comissões.

---

## Onde esta vertical modifica o Core

Pontos concretos em que código de Clínicas altera comportamento de um módulo Core compartilhado, em vez de viver isolado:

1. **Agendamentos** (`app/app/[orgSlug]/agendamentos/page.tsx:11-16,37-57,78-95`) — quando `isClinicNiche(org.niche)`, a página busca e injeta especialidades/profissionais/salas/contextos clínicos, renderiza `<ClinicReminderCard>` no topo e passa 5 props extras (`isClinic`, `clinicSpecialties`, `clinicProfessionals`, `clinicRooms`, `clinicServiceContexts`, `clinicAppointmentContexts`) para o componente de calendário do Core.

2. **`appointments.status` (Core)** — `actions/clinic.ts:271-379` (`setClinicAppointmentStatus`) escreve diretamente na tabela Core `appointments`: `status='completed'` quando `clinic_status==='realizado'` (linha 304), `status='canceled'` quando `clinic_status` é `cancelado`/`no_show` (linha 373). Isso significa que telas/relatórios genéricos que leem `appointments.status` (fora do nicho clínica) são afetados por essa sincronização.

3. **`financial_entries` (Core)** — `actions/clinic-packages.ts:79-100` insere diretamente em `financial_entries` (categoria "Pacote clínico") ao criar um pacote com valor — sem passar pela action genérica `actions/financial.ts` (comentário no código admite isso: "segue o mesmo padrão... inserido direto aqui para manter o `financial_entry_id` no mesmo insert").

4. **`tasks` (Core)** — `actions/clinic-returns.ts:63-112` (`createClinicReturnTask`) insere diretamente em `tasks`, usando a primeira coluna de `task_columns` da org — mesma tabela usada pelo módulo genérico de Tarefas, sem sistema de tarefas paralelo.

5. **Dashboard/Início** (`app/app/[orgSlug]/page.tsx`, ver commit `6340de2`) — adiciona uma 6ª aba condicional ao `DashboardTabsShell` (`components/features/dashboard/DashboardTabsShell.tsx`, prop `clinica`, grid muda de 5 para 6 colunas só quando presente).

6. **Motor de Automações** (`lib/inngest/automation.ts:90-95`, `components/features/automations/AutomationFlow.tsx:61-63,132-134`) — 3 eventos novos (`clinic.appointment.confirmed`, `clinic.quote.approved`, `clinic.attendance.completed`) registrados nos triggers da function `processAutomationEvent` e na lista de gatilhos configuráveis pela UI de automações — sem function/engine nova.

7. **Copiloto IA / Analista de Dados** (`lib/ai/insights-tools.ts`, `lib/ai/insights-prompt.ts:41,45`) — 2 tools novas no array `ANALYTICS_TOOLS` compartilhado com todas as outras verticais, e um parágrafo de guardrail adicionado ao system prompt único do Copiloto (não um prompt separado por nicho).

8. **Permissões / menu lateral** (`lib/permissions.ts:27-32,81-86,156-161,177`, `lib/niche-modules.ts:17,31,44-58`, `components/features/Sidebar.tsx:348-406`) — 6 chaves de permissão novas na seção "Clínicas" do painel de RBAC genérico, e items de menu condicionados por `isModuleEnabled(org.niche, ...)` no componente de navegação compartilhado.

9. **`org_settings` (Core)** — `supabase/migrations/0165_clinic_reminder_template.sql` adiciona a coluna `clinic_reminder_template_name` à tabela de configurações genérica da org (não cria uma tabela `clinic_settings` própria).

10. **`whatsapp_templates` (Core)** — `ensureClinicReminderTemplate` (`actions/clinic.ts:418-455`) insere um registro na tabela genérica de templates WhatsApp do Core, reaproveitando 100% do fluxo de aprovação Meta existente.
