# Auditoria — Segurança / Duplicação / Testes (2026-09)

Auditoria read-only. Escopo: `actions/*.ts`, `lib/**/*.ts`, `app/api/webhooks/*`, `app/api/**/route.ts`, `components/features/**` (chamadas a Server Actions/fetch), `lib/inngest/*.ts`. Metodologia: grep amplo (`createAdminClient`, `SUPABASE_SERVICE_ROLE_KEY`, assinatura de webhook, `role ===`, etc.) seguido de leitura pontual dos candidatos mais relevantes. Não é varredura exaustiva dos ~104 usos de `createAdminClient()` — priorizei rotas públicas/anônimas e webhooks, que concentram o maior risco de vazamento entre tenants.

---

## 1. Segurança / multi-tenancy

### Crítico

**1.1 — `app/api/webhooks/autentique/route.ts` sem validação de assinatura**
`app/api/webhooks/autentique/route.ts:10-17`. O endpoint aceita qualquer POST, lê `event.type`/`event.data.document` do body sem checar HMAC/token algum (diferente de WhatsApp/Instagram, que validam `X-Hub-Signature-256`, e do Asaas, que usa `verifyStaticToken`). Mitigação parcial: antes de marcar o contrato como assinado, o código busca o status real na API da Autentique usando a `autentique_api_key` da própria org (linha 40), então um atacante não consegue forjar "assinado" só com o payload. Ainda assim, `documentId` (`autentique_document_id`) é um identificador previsível/enumerável salvo em `sale_contracts` — um atacante que descubra/adivinhe um `documentId` de outra org pode forçar o servidor a consultar a API da Autentique daquela org e, se o documento realmente estiver assinado, disparar a atualização de `sale_contracts`/`travel_sales` sem nenhuma prova de que a requisição veio da Autentique. Cenário concreto: atacante itera IDs de documento (formato previsível da Autentique) via POST repetido nesse endpoint; para qualquer ID que corresponda a um contrato real e já assinado, o webhook grava `status: 'signed'` mesmo a chamada não tendo vindo da Autentique. Recomendação: exigir um segredo compartilhado (header custom, já que a Autentique não oferece HMAC nativo) ou, no mínimo, validar contra uma lista de IPs conhecidos da Autentique.

**1.2 — Webhook Asaas sem deduplicação por evento antes de creditar (duplicidade financeira)**
`app/api/webhooks/asaas/route.ts:36-93`. O evento é persistido em `billing_events` via `insert` simples (sem `unique` em `payload->>id`/external id verificado antes do insert) e a lógica de crédito avulso (`credit_pack:*`, linhas 54-93) soma `credits_purchased` direto, sem checar se aquele evento específico (Asaas manda `id` no payload) já foi processado. Asaas, como a maioria dos provedores de webhook, reenvia em caso de timeout/non-2xx. Cenário concreto: o processamento demora (import dinâmico + updates) e excede o timeout do lado da Asaas antes do `return`; Asaas reenvia o mesmo `PAYMENT_CONFIRMED`; o handler roda de novo e credita os créditos de IA em dobro para a mesma compra — impacto financeiro direto. A tabela `billing_events` grava `payload` mas não há `unique constraint`/checagem por `payload.id` antes de aplicar o efeito colateral. Recomendação: usar o `id` do evento Asaas como chave de idempotência (unique constraint + `on conflict do nothing` antes de processar).

### Alto

**1.3 — `acceptInviteAsNewUser`/`getInviteeAccountStatus` usam `listUsers()` sem paginação para checar e-mail existente**
`actions/team-accept.ts:55-58` e `:102-105`. `admin.auth.admin.listUsers()` sem paginação retorna só a primeira página (padrão do GoTrue, tipicamente 50 usuários). Conforme a base de usuários do Althos cresce além disso, a checagem "já existe conta com esse e-mail" passa a ser um falso-negativo para usuários fora da primeira página. Cenário concreto: com > 50 contas cadastradas, um convidado cujo e-mail já tem conta (mas está fora da primeira página de `listUsers()`) consegue passar pela checagem de `existing` (linha 103) e cair em `admin.auth.admin.createUser()` — na melhor hipótese, o Supabase rejeita por e-mail duplicado; na pior (se o e-mail cadastrado antes for case-diferente ou for um provider distinto), cria um segundo registro incoerente. Recomendação: usar `admin.auth.admin.getUserByEmail`/filtro server-side em vez de listar todos os usuários.

