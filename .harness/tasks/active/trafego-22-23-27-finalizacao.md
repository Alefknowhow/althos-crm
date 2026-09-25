# Finalização da vertical Tráfego — issues #23, #27 (+#61) e #22

- **Status**: active — plano aprovado para execução, nenhuma fase iniciada
- **Criado em**: 2026-09-25
- **Responsável**: Claude (Claude Code)
- **Issues**: #23 (Biblioteca), #27 (Portal do Cliente) + #61 (follow-up do #27), #22 (Tráfego + Traffic Agent/Ads Tool Layer)

> **Como executar este plano (leia antes de começar):**
> 1. Execute as fases **na ordem** (1 → 2 → 3). Dentro de cada fase, os passos também estão em ordem de dependência.
> 2. **Um commit por passo** (ou por par de passos pequenos marcados como "mesmo commit"). Depois de cada commit: `tsc --noEmit`, `npm run lint` (0 erros), e a cada fim de fase um `next build` completo — com o contorno do `xlsx` descrito em "Validação".
> 3. Push em `claude/vibrant-hawking-9ka67c` e fast-forward para `master` (conferir `git merge-base origin/master HEAD == git rev-parse origin/master`; se não for FF, `git merge origin/master` — nunca rebase/force).
> 4. Passos marcados **⛔ BLOQUEADO** dependem de credencial/aprovação externa: **não implementar a parte bloqueada**; implementar só o que o passo diz que é seguro (interface/flag desligada) e seguir.
> 5. Passos marcados **❓ CHECKPOINT** exigem rodar a query/verificação indicada antes; se o resultado divergir do esperado, parar e perguntar ao usuário.
> 6. Nunca editar migration já aplicada. Próximo número livre hoje: **0285** (confira `ls supabase/migrations | tail -1`). Aplicar via `mcp__Supabase__apply_migration` com `project_id: boggtwpywbkpzkmvnbng` e **também** criar o arquivo `.sql` idêntico no repo.
> 7. Ao terminar cada fase, atualizar a seção "Progresso" deste arquivo e marcar checkboxes nas issues.

---

## 0. Estado real (descoberta de 2026-09-25) — corrige premissas anteriores

Estas descobertas mudam o escopo em relação ao que foi dito antes nas issues/comentários:

1. **#19 está 100% concluída** (7/7 sub-issues, ver `.harness/tasks/active/orquestrador-global-ia-19.md`). Existe toda a infra que o Traffic Agent precisa:
   - `agent_definitions` + `lib/agent-definitions/invoke.ts::invokeAgentDefinition()` (Agent Definition configurável, runtime context, tools via registry, `emit_result`).
   - `lib/agent/execute.ts::executeTool()` com **`requiresApproval`** (enfileira em `agent_pending_approvals`, notifica, aprovar re-executa revalidando permissão) e **`capabilityKey`** (entitlements). UI de aprovação já existe em `configuracoes/aprovacoes`.
   - `agent_audit_log` unificado (`lib/agent/audit.ts::logAiExecution()`).
   - "Skill Registry" = `library_items` (`lib/ai/library.ts`, `source_module`/`category`) — já injetado automaticamente em todo Agent Definition.
   - Orquestrador global (`mod+j`) que já oferece todas as tools do `TOOL_REGISTRY`.
2. **Meta CAPI server-side já existe e já dispara** (`lib/meta/capi.ts::sendCapiEvent`), configurado **por pipeline** (`pipelines.meta_pixel_id`, `meta_access_token`, `google_ads_id`, `google_ads_conversion_label`):
   - `Lead` em formulário público (`actions/public_forms.ts`), `Purchase`/`NotQualified` ao mover lead pra estágio ganho/perdido (`actions/contatos-pipeline.ts`), evento na qualificação por IA (`lib/ai/run-qualification.ts`). Deduplicação por `eventId`, `fbc`/`fbp`/`ctwa_clid` já propagados.
   - **Não existe log** de envios CAPI (sucesso/falha/última atividade) — é o gap real pra "Tracking/saúde".
   - O §6 do #27 ("feedback server-side") está portanto **majoritariamente feito para Meta**; falta: conversão manual do Portal disparar CAPI, e observabilidade.
