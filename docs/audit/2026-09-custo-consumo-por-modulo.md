# Custo real de infraestrutura por módulo/ação — Althos CRM

> Auditoria de consumo (não financeira em BRL de venda, e sim de **custo real de infra da Althos**). Metodologia: leitura direta do código em `lib/inngest/`, `actions/`, `lib/ai/`, `lib/social/`, `lib/storage/`, `app/api/`. Data: 2026-09-12.
>
> Premissa confirmada nesta sessão e reaproveitada aqui: cada organização conecta sua própria conta WhatsApp Cloud API (WABA) e Instagram — o custo de mensageria da Meta é pago pelo cliente final, não pela Althos. O custo real da Althos nesses canais é só o que roda **na própria infra** (Inngest, Supabase, Storage, Vercel).
>
> Catálogo de custo de IA usado neste relatório (`ai_action_cost_catalog`, câmbio usd_to_brl=5.4, margem=25%, 1 crédito ≈ R$0,01215 custo real / R$0,01519 preço de venda):
>
> | Ação | Créditos | Custo real (~US$) |
> |---|---|---|
> | ai_insights_query | 9 | US$1,95¢ |
> | generate_proposal | 8 | US$1,80¢ |
> | financial_ai_chat | 7 | US$1,50¢ |
> | ocr_extract | 5 | US$1,05¢ |
> | roteirista_generate | 4 | US$0,13¢ |
> | property_matching | 1 | US$0,20¢ |
> | instagram_ai_reply | 1 | US$0,13¢ |
> | lead_scoring | 1 | US$0,018¢ |
> | qualify_lead | 1 | US$0,018¢ |
> | ai_attendant_reply | 1 | US$0,225¢ |

---

## 1. WhatsApp — mensagem recebida (webhook → ingest → Agente IA)

Pipeline real, dois arquivos (`lib/inngest/whatsapp-ingest.ts` + `lib/inngest/whatsapp-inbound.ts`), acionados pelo webhook que só identifica a org e enfileira `whatsapp/message.raw`.

**`ingestWhatsappMessageFn` (sempre roda, 1x por mensagem inbound):**
- Inngest: 1 execução, com **5 `step.run()`** reais: `check-idempotency`, `fetch-org`, `resolve-conversation-and-lead`, (`download-media` — condicional, só em mensagem com mídia), `insert-message`, `notify-and-ai`. Ou seja, **5 steps no caso texto puro, 6 com mídia**.
- Supabase: dentro de `resolve-conversation-and-lead` sozinho já tem até 6 queries possíveis (select conversa, select lead por telefone, select pipeline default, select stage, resolveAdCampaignExternalId → 1 select em `campaigns`, insert em `contatos`) + insert/update de `whatsapp_conversations` + insert em `whatsapp_messages` + insert opcional em `contato_activities`. Pior caso (lead novo + atribuição CTWA): **~9-10 queries**.
- Storage: **sim, condicional** — mensagem de mídia (image/audio/video/document/sticker) baixa da Graph API (2 fetches de rede: metadata + arquivo) e sobe via `uploadSystemFile` (que passa pelo `StorageService` → R2). Tamanho típico: foto/documento de WhatsApp, tipicamente 50KB–5MB.
- IA: nenhuma nesta function.
- Vercel: não roda em function HTTP — é Inngest function (roda fora do ciclo de resposta rápido da Meta, que é o motivo de ela existir). `retries: 2`.

