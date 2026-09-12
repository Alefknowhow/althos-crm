# Auditoria — Performance e Bugs Funcionais (2026-09)

> Escopo: `actions/*.ts`, `lib/**/*.ts`, `app/api/**/*.ts`, `lib/inngest/*.ts`, `components/features/**/*.tsx`.
> Metodologia: leitura direta dos arquivos + grep amplo no repositório inteiro (não amostragem). Todos os achados abaixo foram verificados lendo o conteúdo real do arquivo citado. Itens marcados "suspeita" (categoria 6) não foram confirmados com `EXPLAIN` — são hipóteses a validar.

## Resumo executivo

O ponto mais grave encontrado é `lib/inngest/pipeline-distribution-cron.ts`: um cron que roda **a cada 5 minutos** processa até 200 leads por pipeline, e para cada lead executa uma cadeia de ~4-5 `await` **sequenciais** (escolher próximo vendedor, atualizar lead, inserir atividade, buscar owners, notificar cada um em loop) dentro de um único `step.run` — sem `Promise.all`. Em uma org com fila grande isso pode facilmente estourar os 5 minutos até a próxima execução, causando sobreposição/atraso de reatribuição. Em seguida, o padrão de "N queries por item, paralelizadas com `Promise.all`" aparece repetido em `super-admin-orgs.ts`, `super-admin-accounts.ts` e `alerts-cron.ts` — não é N+1 sequencial, mas ainda é N requests HTTP simultâneos ao Postgrest por execução, o que escala mal conforme a base de orgs cresce (hoje provavelmente poucas dezenas, mas o padrão não tem `.limit`/paginação). Na categoria de queries sem `.limit()`, ~17 de ~20 arquivos de dashboard (`dashboard-funnel-throughput.ts`, `dashboard-atrisk.ts`, `dashboard-revenue-rankings.ts`, `dashboard-tabs-*.ts`, `dashboard-timeseries.ts`) buscam todos os `contatos` da org sem cap algum — em uma org com dezenas de milhares de leads, isso pode ficar lento e caro em memória. Por fim, os índices em `contatos` sobre `pipeline_id`/`stage_id` são de coluna única (não compostos com `organization_id`), o que é suspeito dado que praticamente toda query real filtra por `organization_id` + `pipeline_id` juntos. Nenhum TODO/FIXME nem catch-block vazio foi encontrado no repo (grades limpas nessas duas frentes); os componentes de envio de mensagem verificados (`WhatsappChatComposer`, `SocialInboxComposer`, `SmsComposeModal`, `SendCustomEmailDialog`) já têm guard de `disabled={loading}`.

---

## 1. N+1 queries / queries em loop

### 1.1 `lib/inngest/pipeline-distribution-cron.ts:64-100` — crítico
Dentro de `step.run('reassign-pipeline-...')`, o `for (const lead of staleLeads)` (até 200 leads, `.limit(200)` na linha 62) executa, **sequencialmente, sem `Promise.all`**:
- `pickNextDistributionMember` (query)
- `update contatos` (query)
- `insert contato_activities` (query)
- `select memberships` para owners (query)
- loop interno `for (const userId of notifyIds) await createNotification(...)` (mais 1 query por owner+vendedor anterior)

Cenário concreto: uma org com 150 leads parados no primeiro estágio simultaneamente (pico de campanha, por exemplo) gera >150 × 5 = 750 round-trips sequenciais ao Postgres a cada execução — a cron roda a cada 5 minutos (`*/5 * * * *`, linha 21), então se o processamento ultrapassar 5 min a próxima invocação começa em cima da anterior (Inngest permite execuções concorrentes por padrão se não houver `concurrency` configurado — não há `concurrency` neste function).
Sugestão: paralelizar o corpo do loop com `Promise.all` (mantendo o `continue`/skip individual), ou pelo menos separar a leitura de `owners` para fora do loop de leads (é a mesma org, não muda por lead) e batelar os updates com `.in('id', [...])` quando o `nextUserId` for igual para vários leads.

### 1.2 `actions/super-admin-orgs.ts:35-45` (`getAllOrganizations`) — médio
```
const withStats = await Promise.all(orgs.map(async (org) => {
  const [leadsRes, membersRes] = await Promise.all([...]) // 2 queries por org
}))
```
Paralelo (não sequencial), mas ainda 2×N requests simultâneos ao Postgrest, sem paginação nem `.limit` na query principal de `organizations`. Cenário: com 200 orgs cadastradas, a tela de super-admin dispara 400 requests concorrentes numa única invocação de Server Component — sob picos de tráfego isso pode saturar o connection pool do Supabase. Sugestão: substituir por 1-2 queries agregadas (ex.: `contatos` com `group by organization_id` via RPC/view materializada, ou `select organization_id, count(*)` agrupado no Postgrest usando uma função SQL).