**1.4 — Verificações de permissão por `role === 'admin'/'owner'` inline em vez de `checkMemberPermission`**
Ver seção 2.4 abaixo — tratado como duplicação, mas também é risco de segurança: cada ponto que reimplementa a checagem de role manualmente (`actions/organization-accounts.ts:34`, `actions/pipeline-distribution.ts:36`, `actions/voice-numbers.ts:19`, `actions/voice-settings.ts:36`, `actions/team-remove.ts:52`, `actions/team-shared.ts:27`) ignora as permissões granulares por módulo (`PermissionKey`) e o bypass de super-admin documentados em `lib/permissions.server.ts`. Se a política de autorização mudar ali (ex.: revogar permissão granular a um admin específico), esses seis pontos continuam liberando acesso só pelo `role`, criando uma inconsistência de autorização silenciosa entre módulos.

### Médio

**1.5 — `app/r/[code]/route.ts` grava `tracking_clicks` com dados de request não validados**
`app/r/[code]/route.ts:50-65`. Rota pública (correto, por natureza), mas `utm_source`, `utm_medium`, `fbclid` etc. vêm direto de `url.searchParams.get(...)` sem sanitização/limite de tamanho antes do insert via admin client. Não há RLS nem Zod aqui — abuso possível de payloads grandes em `utm_content`/`referrer` (o `user-agent`/`referer` também são inseridos sem cap de tamanho). Risco baixo de tenant-leak (o insert é sempre escopado por `link.organization_id`, correto), mas é insumo não validado indo pro banco — pode inflar `tracking_clicks` com lixo/strings enormes.

**1.6 — `getInviteeAccountStatus` vaza indiretamente se um e-mail tem conta**
`actions/team-accept.ts:42-60`. Função pública (chamada da página `/convite/[token]`) retorna `hasAccount: boolean` para qualquer requisição com um token de convite válido. Não é uma falha grave (o token já é um segredo por si só), mas combinado com 1.3, um token de convite válido + iteração de e-mails poderia ser usado para enumerar contas — risco baixo/médio, McCabe pelo escopo do token.

### Baixo

**1.7 — Padrão consistente e correto na maioria dos fluxos públicos revisados**
`actions/public_forms.ts`, `actions/appointments-public.ts`, `actions/public-leads.ts`: todos resolvem a org primeiro (por slug/token) e escopam toda query subsequente por `organization_id` explícito — nenhum finding de vazamento cross-tenant nesses três. Mantidos como referência de "como fazer certo" para revisões futuras de outras rotas públicas.

---

## 2. Código duplicado

**2.1 — Normalização de telefone espalhada, sem função canônica única**
Existem implementações/usos independentes de formatação/normalização de telefone em `lib/utils.ts:12` (`formatPhoneDisplay`), `lib/meta/capi.ts`, `lib/nps/send-survey.ts` e `actions/whatsapp-connection.ts` — sem um único helper `normalizePhone()` compartilhado que todos consomem. Isso é o padrão clássico de dedup de lead por telefone divergindo sutilmente entre WhatsApp, NPS e Meta CAPI (um normaliza com `+55`, outro sem, por exemplo). Recomendação: consolidar em um único `lib/phone.ts` com `normalizePhoneE164()`/`formatPhoneDisplay()` e migrar os quatro pontos de uso.

**2.2 — Lógica de rehost/ingestão de mídia duplicada entre WhatsApp e Instagram**
`lib/whatsapp/scheduled-delivery.ts`, `lib/inngest/whatsapp-ingest.ts` vs. `lib/social/engine.ts`/`lib/social/engine-helpers.ts`/`lib/social/conversation-log.ts` — todos implementam separadamente o fluxo "baixar mídia da API do canal → subir pro storage próprio → salvar referência". Como o `CLAUDE.md` já aponta que toda mídia nova deveria passar por `StorageService` (`lib/storage/index.ts`), vale confirmar que os quatro pontos realmente delegam pra lá e não reimplementam upload direto — recomendo uma auditoria dedicada (fora do escopo de leitura completa aqui) comparando linha a linha esses arquivos para extrair um `lib/media/rehost.ts` único, hoje a lógica de "baixar do provider e persistir" está fragmentada por canal.

**2.3 — Checagem de permissão de role duplicada manualmente (ver também 1.4)**
`actions/organization-accounts.ts:34`, `actions/pipeline-distribution.ts:36`, `actions/team-shared.ts:27`, `actions/team-remove.ts:52`, `actions/voice-numbers.ts:19`, `actions/voice-settings.ts:36` reimplementam `membership.role === 'admin' | 'owner'` em vez de chamar `checkMemberPermission`/o helper central de `lib/permissions.server.ts`. Seis pontos de verdade divergentes para "é admin?" é o exato risco que `lib/permissions.server.ts` foi criado para eliminar. Sugestão: expor um `isOrgAdmin(orgId, userId)` em `lib/permissions.server.ts` e substituir as seis ocorrências.