3. **Meta Ads OAuth é só leitura** (`ADS_SCOPES = 'ads_read'` em `lib/meta/ads-oauth.ts`). Leituras existentes em `lib/meta/ads.ts`: campanhas, adsets, ads, insights diários, insights por anúncio. **Nenhuma mutation.**
4. **Google Ads: zero integração** (só `gclid` capturado em `app/r/[code]/route.ts`/`tracking_links`, e `google_ads_id`/label client-side por pipeline). Sem OAuth, sem developer token.
5. **Adicionar trigger de automação é padrão de baixo risco** (corrige o que foi dito antes): basta `inngest.send({ name, data: { orgId, leadId } })` na origem + registrar o evento no `triggers` de uma `createFunction` em `lib/inngest/automation.ts` (todas chamam o mesmo `handleAutomationEvent`, que casa por `trigger_type`) + entrada em `lib/automations/trigger-meta.ts`. Limite do Inngest: 10 triggers por function (`automation-process-verticals-2` já tem 9) → criar function nova.
6. **Portal não permite upload** (critério de aceite do #23 "Cliente pode enviar materiais brutos pelo Portal" **não atendido**). `actions/storage-upload.ts::uploadFile` exige sessão de membro — precisa variante de portal.
7. `media_plan_items.creative_id` é FK para **`campaign_creatives`** (legado). Como a aba Criativos saiu, o picker de criativo do plano de mídia precisa passar a apontar para `library_assets`.
8. Já existem e devem ser reaproveitados (não recriar): `lib/trafego/alerts.ts::computeClientAlerts`, `lib/trafego/health-status.ts::computeClientHealthStatus`, `actions/marketing-accounts.ts::listCampaignsByClientCore` (sem auth, recebe client), `actions/trafego-performance.ts::getClientPerformanceSummaryCore`, `actions/marketing-strategist.ts` (IA que propõe plano de mídia via `tool_choice` forçado), tools de agente `get_campaigns`, `get_campaign_performance`, `get_clients`, `get_client`, `get_client_performance`, `get_client_targets`.

### Decisões/credenciais que dependem do usuário (não bloqueiam as Fases 1 e 2)

| Item | Necessário para | Estado |
|---|---|---|
| Escopo `ads_management` no app Meta + **App Review** da Meta | Mutations Meta (pausar, orçamento) — Fase 3.8 | ⛔ não disponível |
| Google Ads **developer token** + OAuth client (Google Cloud) + conta de teste (MCC) | Adapter Google (leitura e escrita) e upload de conversão offline — Fases 2.9 e 3.9 | ⛔ não disponível |
| Conta de anúncio Meta de teste | Testar ponta-a-ponta leituras/CAPI | opcional (código já em produção) |

---

## Fase 1 — Fechar #23 (Biblioteca)

Critérios de aceite do #23 ainda não atendidos: upload pelo cliente no Portal; comentário do cliente no Portal; versão final aprovada identificável; relação com campanha; IA consultando assets com autorização; integração com Automações; legado `campaign_creatives`.

### 1.1 Upload de material bruto e comentário pelo Portal do Cliente
- **Arquivos**: `actions/client-portal-data.ts` (novas actions), `components/features/portal/PortalLibraryTab.tsx` (novo, extraído do `PortalDashboard.tsx` pra não estourar 350 linhas), `PortalDashboard.tsx`.
- **Actions novas** (todas começam com `requirePortalAccess(contatoId)`, usam `createAdminClient()` e filtram por `access.organizationId` + `contatoId`):
  - `uploadPortalLibraryAsset(contatoId, { title, description, filename, contentType, base64, width, height, parentAssetId? })`:
    - Validar MIME contra a mesma lista da categoria `library` (`actions/storage-upload.ts` → exportar `ALLOWED_MIME_BY_CATEGORY` ou mover pra `lib/storage/mime.ts` e importar dos dois lugares) e tamanho (`MAX_UPLOAD_BYTES` 20MB).
    - `StorageService.upload({ organizationId: access.organizationId, category: 'library', scopeId: contatoId, fileId: crypto.randomUUID(), body, contentType, filename })` e inserir `storage_objects` manualmente com admin (`user_id` = usuário do portal, `metadata: { uploaded_via: 'portal' }`).
    - `kind` **forçado** `'bruto'` (cliente nunca cria "produzido"); se `parentAssetId`, validar que pertence ao mesmo org+contato e é `kind='bruto'`.
    - Replicar a lógica de versão/`root_asset_id` de `uploadLibraryAsset` — **extrair** a parte "calcula versão + insere + ajusta root" para um helper puro-ish `lib/library/insert-asset.ts(supabaseClient, {...})` usado pelas duas actions (evita duplicar).
    - Registrar em `contato_activities` (`type: 'library_asset_uploaded_portal'`) — auditoria.
  - `addPortalAssetComment(contatoId, assetId, body)` → insere em `library_asset_comments` com `author_type: 'client'`, `author_name` = nome do contato, `user_id` null (o `user_id` referencia `profiles`, usuário do portal pode não ter profile — **verificar FK**: se `profiles` não tiver linha do usuário do portal, deixar null).
  - `listPortalAssetDetail(contatoId, rootAssetId)` → versões + comentários + URL assinada (mesma lógica de `listAssetChains`, filtrada).
- **UI**: aba Biblioteca do portal vira 3 grupos iguais ao interno (Material bruto / Aguardando aprovação / Aprovados), cards com `MediaPreview` (`components/features/library/MediaPreview.tsx`), botão "Enviar material" (upload com `detectMediaDimensions` + fallback de enquadramento — reaproveitar lógica de `UploadLibraryAssetDialog.tsx`: extrair o hook `useMediaDimensions(fileRef)` para `lib/media-dimensions.ts` ou `components/features/library/useMediaDimensions.ts` e usar nos dois diálogos), comentários, e em "Aguardando aprovação" botões Aprovar / Solicitar alteração **direto no portal** (nova action `respondPortalAsset(contatoId, assetId, status, comment)` — mesma regra da RPC pública: só `aprovado|alteracao_solicitada`, comentário obrigatório para alteração, só em `kind='produzido'` e `status='pendente'`).
- **Aceite**: cliente logado no portal sobe um arquivo → aparece na aba "Material bruto" do painel interno; comenta → comentário aparece na thread interna; aprova pelo portal sem precisar do link.

### 1.2 Versão final aprovada + histórico de versões visível
- **Arquivos**: `components/features/agencias-trafego/AssetChainCard.tsx`, `components/features/library/AssetVersionHistory.tsx` (novo).
- Botão "Histórico (N versões)" no card abre lista das versões (`chain.versions`, já carregado) com data, status de cada uma e preview sob demanda. Badge **"Final aprovada"** na versão com `status='aprovado'` mais recente da cadeia.
- Ao subir nova versão de um produzido que estava `aprovado`/`alteracao_solicitada`, a nova versão nasce `pendente` (já é o default) — conferir e documentar.
- **Aceite**: critérios "versionamento sem sobrescrever" e "versão final aprovada identificável".

### 1.3 Relacionar asset a campanha (opcional no upload)
- `UploadLibraryAssetDialog.tsx`: Select "Campanha (opcional)" alimentado pelas campanhas do cliente (`campaigns` já carregadas em `ClientDetailShell`; passar como prop `campaigns: {id,name}[]`). Gravar em `library_assets.campaign_id` (coluna já existe).
- Card mostra a campanha vinculada.

### 1.4 Migrar legado `campaign_creatives` e o picker do plano de mídia
- **Resultado já consultado em 2026-09-25: `campaign_creatives` = 0 linhas em produção** → caminho "ambos 0" (só trocar FK/picker, sem migração de dados). Re-confirmar a contagem na hora de executar.
- **❓ CHECKPOINT**: rodar `select count(*) from campaign_creatives;` e `select count(*) from media_plan_items where creative_id is not null;` via `mcp__Supabase__execute_sql`.
  - Se **ambos 0**: pular migração de dados; fazer só a troca de FK (abaixo).
  - Se >0: migrar (abaixo). Se > ~500 linhas, parar e perguntar.
- **Migration 0285** `library_assets_media_plan_link.sql`: `alter table media_plan_items add column library_asset_id uuid references library_assets(id) on delete set null;` + índice. (Não remover `creative_id` — manter por compatibilidade.)
- **Migração de dados (se houver)**, migration 0286 separada, **idempotente**:
  - Para cada `campaign_creatives`: `storage_key` é URL pública do bucket legado `form-assets` → extrair a key (parte após `/object/public/form-assets/`) e inserir `storage_objects` (`storage_provider='supabase'`, `bucket='form-assets'`, `storage_key`, `mime_type` derivado de `media_type`), depois `library_assets` (`kind='produzido'`, `version=1`, `status` mapeado `pendente→pendente`, `aprovado→aprovado`, `reprovado→alteracao_solicitada`, `public_token` **copiado** para links antigos continuarem válidos via nova rota? — NÃO: tokens antigos continuam servidos por `/criativo/[token]`; deixar `public_token` null no novo registro para não colidir), `root_asset_id = id`, `metadata` de origem em `description` ou nova coluna `legacy_creative_id uuid` (adicionar na 0286, com unique parcial, garante idempotência: `where not exists (... legacy_creative_id = c.id)`).
  - `client_comment` não vazio → linha em `library_asset_comments` (`author_type='client'`).
  - `update media_plan_items set library_asset_id = la.id from library_assets la where la.legacy_creative_id = media_plan_items.creative_id`.
  - Leitura do arquivo legado funciona pelo modelo híbrido (`lib/storage/providers/supabase.ts`) — **validar** gerando signed URL de 1 registro migrado antes de concluir.
- **Código**: `MediaPlanBuilder.tsx`/`MediaPlanItemNode.tsx` + `actions/media-plans.ts`: picker passa a listar `library_assets` produzidos (latest de cada cadeia) e gravar `library_asset_id`; exibir `creative_id` legado só se `library_asset_id` for null. `ClientDetailShell` recebe `libraryChains` (já recebe) — trocar `creatives.map(...)` por chains produzidas. Remover `listCreatives` do `page.tsx` do cliente **somente** se nada mais usar (grep).
- **Aceite**: nenhum lugar da UI depende mais de `campaign_creatives` para criar coisa nova; links antigos `/criativo/[token]` continuam funcionando (não apagar rota/tabela).

### 1.5 Eventos de Automação da Biblioteca
- **Eventos** (nome = `trigger_type`): `trafego.library.submitted` (produzido criado → aguardando aprovação), `trafego.library.approved`, `trafego.library.change_requested`, `trafego.library.client_uploaded` (bruto enviado pelo portal).
- **Onde disparar** (`inngest.send({ name, data: { orgId, leadId: contatoId, assetId } })`, sempre em `try/catch` best-effort — nunca falhar a ação do usuário por causa do evento):
  - `uploadLibraryAsset` quando `kind='produzido'` → submitted.
  - `uploadPortalLibraryAsset` → client_uploaded.
  - `respondToLibraryAssetPublic` (após RPC ok): a RPC não devolve org/contato → fazer lookup com `createAdminClient()` por `public_token` (mesmo padrão já usado em `actions/campaign-creatives.ts::respondToCreativePublic`) → approved/change_requested. Também gravar `contato_activities` (auditoria que hoje falta nesse caminho).
  - `respondPortalAsset` (1.1) → approved/change_requested.
- **Registrar**: nova function `processAutomationEventTraffic` (`id: 'automation-process-traffic'`, mesma `concurrency`) em `lib/inngest/automation.ts` com os 4 eventos, **adicionar ao array `functions` de `app/api/inngest/route.ts`** (sem isso nunca roda).
- **Catálogo**: 4 entradas em `lib/automations/trigger-meta.ts` com `niche: 'trafego'` (ícone `FolderOpen`/`CheckCircle2`).
- **Verificar** que `handleAutomationEvent` resolve contato por `event.data.leadId` (ler a função antes; ajustar nome do campo se for outro).
- **Aceite**: automação com trigger "Criativo aprovado (Tráfego)" dispara ao aprovar pelo link público.

### 1.6 IA consultando a Biblioteca com autorização
- Nova tool read-only `list_library_assets` em `lib/agent/tools/` (arquivo `library.ts`, registrar em `registry.ts`): input `{ clientId, kind?, status? }`, `permission: 'trafego'`, `capabilityKey` de vertical tráfego (ver como `modules-seguros-trafego.ts` declara), `requiresApproval: false`. Retorna **metadados** (título, tipo, status, versão, datas, nº comentários, campanha) — **nunca** URL assinada nem conteúdo do arquivo (issue: "assets não devem ser enviados indiscriminadamente ao contexto do modelo").
- **Aceite**: Orquestrador (`mod+j`) responde "quais criativos do cliente X estão aguardando aprovação?".

### 1.7 Fechamento da Fase 1
- `next build` completo. Atualizar este arquivo (Progresso), marcar checkboxes do #23, comentar no #23 o que foi entregue e **fechar o #23** (`state_reason: completed`) se todos os critérios estiverem atendidos.

---

## Fase 2 — Fechar #27 e #61 (Portal do Cliente)

Critérios ainda abertos: filtros na Visão Geral; painel individual por conta (drill-down); Tracking/saúde; conversão manual integrada ao resto do sistema; plataforma × real rotulado; feedback server-side (parte Meta quase pronta); auditoria de ações do portal.

### 2.1 Visão Geral com filtros de período e plataforma
- `getPortalOverview(contatoId, { days: 7|30|90, platform?: 'meta'|'google'|'all' })` em `actions/client-portal.ts` (hoje fixo 30d). Reaproveitar `getClientPerformanceComparisonAdmin` com range dinâmico; retornar também `previous` para mostrar variação %.
- Série diária: reaproveitar a lógica de `actions/trafego-performance.ts::getClientDailySeries` — extrair núcleo sem auth (`getClientDailySeriesCore(supabase, orgId, contatoId, range)`) igual ao padrão `...Core` já usado, e chamar do portal com admin client.
- UI: `components/features/portal/PortalOverviewTab.tsx` (extraído) com seletor de período, KPIs com delta, gráfico (reaproveitar `ClientPerformanceChart.tsx` se for client-component puro; senão, copiar o mínimo). Filtro de plataforma só aparece se houver mais de 1 provider nas contas.
- Troca de período via server action (client component chama action e re-renderiza) — não recarregar a página inteira.

### 2.2 Painel individual por conta (drill-down)
- Aba "Contas": lista de contas → clicar abre painel da conta: KPIs da conta (filtrar `listCampaignsByClientCore` por `ad_account_id`) + tabela de campanhas.
- Drill-down Meta **Campanha → Conjunto → Anúncio** sob demanda: nova action `listPortalCampaignChildren(contatoId, campaignId)` que valida que a campanha pertence a uma `ad_account` do contato, pega o token da org (`organizations.meta_ads_access_token`, ver `0118_meta_ads_oauth.sql`) **server-side** e chama `fetchMetaAdSets`/`fetchMetaAds` (`lib/meta/ads.ts`). Token nunca vai ao client. Se token ausente/expirado → mensagem "dados detalhados indisponíveis", sem erro.
- Google: sem integração → contas Google (se houver `ad_accounts.provider='google'` importadas por CSV) mostram só nível campanha.

### 2.3 Log de envios CAPI (observabilidade — base para Tracking)
- **Migration** `capi_event_log`: `id, organization_id, pipeline_id null, contato_id null, event_name, event_id, status ('sent'|'failed'), http_status int null, error text null, source text ('form'|'pipeline'|'qualification'|'portal_conversion'), created_at`. RLS padrão. Índice `(organization_id, created_at desc)`.
- `lib/meta/capi.ts`: `sendCapiEvent` passa a **retornar** `{ ok, status, error }` (hoje `Promise<void>` — conferir o final da função e se lança em erro HTTP) e ganhar wrapper `sendCapiEventLogged(payload, { supabase, organizationId, pipelineId, contatoId, source })` que chama e grava o log (best-effort, nunca lança).
- Trocar os 3 call sites (`public_forms.ts`, `contatos-pipeline.ts`, `run-qualification.ts`) para o wrapper. **Não mudar payload/eventos** — só logging.
- Retenção: opcional cron de limpeza > 90 dias (pode ficar para depois; anotar).

### 2.4 Aba Tracking no Portal (read-only, sem segredos)
- Nova action `getPortalTrackingHealth(contatoId)` (admin client, filtro explícito) retornando **só flags/datas, nunca token/ID sensível**:
  - Meta Pixel/CAPI: algum pipeline da org com `meta_pixel_id` configurado (boolean) + último envio CAPI (`capi_event_log`, filtrar por `contato_id` do cliente **ou** pipelines usados pelos leads dele — começar simples: eventos da org com `contato_id` pertencente a leads cujo `source`/tracking aponta para esse cliente; se ficar complexo, usar só "último envio da org" com rótulo "da agência") + nº de falhas 7d.
  - Google Ads conversions: `google_ads_id` configurado (boolean) — client-side apenas (rotular).
  - UTMs/links: `tracking_links` do cliente (contagem ativa) + último clique (`tracking_clicks`).
  - Sincronização de contas: `ad_accounts.updated_at` mais recente + alerta se ≥3 dias (reusar regra de `computeClientAlerts`).
  - Alertas: `computeClientAlerts(...)` (já existe) — só os de tracking/sync para o cliente; alertas de performance ficam para a agência (decisão de produto: mostrar ou não? **default: mostrar só tracking/sync**, anotar como decisão).
- Painel interno: acrescentar o mesmo bloco "Saúde do tracking" na aba Conversões do cliente (`ClientTrackingTab.tsx`), com detalhe extra (falhas com mensagem de erro) que o portal não mostra.

### 2.5 Conversão manual do Portal integrada
- Mostrar `portal_conversions` no painel interno: card "Conversões informadas pelo cliente" na aba Conversões (`ClientTrackingTab.tsx`) — nova action interna `listClientPortalConversions(orgSlug, contatoId)` com permissão `trafego`.
- Botão interno "Validar" por conversão (coluna nova `validated_at`, `validated_by` — migration) para a agência confirmar antes de entrar em relatórios. Issue: "o portal é complemento, não segunda fonte conflitante".
- CAPI: ao **validar** uma conversão `venda` (não ao registrar — evita cliente disparar evento de compra direto na Meta), se houver pipeline com pixel configurado, enviar `Purchase` via `sendCapiEventLogged` com `eventId: 'portal-conv-{id}'` (dedupe), `value`/`currency`, `source: 'portal_conversion'`. Qual pipeline usar: o default da org (`pipelines.is_default`) — **❓ CHECKPOINT** se não houver default com pixel, não enviar e registrar "sem pixel configurado".
- Evento de automação `trafego.conversion.reported` (padrão da 1.5, mesma function nova).

### 2.6 Plataforma × resultado real (rotulado)
- Componente `components/features/trafego/PlatformVsRealCard.tsx` usado na Visão Geral do portal **e** na aba Analytics interna:
  - Coluna "Reportado pela plataforma": `meta_leads` de `campaign_metrics_daily` (já agregado em `listCampaignsByClientCore` como `leads`), investimento.
  - Coluna "Real no Althos": leads atribuídos ao cliente (mesma fonte que `getClientPerformanceSummaryCore` usa para `leads`/`salesCount`/`revenueCents` — **ler a função e documentar a origem exata no componente**), + conversões manuais **validadas**.
  - ROAS real = receita real / investimento, só se ambos > 0; senão "—" com tooltip.
  - Cada número com rótulo de origem explícito; nunca somar fontes diferentes.

### 2.7 Auditoria das ações do portal
- Toda action de escrita do portal (upload, comentário, aprovação, conversão) grava `contato_activities` com `type` específico e `payload` mínimo (`{ asset_id | conversion_id, by: 'portal', user_id }`). Revisar 1.1/1.5/2.5 e garantir.

### 2.8 Segurança/entitlement do Portal
- Conferir que `app/portal/[contatoId]/page.tsx` e todas as actions do portal verificam que a org tem a vertical Tráfego habilitada (issue #25): usar `hasCapability`/checagem de nicho usada em `requireModuleEnabled(org.niche, 'trafego')`. Implementar dentro de `requirePortalAccess` (buscar `organizations.niche` junto) — se a vertical não estiver ativa, negar acesso.
- Rodar `mcp__Supabase__get_advisors` (security) depois das migrations da fase.

### 2.9 Google Ads conversões offline — ⛔ BLOQUEADO
- **Seguro fazer agora**: só a interface no Ads Tool Layer (Fase 3.1) com capability `uploadOfflineConversion: false` para Google e um comentário no #22 explicando o requisito (developer token + OAuth + conversion action). `gclid` já é capturado em `tracking_links` — anotar isso.
- **Não fazer**: OAuth Google, chamadas à API.

### 2.10 Fechamento da Fase 2
- `next build` completo. Marcar checkboxes no #61 e #27, comentar entregas, **fechar #61**; fechar #27 **deixando explícito** que Google Ads conversions depende de credenciais (mover esse item para o follow-up da Fase 3.10).

---

## Fase 3 — #22: Traffic Agent + Ads Tool Layer

Base estrutural do #22 já foi auditada como pronta (comentário de 2026-09-25 na issue). Esta fase entrega a metade "Traffic Agent + Ads Tool Layer" até onde é possível **sem** escopo de escrita da Meta nem Google Ads.

### 3.1 Ads Tool Layer — contratos e adapter Meta (leitura)
- `lib/ads/types.ts`: `AdsProviderName = 'meta' | 'google'`; `AdsCapabilities = { readAccounts, readCampaigns, readAdSets, readAds, readInsights, readSearchTerms, pauseCampaign, resumeCampaign, updateBudget, createCampaign, uploadOfflineConversion }` (booleans); `AdsProviderAdapter` com métodos correspondentes (todos opcionais conforme capability) e tipos normalizados **sem forçar equivalência** (cada provider pode devolver campos extras em `raw`).
- `lib/ads/providers/meta.ts`: adapter que **embrulha** `lib/meta/ads.ts` (não reimplementar HTTP). Capabilities de leitura `true`, escrita `false` até 3.8.
- `lib/ads/providers/google.ts`: stub, todas capabilities `false`, métodos lançam `AdsCapabilityError` claro.
- `lib/ads/index.ts`: `getAdsAdapter(provider)` + `resolveAdsToken(supabaseAdmin, orgId, provider)` (Meta: `organizations.meta_ads_access_token` + checar `meta_ads_token_expires_at`) — **token só server-side**, nunca retornado a tool/LLM.
- Mesmo padrão de `lib/storage/index.ts` / `lib/voice/provider.ts` (registrar em CLAUDE.md na tabela de stack e na Camada 2).
- Testes Vitest: capability gating (chamar método sem capability lança), normalização do adapter Meta com fixture JSON (sem rede).

### 3.2 Tools de leitura/análise para o agente
- Novo arquivo `lib/agent/tools/ads.ts`, registrar no `registry.ts`, `permission: 'trafego'`, capabilityKey da vertical, `requiresApproval: false`:
  - `get_ad_account_insights { clientId, days }` — insights por conta.
  - `get_adsets { campaignId }`, `get_ads { adSetId }` — via adapter (valida que a campanha pertence a conta de um contato da org).
  - `get_client_alerts { clientId }` — `computeClientAlerts` + `computeClientHealthStatus` (já existem).
  - `get_search_terms { clientId }` — retorna "não suportado pelo provider atual" via capability (Google futuro).
  - `list_media_plan { clientId }` — plano de mídia atual (estratégia/intenção) para o agente comparar com o publicado.
- Nunca incluir token/segredo no output. Auditoria já é automática via `executeTool`.

### 3.3 Traffic Agent (Agent Definition) + Skills de Paid Media
- **Seed** (migration de dados idempotente ou action "instalar agente de tráfego" disparada 1x por org com vertical tráfego — preferir **action idempotente** chamada pela UI, não migration com dados por org): cria `agent_definitions` "Traffic Agent" com `allowed_tools` = tools de 3.2 + `get_clients/get_client/get_client_performance/get_client_targets/get_campaigns/get_campaign_performance/list_library_assets`, persona/regras de paid media (explicar evidência, nunca executar sem aprovação, respeitar metas do `traffic_client_profile`).
  - Conferir o schema real de `agent_definitions` (`0267_agent_definitions.sql`) antes — campos de persona/regras/model.
- **Skills** = `library_items` com `source_module = 'trafego'` e `category` ∈ `google-ads | meta-ads | tracking | campaign-planning | diagnostics | optimization | reporting`. Criar conteúdo inicial **curto e próprio** (não copiar skill pública sem revisar licença) — 1–3 itens por categoria com checklists de diagnóstico (ex.: queda de conversão → checar tracking, frequência, CPM, orçamento limitado). Verificar se `getActiveLibraryItems` filtra por `source_module`; se injeta tudo, adicionar filtro opcional por módulo em `invokeAgentDefinition` para o Traffic Agent carregar só `trafego` (progressive loading pedido na issue).
- **UI**: no `MarketingStrategistDock.tsx` (já presente em toda aba do cliente), adicionar modo "Conversar com o Traffic Agent" (chat streaming) ao lado do "Gerar plano" existente. Backend: rota `app/api/trafego/agent/chat/route.ts` espelhando `app/api/orchestrator/chat/route.ts` mas usando `invokeAgentDefinition()` com a definição do Traffic Agent e **runtime context com `clientId` atual** (objetivo: "analisar a operação do cliente X").
  - Créditos: `consumeAiCredits`/`checkFeatureAccess` **antes** da chamada (mesmo padrão do Strategist) — `invokeAgentDefinition` não cobra sozinho.
- **Aceite**: pergunta "por que o CPL subiu essa semana?" → agente chama insights/alertas e responde com evidência numérica.

### 3.4 Fluxo seguro de escrita: draft → preview → aprovação → execução → verificação → auditoria
- **Reusar #51** em vez de tabela nova: tools de mutation declaram `requiresApproval: true` → `executeTool` enfileira em `agent_pending_approvals` → humano aprova em `configuracoes/aprovacoes` → re-executa revalidando permissão.
- Melhorias necessárias no fluxo existente:
  - `AgentApprovalsView.tsx`: renderer específico por tool (`ads.*`) mostrando **diff legível** (ex.: "Orçamento diário: R$ 50 → R$ 75 (+50%)", "Pausar campanha 'Black Friday — Conversão'") em vez de JSON cru. Registry de renderers por nome de tool.
  - Link da aprovação também visível no contexto do cliente (card "Alterações pendentes" na aba Estratégia).
  - Após executar: a tool faz **verificação** relendo o objeto pelo adapter e grava `result` com estado antes/depois (auditoria completa em `agent_audit_log` + `agent_pending_approvals.result`).
- **Guardrails/policies** por org: nova tabela `ads_policies` (org, `max_budget_change_pct` default 30, `allow_pause bool` default true, `allow_budget_change bool` default false, `autonomy_level` 'read'|'draft'|'low_risk'|'full_approval' default 'draft') + tela simples em Configurações ou no Método da Agência. Tool de mutation checa a policy **antes** de enfileirar (rejeita acima do limite com explicação).
- Nesta fase as tools de mutation existem mas o adapter Meta tem capability de escrita `false` → ao executar retornam erro claro "escrita na Meta não habilitada (requer permissão ads_management)". Isso permite testar o fluxo de aprovação ponta a ponta sem tocar a conta real.

### 3.5 Sincronização Estratégia (Althos) × publicado (plataforma)
- **Migration**: `media_plan_items` + `external_id text`, `external_provider text`, `sync_status text check in ('draft','published','diverged','sync_error','external_change')` default 'draft', `last_synced_at timestamptz`, `last_sync_error text`.
- **Vinculação manual** primeiro: no `MediaPlanItemNode`, ação "Vincular à campanha publicada" (select de campanhas/adsets/ads reais via adapter) → grava `external_id`.
- **Reconciliador read-only**: Inngest cron diário (`trafego/media-plan.reconcile`) por org com itens vinculados: busca estado real (nome, status, orçamento) via adapter, compara com o plano, marca `diverged`/`external_change` com o motivo, **nunca sobrescreve** nem o plano nem a plataforma. Registrar no array de functions do Inngest.
- UI: badge de sync por item + filtro "divergentes".

### 3.6 "Analisar contas" (operação diária)
- Inngest cron diário por org com vertical tráfego: para cada cliente com conta ativa, `computeClientAlerts` + `computeClientHealthStatus`; se crítico/atenção, criar notificação (`actions/notifications.ts`) para os responsáveis e guardar snapshot em nova tabela `traffic_account_checks` (org, contato, date, health, alerts jsonb) — permite histórico e a tela abaixo.
- Tela "Contas que exigem atenção" no Command Center (`TrafegoCommandCenter.tsx`): lista do último check, com botão "Pedir análise ao Traffic Agent" (abre o chat 3.3 já com o objetivo preenchido). **Sem IA no cron** (custo/créditos) — IA só sob demanda.

### 3.7 Entitlement da vertical (#25)
- Garantir que tools (3.2/3.4), rota do agente, crons (3.5/3.6) e tela verificam a vertical tráfego ativa (`capabilityKey` nas tools; nos crons, filtrar orgs por `niche`/capability). Documentar no CLAUDE.md.

### 3.8 Mutations Meta — ⛔ BLOQUEADO (ads_management + App Review)
- **Seguro fazer agora**: implementar no adapter Meta `pauseCampaign`/`resumeCampaign`/`updateAdSetBudget` (POST no Graph API) **atrás de** `process.env.META_ADS_WRITE_ENABLED === 'true'` (capability só vira `true` com a env) + tools `ads_pause_campaign`, `ads_resume_campaign`, `ads_update_budget` com `requiresApproval: true`, checagem de `ads_policies`, idempotência (não repetir se o estado já é o desejado) e verificação pós-execução. Env **não** definida em produção.
- `ADS_SCOPES` continua `ads_read`; documentar em comentário que ativar escrita exige: adicionar `ads_management` ao escopo, App Review aprovado, reconectar contas, e setar a env.
- **Não fazer**: alterar o escopo do OAuth em produção, publicar campanha nova.

### 3.9 Google Ads — ⛔ BLOQUEADO
- Só o stub da 3.1. Nada mais.

### 3.10 Fechamento da Fase 3 e do #22
- `next build` completo, `npm test`.
- Atualizar CLAUDE.md (stack: Ads Tool Layer; módulos: Traffic Agent; Camada 2: linha "Tráfego/Ads").
- Comentar no #22 o entregue, marcar critérios atendidos, **criar issue de continuação** "[IMPROVE] Tráfego — habilitar escrita Meta (ads_management/App Review) e integração Google Ads" com: passos de credencial, o que já está pronto atrás de flag, checklist de teste com conta real, conversões offline Google (gclid). Então **fechar o #22**.

---

## Validação (todas as fases)

- `xlsx` é bloqueado pelo proxy (`cdn.sheetjs.com`): antes de `npm install`/`tsc`/`lint`/`build`, remover temporariamente `xlsx` do `package.json` (script Python usado na sessão), rodar, e **sempre** `git checkout -- package.json package-lock.json` depois. Para `next build`, criar stub em `node_modules/xlsx/{package.json,index.js,index.d.ts}` e apagar depois (`rm -rf node_modules/xlsx`). Único erro esperado e aceito: `components/features/blocks/BlocksImporter.tsx` (tipos do stub). Critério real: `✓ Compiled successfully` + nenhum outro erro de tipo.
- `npm run lint`: 0 **errors** (warnings pré-existentes tolerados). Regra que já pegou 2x nesta sessão: **arquivo > 350 linhas é erro** (`quality/max-lines`) — extrair componentes/actions antes de chegar lá (`PortalDashboard.tsx`, `client-portal-data.ts`, `AssetChainCard.tsx` estão perto).
- Toda tabela nova: `organization_id`, RLS `get_user_organizations()` + `is_super_admin()`. Portal nunca depende de RLS — admin client + filtro explícito + `requirePortalAccess`.
- Após migrations: `mcp__Supabase__get_advisors` (security).
- Nunca expor token Meta/CAPI/Google ao client ou ao LLM.

## Ordem de commits sugerida

1. F1.1 (pode ser 2 commits: actions+helper, UI) · 2. F1.2+1.3 · 3. F1.4 (migration + picker; dados em commit separado se houver) · 4. F1.5 · 5. F1.6 · 6. F2.1 · 7. F2.2 · 8. F2.3 · 9. F2.4 · 10. F2.5 · 11. F2.6 · 12. F2.7+2.8 · 13. F3.1 · 14. F3.2 · 15. F3.3 · 16. F3.4 · 17. F3.5 · 18. F3.6 · 19. F3.7+3.8 · 20. fechamento/docs.

## Riscos

- **1.4 migração de legado**: único passo que move dado de produção — por isso checkpoint + idempotência + `legacy_creative_id` + nunca apagar origem.
- **2.3 alterar `sendCapiEvent`**: está em caminhos de produção (form público, pipeline). Mudança só aditiva (retorno + wrapper); manter comportamento de nunca lançar para o caller.
- **3.4/3.8**: qualquer escrita em conta de anúncio real tem impacto financeiro — por isso env desligada + aprovação + policy + verificação. Não ligar a env sem o usuário.
- Portal usa admin client: toda query nova precisa de `organization_id` **e** `contato_id` no filtro — revisar diff procurando `.from(` sem os dois.

## Progresso

_(preencher ao concluir cada passo: data, commit, observações)_

| Passo | Status | Commit | Notas |
|---|---|---|---|
| 1.1 | pendente | | |
| 1.2 | pendente | | |
| 1.3 | pendente | | |
| 1.4 | pendente | | |
| 1.5 | pendente | | |
| 1.6 | pendente | | |
| 2.1–2.8 | pendente | | |
| 3.1–3.8 | pendente | | |