**`processWhatsappInboundFn` (condicional — só dispara se há texto E conversa não pausada):**
- Inngest: 1 execução adicional, **sem `step.run()` nomeados** (função não usa `step.run` para as etapas, roda como bloco único — nota: diferente da `ingest`, aqui é tudo dentro do handler direto, então uma falha no meio reprocessa tudo do zero no retry, não é memoizado por etapa).
- Supabase: até **~9 queries de leitura + 3-5 de escrita**: select org, select `ai_attendant_config`, select conversa, select `ai_knowledge_items`, select lead (`contatos`), select histórico (`whatsapp_messages`, limit 20), insert mensagem de saída, update conversa, (condicional) update conversa com handoff summary, (condicional) update `contatos.ai_memory_notes`, update final de status pós-envio.
- IA: **`ai_attendant_reply`** = 1 crédito (~US$0,225¢ / ~R$0,01215 custo real) por resposta gerada. Se houver handoff (`handoffRequested`), soma-se uma segunda chamada de IA para `summarizeForHandoff` (não tem linha própria no catálogo — é parte da mesma feature `ai_attendant`, custo adicional não medido por crédito separado nesta versão do código — **gap**: gera custo real de tokens de IA sem cobrar crédito extra).
- Vercel: Inngest function, sem `maxDuration` customizado.

**Zero-custo direto pra Althos**: a entrega da mensagem em si (via `sendTextMessage`, Meta Cloud API) é paga pelo WABA da própria organização — custo zero pra Althos.

## 2. WhatsApp — sugestão/envio manual de mensagem

**Correção pós-auditoria**: a função existe, só não estava mais em `actions/whatsapp.ts` no momento em que o agente checou — o repositório recebeu um refactor (`f840fb2`/`b465881`) que moveu essa lógica para `actions/whatsapp-ai-reply.ts` (Contatos também foi dividido em módulos por assunto nesse mesmo período: `contatos-leads.ts`, `contatos-customers.ts`, etc.). A função de sugestão de resposta (1 crédito `ai_attendant_reply`, mesmo custo da seção 1, chamada sob demanda via botão discreto no chat — não automática) segue existindo; não muda a conclusão do relatório, só a localização do arquivo.

## 3. Instagram — DM e comentário (`lib/social/engine.ts` + `lib/social/conversation-log.ts`)

`processInboundInteraction` (chamado pelo webhook do Instagram) roda **inline, sem Inngest** para a maior parte do trabalho (não é uma Inngest function — é executado direto na resposta ao webhook). Só dispara Inngest para notificação (`inngest.send`, evento `instagram/message.received` ou `instagram/comment.received`, usado por push/sino).

- Supabase por interação: select `social_connections`, select dedup (`social_interactions`), get-or-create `social_conversations` (select + upsert), insert `social_messages` (log inbound), select/update de enriquecimento de perfil (condicional, só 1ª vez), select `social_automations`, (condicional) select `organizations` se resposta for IA, insert final em `social_interactions`. Total típico: **~7-9 queries**, podendo passar de 10 com funil ativo (`runFunnelForInbound`/`startCommentFunnel`, lidos por referência mas não abertos nesta auditoria).
- Chamadas de rede externas (não R2, não Supabase): `getInstagramUserProfile` (perfil do remetente, chamado **duas vezes** no fluxo — uma para nome de notificação, outra para enriquecimento, quando aplicável — potencial duplicação de chamada de rede evitável, mas sem custo monetário direto, é Graph API gratuita).
- Storage: **sim, condicional** — `rehostInboundAttachment` (mídia recebida por DM) resobe pro storage próprio antes de logar — mesmo padrão do WhatsApp (via `StorageService`/R2 presumivelmente).
- IA: `instagram_ai_reply` = 1 crédito (~US$0,13¢) por resposta gerada quando a automação é do tipo IA (`response_type !== 'fixed'`). Automação fixa = zero custo de IA.
- Vercel: rota de webhook (não Inngest) — significa que TODO esse trabalho roda dentro do ciclo de resposta do webhook, ao contrário do WhatsApp (que foi otimizado para sair do ciclo do webhook). **Achado relevante**: se o volume de Instagram crescer, essa rota corre risco de timeout da Vercel por não ter sido movida para Inngest como o WhatsApp já foi.

**Zero-custo direto pra Althos**: envio de DM/reply via Graph API do Instagram é gratuito (API oficial, sem cobrança por mensagem) — mesmo raciocínio do WhatsApp.