**2.4 — Filtro `role === 'user' | 'assistant'` de histórico de conversa repetido em 4 lugares**
`actions/ai_attendant-sandbox.ts:166`, `actions/ai_insights.ts:177`, `app/api/copilot/chat/route.ts:125`, `app/api/financial-ai/chat/route.ts:91` fazem exatamente o mesmo `.filter(m => m.role === 'user' || m.role === 'assistant')` com o mesmo cast de tipo. Baixo risco, mas candidato óbvio a um helper `sanitizeChatHistory()` compartilhado em `lib/ai/`.

---

## 3. Testes faltando

Suíte real (`tests/unit/*.test.ts`, Vitest): `antispam`, `backup-crypto`, `backup-manifest`, `backup-restore-guard`, `backup-retention`, `billing-plans`, `currency`, `date-filter`, `lead-origin`, `plans-config`, `security-authz`, `slugify`, `storage-key`, `task-colors`, `webhook`, `whatsapp-inbox-view`. Boa cobertura em billing legado (`billing-plans.test.ts`) e no novo (`plans-config.test.ts`) e em `webhook.test.ts` (provavelmente cobre `verifyStaticToken`/`verifyResendWebhook` de `lib/security/webhook.ts`).

**Sem teste correspondente, priorizados:**

- **Crítico/financeiro** — `lib/plans/server.ts`: `consumeAiCredits()` (linha 121), `getAiCreditsStatus()` (linha 168), `currentPeriodMonth()` (linha 205) e o cálculo de `cost = Math.max(1, Math.ceil(baseCost * multiplier))` (linha 132) não têm teste unitário. É lógica de arredondamento e multiplicador de modelo (Haiku 1x/Sonnet 3x/Opus 5x) que decide quanto crédito é debitado por chamada de IA — erro de arredondamento aqui sangra créditos silenciosamente. `plans-config.test.ts` cobre a config estática, mas não a função de consumo em si.
- **Crítico/financeiro** — `app/api/webhooks/asaas/route.ts`: nenhum teste cobre o parsing de `externalReference` (`credit_pack:<accountId>:<credits>`, linha 57), a resolução de `planKey` (linha 113-115) ou o fluxo de ativação de assinatura. Dado o achado 1.2 (ausência de idempotência), um teste que simule reentrega do mesmo evento já destacaria o bug antes de produção.
- **Alto** — `actions/financial-reports.ts`: `getSimpleDRE` (linha 11), `getCashFlowProjection` (linha 119, horizonte de 90 dias) e `getDailyCashFlow` (linha 42) — cálculos de fluxo de caixa/DRE sem nenhum teste; são os números que o usuário vê no dashboard financeiro e vai tomar decisão em cima.
- **Alto** — `actions/financial-summary.ts`: `getFinancialKpis` (linha 58), `getCashFlowSeries` (linha 140), `getRevenueBreakdown`/`getExpenseBreakdown` (linhas 232/279) — mesma categoria, zero cobertura.
- **Médio** — `actions/appointments-public.ts`: `getAvailableSlots` (linha 80) tem lógica não trivial de geração de slots (buffer, step, filtragem de conflito, timezone fixo `-03:00` sem DST) e nenhum teste garante que overlaps são detectados corretamente ou que o slot no passado é excluído.
- **Médio** — dedup de lead por e-mail/telefone repetida em `actions/public_forms.ts:62-78`, `actions/appointments-public.ts:217-251` e (presumivelmente) nos fluxos de WhatsApp/Instagram — nenhuma tem teste; o "find or create lead" é reimplementado em cada arquivo (ver também achado 2.1/2.2) e uma mudança em um lugar não garante que os outros continuem corretos.
- **Baixo** — helpers de normalização de telefone (`lib/utils.ts:formatPhoneDisplay`) não têm teste próprio, apesar de `date-filter.test.ts`/`currency.test.ts` mostrarem que esse padrão de teste de parsing já existe no repo — é replicável facilmente.

---

## Resumo de contagem

| Seção | Crítico | Alto | Médio | Baixo |
|---|---|---|---|---|
| 1. Segurança | 2 | 2 | 2 | 1 |
| 2. Duplicação | 0 | 1 (2.3) | 2 (2.1, 2.2) | 1 (2.4) |
| 3. Testes | 2 | 2 | 2 | 1 |