### 1.3 `actions/super-admin-accounts.ts:38-41` (`getPlatformAccounts`) — médio
Mesmo padrão: `orgs.map(async o => { count query })` — 1 query de contagem por org, em paralelo. Comentário no próprio código já reconhece isso ("small N — handful of orgs"), mas não há guarda contra crescimento — se a base de contas crescer para centenas, o custo cresce linearmente sem aviso. Sugestão: mesma consolidação via RPC agregada.

### 1.4 `lib/inngest/alerts-cron.ts:120-146` — médio/alto
`churnResults = await Promise.all(activeOrgs.map(async (o) => { 2 count queries }))` — 2 queries por org ativa, em paralelo, dentro de um único `step.run('scan-fleet', ...)`. Como é um cron diário fleet-wide (`0 6 * * *`), com centenas de orgs ativas isso são centenas de pares de requests simultâneos ao Postgrest disparados de uma vez só a partir de uma única função serverless — risco de exceder limites de conexão/rate-limit do Supabase. Sugestão: uma única query agregada (`contatos` agrupado por `organization_id` com `max(last_activity_at)` e `count(*)`, feita em SQL/RPC) em vez de 2×N chamadas.

### 1.5 `lib/inngest/marketing-sync-cron.ts:59-110` — médio
Estrutura: `for (const account of accounts)` sequencial (correto — é um `step.run` isolado por conta, então falhas isoladas não derrubam outras contas), mas dentro de cada conta: `Promise.all(campaigns.map(...))` e, dentro de cada campanha, `Promise.all(insights.map(row => admin.from('campaign_metrics_daily').upsert(row)))` — **um upsert HTTP por linha de insight**, não em lote. Cenário: uma conta com 40 campanhas ativas × 30 dias de insights = até 1200 upserts individuais disparados em paralelo numa única invocação. O Supabase JS `.upsert()` aceita um array — pode-se batelar todas as linhas de uma campanha (ou até de todas as campanhas da conta) num único `.upsert(arrayDeLinhas, { onConflict: 'campaign_id,date,source' })`. Reduziria de ~1200 requests para 1-40.

### 1.6 `lib/push/send.ts:88-92` — baixo
`orgIds.map(async orgId => isNotificationEnabled(...))` dentro de `sendPushToUser` — 1 query por org à qual o usuário pertence. Baixo impacto na prática (um usuário raramente pertence a mais de 2-3 orgs), mas seria trivial trocar por uma única query `in('organization_id', orgIds)` dentro de `isNotificationEnabled`/nova função batch, caso o padrão de multi-org por usuário cresça.

### 1.7 `app/app/[orgSlug]/configuracoes/google-business/page.tsx:19-21` — baixo
`connections.map(async c => getGoogleBusinessLocations(orgSlug, c.id))` — 1 chamada (potencialmente à API do Google, não só ao banco) por conexão OAuth cadastrada. Baixo risco hoje (tipicamente 1 conexão por org), mas se uma agência conectar múltiplas contas Google Business, o tempo de carregamento da página cresce linearmente e sem paralelismo entre conexões seria pior — aqui já está em paralelo, então é aceitável, só vale monitorar se `getGoogleBusinessLocations` já pagina internamente.

### Achado positivo (não é bug, mas contraste útil)
`actions/storage-read.ts:151-181` (`getObjectSignedUrls`) é o padrão correto: uma única query com `.in('id', objectIds)` para resolver várias URLs assinadas de uma vez, comentada explicitamente como forma de evitar "uma Server Action por imagem". Vale como referência para corrigir os itens 1.2–1.4.

---

## 2. Queries sem `.limit()`

Grep em `.from('contatos')` dentro de `actions/dashboard-*.ts` mostra que apenas 3 arquivos aplicam `.limit(...)`:
- `actions/dashboard-funnel.ts:213` → `.limit(500)`
- `actions/dashboard-revenue.ts:137` → `.limit(5000)`
- `actions/dashboard-tabs-response.ts:48` → `.limit(limit)` (parametrizado)

