# Vertical: Corretora de Seguros

Gerado em: 2026-08-22, baseado no código em HEAD.

Nicho gated por `isInsuranceNiche(niche)` — `lib/niche.ts:24-27` (`niche.toLowerCase().includes('segur')`). É a vertical mais nova do sistema, construída em 5 fases sequenciais (commits `fb92d3f` → `7ef3340`), cada uma com sua própria migration numerada (0185–0189) e sem nenhum audit prévio em `docs/audit/`.

## Sumário

1. [Fases de construção (histórico)](#fases)
2. [Cadastro: Produtos de Seguro](#produtos)
3. [Cadastro: Seguradoras](#seguradoras)
4. [Cotações (comparação entre seguradoras)](#cotacoes)
5. [Apólices (emissão + comissão parcelada)](#apolices)
6. [Configuração de lembrete de renovação](#config-renovacao)
7. [Sinistros](#sinistros)
8. [Permissões e visibilidade no menu](#permissoes)
9. [Onde esta vertical modifica o Core](#core)

---

## 1. Fases de construção (histórico) {#fases}

| Fase | Commit | O que entrega |
|---|---|---|
| 1 | `fb92d3f` | Cadastro de Produtos de Seguro + Seguradoras (`0185_insurance_catalog.sql`) |
| 2 | `54d06bd` | Cotações com comparação entre seguradoras (`0186_insurance_quotes.sql`) |
| 3 | `3a2b52c` | Apólices com comissão parcelada no Financeiro (`0187_insurance_policies.sql`) |
| 4 | `c0510fc` | Lembrete automático de renovação de apólice (`0188_insurance_renewal_settings.sql` + `lib/inngest/insurance-crons.ts`) |
| 5 | `7ef3340` | Sinistros com documentos e tarefa automática (`0189_insurance_claims.sql`) |

Cada fase comenta explicitamente no SQL/código de qual módulo de outra vertical ela "espelha" o design — o padrão declarado é reuso deliberado de arquitetura, não vertical isolada do zero:
- Produtos/Seguradoras → mesmo espírito de `properties.property_type` (Imobiliárias) para tipo livre, sem enum travado.
- Cotações/itens → espelha `property_proposals`/`property_proposal_items` (Imobiliárias) 1:1.
- Apólices → espelha `actions/property-deals.ts::closeDeal` (Imobiliárias): emite a partir de cotação aprovada, sincroniza Financeiro, dispara evento Inngest.
- Lembrete de renovação → mesmo padrão de evento genérico de `imoveis.visit.scheduled` (sem lógica de WhatsApp duplicada — delega ao motor de automação genérico).

---

## 2. Cadastro: Produtos de Seguro {#produtos}

### O que é / o que resolve
Catálogo extensível de tipos de seguro (Auto, Residencial, Vida, etc.) — texto livre, sem enum travado no banco.

### Funcionalidades principais
- CRUD simples: nome, descrição, ativo/inativo (soft-archive via `isActive: false`, sem delete físico).

### Arquivos-chave
- Rota: `app/app/[orgSlug]/produtos-seguro/page.tsx` (19 linhas — server component, `listInsuranceProducts` + `InsuranceProductsView`)
- Componente: `components/features/insurance/InsuranceProductsView.tsx`
- Server Actions: `actions/insurance-products.ts` (`listInsuranceProducts`, `createInsuranceProduct`, `updateInsuranceProduct`, `archiveInsuranceProduct`)
- Tabela: `insurance_products` (`supabase/migrations/0185_insurance_catalog.sql:1-18`)

### Conexões
- Referenciado por `insurance_quotes.insurance_product_id` (FK `ON DELETE RESTRICT` — não é possível apagar um produto usado em cotação/apólice).

---

## 3. Cadastro: Seguradoras {#seguradoras}

### O que é / o que resolve
Entidade de seguradora/operadora parceira da corretora — não existia equivalente no projeto antes (a vertical Viagens usa `operator` como texto livre solto em `travel_sales`, sem tabela própria).

### Funcionalidades principais
- CRUD: nome, CNPJ, contato (nome/telefone/e-mail), condições gerais (texto livre), logo, notas internas, ativo/inativo.
- Upload de logo via `uploadSaleVoucher` (`actions/upload.ts`) — reaproveita o Storage já existente da vertical Viagens (bucket de vouchers), sem bucket dedicado. Só 1 logo por seguradora (`logo_storage_key`, sem tabela de mídia).

### Arquivos-chave
- Rota: `app/app/[orgSlug]/seguradoras/page.tsx` (19 linhas)
- Componente: `components/features/insurance/InsurersView.tsx` (upload de logo em `InsurersView.tsx:14,51`)
- Server Actions: `actions/insurers.ts` (`listInsurers`, `getInsurer`, `createInsurer`, `updateInsurer`, `archiveInsurer`)
- Tabela: `insurers` (`supabase/migrations/0185_insurance_catalog.sql:20-43`)

### Conexões
- Referenciada por `insurance_quote_items.insurer_id` (`ON DELETE RESTRICT`) e `insurance_policies.insurer_id` (`ON DELETE RESTRICT`).
- Nome/logo exibidos via join em Cotações, Apólices e Sinistros (nunca desnormalizados).

---

## 4. Cotações (comparação entre seguradoras) {#cotacoes}

### O que é / o que resolve
Uma cotação = 1 cliente + 1 produto de seguro + N seguradoras comparadas lado a lado (prêmio, cobertura, franquia, condições por seguradora). Espelha 1:1 o padrão `property_proposals`/`property_proposal_items` da vertical Imobiliárias.

### Funcionalidades principais
- Status com 10 estados: `rascunho → em_cotacao → recebida → em_analise → apresentada → em_negociacao → aprovada/recusada/expirada/cancelada` (`actions/insurance-quotes.ts:17-19`, check constraint em `0186_insurance_quotes.sql:7-10`).
- Cada cotação tem N itens (`insurance_quote_items`), um por seguradora comparada, com `premium_cents`, `coverage`, `franquia`, `conditions`, `sort_order`.
- **Padrão delete+reinsert total**: ao salvar uma cotação, todos os itens são deletados e reinseridos (`replaceItems`, `actions/insurance-quotes.ts:90-102`) — mesmo padrão de `property_proposal_items`, não faz update incremental de item.
- `lowestPremiumCents` calculado em memória no mapeamento da linha (`actions/insurance-quotes.ts:79,86`) — não é uma coluna, é derivado a cada leitura.
- `valid_until`: data de validade da cotação (não gatilha nada automaticamente — não há cron de expiração).

### Arquivos-chave
- Rota: `app/app/[orgSlug]/cotacoes-seguro/page.tsx`
- Componente: `components/features/insurance/InsuranceQuotesView.tsx`
- Server Actions: `actions/insurance-quotes.ts` (`listQuotes`, `getQuote`, `createQuote`, `updateQuote`, `setQuoteStatus`)
- Tabelas: `insurance_quotes` + `insurance_quote_items` (`supabase/migrations/0186_insurance_quotes.sql`)

### Conexões
- `insurance_quotes.contato_id` → `contatos` (Core) `ON DELETE CASCADE`.
- `insurance_quotes.insurance_product_id` → produtos (Fase 1).
- `insurance_quote_items.insurer_id` → seguradoras (Fase 1).
- Consumida por Apólices: `issuePolicy` recebe `quoteId` opcional e, se presente, marca a cotação como `aprovada` (`actions/insurance-policies.ts:125-127`).

---

## 5. Apólices (emissão + comissão parcelada) {#apolices}

### O que é / o que resolve
Emissão de uma apólice — a partir de uma cotação aprovada ou diretamente — com geração automática de número, e a comissão da corretora lançada no Financeiro (parcelada de verdade se `installments_count > 1`).

### Funcionalidades principais
- `policy_number` auto-gerado no formato `APL-000001` via trigger de banco (`generate_insurance_policy_number()`, `0187_insurance_policies.sql:40-59`) — mesmo padrão de `properties.code`.
- Status: `em_emissao / ativa / suspensa / cancelada / expirada` (`0187_insurance_policies.sql:16-18`).
- `issuePolicy` (`actions/insurance-policies.ts:103-162`):
  - Insere a apólice.
  - Se veio de cotação (`quoteId`), atualiza `insurance_quotes.status = 'aprovada'`.
  - Se `commissionCents > 0`, gera N lançamentos em `financial_entries` (receita, categoria "Comissão de seguros"), um por parcela, com vencimento mensal a partir de `startDate` (ou hoje). **Primeira vertical a de fato consumir `installment_group_id`/`parcela_numero`/`parcela_total`** (colunas existentes desde a migration 0120, mas sem consumidor real até aqui) — divisão do valor com resto jogado na última parcela (`actions/insurance-policies.ts:132-151`).
  - Dispara evento Inngest `seguros.policy.issued`.
  - Revalida `/apolices`, `/cotacoes-seguro` e **`/financeiro`**.
- `cancelPolicy`: marca apólice como `cancelada` e cancela em cascata todos os `financial_entries` `pendente`/`vencido` vinculados (`actions/insurance-policies.ts:164-185`) — não mexe em parcelas já pagas.

### Arquivos-chave
- Rota: `app/app/[orgSlug]/apolices/page.tsx` (busca policies + quotes + products + insurers + contatos + config de renovação em paralelo)
- Componente: `components/features/insurance/InsurancePoliciesView.tsx`
- Server Actions: `actions/insurance-policies.ts` (`listPolicies`, `getPolicy`, `issuePolicy`, `cancelPolicy`)
- Tabela: `insurance_policies` (`supabase/migrations/0187_insurance_policies.sql`)
- Coluna nova em tabela Core: `financial_entries.insurance_policy_id` (`0187_insurance_policies.sql:61-63`)

### Conexões
- `quote_id` → `insurance_quotes` (`ON DELETE SET NULL` — apólice sobrevive se a cotação for apagada).
- `contato_id` → `contatos` (Core).
- `insurer_id` → `insurers`, `insurance_product_id` → `insurance_products`.
- Base de Sinistros: `insurance_claims.policy_id` referencia `insurance_policies`.

### Inngest
- Evento emitido (não function própria): `seguros.policy.issued` — consumido pelo motor de automação genérico (`lib/inngest/automation.ts:116`), mesmo mecanismo de `imoveis.deal.closed`, sem engine paralela.

---

## 6. Configuração de lembrete de renovação {#config-renovacao}

### O que é / o que resolve
Permite a org configurar em quantos dias de antecedência (múltiplos thresholds) quer ser lembrada da renovação de uma apólice.

### Funcionalidades principais
- `getInsuranceRenewalSettings`/`saveInsuranceRenewalSettings` (`actions/insurance-settings.ts`) leem/gravam `org_settings.insurance_renewal_reminder_days` (array de inteiros, default `{60,30,15}`, `0188_insurance_renewal_settings.sql:1-2`).
- Validação: 1 a 10 valores, 1–365 dias cada (`DaysSchema`, `actions/insurance-settings.ts:16`); duplicados removidos e ordenados decrescente ao salvar.
- Editado diretamente na tela de Apólices (não tem rota própria).

### Arquivos-chave
- Server Actions: `actions/insurance-settings.ts`
- Coluna: `org_settings.insurance_renewal_reminder_days` (`supabase/migrations/0188_insurance_renewal_settings.sql:1-2`)
- Coluna auxiliar de idempotência: `insurance_policies.renewal_reminder_days_sent` (`0188_insurance_renewal_settings.sql:4-5`)

### Conexões
- Consumida pelo cron `insuranceRenewalReminderCronFn` (`lib/inngest/insurance-crons.ts`).

---

## 7. Sinistros {#sinistros}

### O que é / o que resolve
Acompanhamento de sinistros pela corretora — explicitamente **não** substitui o sistema interno da seguradora, é só rastreamento do lado da corretora (comentário no código, `actions/insurance-claims.ts:13`).

### Funcionalidades principais
- Status: `aberto / em_analise / aguardando_documentos / em_regulacao / aprovado / negado / concluido` (`0189_insurance_claims.sql:11-14`).
- Seguradora do sinistro **não é uma FK direta** — vem via join `insurance_claims → insurance_policies → insurers`, porque a seguradora de uma apólice já emitida não muda (deliberado, comentado em `0189_insurance_claims.sql:55` e `actions/insurance-claims.ts:14`).
- `createClaim` (`actions/insurance-claims.ts:96-134`):
  - Insere o sinistro.
  - **Cria uma tarefa automaticamente** em `tasks` (Core), título `"Sinistro aberto: {cliente} — apólice {numero}"`, `due_date = hoje`, `assigned_to = responsavelUserId || user.id`, na primeira coluna (`task_columns`, ordenada por `position`) da org.
  - Dispara `seguros.claim.opened`.
- Documentos do sinistro: `insurance_claim_documents` (storage_key/label/kind), upload via `uploadSaleVoucher` (mesmo bucket de vouchers de Viagens, reaproveitado — sem bucket dedicado a Seguros). `addClaimDocument`/`removeClaimDocument`.

### Arquivos-chave
- Rota: `app/app/[orgSlug]/sinistros/page.tsx`
- Componente: `components/features/insurance/InsuranceClaimsView.tsx` (upload em `InsuranceClaimsView.tsx:15,97`)
- Server Actions: `actions/insurance-claims.ts` (`listClaims`, `getClaim`, `createClaim`, `updateClaim`, `setClaimStatus`, `addClaimDocument`, `removeClaimDocument`)
- Tabelas: `insurance_claims` + `insurance_claim_documents` (`supabase/migrations/0189_insurance_claims.sql`)

### Conexões
- `policy_id` → `insurance_policies` (`ON DELETE CASCADE` — sinistro morre se a apólice for apagada, o que na prática quase não acontece já que apólices só são canceladas, não deletadas).
- `contato_id` → `contatos` (Core).
- Cria registro em `tasks` (Core) automaticamente na abertura.

### Inngest
- Evento emitido: `seguros.claim.opened` — consumido pelo motor de automação genérico (`lib/inngest/automation.ts:118`).

---

## 8. Permissões e visibilidade no menu {#permissoes}

- Permissão única cobre toda a vertical: `PermissionKey = 'seguros'` (`lib/permissions.ts:36,90`), verificada em toda action via `checkMemberPermission(org.id, user.id, 'seguros')` (repetido em `insurance-products.ts`, `insurers.ts`, `insurance-quotes.ts`, `insurance-policies.ts`, `insurance-settings.ts`, `insurance-claims.ts` — não há permissão granular por módulo dentro de Seguros).
- `'seguros'` está em `NON_TRAVEL_ONLY_KEYS` (`lib/permissions.ts:177`) — não aparece em orgs do nicho Viagens.
- Default de permissão para membros novos: `seguros: false` (`lib/permissions.ts:163`) — precisa ser concedida explicitamente.
- Visibilidade no menu: `isModuleEnabled(org.niche, 'seguros')` — `lib/niche-modules.ts:33,60`, `INSURANCE_ONLY = ['seguros']`.
- Sidebar (`components/features/Sidebar.tsx:447-487`): seção "Seguros" com 5 links — Cotações, Produtos, Seguradoras, Apólices, Sinistros — condicionada a `isModuleEnabled(...) && can('seguros')`.
- **Diferença de outras verticais**: ao contrário de Imobiliárias (que exclui `catalogo`/`vendas`/`agendamentos` do menu via `NOT_REAL_ESTATE`), Seguros **não exclui nada de `GENERIC_ONLY`** — o CRM genérico (Catálogo, Vendas, Agendamentos) continua visível/em uso normalmente ao lado dos módulos de Seguros (comentário explícito em `lib/niche-modules.ts:48-50`).

---

## 9. Onde esta vertical modifica o Core {#core}

| Módulo Core afetado | Mudança | Arquivo:linha |
|---|---|---|
| **Financeiro** (`financial_entries`) | Nova coluna `insurance_policy_id` (FK, `ON DELETE SET NULL`) | `supabase/migrations/0187_insurance_policies.sql:61-63` |
| **Financeiro** — parcelamento real | Primeira vertical a popular `installment_group_id`/`parcela_numero`/`parcela_total` de fato (colunas existiam desde a migration 0120, sem consumidor até então) | `actions/insurance-policies.ts:132-151` |
| **Financeiro** — cancelamento em cascata | `cancelPolicy` cancela todos os lançamentos `pendente`/`vencido` vinculados à apólice | `actions/insurance-policies.ts:176-181` |
| **Tarefas** (`tasks`) | `createClaim` cria tarefa automática de acompanhamento de sinistro | `actions/insurance-claims.ts:120-125` |
| **Tarefas** (`tasks`) | Cron de renovação cria tarefa automática de lembrete | `lib/inngest/insurance-crons.ts:82-87` |
| **Sidebar** | Seção "Seguros" com 5 links, condicionada a nicho+permissão | `components/features/Sidebar.tsx:447-487` |
| **Permissões** (`lib/permissions.ts`) | Nova `PermissionKey = 'seguros'`, seção própria, default `false`, listada em `NON_TRAVEL_ONLY_KEYS` | `lib/permissions.ts:36,90,163,177` |
| **Módulos por nicho** (`lib/niche-modules.ts`) | Nova entrada `INSURANCE_ONLY = ['seguros']`; não exclui `GENERIC_ONLY` (diferente de Imobiliárias) | `lib/niche-modules.ts:20-21,33,44-63` |
| **Automação genérica** (`lib/inngest/automation.ts`) | 3 eventos novos registrados no motor genérico, sem engine paralela: `seguros.policy.issued`, `seguros.policy.renewal_due`, `seguros.claim.opened` | `lib/inngest/automation.ts:116-118` |
| **Inngest route** (`app/api/inngest/route.ts`) | Registra `insuranceRenewalReminderCronFn` (cron diário `0 8 * * *`) | `app/api/inngest/route.ts:20,62` |
| **Storage** | Sem bucket dedicado — reaproveita `uploadSaleVoucher` (`actions/upload.ts`, bucket de vouchers da vertical Viagens) tanto para logo de seguradora quanto para documentos de sinistro | `components/features/insurance/InsurersView.tsx:14,51`; `components/features/insurance/InsuranceClaimsView.tsx:15,97` |
| **Contatos** | Nenhuma coluna nova em `contatos` — todas as tabelas de Seguros apontam para `contatos` via FK padrão (`contato_id`), sem campo específico de seguro no cadastro de contato | — |
| **Dashboard** | Nenhuma referência a Seguros encontrada no dashboard genérico — vertical não tem cards/KPIs próprios no dashboard Core (possível gap/oportunidade, não implementado) | — |

### Observações gerais
- Todas as 6 tabelas novas (`insurance_products`, `insurers`, `insurance_quotes`, `insurance_quote_items`, `insurance_policies`, `insurance_claims`, `insurance_claim_documents`) seguem o padrão RLS do resto do sistema: `organization_id IN (SELECT get_user_organizations())` + policy separada para super-admin.
- Nenhuma function Inngest própria de "engine" de Seguros existe — só o cron de renovação (`insuranceRenewalReminderCronFn`). Todo o resto de automação (WhatsApp em emissão/renovação/sinistro, se configurado) passa pelo motor de automação genérico do Core, não há lógica duplicada.
- Não há testes unitários específicos de Seguros em `tests/unit/` (buscar confirma ausência) — mesma lacuna geral do projeto fora de antispam/billing/currency/date-filters/webhooks/slugify.
