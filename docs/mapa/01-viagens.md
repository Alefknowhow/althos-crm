# Mapa da Vertical — Agência de Viagens

Gerado em: 2026-08-22, baseado no código em HEAD.

> Consolida `docs/audit/cotacoes.md`, `reservas.md`, `bloqueios.md`, `embarques.md`, `documentos.md`, `ofertas.md` (2026-07-29) num único documento de vertical, verificado contra o código atual, mais Roteirista, "Explorar Voos", Créditos de Viagem e integração com Dashboard/Relatórios, que não tinham audit próprio. Ver `docs/mapa/00-core.md` para o Core compartilhado.

## Sumário

1. [Como o gating por nicho funciona](#1-como-o-gating-por-nicho-funciona)
2. [Cotações](#2-cotações)
3. [Ofertas](#3-ofertas)
4. [Reservas (Vendas)](#4-reservas-vendas)
5. [Bloqueios](#5-bloqueios)
6. [Embarques](#6-embarques)
7. [Documentos](#7-documentos)
8. [Roteirista (Travel Planner)](#8-roteirista-travel-planner)
9. [Explorar Voos](#9-explorar-voos)
10. [Créditos de Viagem (extensão do Core em Contatos)](#10-créditos-de-viagem-extensão-do-core-em-contatos)
11. [Dashboard e Relatórios — métricas de viagem](#11-dashboard-e-relatórios--métricas-de-viagem)
12. [Onde esta vertical modifica o Core](#12-onde-esta-vertical-modifica-o-core)
13. [Inngest da vertical](#13-inngest-da-vertical)
14. [Mapa de tabelas](#14-mapa-de-tabelas)

---

## 1. Como o gating por nicho funciona

- `organizations.niche` é string livre. `isTravelNiche(niche)` (`lib/niche.ts:9-12`) retorna `true` se `niche === 'viagens' || niche.includes('viag') || niche.includes('travel')`.
- Visibilidade de módulo no menu é decidida por um registry central, `lib/niche-modules.ts`: `TRAVEL_ONLY = ['cotacoes','roteirista','ofertas','embarques','bloqueios','reservas','documentos_viagem']`. `isModuleEnabled(niche, key)` é o único ponto que `components/features/Sidebar.tsx` consulta — não há mais `isTravelNiche` inline no Sidebar.
- Cada `page.tsx` de módulo vertical faz seu próprio guard redundante: `requireAuth()` → `getCurrentOrganization(orgSlug)` → `if (!isTravelNiche(org.niche)) redirect(...)`. Não existe um helper compartilhado — o guard é copiado verbatim em Cotações, Ofertas, Reservas (4 rotas), Bloqueios, Embarques, Documentos, Roteirista.
- Um catch-all de nicho genérico ("Vendas"/"Catálogo"/"Agendamentos") fica oculto para orgs de viagem (`GENERIC_ONLY` no registry) — o menu ainda é binário viagem/não-viagem para esses três módulos, não aditivo.
- Permissões granulares por módulo (`lib/permissions.ts:17-25,72-79`): `reservas`, `cotacoes`, `ofertas`, `embarques`, `bloqueios`, `explorar_voos`, `documentos`, `roteirista` — todas com `default: false` (linhas 148-155), precisam ser concedidas explicitamente por membro. `explorar_voos` existe como chave de permissão mas **não tem módulo/tela correspondente** (ver seção 9).

---

## 2. Cotações

**O que é**: fluxo de proposta/orçamento de viagem — capa, roteiro dia-a-dia, hospedagens, aéreo, investimento, condições — com link público para o cliente e impressão em PDF whitelabel.

**Funcionalidades principais**: editor split-view (formulário + preview ao vivo usando o mesmo componente do cliente), autosave debounced 800ms, geocodificação de locais para mapa (Nominatim/Photon), lookup de hotel via TripAdvisor Content API, link público rastreável, conversão em venda.

**Arquivos-chave**:
- Rotas: `/app/[orgSlug]/cotacoes` (lista), `/cotacoes/[id]` (editor), `/cotacoes/[id]/pdf` (impressão), `/cotacoes/[id]/orcamento` (órfã, ver abaixo), pública `/p/[token]`.
- Componentes: `ProposalsList.tsx`, `QuotationEditor.tsx` (1168 linhas), `PublicQuotationView.tsx` (1225 linhas, compartilhado com Ofertas), `QuotationPrintView.tsx`, `ItineraryEditor.tsx`.
- Actions: `actions/travel-proposals.ts` (CRUD, `duplicateProposal`, `geocodePlace`), `actions/quotations.ts` (`getQuotationFull`, `saveQuotation`, `generateQuotationLink`, `createSaleFromQuotation`, `tripadvisorLookup`).
- Tabelas: `travel_proposals`, `quotation_lodgings`, `quotation_flights`, `quotation_itinerary_days`, `quotation_map_pins`.
- Permissão: `cotacoes`. Gap: leituras (`listProposals`, `getQuotationFull`) não chamam `checkMemberPermission` — só o redirect de nicho protege.

**Conexões**:
- → Reservas: `createSaleFromQuotation` (idempotente por `proposal_id`) cria `travel_sales`; botão "Gerar venda" no editor.
- ↔ Ofertas: mesma tabela `travel_proposals`, diferenciadas por `is_offer`; `convertOfferToQuotation`/`convertQuotationToOffer` duplicam nos dois sentidos.
- → Contatos: FK `contato_id`; `listProposalsForLead` alimenta popup do card no Pipeline.
- → Tracking: `/api/track/proposal` (sem auth, admin client) promove status `sent`→`viewed`, dispara Inngest de lead scoring/CAPI.
- → Roteirista: `convertRoteiroToQuotation` insere direto em `travel_proposals`/`quotation_lodgings` (ver seção 8).

**Achados relevantes**: "Orçamento IA" (`budget_documents`, `BudgetDocumentsView.tsx`) está completamente inalcançável da UI desde que `CotacoesTabs.tsx` parou de ser renderizado — código/tabela/rota de impressão continuam plugados entre si mas sem entrada. `ProposalBuilder.tsx` (1212 linhas) e `PublicProposalView.tsx` (927 linhas) são código morto, zero importadores.

---

## 3. Ofertas

**O que é**: vitrine pública de pacotes de viagem publicáveis pelo agente — desde a migração `0085_offers_as_quotations.sql`, **Ofertas não é mais uma tabela própria**: é uma linha de `travel_proposals` com `is_offer=true`, reusando 100% o editor, view pública e RPC de Cotações.

**Funcionalidades principais**: grid de vitrine estilo storefront (`/v/[token]`), página de detalhe pública (`/p/[token]`, mesma rota de Cotações), toggle de publicação, categoria da oferta.

**Arquivos-chave**:
- Rotas: `/app/[orgSlug]/ofertas` (lista, `OffersList.tsx`), `/ofertas/[id]` (mesmo `QuotationEditor` com prop `isOffer`), pública `/v/[token]` (`PublicVitrineStorefront.tsx`, RPC `get_public_vitrine`).
- Actions: `listOffers`, `createOffer`, `convertOfferToQuotation`, `convertQuotationToOffer` em `actions/quotations.ts` — **todas usam a permissão `cotacoes`**, não `ofertas`.
- Legado morto: `actions/travel-showcase.ts` (tabela `travel_showcase_packages`, checa `ofertas`), `ShowcaseBuilder.tsx`, `ShowcaseList.tsx`, `PublicVitrineView.tsx`, `PublicPackageView.tsx`, rota `/v/[token]/[id]` — sem importadores/links vivos.
- `organizations.vitrine_token` é o identificador da vitrine raiz, independente do `public_token` por oferta.

**Conexões**: ver Cotações (mesma tabela/editor/view pública). `generateProposalFromPackage` (legado, morto) era uma segunda ponte independente de `travel_showcase_packages` → `travel_proposals`.

**Achado crítico de permissão**: a permissão real que trava criar/editar/converter ofertas é `cotacoes`, não `ofertas` — um membro com só `ofertas` concedido não consegue mutar nada; um membro com só `cotacoes` gerencia ofertas completamente. Não existe `deleteOffer`.

---

## 4. Reservas (Vendas)

**O que é**: registro da venda fechada de viagem — cliente, destino, valores, viajantes, voucher, contrato, checklist operacional. É o "fechamento" do funil de viagem (equivalente vertical de Vendas/`sales` genérico).

**Funcionalidades principais**: lista/editor inline, geração de contrato (template customizável por org via Tiptap ou fallback hardcoded), voucher imprimível com QR code, upload de contrato assinado (placeholder manual, sem integração de assinatura eletrônica), aplicação de créditos de cancelamento, criação automática de tarefas operacionais ao salvar.

**Arquivos-chave**:
- Rotas: `/app/[orgSlug]/reservas` (lista/editor, `TravelSalesView.tsx` — nota: vive em `components/features/proposals/`, não `reservas/`), `/reservas/contrato-padrao` (template da org), `/reservas/[saleId]/contrato` (gera/imprime contrato), `/voucher-print/[orgSlug]/[saleId]` (fora de `app/[orgSlug]` deliberadamente, para não herdar sidebar/header).
- Actions: `actions/travel-sales.ts` — `listTravelSales`, `updateTravelSale`, `deleteTravelSale`, `cancelTravelSale` (cria crédito), `createTravelSale`, `saveTravelSaleAndGenerateTasks` (sincroniza `financial_entries` + gera 3-4 tarefas), `maybeCreateTravelSaleOnWon` (venda automática ao ganhar lead com proposta vinculada), `markContractGenerated`.
- Tabela: `travel_sales`. Colunas incluem `contato_id`, `proposal_id`, `total_cents`, `status`, `contrato_gerado_at`, `tasks_generated_at`, `vouchers` (array), `flights`, `travelers`, `commission_cents`, `departure_date`.
- Permissão: `reservas`. Gap: `markContractGenerated` não checa permissão.

**Conexões**:
- ← Cotações: `sale.proposal_id`; `mapProposalToSaleFields` faz o prefill.
- ← Pipeline: `maybeCreateTravelSaleOnWon` — mover lead pra etapa "ganho" com proposta vinculada cria a venda automaticamente.
- → Tarefas: `saveTravelSaleAndGenerateTasks` insere em `tasks` com `sale_id`+`contato_id`.
- → Financeiro: sincroniza `financial_entries` (categoria "Comissão") vinculada por `venda_id`.
- → Créditos de Viagem: `cancelTravelSale` cria crédito automaticamente (ver seção 10).
- → Documentos: contrato lê `document_templates`/`organizations.contract_template_id`.
- → Embarques: única fonte de dados de Embarques é `travel_sales` filtrada por `departure_date` (ver seção 6).

**Bug documentado**: link "Ver venda de origem" a partir de um crédito em `/contatos/[id]` monta `?venda=<id>`, mas a página de Reservas só lê `searchParams.sale` — o deep-link nunca funciona.

---

## 5. Bloqueios

**O que é**: gestão de bloqueio/allotment de assentos ou vagas negociados com operadoras — conceito específico de agência de turismo.

**Funcionalidades principais**: CRUD de bloqueios (origem/destino/datas/voo/assentos), stepper de +/- assentos disponíveis, importação de planilha CSV/XLSX/XLSM.

**Arquivos-chave**: `/app/[orgSlug]/bloqueios` (única rota), `BlocksView.tsx`, `BlocksImporter.tsx`, `actions/travel-blocks.ts`. Tabela `travel_blocks` (`origem, destino, data_ida, data_volta, voo_ida/volta, assentos_total, assentos_disponiveis, prazo, observacoes`). Permissão: `bloqueios`.

**Conexões**: **nenhuma.** Confirmado por grep — não há vínculo entre `travel_blocks` e Reservas/Cotações. Vender um assento de um bloqueio não decrementa `assentos_disponiveis`; é puramente manual/informativo, apesar do conceito de "allotment" ser justamente sobre disponibilidade em tempo real.

**Gap de segurança**: `listTravelBlocks` não checa permissão nenhuma — só as actions mutantes checam.

---

## 6. Embarques

**O que é**: visão de linha do tempo/lista das próximas viagens já vendidas — não é uma tabela própria, é uma leitura derivada de `travel_sales`.

**Funcionalidades principais**: timeline Gantt de 3 meses + visão em lista, diálogo de detalhe com atalho de WhatsApp, tarefas relacionadas.

**Arquivos-chave**: `/app/[orgSlug]/embarques` (única rota), `ScheduleClient.tsx`, `actions/travel-schedule.ts` (`listScheduledTrips` — lê `travel_sales` com `departure_date` não nulo, enriquece com `contatos`; `getTripTasks`). Permissão: `embarques`.

**Conexões**: 100% derivado de Reservas (`travel_sales`) — não existe tabela `embarques`/`scheduled_trips`. Link "Abrir reserva" vai para `/reservas?sale={id}`. Lê `tasks` por `contato_id`.

**Achado de arquitetura**: `consultar_embarques`/`queryDepartures` em `lib/ai/insights-tools.ts` (Copiloto de IA) é um segundo caminho de leitura independente reproduzindo a mesma query de "próximos embarques" contra `travel_sales`, com janela e colunas diferentes — lógica duplicada.

**Gap de segurança**: página e actions não checam permissão `embarques` — só a visibilidade do link no Sidebar protege a navegação.

---

## 7. Documentos

**O que é**: modelos de documento genéricos da org (contratos, termos) + gestão de anexos padrão de viagem (MEDIF/FREMEC — formulários de assistência médica/menor desacompanhado exigidos por companhias aéreas).

**Funcionalidades principais**: CRUD de `document_templates` com merge fields (`{{sale.x}}`/`{{org.x}}`), geração de documento imutável a partir de um template + valores digitados, upload/download de PDF em branco de MEDIF/FREMEC (sem formulário estruturado — feature de registro estruturado de MEDIF existiu e foi removida na migration `0096_reservas_checklist_contrato.sql`, que fez `DROP TABLE medif_records`).

**Arquivos-chave**: `/app/[orgSlug]/documentos` (`DocumentosTabs.tsx`), `/documentos/[id]/print`. Actions: `actions/document-templates.ts`, `actions/generated-documents.ts` (`listGeneratedDocuments`/`deleteGeneratedDocument` são código morto), `actions/attachment-templates.ts` (bucket `medif-templates`). Tabelas: `document_templates`, `generated_documents` (via `generateDocument`), `attachment_templates`. Permissão: `documentos`.

**Conexões**: → Reservas — o template "Contrato padrão" é uma linha de `document_templates` marcada via `organizations.contract_template_id` (sem coluna discriminadora `kind`/`type` — risco se o vínculo for corrompido); o motor de merge `renderTemplate()` é reusado identicamente por Documentos (`fieldValues` manuais) e pela impressão de contrato de Reservas (auto-preenchido de `travel_sales`/`organizations`).

---

## 8. Roteirista (Travel Planner)

**O que é**: gerador de roteiro de viagem via chat com IA (Gemini), com busca real na web, que pode ser convertido em cotação. Não gera cotação diretamente — é uma etapa de rascunho conversacional anterior a Cotações.

**Funcionalidades principais**:
- Chat multi-turno por "conversa" (`roteiro_generations` + `roteiro_messages`), com atalho de início rápido (destino/datas/pax) ou mensagem livre.
- Base de conhecimento por org (`roteirista_knowledge_items`) injetada no contexto de todo chat — texto livre curado pelo agente (ex.: preferências de operadora, política interna).
- `convertRoteiroToQuotation`: extrai um rascunho estruturado (`extractQuotationDraft`, via Gemini) da conversa e insere direto em `travel_proposals` + `quotation_lodgings`.
- Consome créditos de IA da org (`consumeAiCredits`, ação `roteirista_generate`) a cada mensagem enviada e a cada conversão — igual em ambos os pontos.

**Gate duplo** (documentado no próprio código, `actions/roteirista.ts:38-46`): além de `isTravelNiche` + permissão `roteirista`, existe uma feature flag própria `TRAVEL_PLANNER_ENABLED` (`lib/ai/roteirista.ts`) que está **atualmente desligada em produção** — a página (`app/app/[orgSlug]/roteirista/page.tsx:21-32`) renderiza um `EmptyState` explicando que a feature foi pausada por custo de tokens da busca web ("dá pra reproduzir de graça pesquisando direto no chat do Gemini"), em vez do chat.

**Arquivos-chave**:
- Rota: `app/app/[orgSlug]/roteirista/page.tsx`.
- Componente: `components/features/roteirista/RoteiristaView.tsx`.
- Actions: `actions/roteirista.ts` (`listRoteiros`, `startRoteiro`, `sendRoteiroMessage`, `convertRoteiroToQuotation`, CRUD de `roteirista_knowledge_items`).
- Lib: `lib/ai/roteirista.ts` (`sendRoteiroChatMessage`, `buildQuickStartMessage`, `extractQuotationDraft`, `TRAVEL_PLANNER_ENABLED`). Usa `getGeminiKey()`/`hasGeminiKey()` — motor Gemini, não Anthropic, diferente do restante da IA do CRM.
- Tabelas: `roteiro_generations`, `roteiro_messages`, `roteirista_knowledge_items`.
- Permissão: `roteirista`, todas as actions passam por `requireRoteiristaAccess()` (checa nicho + flag + permissão num único helper — diferente do resto da vertical, que não tem um helper compartilhado).

**Conexões**: → Cotações via `convertRoteiroToQuotation` (grava direto em `travel_proposals`/`quotation_lodgings`, ignorando o `saveQuotation` de `actions/quotations.ts`). → Créditos de IA (`lib/plans/server.ts`).

---

## 9. Explorar Voos

**Não existe como módulo/tela/rota.** Confirmado por busca ampla no repo: `explorar_voos` aparece **somente** como chave de permissão declarada em `lib/permissions.ts:23,77,153,175` (label "Explorar Voos", seção "Viagens", default `false`) — sem nenhum componente, action, rota ou tabela associada. É uma permissão órfã, provavelmente reservada para uma feature planejada e nunca implementada (possivelmente cotação/busca de tarifa aérea integrada, adjacente ao campo `flights_html`/`quotation_flights` já existente em Cotações). Não confundir com o campo "Aéreo" dentro do editor de Cotações, que é entrada manual de dados de voo, não busca.

---

## 10. Créditos de Viagem (extensão do Core em Contatos)

**O que é**: saldo de crédito gerado quando uma reserva é cancelada (`cancelTravelSale` cria o crédito automaticamente — não há criação manual direta fora desse fluxo, embora `createCredit` seja genérica o bastante para isso). Aplicável a uma venda futura do mesmo contato.

**Funcionalidades principais**: listagem por contato, aplicação parcial/total numa venda (`ApplyCreditDialog`, sem paginação), timeline de uso.

**Arquivos-chave**: `actions/travel-credits.ts` (`listCreditsForContato`, `listAvailableCreditsForContato`, `createCredit`, `applyCreditToSale`). Tabelas: `travel_credits`, `travel_credit_usages`. Permissão reutilizada: **`reservas`** (não existe permissão própria de "créditos").

**Ponto de extensão do Core**: a tela de Contatos (módulo Core) é quem renderiza o bloco — não vive em pasta própria da vertical:
- `app/app/[orgSlug]/contatos/[id]/page.tsx:106` — busca condicional: `isTravelNiche(org.niche) ? listCreditsForContato(...) : Promise.resolve([])`.
- `app/app/[orgSlug]/contatos/[id]/page.tsx:286` — bloco `<Card>` "Créditos de Cancelamento" só renderiza `{isTravelNiche(org.niche) && (...)}`. O nome de exibição é deliberadamente genérico ("Créditos de Cancelamento", não "de Viagem") — comentário no código (linhas 283-285) documenta que o conceito não é exclusivo do nicho de viagens, é só o único nicho que usa hoje.
- `origem_sale_id` conecta o crédito de volta à venda que o originou; o link "Ver venda de origem" tem o bug de deep-link documentado na seção 4.

---

## 11. Dashboard e Relatórios — métricas de viagem

Nem Dashboard nem Relatórios têm tabela própria de viagem — ambos ramificam sobre a mesma fonte normalizada.

**`lib/dashboard/sales-source.ts`** é o ponto único de extensão nomeado (comentário no próprio arquivo o descreve como "Single niche-aware extension point for 'sales' data on the dashboard and the Insights IA tools"):
- `isOrgTravelNiche(supabase, orgId)` resolve o nicho da org (com memoização por request, `nicheCache`).
- `fetchNormalizedSales()` (linha 55) retorna um formato comum (`amount_cents`, `date`, `seller_id`): para orgs de viagem, lê `travel_sales` (excluindo `status='canceled'`); para as demais, lê `sales` (`amount_cents`/`sale_date`/`seller_id`, respeitando `onlyCompleted`).
- Usado tanto pelos widgets do Dashboard quanto pelo Copiloto de IA (Insights).

**`actions/reports.ts:175`** (dentro do `case type === 'sales'`) ramifica manualmente (comentário nas linhas 170-174 explica o motivo — mesma razão do `sales-source.ts`, mas implementado à parte, não reaproveitando a função): se `isTravelNiche(org.niche)`, consulta `travel_sales` direto com colunas específicas de viagem (`destination`, `operator`, `package_locator`, `commission_cents`) em vez de reusar `fetchNormalizedSales`. É uma segunda implementação da mesma decisão de roteamento, não uma chamada à função de `sales-source.ts` — duplicação de lógica de niche-branching entre os dois arquivos.

---

## 12. Onde esta vertical modifica o Core

Pontos concretos onde código de Viagens altera comportamento de uma tela/action Core compartilhada, em vez de viver isolado na própria pasta:

| Arquivo:linha | O que faz | Módulo Core afetado |
|---|---|---|
| `components/features/Sidebar.tsx` (via `isModuleEnabled`) | Mostra/esconde itens de menu Cotações/Roteirista/Ofertas/Embarques/Bloqueios/Reservas/Documentos; esconde Catálogo/Vendas/Agendamentos para orgs de viagem (`GENERIC_ONLY` no registry) | Sidebar/navegação |
| `app/app/[orgSlug]/contatos/[id]/page.tsx:106` | Busca condicional de `listCreditsForContato` só se `isTravelNiche` | Ficha de Contato |
| `app/app/[orgSlug]/contatos/[id]/page.tsx:286` | Injeta bloco `<Card>` "Créditos de Cancelamento" condicionalmente | Ficha de Contato |
| `app/app/[orgSlug]/contatos/page.tsx:262` | Passa prop `isTravel={isTravelNiche(org.niche)}` para o componente de lista | Lista de Contatos |
| `actions/reports.ts:175` | Ramifica o relatório de "Vendas" para consultar `travel_sales` em vez de `sales`, com colunas específicas de viagem | Server Action de Relatórios |
| `lib/dashboard/sales-source.ts` (arquivo inteiro) | Ponto de extensão nomeado — decide `travel_sales` vs `sales` para todo consumidor de "vendas normalizadas" (Dashboard + Insights IA) | Dashboard, Copiloto de IA |
| `components/features/GeneralTab.tsx:458` | Uso de `isTravelNiche` em Configurações gerais (não inspecionado em detalhe nesta rodada — citado no `core-vs-vertical-audit.md`, seção D.2) | Configurações da org |
| `app/app/[orgSlug]/configuracoes/equipe/TeamClient.tsx:58-59` | Badge no seletor de nicho ao gerenciar equipe — uso classificado como legítimo, não é injeção de comportamento | Configurações de Equipe |
| `actions/travel-sales.ts` (`cancelTravelSale`) → `actions/travel-credits.ts` (`createCredit`) | Cancelar uma reserva cria uma linha em `financial_entries`-adjacente `travel_credits`, fora do fluxo de Reservas/pasta própria | Modelo de dados do Contato (créditos aparecem na ficha Core) |

Fora esses pontos, a vertical de Viagens é bem isolada: nenhuma tabela Core (`contatos`, `tasks`, `pipelines`) tem coluna travel-only — o acoplamento é só na camada de apresentação/roteamento, não no schema.

---

## 13. Inngest da vertical

**Nenhuma function de Inngest é exclusiva da vertical de Viagens.** Busca em `lib/inngest/` por `travel`/`roteirista`/`cotac`/`reserva` não retorna nenhuma function dedicada — o fluxo de Cotações/Reservas/Roteirista é 100% síncrono via Server Actions (chat da IA do Roteirista, geração de contrato, criação de venda automática ao ganhar lead — tudo acontece na própria Server Action, sem job em background). O único ponto assíncrono adjacente é o tracking de proposta (`/api/track/proposal`), que dispara eventos genéricos de lead scoring/CAPI (Core), não uma function travel-specific.

---

## 14. Mapa de tabelas

| Tabela | Módulo | Observação |
|---|---|---|
| `travel_proposals` | Cotações + Ofertas | `is_offer` diferencia as duas; FK `contato_id` |
| `quotation_lodgings`, `quotation_flights`, `quotation_itinerary_days`, `quotation_map_pins` | Cotações + Ofertas | Tabelas filhas de `travel_proposals`, substituídas por completo (delete+insert) em cada `saveQuotation` |
| `travel_sales` | Reservas | Fonte também de Embarques (via `departure_date`) e do Dashboard/Relatórios de viagem |
| `travel_blocks` | Bloqueios | Sem FK para `travel_sales`/`travel_proposals` — desconectado |
| `travel_credits`, `travel_credit_usages` | Créditos de Viagem | FK `contato_id`, `origem_sale_id` |
| `document_templates`, `generated_documents`, `attachment_templates` | Documentos | `document_templates` também serve o "Contrato padrão" de Reservas via `organizations.contract_template_id` |
| `roteiro_generations`, `roteiro_messages`, `roteirista_knowledge_items` | Roteirista | Isolado; ponte pra `travel_proposals` só via `convertRoteiroToQuotation` |
| `budget_documents` | Órfão (ex-"Orçamento IA" de Cotações) | Tabela viva no banco, sem entrada de UI |
| `travel_showcase_packages` | Órfã (Ofertas legado, pré-`0085_offers_as_quotations.sql`) | Substituída por `travel_proposals(is_offer=true)`, nunca removida |