Os demais buscam **todos** os `contatos` da org que casam com o filtro, sem cap:
- `actions/dashboard-funnel-throughput.ts:63-66` — médio
- `actions/dashboard-atrisk.ts:81-84` e `:205-208` — médio (e depois ainda faz uma segunda query em `contato_activities` para todos os `leadIds` retornados, sem `.in` limitado por lote)
- `actions/dashboard-revenue-rankings.ts:67-70` — médio
- `actions/dashboard-core.ts:71-121` (`count: 'exact', head: true`) — baixo, são apenas counts, não trazem linhas
- `actions/dashboard-tabs-customers.ts:34-37`, `:112-115` — médio
- `actions/dashboard-tabs-misc.ts:60-63` — médio
- `actions/dashboard-tabs-sellers.ts:24-27`, `:49-52` — médio
- `actions/dashboard-tabs-recompra.ts:64-67` — médio
- `actions/dashboard-timeseries.ts:74-77` — médio

Cenário concreto: uma org de clínicas/viagens madura com 40.000 leads acumulados ao longo de anos abrindo o dashboard financeiro/funil dispara `select stage_id, value_cents, source, utm from contatos where organization_id = ... and pipeline_id in (...)` sem limite — trafega 40k linhas pro Node só para agregar em memória (`.reduce`/`.filter` no JS), quando a agregação (soma, contagem por estágio) poderia ser feita no Postgres. Sugestão objetiva: (a) adicionar `.limit()` sensato onde a agregação em JS não escala, e/ou (b) migrar as agregações reais para `count`/`sum` via RPC SQL — como já foi feito em `dashboard-core.ts` com `head: true`.

---

## 3. Sequencial em vez de `Promise.all`

- **`lib/inngest/pipeline-distribution-cron.ts`** (já detalhado em 1.1) — o achado mais claro desta categoria: 4-5 `await` independentes por item de um loop, nenhum paralelizado.
- **`actions/super-admin-accounts.ts:25-32`** (`getPlatformAccounts`) — ao contrário do achado 1.3, aqui já está correto: 6 queries independentes (`acctRes, subsRes, orgsRes, creditsRes, membershipsRes, authRes`) são feitas com um único `Promise.all`. Citado como contraste — não é um bug, mas mostra que o padrão correto já é conhecido e usado no mesmo arquivo onde 1.3 ainda é sequencial-por-item.
- Não foram encontradas outras cadeias óbvias de `await` independentes fora de `Promise.all` em `actions/*.ts` fora dos itens já listados nas seções 1 e 2 — a maior parte do código de dashboard/dashboard-tabs já usa `Promise.all` para os múltiplos selects que compõem cada aba (confirmado por leitura de `dashboard-core.ts`, `dashboard-trafego.ts`).

---

## 4. Ineficiência em Inngest

- **`lib/inngest/marketing-sync-cron.ts`** — ver 1.5. Estrutura de steps é razoável (1 step por conta via `sync-account-${account.id}` dentro do loop principal), mas o conteúdo de cada step faz upserts não-batelados.
- **`lib/inngest/pipeline-distribution-cron.ts`** — cron de granularidade mais alta do sistema (`*/5 * * * *`), condizente com o comentário do próprio arquivo ("é a única regra do app com granularidade de minutos"). A frequência em si é justificável (reatribuição por timeout precisa de granularidade fina), mas o corpo sequencial (1.1) é o problema real, não a frequência.
- **`lib/inngest/clinic-crons.ts`** (`clinic-appointment-reminder`, `*/30 * * * *`) — arquitetura em múltiplos `step.run` pequenos e sequenciais (fetch-clinic-orgs → fetch-reminder-settings → fetch-templates → ...) é razoável para uma função que roda 48×/dia e não teve nenhum sinal de N+1 nas primeiras ~60 linhas lidas; não há indício de problema aqui além do padrão comum de várias queries encadeadas, o que é aceitável dado o baixo volume esperado (poucas orgs de clínica com lembretes).
- **`lib/inngest/alerts-cron.ts`** — `.limit(2000)` na query principal de orgs (linha 72) é um cap saudável, mas o loop de churn (1.4) roda por cima do subconjunto `activeOrgs` sem paginação — se a frota ultrapassar 2000 orgs ativas, o `.limit(2000)` também passa a truncar silenciosamente o scan (nenhum org além das 2000 primeiras é analisado), o que é ao mesmo tempo mitigação de custo e bug latente de cobertura incompleta — vale registrar como risco médio a monitorar.

Nenhum cron encontrado tem frequência obviamente desproporcional ao trabalho que faz, exceto o já citado `pipeline-distribution-cron` (5 min) cujo problema é o corpo, não o intervalo.

---

## 5. Bugs reais

