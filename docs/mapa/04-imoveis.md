# Vertical Imobiliárias

Gerado em: 2026-08-22, baseado no código em HEAD.

Nicho gate: `isRealEstateNiche(niche)` em `lib/niche.ts:20` — `true` quando `organizations.niche` contém a substring `imob` (case-insensitive). Valor selecionável em `NICHE_OPTIONS`: `'Imobiliária'` (`lib/niche.ts:56`).

Construída em 8 fases (commits, mais recente primeiro):
1. `7f416d0` — Fase 1: cadastro de imóveis
2. `d56e59b` — Fase 2: match lead × imóvel + visitas
3. `e34feec` — Fase 3: propostas + negociação (venda/locação)
4. `02ca000` — Fase 4: matching por IA + padrão de header
5. `cdc1452` — Fase 5: dashboard + relatório
6. `08362f6` — Fase 6: módulo de Visitas dedicado (agenda do corretor)
7. `2c56d41` — Fase 7: pipeline imobiliário com avanço automático de etapa
8. `c5790de` — Fase 8: proposta multi-imóvel + link público
9. `f4e66bb` — fix: remove Pipeline duplicado no menu, esconde Catálogo

## Sumário

- [1. Cadastro de imóveis](#1-cadastro-de-imóveis)
- [2. Match lead × imóvel (interesses) + preferências](#2-match-lead--imóvel-interesses--preferências)
- [3. Matching por IA](#3-matching-por-ia)
- [4. Visitas](#4-visitas)
- [5. Propostas (multi-imóvel + link público)](#5-propostas-multi-imóvel--link-público)
- [6. Negociação / Fechamento (property_deals)](#6-negociação--fechamento-property_deals)
- [7. Pipeline imobiliário dedicado](#7-pipeline-imobiliário-dedicado)
- [8. Dashboard e Relatórios](#8-dashboard-e-relatórios)
- [Onde esta vertical modifica o Core](#onde-esta-vertical-modifica-o-core)
- [Inngest — resumo geral](#inngest--resumo-geral)
- [Permissão](#permissão)

---

## 1. Cadastro de imóveis

### O que é / o que resolve
Estoque de imóveis da imobiliária: ficha completa (endereço, preço, características físicas, comissão, exclusividade) + galeria de mídia (fotos/vídeos/documentos) referenciada no Storage.

### Funcionalidades principais
- CRUD completo com código comercial automático sequencial por org (`ALT-000001`, `ALT-000002`, ...), gerado por trigger de banco.
- Status do imóvel: `disponivel`, `reservado`, `em_negociacao`, `vendido`, `alugado`, `indisponivel` — dirige o funil (matching e proposta só oferecem imóveis `disponivel`; `closeDeal`/`cancelDeal` alternam entre `vendido`/`alugado` e `disponivel`).
- `purpose`: `venda`, `locacao`, `venda_locacao` (imóvel pode servir os dois).
- `features` é `jsonb` array de strings livres (ex.: `["piscina","churrasqueira"]`) — catálogo sugerido na UI mas não travado em enum (mesmo espírito do `data` jsonb de `quotation_products` em Viagens).
- Proprietário via FK direta pra `contatos` (`owner_contato_id`) — reaproveita Contato do Core, sem entidade "Proprietário" nova.
- Corretor responsável (`broker_user_id`) via FK pra `auth.users`.
- Mídia: fotos/vídeos/documentos com `sort_order` e flag `is_cover` (capa) — armazenados como `storage_key` (Supabase Storage), nunca binário no Postgres.
- Soft-delete via `archiveProperty` (marca `indisponivel`, histórico preservado); `deleteProperty` existe mas é hard-delete não usado pela UI padrão (não há botão de exclusão definitiva documentado no fluxo — ação exposta por completude da action).

### Arquivos-chave
- Rotas: `app/app/[orgSlug]/imoveis/page.tsx` (lista), `app/app/[orgSlug]/imoveis/novo/page.tsx` (criação), `app/app/[orgSlug]/imoveis/[id]/page.tsx` (detalhe/edição).
- Server Actions: `actions/properties.ts` — `listProperties`, `getProperty`, `createProperty`, `updateProperty`, `archiveProperty`, `deleteProperty`, `addPropertyMedia`, `removePropertyMedia`, `reorderPropertyMedia`, `setCoverMedia`.
- Componentes: `components/features/properties/PropertyList.tsx`, `components/features/properties/PropertyEditor.tsx`.
- Tabelas: `properties`, `property_media` (`supabase/migrations/0178_real_estate_properties.sql`).

### Conexões
- Core: `contatos` (proprietário), `auth.users`/`memberships` (corretor), Supabase Storage (mídia).
- Vertical: alimenta candidatos pro Matching por IA (§3), é o alvo de Interesses (§2), Visitas (§4), Propostas (§5) e Negociações (§6). `properties.status` é o campo que o funil inteiro lê/escreve.

### Inngest
Nenhum — módulo é puro CRUD síncrono, sem eventos.

---

## 2. Match lead × imóvel (interesses) + preferências

### O que é / o que resolve
Duas peças complementares:
1. **Interesses** (`property_interests`): registro manual de "esse lead está interessado nesse imóvel", com flag de favorito — visível tanto no detalhe do contato quanto no detalhe do imóvel.
2. **Preferências** (`contatos.property_preferences`, jsonb): o que o corretor sabe que o lead procura (finalidade, faixa de preço, dormitórios mín., cidade/bairro, tipo, observações) — usado como pré-filtro/contexto pro matching por IA (§3).

### Funcionalidades principais
- `addInterest`/`removeInterest`/`toggleFavorite` — join table única `property_interests (property_id, contato_id)` com `UNIQUE` constraint (erro amigável em duplicata via código Postgres `23505`).
- `listInterestsByContato`/`listInterestsByProperty` — mesma tabela, duas direções de leitura.
- `getPropertyPreferences`/`savePropertyPreferences` — leitura/escrita direta em `contatos.property_preferences`, shape: `{ purpose?, priceMin?, priceMax?, bedroomsMin?, city?, neighborhood?, propertyType?, notes? }`.

### Arquivos-chave
- Server Actions: `actions/property-interests.ts`, `actions/property-preferences.ts`.
- Componentes: `components/features/properties/PropertyInterestsSection.tsx`.
- Tabelas: `property_interests` (`supabase/migrations/0179_real_estate_interests_visits.sql`), coluna `contatos.property_preferences` (`supabase/migrations/0181_real_estate_preferences.sql`).

### Conexões
- Core: modifica `contatos` diretamente (coluna nova) — ver seção "Onde esta vertical modifica o Core".
- Vertical: preferências alimentam o Matching por IA (§3); interesses aparecem lado a lado com Visitas no detalhe do imóvel/contato.

### Inngest
Nenhum.

---

## 3. Matching por IA

### O que é / o que resolve
Sob demanda (sem persistência): dado um lead + suas `property_preferences`, pré-filtra candidatos via SQL e pede pra IA (Claude) rankear por compatibilidade com score 0-100 + motivo em 1 frase.

### Funcionalidades principais
- Pré-filtro SQL usando `property_preferences`: `purpose` (aceita `venda_locacao` como coringa), `priceMin/Max`, `bedroomsMin`, `city`/`neighborhood`/`propertyType` (`ilike`) — só imóveis `status = 'disponivel'`, limitado a 30 candidatos (`CANDIDATE_LIMIT`), mais recentes primeiro.
- Chamada à IA via tool forçado (`tool_choice: { type: 'tool', name: 'rank_properties' }`) — sem parse de markdown, mesmo padrão de `lib/ai/qualifier.ts`. Só Claude (`claude-sonnet-5`), sem paridade Gemini.
- Retorna até 10 sugestões (`RESULT_LIMIT`), ordenadas por score.
- Gate de acesso: reaproveita `checkFeatureAccessByOrgSlug(orgSlug, 'lead_scoring')` — não criou um `FeatureKey` novo, é tratado como a mesma categoria de recurso de IA sobre lead.
- Consome créditos de IA via `consumeAiCredits({ accountId, action: 'property_matching', leadId, metadata })` — chave de API é a plataforma (`getPlatformAiKey()`), não por-org.

### Arquivos-chave
- Server Action: `actions/property-matching.ts` — `matchPropertiesForLead`.
- Motor puro (sem I/O): `lib/ai/property-matcher.ts` — `matchProperties()`.
- Componente: `components/features/properties/PropertyMatchSuggestions.tsx`.

### Conexões
- Core: `lib/plans/server.ts` (`checkFeatureAccessByOrgSlug`, `consumeAiCredits`, `getAccountIdForOrgSlug`), `lib/ai/api-key.ts` (`getPlatformAiKey`).
- Vertical: lê `properties` (candidatos) e `contatos.property_preferences` (§2). Resultado não é persistido — cada execução consome crédito de novo.

### Inngest
Nenhum — chamada síncrona dentro da Server Action.

---

## 4. Visitas

### O que é / o que resolve
Agendamento de visita de um lead a um imóvel, com um corretor responsável. Tabela própria — deliberadamente **não** estende o `appointments` genérico do Core (que assume fluxo de agendamento público com `event_type_id`/`guest_name`/`email`/`phone`, incompatível com "corretor agenda visita de lead conhecido a imóvel específico" — ver comentário em `supabase/migrations/0179_real_estate_interests_visits.sql:7-13`).

### Funcionalidades principais
- Status: `agendada`, `confirmada`, `realizada`, `cancelada`, `nao_compareceu`.
- `scheduleVisit`: cria a visita **e** uma `task` no Core (mesma tabela/fluxo de Tarefas — "Confirmar visita: {lead} em {imóvel}", atribuída ao corretor ou a quem agendou, na primeira coluna do quadro de tarefas da org) — mesmo padrão de `createClinicReturnTask` em `actions/clinic-returns.ts`.
- `updateVisitStatus`: muda status e, para `confirmada`/`cancelada`/`realizada`, emite evento de automação correspondente.
- Módulo dedicado `/visitas` (Fase 6) — "agenda do corretor": lista todas as visitas da org com filtros por corretor/status/período (`listVisits`), não escopado a um imóvel ou contato específico.
- Confirmação/lembrete por WhatsApp **não é automático por padrão** — fica a cargo do motor de automação genérico (`lib/inngest/automation.ts`), que a agência precisa configurar manualmente na tela de Automações (mesmo padrão de Clínicas).

### Arquivos-chave
- Rota dedicada: `app/app/[orgSlug]/visitas/page.tsx` — redirect pra `/app/${orgSlug}` se `!isRealEstateNiche(org.niche)`.
- Server Action: `actions/property-visits.ts` — `listVisitsByContato`, `listVisitsByProperty`, `listVisits`, `scheduleVisit`, `updateVisitStatus`.
- Componentes: `components/features/properties/VisitsView.tsx`, `components/features/properties/PropertyVisitsSection.tsx`.
- Tabela: `property_visits` (`supabase/migrations/0179_real_estate_interests_visits.sql`).

### Conexões
- Core: cria linha em `tasks` (Tarefas) a cada agendamento; eventos disparam o motor genérico de automação (`lib/inngest/automation.ts`) se configurado.
- Vertical: eventos também disparam avanço automático do Pipeline Imobiliário (§7).

### Inngest
Eventos emitidos (payload sempre `{ orgId, leadId, propertyId, visitId }`):
- `imoveis.visit.scheduled` — em `scheduleVisit` (`actions/property-visits.ts:134`).
- `imoveis.visit.confirmed`, `imoveis.visit.canceled`, `imoveis.visit.completed` — em `updateVisitStatus`, conforme o novo status (`actions/property-visits.ts:162-173`).
Consumidos por: motor genérico de automação (`lib/inngest/automation.ts`, se a agência configurou uma automação pro evento) e pela function dedicada `imoveisPipelineAdvanceFn` (§7, exceto `confirmed`/`canceled`, que essa function não escuta).

---

## 5. Propostas (multi-imóvel + link público)

### O que é / o que resolve
Proposta formal enviada ao lead: um ou mais imóveis, cada um com preço próprio, condições, validade — com link público compartilhável (sem login) pro cliente visualizar.

### Funcionalidades principais
- **Fase 3** (original): proposta de 1 imóvel só, gravada direto em `property_proposals.property_id`/`offered_price_cents`.
- **Fase 8** (atual): proposta multi-imóvel via tabela filha `property_proposal_items` (um preço por imóvel) — mesmo desenho de `quotation_products` em Viagens: **delete + reinsert total** a cada save (`replaceItems()` em `actions/property-proposals.ts:126`). Colunas legadas de Fase 3 continuam existindo só pra não quebrar propostas antigas; proposta nova sempre grava em `property_proposal_items`, mesmo com 1 imóvel.
- Status: `draft`, `sent`, `viewed`, `won`, `lost`, `expired` (mesmo vocabulário de `travel_proposals.status`).
- Link público: token aleatório de 24 hex chars (`crypto.getRandomValues`), gerado/rotacionado por `generatePropertyProposalLink`. Ao gerar o primeiro link, status `draft` vira `sent` automaticamente.
- Página pública (`app/(public)/imoveis-proposta/[token]/page.tsx`) chama a RPC `get_public_property_proposal(p_token)` — `SECURITY DEFINER`, nunca expõe `broker_user_id`/`notes`/`internal_notes`; retorna dados da organização (nome/logo/whatsapp via `org_settings`) + lista de imóveis com fotos (mesmo desenho de `get_public_quotation`, Viagens).
- `setProposalStatus('sent')` dispara evento de automação usando o **primeiro** imóvel da proposta como `propertyId` do payload (limitação: pipeline/automação só reagem ao primeiro item de uma proposta multi-imóvel).

### Arquivos-chave
- Rota interna: `app/app/[orgSlug]/propostas/page.tsx` — redirect se `!isRealEstateNiche`.
- Rota pública: `app/(public)/imoveis-proposta/[token]/page.tsx`.
- Server Action: `actions/property-proposals.ts` — `listProposals`, `getProposal`, `createProposal`, `updateProposal`, `setProposalStatus`, `generatePropertyProposalLink`.
- Componente: `components/features/properties/PropertyProposalsView.tsx`.
- Tabelas: `property_proposals`, `property_proposal_items` (`supabase/migrations/0180_real_estate_proposals_deals.sql`, `0184_property_proposal_items_public_link.sql`), RPC `public.get_public_property_proposal`.

### Conexões
- Core: mesmo padrão de link público que Cotações de Viagens (`generateQuotationLink`/`get_public_quotation`, `actions/quotations.ts`).
- Vertical: origem opcional de uma Negociação fechada (§6, via `property_deals.proposal_id`); dispara avanço automático do Pipeline (§7).

### Inngest
- `imoveis.proposal.sent` — emitido em `setProposalStatus` quando `status = 'sent'` (`actions/property-proposals.ts:207-213`), payload `{ orgId, leadId, propertyId (primeiro item), proposalId }`.

---

## 6. Negociação / Fechamento (property_deals)

### O que é / o que resolve
Fecha o funil: registra a venda ou locação de um imóvel a um lead, tira o imóvel de circulação e sincroniza uma linha de comissão no Financeiro.

### Funcionalidades principais
- `closeDeal`: cria `property_deals` (tipo `venda`/`locacao`, preço final, comissão, e para locação `monthly_rent_cents`/`lease_start_date`/`lease_end_date`), muda `properties.status` pra `vendido` ou `alugado`, marca a proposta de origem (se houver) como `won`.
- Comissão: se `commissionCents > 0`, insere **uma linha simples** em `financial_entries` (`tipo: 'receita'`, `categoria: 'Comissão imobiliária'`, `status: 'pendente'`) — versão simplificada do `syncSaleRevenueEntry` de Viagens, **sem split retida/repasse** (não existe operadora em imóveis pra justificar essa complexidade — comentário em `actions/property-deals.ts:134-136`).
- `cancelDeal`: reverte `properties.status` pra `disponivel`, marca `property_deals.status = 'cancelado'`, cancela as `financial_entries` pendentes/vencidas ligadas via `property_deal_id`.
- Status do deal é binário: `aberto`/`cancelado` (sem checklist de etapas — igual `travel_sales.status`).

### Arquivos-chave
- Rota: `app/app/[orgSlug]/negociacoes/page.tsx` — redirect se `!isRealEstateNiche`.
- Server Action: `actions/property-deals.ts` — `listDeals`, `getDeal`, `closeDeal`, `cancelDeal`.
- Componente: `components/features/properties/PropertyDealsView.tsx`.
- Tabela: `property_deals` (`supabase/migrations/0180_real_estate_proposals_deals.sql`); FK dedicada `financial_entries.property_deal_id` (mesma migration, mesmo padrão de `financial_entries.venda_id` em Viagens).

### Conexões
- Core: escreve em `financial_entries` (Financeiro) e em `properties.status`.
- Vertical: consome opcionalmente uma `property_proposals` como origem; evento terminal do avanço automático de Pipeline (§7).

### Inngest
- `imoveis.deal.closed` — emitido em `closeDeal` (`actions/property-deals.ts:145-148`), payload `{ orgId, leadId, propertyId, dealId }`. **Não** há evento de cancelamento (`cancelDeal` não emite nada).

---

## 7. Pipeline imobiliário dedicado

### O que é / o que resolve
Um pipeline Kanban **próprio** da vertical, com etapas fixas que espelham o funil real de imóveis, avançando automaticamente conforme visitas/propostas/negócios acontecem — sem exigir que o corretor arraste manualmente o card a cada evento.

### Funcionalidades principais
- Etapas fixas (`lib/pipeline-imoveis-constants.ts`): `Captação de interesse` → `Visita agendada` → `Visita realizada` → `Proposta enviada` → `Em negociação` → `Fechado` (ganho) / `Perdido`.
- `ensureRealEstatePipeline` (`actions/pipeline-imoveis.ts`): get-or-create idempotente — se a org ainda não tem um pipeline `kind='imoveis'`, cria um com as 6 etapas acima. Chamado preguiçosamente pela rota, sem migração de dado retroativa.
- Rota `/pipeline-imoveis` é fina: **não é um board próprio** — garante o pipeline e redireciona pro Kanban genérico já filtrado (`/pipeline?pipeline_id=<id>`), reaproveitando 100% de `KanbanBoard`/`app/app/[orgSlug]/pipeline/page.tsx`.
- **Avanço automático de etapa** — function Inngest dedicada `imoveisPipelineAdvanceFn` (`lib/inngest/imoveis-pipeline-advance.ts`), escutando os MESMOS eventos que os módulos acima já emitem (não duplica emissão, roda em paralelo ao motor de automação genérico):
  - `imoveis.visit.scheduled` → etapa "Visita agendada"
  - `imoveis.visit.completed` → etapa "Visita realizada"
  - `imoveis.proposal.sent` → etapa "Proposta enviada"
  - `imoveis.deal.closed` → etapa "Fechado" (força mesmo se o lead já tiver avançado além — único evento terminal que pode "pular")
  - Regra de não-regressão: só avança um lead que **já está dentro** do pipeline imobiliário (`contato.pipeline_id === pipeline.id`); entrada no pipeline continua manual (arrastar/selecionar). Nunca move pra uma etapa de posição igual/anterior, exceto o evento terminal.
  - Usa `createAdminClient()` (bypassa RLS, filtra `organization_id` manualmente) porque roda sem usuário autenticado.
  - **Deliberadamente não** reaproveita o corpo completo de `moveLeadToStage` (`actions/contatos.ts`) — evita replicar efeitos colaterais (CAPI, auto-criação de venda de viagem, espelho em `negocios`) num contexto de sistema; só move `stage_id`, atualiza `deal_status`/`closed_at` quando terminal, e registra `contato_activities` com `payload.auto = true`.

### Arquivos-chave
- Constantes compartilhadas: `lib/pipeline-imoveis-constants.ts` (separadas da action porque arquivos `'use server'` só exportam funções async, e a function Inngest também precisa importar).
- Server Action: `actions/pipeline-imoveis.ts` — `ensureRealEstatePipeline`.
- Rota: `app/app/[orgSlug]/pipeline-imoveis/page.tsx`.
- Inngest function: `lib/inngest/imoveis-pipeline-advance.ts` — `imoveisPipelineAdvanceFn`, registrada em `app/api/inngest/route.ts:19,61`.
- Migration: `supabase/migrations/0183_pipeline_kind.sql` — coluna `pipelines.kind`.

### Conexões
- Core: reaproveita 100% o suporte a **múltiplos pipelines** (`pipelines`/`pipeline_stages`, `KanbanBoard`, `PipelineSwitcher`) — a única peça nova de schema é `pipelines.kind`.
- Vertical: consumidor terminal dos eventos de Visitas (§4), Propostas (§5) e Negociações (§6).

### Inngest
`imoveisPipelineAdvanceFn` — triggers: `imoveis.visit.scheduled`, `imoveis.visit.completed`, `imoveis.proposal.sent`, `imoveis.deal.closed`. Concurrency limitada por `event.data.orgId` (limit 5).

---

## 8. Dashboard e Relatórios

### O que é / o que resolve
Aba "Imobiliária" no dashboard geral + entrada equivalente em Relatórios — métricas agregadas do funil, tudo de dado real (sem placeholder/mock).

### Funcionalidades principais
- KPIs: imóveis disponíveis (contagem), fechados nos últimos 30 dias, visitas agendadas/confirmadas nos próximos 7 dias, comissão pendente (soma de `financial_entries` com `status='pendente'` e `property_deal_id` não nulo).
- Gráficos de barra: propostas por status (últimos 30 dias), estoque disponível por cidade (top 20).
- Renderizada apenas quando o nicho da org é Imobiliária (aba condicional, ver `DashboardTabsShell`).

### Arquivos-chave
- Server Action: `actions/dashboard-imoveis.ts` — `getImoveisDashboardMetrics`.
- Componente de aba: `components/features/dashboard/tabs/ImobiliariaTab.tsx`.
- Shell do dashboard: `components/features/dashboard/DashboardTabsShell.tsx:14,29,37,40,56,80-82` — prop `imoveis` soma-se a `clinica`/`trafego` como aba extra condicional.
- Relatórios: `components/features/reports/ReportsClient.tsx:20` — item `{ type: 'imoveis', label: 'Imóveis', imobiliariaOnly: true }`.

### Conexões
- Core: lê `properties`, `property_visits`, `property_proposals`, `property_deals`, `financial_entries` — nenhuma tabela nova, só agregação.

### Inngest
Nenhum.

---

## Onde esta vertical modifica o Core

| Ponto do Core | Modificação | Local |
|---|---|---|
| **Contatos** | Nova coluna `property_preferences` (jsonb) em `contatos` — preferências de imóvel do lead, usada como pré-filtro do Matching por IA. | `supabase/migrations/0181_real_estate_preferences.sql:1-5`; leitura/escrita em `actions/property-preferences.ts:46-71` |
| **Pipeline genérico** | Nova coluna `pipelines.kind` — marca um pipeline "especial" gerenciado por automação (`'imoveis'`), com índice único `(organization_id, kind) WHERE kind IS NOT NULL` (uma org só pode ter 1 pipeline de cada kind). `NULL` = pipeline comum, comportamento do Core intocado. O pipeline imobiliário **convive** com pipelines genéricos da mesma org: é só mais uma linha em `pipelines`, roteado pelo Kanban existente via `?pipeline_id=`, sem board/rota própria. | `supabase/migrations/0183_pipeline_kind.sql`; consumido em `actions/pipeline-imoveis.ts:31-37` e `lib/inngest/imoveis-pipeline-advance.ts:48-53` |
| **Pipeline — avanço automático de etapa** | Nenhuma outra vertical tem uma function Inngest que move `contatos.stage_id` sozinha em reação a eventos de negócio — é específico de Imobiliárias (Fase 7). Roda em paralelo ao motor de automação genérico, sem reescrevê-lo. | `lib/inngest/imoveis-pipeline-advance.ts:85-104` |
| **Sidebar** | Item "Pipeline" aponta pra `/pipeline-imoveis` em vez de `/pipeline` quando `isModuleEnabled(org.niche, 'imoveis')` — único nicho que redireciona a entrada de Pipeline pra uma rota própria antes de cair no Kanban genérico. Quatro itens adicionais (`Imóveis`, `Visitas`, `Propostas`, `Negociações`) só aparecem com `can('imoveis') && isModuleEnabled(org.niche, 'imoveis')`. | `components/features/Sidebar.tsx:215` (troca de href do Pipeline), `:411-444` (itens dedicados) |
| **Módulos genéricos ocultos** | `niche-modules.ts` esconde `vendas`, `agendamentos` e `catalogo` para o nicho Imobiliária — `vendas` duplicaria Negociações (`property_deals`), `agendamentos` duplicaria Visitas (`property_visits`), e não existe equivalente de Catálogo genérico na vertical. | `lib/niche-modules.ts:38-42,62` |
| **Financeiro** | Nova FK `financial_entries.property_deal_id`, mesmo padrão que `venda_id` (Viagens) — comissão de negócio fechado vira uma linha "pendente" em Financeiro. | `supabase/migrations/0180_real_estate_proposals_deals.sql:110-113`; escrita em `actions/property-deals.ts:137-143` |
| **Tarefas** | `scheduleVisit` cria uma `task` no Core automaticamente a cada visita agendada ("Confirmar visita: ..."), na primeira coluna do quadro de Tarefas da org. | `actions/property-visits.ts:116-128` |
| **Dashboard** | Aba condicional "Imobiliária" somada a `clinica`/`trafego` como aba extra do dashboard geral, renderizada só quando a org é do nicho. | `components/features/dashboard/DashboardTabsShell.tsx:14,29,37,40,56,80-82` |
| **Relatórios** | Item de relatório `imoveis` com flag `imobiliariaOnly: true`. | `components/features/reports/ReportsClient.tsx:20` |
| **Permissões** | Chave granular própria `'imoveis'` (`PermissionKey`) — todas as Server Actions da vertical checam `checkMemberPermission(org.id, user.id, 'imoveis')`, nenhuma reaproveita `'leads'`/`'clients'`. | ver `lib/permissions.ts`; uso em todas as actions listadas acima |

---

## Inngest — resumo geral

Eventos próprios da vertical (namespace `imoveis.*`), todos emitidos por Server Actions síncronas (não por webhooks):

| Evento | Emitido por | Consumido por |
|---|---|---|
| `imoveis.visit.scheduled` | `actions/property-visits.ts:134` (`scheduleVisit`) | motor genérico de automação (se configurado) + `imoveisPipelineAdvanceFn` |
| `imoveis.visit.confirmed` | `actions/property-visits.ts:169` (`updateVisitStatus`) | motor genérico de automação apenas (pipeline não escuta) |
| `imoveis.visit.canceled` | `actions/property-visits.ts:169` (`updateVisitStatus`) | motor genérico de automação apenas |
| `imoveis.visit.completed` | `actions/property-visits.ts:169` (`updateVisitStatus`) | motor genérico de automação + `imoveisPipelineAdvanceFn` |
| `imoveis.proposal.sent` | `actions/property-proposals.ts:209` (`setProposalStatus`) | motor genérico de automação + `imoveisPipelineAdvanceFn` |
| `imoveis.deal.closed` | `actions/property-deals.ts:145` (`closeDeal`) | motor genérico de automação + `imoveisPipelineAdvanceFn` |

Function dedicada registrada em `app/api/inngest/route.ts:19,61`: `imoveisPipelineAdvanceFn`.

Nenhum evento de cancelamento de negócio (`cancelDeal` não emite nada) — automações configuradas pra "negócio fechado" não são revertidas se o negócio for cancelado depois.

---

## Permissão

Toda a vertical usa uma única chave granular: `'imoveis'` (`PermissionKey`, `lib/permissions.ts`). Não há sub-permissões por módulo (Visitas, Propostas e Negociações compartilham a mesma checagem que Cadastro de Imóveis) — quem tem acesso a `imoveis` vê a vertical inteira.
