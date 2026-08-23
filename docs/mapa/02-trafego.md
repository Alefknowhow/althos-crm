# Mapa técnico — Vertical Agências de Tráfego

Gerado em: 2026-08-23, baseado no código em HEAD (`22a4c2a`). Working tree limpo — não há mudanças não commitadas em `actions/contracts.ts`/`actions/plan-contracts.ts` (já foram commitadas em `22a4c2a`, "fix(security): contratos (Reservas e Planos) sem checagem de permissão").

## Sumário

1. [Identidade do nicho e gating](#1-identidade-do-nicho-e-gating)
2. [Clientes de Tráfego (`agencias-trafego/trafego`)](#2-clientes-de-tráfego-agencias-trafegotrafego)
3. [Painel do cliente (`ClientDetailShell`)](#3-painel-do-cliente-clientdetailshell)
4. [Planos (Catálogo reaproveitado)](#4-planos-catálogo-reaproveitado)
5. [Vendas → assinatura de plano com contrato](#5-vendas--assinatura-de-plano-com-contrato)
6. [`plan_contracts` — contrato próprio de assinatura](#6-plan_contracts--contrato-próprio-de-assinatura)
7. [Dashboard — aba Tráfego](#7-dashboard--aba-tráfego)
8. [Onde esta vertical modifica o Core](#8-onde-esta-vertical-modifica-o-core)
9. [Gaps conhecidos / dívida documentada no próprio código](#9-gaps-conhecidos--dívida-documentada-no-próprio-código)

---

## 1. Identidade do nicho e gating

- `lib/niche.ts:29` — `NICHE_TRAFFIC = 'trafego'`.
- `lib/niche.ts:31-34` — `isTrafficNiche(niche)`: `true` se a string contiver `'tráfego'` ou `'trafego'` (case-insensitive, sem acento também casa).
- `lib/niche.ts:46-54` — `NICHE_OPTIONS`: opção selecionável `{ value: 'trafego', label: 'Agência de Tráfego' }` (linha 52), ao lado de Viagens/Clínicas/Imobiliárias/Advocacia/Seguros/Outros.
- `lib/niche-modules.ts:23` — módulo `'trafego'` cadastrado no union `ModuleKey`.
- `lib/niche-modules.ts:34` — `TRAFFIC_ONLY: ModuleKey[] = ['trafego']`.
- `lib/niche-modules.ts:51-64` — `isModuleEnabled(niche, key)`: para `key === 'trafego'`, retorna `isTrafficNiche(niche)` (linha 61). Diferente de Viagens, o nicho Tráfego **não** está em `GENERIC_ONLY`/`NOT_*` — ou seja, Catálogo/Vendas/Agendamentos continuam habilitados normalmente para esse nicho (são reaproveitados, não escondidos, ver seções 4-5).
- Permissão granular associada: chave `'trafego'` em `PermissionKey` (`lib/permissions.ts`), checada via `checkMemberPermission(orgId, userId, 'trafego')` em toda action da vertical.

Todas as rotas próprias da vertical fazem o mesmo padrão de guarda dupla — `requireAuth()` + `getCurrentOrganization()` + `if (!isTrafficNiche(org.niche)) redirect(...)` — nunca confiam só no menu estar escondido:
- `app/app/[orgSlug]/agencias-trafego/trafego/page.tsx:21-23`
- `app/app/[orgSlug]/agencias-trafego/trafego/[id]/page.tsx:15-17`
- `app/app/[orgSlug]/vendas/[saleId]/contrato/page.tsx:17-19`

---

## 2. Clientes de Tráfego (`agencias-trafego/trafego`)

**O que é**: lista de clientes geridos pela agência — não é uma tabela nova, é uma *view* sobre `contatos` filtrados por `status='cliente'`, com métricas agregadas de contas de anúncio/campanhas/criativos pendentes. Camada de gestão separada do cadastro genérico de Contatos.

**Funcionalidades principais**:
- Lista de clientes (contatos com `status='cliente'`) com nome e nicho (`traffic_client_profile.niche`).
- Por cliente: contagem de campanhas ativas, gasto agregado (30 dias) e contagem de criativos pendentes de aprovação.
- Link para o painel dedicado (`[id]`).

**Arquivos-chave**:
- Rota: `app/app/[orgSlug]/agencias-trafego/trafego/page.tsx` — query direta via `createClient()` (não passa por Server Action), usa admin/RLS-scoped client: `contatos` (linha 29-34), `ad_accounts` (linha 50), `campaign_creatives` (linha 51, filtro `status='pendente'`), `campaigns` (linha 66-70), `campaign_metrics_daily` (linha 78-83, soma `spend_cents` últimos 30d).
- Tabelas: `contatos.traffic_client_profile` (JSONB, migration `0190`), `ad_accounts.contato_id` (FK adicionada na `0190`), `campaign_creatives`, `campaigns`, `campaign_metrics_daily` (estas três já existiam do módulo Marketing/Core, migration `0032_marketing.sql` e posteriores).

**Conexões**:
- Depende de `contatos.status = 'cliente'` — reaproveita o pipeline de conversão genérico de Contatos/CRM; não há um "cadastro de cliente de tráfego" separado.
- `ad_accounts`, `campaigns`, `campaign_metrics_daily` são tabelas Core do módulo Marketing (usadas também fora da vertical, ex. `getMarketingOverview`); a vertical só filtra por `contato_id`.

---

## 3. Painel do cliente (`ClientDetailShell`)

**O que é**: dashboard dedicado por cliente, com 3 abas — Dados, Histórico, Criativos.

**Funcionalidades principais**:
- **Dados**: `TrafficClientProfileCard` (perfil estruturado — nicho, objetivo, orçamento mensal, público-alvo, regras, metas de ROAS/CPL/leads/receita) + `TrafficClientCampaignsCard` (contas de anúncio e campanhas vinculadas ao cliente).
- **Histórico**: `ClientHistorySection` — lista as `sales` (vendas genéricas) do contato.
- **Criativos**: `CampaignCreativesSection` — upload/gestão de criativos com fluxo de aprovação do cliente via link público.

**Arquivos-chave**:
- Rota: `app/app/[orgSlug]/agencias-trafego/trafego/[id]/page.tsx` — busca em paralelo (linha 29-40): `getTrafficClientProfile`, `listAdAccountsByClient`, `listCampaignsByClient`, `listCreatives`, e um select direto em `sales` (linha 34-39, join `products(name)`).
- Componente raiz: `components/features/agencias-trafego/ClientDetailShell.tsx` (client component, `Tabs` shadcn).
- Sub-componentes: `TrafficClientProfileCard.tsx`, `TrafficClientCampaignsCard.tsx`, `ClientHistorySection.tsx`, `CampaignCreativesSection.tsx`, `PublicCreativeApprovalView.tsx` (a view pública, sem auth, acessada por `public_token`), `PlaceholderPage.tsx`.
- Server Actions:
  - `actions/traffic-client-profile.ts` — `getTrafficClientProfile`/`saveTrafficClientProfile`, `requireAccess` checa permissão `'trafego'` (linha 48-54); schema Zod `ProfileSchema` (linha 33-46) inclui campos de meta (`targetRoas`, `targetCpl`, `targetLeads`, `targetRevenueCents`) citados como usados por um "Agent Layer" (`get_client_targets`, comentário linha 25-26) — não documentado nesta vertical porque não foi pedido, mas é um ponto de extensão citado no código.
  - `actions/marketing.ts:41-54` — `listAdAccountsByClient` (permissão `'trafego'`, linha 44).
  - `actions/marketing.ts:66-105` — `listCampaignsByClientCore(supabase, orgId, contatoId, days)`: núcleo **sem auth**, recebe org já resolvida — reaproveitado tanto pela action de sessão (`listCampaignsByClient`, linha 107-114, permissão `'trafego'`) quanto por tools de um Agent Layer (comentário linha 61-64: `lib/agent/tools/campaigns.ts`, fora do escopo desta vertical mas consumidor direto dela).
  - `actions/campaign-creatives.ts` — `listCreatives` (linha 37-47), upload via `uploadCreativeAsset` (`actions/upload.ts`), todas atrás de `requireAccess` com permissão `'trafego'` (linha 29-35).
- Tabelas: `contatos.traffic_client_profile` (JSONB), `ad_accounts.contato_id`, `campaign_creatives` (todas migration `0190_traffic_client_management.sql`), `campaigns`/`campaign_metrics_daily` (Core, `0032` + `0117`/`0119`/`0127`/`0129`/`0133`/`0134`/`0160`).
- Funções SQL públicas (sem auth, `SECURITY DEFINER`) na `0190`: `public.get_public_creative(p_token)` (linha 53-89) e `public.update_public_creative_status(p_token, p_status, p_comment)` (linha 93-113) — permitem que o cliente aprove/reprove um criativo por link, sem login, mesmo padrão de `get_public_quotation` (Viagens).

**Conexões com o Core**: `sales` (venda genérica), `contatos` (cadastro genérico), `campaigns`/`ad_accounts`/`campaign_metrics_daily` (módulo Marketing Core).

---

## 4. Planos (Catálogo reaproveitado)

**O que é**: para o nicho Tráfego, a tela genérica de Catálogo (`/catalogo`) é relabelada como "Planos" e ganha campos de assinatura recorrente. Não existe rota nem tabela própria — é o mesmo `products`/`ProductDialog`/`CatalogSplit` do Core, com comportamento condicional.

**Funcionalidades principais**:
- Título/hint trocados: "Planos" / "Os planos que sua agência oferece aos clientes de tráfego." (vs. "Catálogo de Produtos e Serviços" genérico).
- Campo de duração do plano em **meses** (`product.duration_months`) em vez de conceitos de estoque/duração em minutos do catálogo genérico — só exibido quando `traffic && product.is_recurring`.
- Vínculo com `document_templates` (contract_template_id) — templates de contrato carregados só quando `traffic` é true.

**Arquivos-chave**:
- `app/app/[orgSlug]/catalogo/page.tsx:30` — `const traffic = isTrafficNiche(org.niche)`; linha 41 carrega `listDocumentTemplates(orgSlug)` só se `traffic`; linha 59-61 troca título/hint/`isTraffic` prop.
- `app/app/[orgSlug]/catalogo/[id]/page.tsx:21` — mesmo padrão; linha 55 passa `isTraffic={traffic}`; linha 120 — `{traffic && product.is_recurring && (...)}` renderiza bloco "Duração do plano" (meses).
- `components/features/catalog/ProductDialog.tsx:15,19,40` — prop `isTraffic?: boolean` repassada ao `ProductForm`.
- `components/features/catalog/CatalogSplit.tsx:26,30,174,211` — mesma prop repassada ao `ProductDialog` interno.
- `components/features/catalog/ProductForm.tsx` — consumidor final de `isTraffic` (não lido em detalhe nesta auditoria; recebe a prop de `ProductDialog`).
- Tabela: `products` (Core, sem migration própria da vertical) — campos `duration_months`, `is_recurring`, `contract_template_id` são genéricos, usados condicionalmente pela UI.

**Conexões com o Core**: é o mesmo módulo Catálogo do CRM genérico; a vertical não duplica tabela nem rota, só a apresentação.

---

## 5. Vendas → assinatura de plano com contrato

**O que é**: para o nicho Tráfego, a tela genérica de Vendas (`/vendas`) continua sendo a mesma (`SalesTable`/`SaleDialog`/`sales`), mas passa a representar "assinatura de plano" — cada venda pode gerar um contrato de assinatura via `plan-contracts`.

**Arquivos-chave**:
- `app/app/[orgSlug]/vendas/page.tsx:16` — `const traffic = isTrafficNiche(org.niche)`; linha 40/72 — prop `isTraffic={traffic}` repassada a `SaleDialog` e `SalesTable`.
- `app/app/[orgSlug]/vendas/[saleId]/contrato/page.tsx` — rota própria da vertical (só existe/funciona para nicho Tráfego, guarda na linha 19) que renderiza o contrato de assinatura de plano via `getPlanContractRenderData` + `PlanContractPrintView`.
- `components/features/agencias-trafego/PlanoContratoManagerDialog.tsx` — dialog de gestão do contrato (upload/envio/assinatura), análogo ao equivalente de Reservas em Viagens.
- `components/features/agencias-trafego/PlanContractPrintView.tsx` — view de impressão do PDF do contrato (server-rendered, sem iframe — CSP bloqueia `frame-ancestors`, ver comentário `actions/contracts.ts:22-25`).
- `components/features/sales/SalesTable.tsx`, `components/features/sales/SaleDialog.tsx` — recebem `isTraffic` (não lidos linha a linha nesta auditoria, mas são os pontos de entrada onde a UI de Vendas se ramifica por nicho).

**Conexões com o Core**: tabela `sales` (venda genérica, Core) — sem coluna/tabela nova; o "plano" é só um `product` marcado `is_recurring` com `duration_months`.

---

## 6. `plan_contracts` — contrato próprio de assinatura

**O que é**: fluxo de geração/envio/assinatura de contrato via Autentique, específico da vertical Tráfego, com tabela e bucket de Storage **próprios**, deliberadamente não compartilhados com `sale_contracts` (Reservas/Viagens).

**Histórico relevante**: existiu uma tentativa anterior de estender `sale_contracts` para aceitar vendas genéricas (coluna `sales_generic_id`) — revertida na própria migration `0194` (linhas 59-65: dropa constraint, deleta linhas órfãs, torna `sale_id` `NOT NULL` de novo, dropa índice e coluna). A decisão final foi tabela separada.

**Funcionalidades principais** (mesmo shape que Reservas/Viagens, ver `actions/contracts.ts`):
- Gerar dados de renderização do contrato a partir de `sales` + `products.contract_template_id` (`getPlanContractRenderData`).
- Upload de PDF gerado (`uploadPlanContractPdf`) para bucket `plan-contracts`.
- Envio para assinatura via Autentique (`sendPlanContractForSignature`), 2 signatários (cliente + representante da agência).
- Consulta de status (`refreshPlanContractStatus`) e obtenção de URL assinada do PDF (`getPlanContractFileUrl`).
- Reenvio do link por e-mail (`sendPlanContractLinkByEmail`) — **não tem** equivalente de WhatsApp (Reservas tem `sendContractLinkByWhatsapp` em `actions/contracts.ts:352`, Planos não tem essa função em `plan-contracts.ts`).

**Arquivos-chave**:
- `actions/plan-contracts.ts` (329 linhas) — todas as funções atrás de `requireAccess()` (linha 12-18) que checa `checkMemberPermission(org.id, user.id, 'trafego')` — corrigido no commit `22a4c2a` (antes só chamava `requireAuth()`, sem checagem granular).
- `actions/contracts.ts` — mesma correção aplicada ao equivalente de Reservas: `requireAccess()` (linha 14-20) agora checa permissão `'reservas'` (antes só `requireAuth()`).
- Credencial compartilhada: `getApiKeyOrFail(orgId)` (`actions/contracts.ts:130-141`) — lê `organizations.autentique_api_key`, importada por `plan-contracts.ts:10`. É a **única** peça de código reaproveitada entre os dois fluxos (é configuração de integração da org, não dado de contrato — decisão explicada no comentário `actions/contracts.ts:90-93`).
- `getOrgAutentiqueConfig`/`saveOrgAutentiqueConfig` (`actions/contracts.ts:95-128`) — checam permissão `'settings'` (não `'reservas'`/`'trafego'`), ficaram deliberadamente fora do escopo do fix de `22a4c2a` (comentário na mensagem do commit).
- Migration: `supabase/migrations/0194_plan_contracts.sql` — tabela `plan_contracts` (FK `sale_id → sales`, não `travel_sales`), RLS via `get_user_organizations()` (linha 34-37), bucket privado `plan-contracts` com 4 policies de storage (linhas 43-57, mesmo padrão do bucket `sale-contracts`).
- Tabela: `plan_contracts` — colunas idênticas a `sale_contracts` (status draft/sent/signed/rejected, pdf_path, signed_pdf_path, autentique_document_id, signature_link, 2 signatários, timestamps).

**Conexões com o Core**: `sales` (venda genérica), `products.contract_template_id` → `document_templates` (Core, também usado por Reservas/Viagens), `organizations.autentique_api_key` (config de integração compartilhada), `lib/inngest/functions.ts` → `renderTemplate()` (motor de template genérico, reaproveitado igual a Reservas).

---

## 7. Dashboard — aba Tráfego

**O que é**: aba própria no Dashboard geral (`/app/[orgSlug]`), renderizada só quando `isTrafficNiche(org.niche)`.

**Funcionalidades principais** (Fase C, conforme comentário no componente):
- KPIs com dado real: Receita (30d), Vendas (30d), Clientes ativos, Novos clientes (30d), Leads gerados (30d) — todos vindos de `getTrafegoDashboardMetrics`.
- KPIs em estado vazio explicado (`—` com texto de "depende de X, ainda não modelado"): MRR, Investimento em mídia, ROAS, Margem, Clientes abaixo da meta, Churn — deliberadamente não inventados (comentário `TrafegoTab.tsx:10-13`).

**Arquivos-chave**:
- `components/features/dashboard/tabs/TrafegoTab.tsx` — server component, chama `getTrafegoDashboardMetrics(orgSlug)` (`actions/dashboard-trafego.ts`, não lido linha a linha nesta auditoria).
- `app/app/[orgSlug]/page.tsx:19` — import; linha 171-176 — renderiza `<TrafegoTab orgSlug={params.orgSlug} />` dentro de `Suspense`, condicionado a `isTrafficNiche((org as any).niche)`.

**Conexões com o Core**: dashboard genérico (`DashboardTabs` ou equivalente em `app/app/[orgSlug]/page.tsx`) — mesmo padrão das abas `ClinicaTab`/`ImobiliariaTab` para outros nichos.

---

## 8. Onde esta vertical modifica o Core

Esta é a lista exaustiva de pontos onde código específico de Tráfego altera comportamento de módulos Core compartilhados, em vez de viver isolado em `agencias-trafego/`:

| # | Arquivo:linha | Módulo Core afetado | O que muda |
|---|---|---|---|
| 1 | `components/features/Sidebar.tsx:304` | Sidebar | `{isTrafficNiche(org.niche) ? 'Planos' : 'Catálogo'}` — label do item de menu do Catálogo genérico troca para "Planos". |
| 2 | `components/features/Sidebar.tsx:489-499` | Sidebar | Bloco condicional `isModuleEnabled(org.niche, 'trafego') && can('trafego')` injeta a seção "Agências de Tráfego" (item "Clientes") no menu lateral. |
| 3 | `lib/niche-modules.ts:23,34,56,61` | Registro de módulos (Core) | `ModuleKey` ganha `'trafego'`; `TRAFFIC_ONLY`/`isModuleEnabled` decidem visibilidade — ponto único de decisão consumido pela Sidebar e potencialmente outras telas. |
| 4 | `app/app/[orgSlug]/page.tsx:20,171-176` | Dashboard | Import de `TrafegoTab` + renderização condicional por `isTrafficNiche`, mesmo padrão de `ClinicaTab`/`ImobiliariaTab`. |
| 5 | `app/app/[orgSlug]/catalogo/page.tsx:30,41,59-61` | Catálogo | Título/hint trocados para "Planos"; carrega `document_templates` só para tráfego; passa `isTraffic` para `ProductDialog`/`CatalogSplit`. |
| 6 | `app/app/[orgSlug]/catalogo/[id]/page.tsx:21,24,55,120` | Catálogo (detalhe) | Mesmo padrão da lista; linha 120 renderiza bloco "Duração do plano" (meses) só se `traffic && product.is_recurring`. |
| 7 | `components/features/catalog/ProductDialog.tsx:15,19,40` | Catálogo (dialog) | Prop `isTraffic` propagada ao `ProductForm`, que decide campos exibidos (duração em meses vs. estoque/minutos). |
| 8 | `components/features/catalog/CatalogSplit.tsx:26,30,174,211` | Catálogo (split view) | Mesma propagação de `isTraffic`. |
| 9 | `app/app/[orgSlug]/vendas/page.tsx:9,16,40,72` | Vendas | `isTraffic` calculado e propagado a `SaleDialog`/`SalesTable`, muda o comportamento da venda para representar assinatura de plano. |
| 10 | `app/app/[orgSlug]/vendas/[saleId]/contrato/page.tsx` | Vendas (sub-rota) | Rota inteira só é válida/acessível para nicho Tráfego (guarda linha 19); reaproveita a URL `vendas/[saleId]/contrato` mas troca completamente o conteúdo (contrato de plano, não de reserva). |
| 11 | `actions/contracts.ts:90-93,130-141` | Configuração de Integração (Autentique) | `getApiKeyOrFail` e `getOrgAutentiqueConfig`/`saveOrgAutentiqueConfig` são compartilhados entre Reservas e Planos — a chave de API da org serve às duas verticais a partir do mesmo código Core de Configurações. |
| 12 | `actions/marketing.ts:61-64,66-105` | Marketing (Core) | `listCampaignsByClientCore` é núcleo sem-auth do módulo Marketing, criado para ser consumido tanto pela vertical Tráfego (`listCampaignsByClient`) quanto por um Agent Layer citado em comentário (`lib/agent/tools/campaigns.ts`) — extensão do Core motivada pela vertical. |
| 13 | `supabase/migrations/0190_traffic_client_management.sql:8,10-11` | `contatos`, `ad_accounts` (Core) | Adiciona colunas `contatos.traffic_client_profile` (JSONB) e `ad_accounts.contato_id` (FK) diretamente nas tabelas Core, em vez de tabelas satélite. |
| 14 | `supabase/migrations/0194_plan_contracts.sql:59-65` | `sale_contracts` (Core/Reservas) | Reverte uma extensão anterior de `sale_contracts` (coluna `sales_generic_id`, índice, constraint de exclusividade) que tentava compartilhar a tabela entre Reservas e Planos — decisão final foi separar, mas a migration mexe diretamente na tabela Core de Reservas para desfazer o acoplamento. |

**Observação sobre o padrão dominante**: ao contrário de Viagens (que tem módulos 100% dedicados — Cotações, Ofertas, Embarques — listados em `TRAVEL_ONLY`), a vertical Tráfego é majoritariamente um **reskinning condicional de módulos Core** (Catálogo→Planos, Vendas→Assinatura) mais uma área isolada nova (`agencias-trafego/trafego`, Clientes de Tráfego). Só `plan_contracts` e a seção "Clientes" do menu são verdadeiramente isolados; Catálogo e Vendas continuam sendo o mesmo código/tabela do Core com branches de `isTraffic`/`traffic`.

---

## 9. Gaps conhecidos / dívida documentada no próprio código

- `TrafegoTab.tsx:10-13,49-77` — 6 dos 11 KPIs do dashboard de Tráfego são placeholders (`—`) por falta de modelagem: MRR, investimento em mídia, ROAS, margem, clientes abaixo da meta, churn. Não há tabela de contrato recorrente consultada por métricas — mesmo `plan_contracts` existindo, o dashboard ainda não o usa para calcular MRR/churn.
- `actions/plan-contracts.ts` não tem `sendPlanContractLinkByWhatsapp` (Reservas tem, `actions/contracts.ts:352-368`) — assimetria de funcionalidade entre as duas verticais de contrato.
- `actions/traffic-client-profile.ts:25-30` — campos de meta (`targetRoas`, `targetCpl`, etc.) citam um "Agent Layer" (`get_client_targets`) como consumidor, não auditado aqui — ponto de acoplamento externo a confirmar se necessário em tarefa futura.
- O fix de segurança do commit `22a4c2a` deixou `getOrgAutentiqueConfig`/`saveOrgAutentiqueConfig` fora da checagem `'reservas'`/`'trafego'` deliberadamente (permissão `'settings'` já cobre) — mas vale confirmar se algum membro com `'settings'` e sem `'reservas'`/`'trafego'` deveria mesmo poder ver `has_api_key` (não é dado sensível, mas é acesso indireto a saber se a integração está configurada).