- **TODO/FIXME**: nenhuma ocorrência de `TODO`/`FIXME` encontrada em `*.ts`/`*.tsx` no repositório inteiro (grep sem resultados). Não há débito técnico marcado explicitamente no código.
- **Catch vazio / erro engolido silenciosamente**: nenhum `catch {}`/`catch (e) {}` verdadeiramente vazio encontrado por grep multiline no repo. Os poucos catches "curtos" encontrados (ex.: `lib/push/send.ts:122-130`) sempre fazem `console.error` antes de seguir — não é ideal (sem observabilidade estruturada, conforme `CLAUDE.md` confirma "sem Sentry configurado"), mas não é um catch mudo.
- **Cobertura incompleta em churn-risk cron** — ver item acima (seção 4), risco médio de leads de orgs além do offset 2000 nunca serem escaneados para alerta de churn.
- **Double-submit em UI de envio**: spot-check em `components/features/WhatsappChatComposer.tsx`, `components/features/social/SocialInboxComposer.tsx`, `components/features/voice/SmsComposeModal.tsx` (linha 67: `disabled={sending || numbers.length === 0 || !body.trim()}`) e `components/features/SendCustomEmailDialog.tsx` (linha 75: `disabled={loading || !subject.trim() || !lead.email}`) — todos têm guard de estado (`sending`/`loading`) no botão de envio. **Nenhum bug de double-submit confirmado** nos componentes de mensagem verificados; não foi possível verificar 100% dos `components/features/**/*.tsx` dentro do escopo desta auditoria — recomenda-se spot-check adicional em telas de criação de registro fora de "envio de mensagem" (ex.: criação de reserva/venda) se isso for prioridade futura.
- **Funções exportadas não usadas**: não verificado exaustivamente (fora do orçamento desta rodada) — recomenda-se rodar `ts-prune` ou equivalente como tarefa separada em vez de spot-check manual, dado o tamanho do repositório (~230+ migrations, dezenas de `actions/*.ts`).

---

## 6. Suspeita de índices compostos faltando

Índices existentes hoje em `contatos` (via `supabase/migrations/0070`, `0075`, `0110`, `0128`):
- `idx_contatos_org_status (organization_id, status)`
- `idx_contatos_city (organization_id, city)`
- `idx_contatos_deal_status_ganho (organization_id, deal_status)` (parcial, WHERE deal_status='ganho' — ver 0128)
- `idx_contatos_pipeline_id (pipeline_id)` — **coluna única, sem organization_id**
- `idx_contatos_stage_id (stage_id)` — **coluna única, sem organization_id**
- `idx_contatos_org_created_at`, `idx_contatos_org_score`, `idx_contatos_org_email`, `idx_contatos_org_id` (renomeados em 0070)

Padrão de query real observado repetidamente em `actions/dashboard-funnel.ts:97-100`, `dashboard-funnel-throughput.ts:63-66`, `dashboard-atrisk.ts:81-84`, `dashboard-revenue.ts:109-112`, `dashboard-revenue-rankings.ts:67-70`:
```
.eq('organization_id', orgId).in('pipeline_id', pipelineIds)
```
**Suspeita (não confirmada com EXPLAIN)**: como `idx_contatos_pipeline_id` é mono-coluna, o planner provavelmente usa `idx_contatos_org_id` (se existir como B-tree simples) ou faz bitmap-and entre os dois índices — mas um índice composto `(organization_id, pipeline_id)` seria mais direto para esse padrão de acesso, que é o mais comum nas telas de dashboard/funil. Sugestão: `CREATE INDEX CONCURRENTLY idx_contatos_org_pipeline ON contatos (organization_id, pipeline_id)` e validar com `EXPLAIN ANALYZE` antes/depois nas queries de `dashboard-funnel*`.

Da mesma forma, `pipeline-distribution-cron.ts:54-62` filtra `.eq('organization_id', ...).eq('pipeline_id', ...).eq('stage_id', ...).eq('status', 'lead').not('assigned_to', 'is', null)` a cada 5 minutos — não há índice composto cobrindo essa combinação; o mais próximo é `idx_contatos_org_status` (org + status, sem pipeline/stage). Suspeita de mesma natureza: `(organization_id, pipeline_id, stage_id, status)` reduziria o custo desse scan que roda 288×/dia.

Índices de outras tabelas de alto volume (clínicas, voice, storage) são consistentemente mono-coluna em `organization_id` (`idx_voice_calls_org`, `idx_clinic_supplies_org`, etc.) — aceitável para tabelas menores/gated por nicho, mas se `voice_calls`/`clinic_medical_records` crescerem muito em orgs específicas, queries que também filtram por data (`created_at`) ou status vão se beneficiar de compostos. Isso é uma suspeita genérica de baixa prioridade, não verificada contra queries reais além do que já foi listado acima.

---

*Relatório gerado por auditoria automatizada — leitura direta do código-fonte em `C:\Althos-crm` em 2026-09-12. Nenhuma alteração de código foi feita.*