## 4. Formulário público → criação de lead (`form_submissions`)

Não foi encontrada uma action de criação de submissão nomeada explicitamente nem uma função `createContato`/`criarContato` em `actions/contatos.ts` (grep sem match — o create de contato deve estar sob outro nome, não confirmado nesta passada). O que foi confirmado e lido por completo é o **consumo de leitura** desse dado:

- `getFormInsights` (dashboard de insights de formulário): até **4-5 queries** por carregamento (count total, count last30, count prev30, select de linhas para agregação em JS dos últimos 30 dias). Sem paginação nas linhas — se o formulário tiver muito volume em 30 dias, é uma única query sem limite explícito.
- `getLeadFormResponses`: 1 query (join `form_submissions` → `forms`).
- `getFormWithSubmissions`: 1 query paginada (`range`), com filtros por UTM.

O disparo de automação por submissão de formulário passa pelo evento `form.submitted`, tratado por `processAutomationEvent` (ver seção 8).

## 5. Copilot / Insights com IA (`app/api/copilot/chat/route.ts` + `actions/ai_insights.ts::sendInsightMessage`)

Ambos os caminhos (streaming via Route Handler e não-streaming via Server Action) seguem o mesmo padrão: **gate de feature (`checkFeatureAccess('ai_insights')`) e débito de crédito ANTES da chamada de IA**, exatamente como manda o CLAUDE.md (nunca depois).

- Supabase: select org (feature+plano), select histórico de mensagens (`ai_insights_messages`), select/update de sessão (título automático na 1ª mensagem), insert da mensagem do usuário, insert da resposta do assistente (com `tool_calls`, tokens, `cost_cents`, modelo), update de `updated_at` da sessão. **~6-7 queries** por turno de conversa, fora das tool calls que a IA decidir fazer (cada tool call é uma chamada adicional a `executeAnalyticsTool`, que por sua vez consulta o banco — custo variável, não fixo).
- IA: **`ai_insights_query`** = 9 créditos (~US$1,95¢) por mensagem do usuário — é a ação mais cara do catálogo entre as medidas nesta auditoria, atrás só de `generate_proposal`.
- Vercel: o Route Handler declara **`maxDuration = 60`** explicitamente (comentário no código: resposta de IA em streaming pode passar do default de 10s da Vercel sob carga). É a única function lida nesta auditoria com `maxDuration` customizado explícito.
- Modelo: `claude-sonnet-4-6` como default quando a org não tem `ai_qualifier_model` configurado — mais caro que o `claude-haiku-4-5` usado no Agente IA de WhatsApp/qualificação, o que é consistente com o crédito 9x maior do que `ai_attendant_reply`/`lead_scoring`.

## 6. Qualificação automática de lead (`lib/ai/run-qualification.ts`)

- Supabase: select `organizations` (config de IA), (condicional) RPC `account_has_feature`, select `contatos` (lead), (condicional) select `forms`/`form_submissions` para schema, update `contatos` (score/tier/tags), insert `contato_activities`, (condicional, só se tier='cold') select `organizations` de novo para Meta CAPI + chamada `sendCapiEvent`. **~5-7 queries**.
- IA: **`lead_scoring`** = 1 crédito (~US$0,018¢) — a ação de IA mais barata do catálogo, dá pra rodar em volume alto sem grande impacto de custo.
- Suporta dois providers (Claude via `getPlatformAiKey()`, Gemini via `getGeminiKey()`) — o multiplicador de custo por modelo é aplicado dentro de `consumeAiCredits`, não hardcoded aqui (bom: evita subcobrar Gemini vs Claude).
- Vercel/Inngest: chamada tanto por Server Action direta (botão "Requalificar") quanto por function Inngest disparada por `form.submitted` — mesmo código, custo de IA idêntico nos dois caminhos.

## 7. E-mail transacional (`queueEmailForLead` → `lib/inngest/functions.ts::sendEmail`)

- `queueEmailForLead` (Server Action): 1 insert em `email_sends` (status `queued`) + `inngest.send('email.send')`. `sendCustomEmailToLead` faz 1 insert extra em `email_templates` (template descartável `category: 'custom_oneoff'`) antes de chamar `queueEmailForLead` — reaproveita o pipeline de envio em vez de duplicar lógica.
- `sendEmail` (Inngest function, **sem `step.run()`** — roda como bloco único, sem checkpoints memoizados): select `email_sends` com join (`contatos`, `organizations`, `email_templates`), 1 chamada Resend (`resend.emails.send`), update `email_sends` (status/sent_at/resend_id), insert `contato_activities`.
- Custo real: **Resend** — cobrado por e-mail enviado pelo plano Resend da Althos (não é canal "pago pelo cliente final" como WhatsApp/Instagram — este é custo direto da Althos). Não há tamanho de payload relevante (HTML de template).
- Storage/IA: nenhum.

## 8. Automações (`actions/automations.ts` / `lib/inngest/automation.ts`)

Duas camadas Inngest:
1. **`processAutomationEvent` / `-Verticals` / `-Verticals2`** (3 functions, dividido por causa do limite de 10 triggers por function do Inngest): recebem o evento de gatilho (ex. `form.submitted`, `lead.stage_changed`, `sale.registered`, `voice.call.completed`), consultam `automations` ativas da org e, para cada match, **1 insert em `automation_runs`** + **1 `step.run()`** por automação casada + `inngest.send('automation.run.execute')`. Concorrência limitada a 5 por org (`concurrency: { key: 'event.data.orgId', limit: 5 }`).
2. **`executeAutomationRun`**: 1 execução por automação disparada, com **1 `step.run()` por step da automação** (mais 1 `step.run` de log e 1 de update de `current_step` por step de ação — ou seja, uma automação com N steps de ação gera **~3N step.run()** no Inngest, fora os `step.sleep()` dos steps do tipo `wait`, que não contam como execução de function mas mantêm o run "vivo" até o sleep acabar). Cada step de ação loga em `automation_step_logs` (insert), e o run é fechado com update final em `automation_runs` (`completed` ou `failed`).
- Custo por automação: cresce linearmente com o número de steps configurados pelo usuário — uma automação de 5 steps de ação gera potencialmente **15 execuções Inngest** numa única corrida (create-run + 5×(execute+log+update)).
- IA/Storage: dependem do tipo de step (`executeAutomationStep`, não lido nesta auditoria em detalhe) — enviar e-mail/WhatsApp dentro de uma automação reusa os custos das seções 1 e 7 acima.

## 9. Crons registrados (`lib/inngest/*-cron.ts` + afins)

| Cron file | Frequência | O que faz (pelo nome/comentário) |
|---|---|---|
| `marketing-sync-cron.ts` | diária, 6h UTC | Sincroniza dados de campanhas de marketing |
| `alerts-cron.ts` | diária, 6h UTC | Alertas (não detalhado nesta leitura) |
| `insurance-crons.ts` | diária, 8h UTC | Crons da vertical Seguros (apólices/sinistros) |
| `daily-digest-cron.ts` | diária, 10h UTC (7h BRT) | Resumo diário |
| `clinic-crons.ts` | a cada 30 min | Crons da vertical Clínicas (alta frequência — candidato a maior custo agregado de Supabase entre os crons, por rodar 48x/dia) |
| `health-cron.ts` | diária, 3h UTC | Healthcheck |
| `backup-cron.ts` | 3 crons distintos: `backup-database` (3h UTC), `backup-storage` (3h30 UTC, "R2 + buckets legados"), `backup-retention` (4h UTC) | Backup diário do Postgres + backup incremental de Storage + limpeza de backups expirados — provavelmente o cron com maior custo de I/O/egress (R2 + Postgres) do conjunto |
| `scheduled-messages-cron.ts` | diária, 5h UTC | Mensagens agendadas |
| `automation-crons.ts` | 4 crons: 8h UTC, 8h05 UTC, 7h UTC, 7h UTC | Varreduras de automação (provavelmente `task.overdue`/`lead.stale`/aniversário) |
| `flight-status-cron.ts` | 3x/dia (9h/15h/21h UTC = 6h/12h/18h BRT) | Status de voo (vertical Viagens) — provavelmente chama API externa de voos por reserva ativa, custo variável com volume de reservas |
| `push.ts` | a cada hora | Envio de notificações push agregadas |
| `pipeline-distribution-cron.ts` | **a cada 5 minutos** | Distribuição de leads no pipeline — o cron de **maior frequência absoluta** do sistema (288x/dia) |
| `trial-emails.ts` | 2 crons, 9h UTC e 9h05 UTC | E-mails de trial (nutrição/conversão) — usa Resend, custo por e-mail |

**Observação de custo agregado**: `pipeline-distribution-cron.ts` (5 min) e `clinic-crons.ts` (30 min) são os de maior frequência — mesmo que cada execução seja barata, o volume diário (288x e 48x respectivamente) os torna candidatos naturais a otimização se algum dia aparecerem no topo do consumo Inngest da conta.

## 10. Storage (`lib/storage/index.ts` — `StorageService`)

Ponto único de entrada, confirma a regra do CLAUDE.md: todo upload novo vai para R2 via este módulo (`defaultProviderForNewUploads()` sempre retorna `'r2'`, falha alto se R2 não estiver configurado). Provider `supabase` mantido só para leitura de objetos legados (roteado por `ref.provider`, nunca escolhido para upload novo).

- `SIGNED_URL_TTL_SECONDS = 48h` — cada leitura de arquivo (mídia de WhatsApp/Instagram, documento, etc.) gera uma URL assinada válida por 48h; releitura depois disso reassina (custo de request adicional no R2, não de egress redundante já que a mesma URL é cacheada em `storage_objects` quando o caller passa por `actions/storage.ts`).
- `createUploadUrl` (upload direto do browser, presigned): TTL padrão de 600s — evita que o arquivo passe pela function do Next.js/Vercel antes de ir pro R2 (economiza tempo de execução de function e egress duplicado Vercel→R2).
- Custo real de cada upload = requests R2 (PUT) + armazenamento por GB/mês + requests de leitura (GET) subsequentes. Sem tamanho médio confirmado no código (varia por categoria: mídia de WhatsApp tende a ser a de maior volume, ver seção 1).

## 11. Dashboard WhatsApp (`actions/whatsapp-analytics.ts` + `WhatsAppTab.tsx`)

`getWhatsappAnalytics` é a query mais pesada de leitura mapeada nesta auditoria:
- 1 select potencial em `whatsapp_conversations` (filtro por atendente, se aplicável).
- **1 select grande em `whatsapp_messages`** com `LIMIT 20000` explícito (comentário no código reconhece que a tabela "não tem retenção e pode crescer bastante") — toda a agregação (heatmap, série diária, tempo de resposta, taxa de resposta) é feita **em memória no Node**, não via SQL agregado.
- Chunks de até 200 IDs para resolver `assigned_to` por conversa (evita `IN` gigante numa única query, mas ainaualmente pode gerar múltiplas queries — 1 a cada 200 conversas ativas no período).
- Total de queries: **2 a ~1 + N/200** dependendo do volume de conversas ativas no período consultado.
- Risco de custo/performance: o teto de 20.000 linhas é um limite de leitura, não de tempo — em orgs com alto volume de WhatsApp, essa function pode se tornar a consulta mais cara do dashboard em CPU de function Vercel (agregação em JS) mesmo sem estourar o teto de linhas.

---

## Top 5 maiores custos por unidade (ranking desta auditoria)

1. **`ai_insights_query` (Copilot/Insights)** — 9 créditos, ~US$1,95¢ por mensagem. Maior custo de IA por interação entre tudo que foi medido; agravado por rodar em `claude-sonnet-4-6` (mais caro que o Haiku usado no Agente IA) e permitir múltiplas tool calls por turno (custo variável adicional não capturado no crédito fixo).
2. **`generate_proposal`** — 8 créditos, ~US$1,80¢ (não lido em detalhe nesta passada, mas consta no catálogo como 2º maior; recomenda-se auditoria futura do fluxo de geração de proposta).
3. **`financial_ai_chat`** — 7 créditos, ~US$1,50¢ (idem, fora do escopo desta leitura mas presente no catálogo).
4. **Backup diário (`backup-cron.ts`)** — não medido em crédito de IA, mas é o cron com maior I/O estrutural (dump completo do Postgres + backup incremental de todo o R2 + buckets legados, 1x/dia) — custo real provavelmente dominado por egress/armazenamento de backup, não por execução Inngest em si.
5. **Automação de N steps (`executeAutomationRun`)** — não tem custo fixo por unidade, mas escala linearmente (~3 execuções Inngest por step de ação) e pode embutir custos de e-mail (Resend) e WhatsApp/mídia (R2) dentro de uma única automação — o "custo por unidade" real depende inteiramente da automação configurada pelo usuário, tornando-o o item de maior variância de custo do sistema.

Honorable mention (alta frequência, baixo custo unitário mas relevante em agregado): `pipeline-distribution-cron.ts` (5 min) e `clinic-crons.ts` (30 min).

## Zero-custo direto pra Althos

- **Mensageria WhatsApp Cloud API**: cada organização usa sua própria conta WABA — a Meta cobra o cliente final pela conversa/mensagem, não a Althos. O que a Althos paga é só a infra em volta (Inngest, Storage de mídia via R2, queries Supabase) — ver seção 1.
- **Mensageria Instagram (API with Instagram Login)**: mesmo raciocínio — envio de DM/reply via Graph API é gratuito por natureza da API oficial, custo da Althos é só o processamento (Supabase + Storage de mídia + IA quando aplicável) — ver seção 3.
- Ambos os canais têm em comum: o custo real e mensurável pela Althos é 100% infraestrutura própria (Vercel/Inngest/Supabase/R2/Anthropic), nunca a mensageria em si.

---

## Gaps e observações para próxima auditoria

- ~~`actions/whatsapp.ts` não tem uma função `suggestWhatsappReply`~~ — corrigido: existe em `actions/whatsapp-ai-reply.ts`, movida lá por um refactor (`f840fb2`) que aconteceu entre a criação da feature e esta auditoria. `actions/contatos.ts` também virou um barrel file que só reexporta de `actions/contatos-{leads,pipeline,bulk,customers,contactpoints,avatar,deals,documents}.ts` — qualquer auditoria futura que grep por nome de função precisa considerar esses módulos, não só o arquivo antigo.
- A criação de lead por formulário público ainda não foi localizada com certeza nesta auditoria — provavelmente vive na rota de submissão pública (`app/api/forms/` ou similar) ou em `actions/contatos-leads.ts` pós-refactor; recomenda-se confirmar antes de decisão de custo baseada nisso.
- `summarizeForHandoff` (resumo de handoff do Agente IA de WhatsApp) consome tokens de IA real mas não tem ação própria no `ai_action_cost_catalog` — é custo real não medido/cobrado separadamente do crédito de `ai_attendant_reply`.
- `sendEmail` (Inngest) e `processWhatsappInboundFn` não usam `step.run()` internamente — ao contrário de `ingestWhatsappMessageFn` e `executeAutomationRun`, uma falha no meio da execução reprocessa a function inteira do zero no retry (não é um problema de custo por si, mas pode gerar reenvio duplicado de e-mail/mensagem em cenários de retry parcial — vale checar idempotência real desses dois casos).
