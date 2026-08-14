# Auditoria Técnica de Escalabilidade — Althos CRM

**Data:** agosto/2026 · **Escopo:** 100% leitura, nenhuma alteração de código ou banco.
**Stack:** Next.js 14 (App Router) + React · Supabase (Postgres + Auth + Storage + Realtime) · Vercel · Inngest (crons/filas) · Anthropic Claude (IA) · Meta Graph API (WhatsApp/Instagram/Ads) · Resend (e-mail) · Asaas (billing).

---

## 1. Arquitetura geral

```
USUÁRIO (browser/mobile)
   │
   ▼
VERCEL (Edge Middleware → Next.js App Router)
   │  ├─ Server Components (RSC, fetch direto no Supabase via server client)
   │  ├─ Server Actions (actions/*.ts — 69 arquivos, mutações)
   │  ├─ API Routes (app/api/**/route.ts — webhooks, OAuth, chat IA)
   │  └─ Client Components (React, sem cache global — ver §6)
   │
   ▼
SUPABASE (São Paulo)
   │  ├─ Postgres (93 tabelas, multi-tenant via organization_id + RLS)
   │  ├─ Auth (JWT, cookie de sessão validado no middleware)
   │  ├─ Storage (10 buckets, sem lifecycle/expurgo)
   │  └─ Realtime (5 tabelas publicadas: notifications, whatsapp_*, social_*)
   │
   ▼
INNGEST (filas/crons — 15+ functions, roda fora do Vercel)
   │
   ▼
SERVIÇOS EXTERNOS
   ├─ Anthropic Claude (qualificação de lead, respostas de automação, copiloto, OCR)
   ├─ Meta Graph API (WhatsApp Cloud API, Instagram Messaging, Meta Ads)
   ├─ Resend (e-mail transacional + campanhas)
   ├─ Asaas (cobrança/assinatura)
   └─ Google Business, n8n (não encontrado uso direto no código — ver §9)
```

**Pontos de risco de gargalo no fluxo:**
- Webhooks (Instagram/WhatsApp) chamam IA **sincronamente** dentro da resposta ao provedor (Meta espera resposta rápida; ver §9).
- Nenhuma rota tem `maxDuration` configurado — tudo roda no timeout padrão do plano Vercel.
- Zero camada de cache entre o React e o Supabase (sem React Query/SWR) — cada componente refaz fetch do zero.
- RLS depende de uma função `VOLATILE` (`get_user_organizations()`) usada em 43 tabelas — não cacheável pelo planner por statement.

---

## 2. Supabase / PostgreSQL

### Estrutura e volume atual (banco em fase inicial — os índices certos importam MUITO mais agora do que depois)

| Tabela | Linhas hoje | Observação |
|---|---|---|
| `contato_activities` | 68 | maior tabela hoje |
| `notifications` | 49 | |
| `tasks` | 27 | **sem paginação na listagem** |
| `whatsapp_messages` | 19 | índice composto faltando |
| `send_campaign_recipients` | 17 | |
| `contatos` | 15 | bem indexada e paginada |
| `whatsapp_conversations` | 2 | **sem paginação nem índice de ordenação** |

### Índices — achados específicos

| Severidade | Tabela | Problema | Solução |
|---|---|---|---|
| 🔴 Alto | `whatsapp_conversations` | Falta índice `(organization_id, last_message_at DESC)` — a listagem em `app/app/[orgSlug]/conversas/page.tsx:13-17` ordena por essa coluna sem suporte de índice | Criar o composto, espelhando o que `social_conversations` já tem |
| 🔴 Alto | `whatsapp_messages` | Só tem `conversation_id` sozinho, não `(conversation_id, created_at)` — carregar uma thread força sort adicional | Criar o composto, espelhando `social_messages` (que já está correto) |
| 🟡 Médio | `send_campaign_recipients` | Falta índice geral `(organization_id, campaign_id)` para relatório completo (só tem parcial de `status='pending'`) | Adicionar |
| 🟢 Baixo | `contatos` | `idx_contatos_created_at` é redundante com `idx_contatos_org_created_at` | Dropar o redundante |
| 🟢 Baixo | `social_conversations` | Índice duplicado da própria UNIQUE constraint | Dropar o índice, a constraint já serve |

### N+1 / loops / SELECT *

- **`actions/marketing.ts:370-378, 344-352, 448-455`** — upsert linha-a-linha em `campaign_metrics_daily`/`ad_accounts`/campanhas dentro de loop, quando poderia ser `.upsert(array)` em lote único. Prioridade alta (sync diário, tabela de métricas cresce por campanha×dia).
- **`actions/marketing.ts:947-953, 987-993`** — chamada HTTP à Meta **dentro de loop** por ad-set/anúncio (não é banco, mas mesmo padrão N+1 aplicado a API externa — risco de timeout de function).
- **`actions/whatsapp.ts:271-277`** — insert de conversa um a um em loop de seed/scripts.
- **63 ocorrências de `.select('*')`** em 29 arquivos, concentradas em `quotations.ts` (11), `travel-sales.ts` (5) — nenhuma nas tabelas de altíssimo volume, mas trazem colunas JSON grandes desnecessariamente em alguns casos.

### Paginação — achado mais crítico da auditoria

| Tela | Situação |
|---|---|
| Contatos (`contatos/page.tsx`) | ✅ Paginação real (`.range()`, PAGE_SIZE=50), bem indexada |
| **Conversas WhatsApp** (`conversas/page.tsx:13-17`) | 🔴 **Carrega a tabela inteira**, sem `.limit()`/`.range()` |
| **Mensagens de uma conversa** (`conversas/page.tsx:48`) | 🔴 Histórico completo carregado de uma vez, sem paginação/scroll incremental |
| **Tarefas / Kanban de tarefas** (`tarefas/page.tsx:18-22`) | 🔴 Carrega todas as tarefas ativas, sem `.limit()` |
| **Pipeline / Kanban de leads** (`pipeline/page.tsx` + `KanbanBoard.tsx`) | 🔴 Carrega **todos** os leads abertos do pipeline de uma vez, sem paginação nem virtualização de DOM |
| Notificações | ✅ `.limit(30)` fixo — aceitável para o caso de uso |
| Automações | 🟡 Sem paginação, mas volume baixo por natureza (config, não evento) |

Com organizações de milhares de leads/conversas/tarefas, essas 3 telas (Conversas, Tarefas, Pipeline) são as que mais provavelmente degradam primeiro.

### Storage

10 buckets (limites de 2MB a 30MB), **nenhuma política de lifecycle/expurgo** encontrada. `whatsapp-media`/`whatsapp-assets` são públicos e recebem mídia continuamente — custo de storage cresce sem teto proporcional ao volume de mensagens.

### Realtime — tabelas publicadas
`notifications`, `whatsapp_conversations`, `whatsapp_messages`, `social_conversations`, `social_messages`. Ver §8.

### Advisors do Supabase (verbatim, achados relevantes)

**Segurança:**
- 🔴 **`public.profiles` e `public.marketing_leads` têm RLS habilitado SEM NENHUMA POLICY** — bloqueiam 100% do acesso via `anon`/`authenticated` hoje. Se a leitura de `profiles` (nomes de usuário exibidos na UI) funciona, é porque passa pelo client `service_role` (admin), o que bypassa todo filtro de tenant — merece confirmação.
- 🟡 `function_search_path_mutable`: `generate_travel_sale_number` sem `search_path` fixo (vulnerável a hijacking).
- 🟡 **23 funções `SECURITY DEFINER` executáveis por `anon`** (sem login), incluindo `create_organization_for_user_manual` (aceita `owner_id` arbitrário), `consume_ai_credits`, `redeem_coupon`, `redeem_referral` — merece revisão se não há validação interna forte contra abuso não-autenticado.
- 🟡 Proteção contra senha vazada (HaveIBeenPwned) **desabilitada** no Auth.

**Performance:** o advisor retornou ~600KB de dados (excedeu o limite de extração desta rodada) — recomendo rodar `get_advisors(type:'performance')` numa sessão dedicada para extrair a lista completa de sugestões de índice.

---

## 3. Multi-tenancy

Isolamento é feito consistentemente via `organization_id` + RLS (`get_user_organizations()`) na esmagadora maioria das ~93 tabelas. Padrão sólido. Pontos de atenção:

- As duas tabelas sem policy (`profiles`, `marketing_leads`) são uma **quebra de isolamento por omissão** — não vazam dado entre tenants (porque bloqueiam tudo), mas indicam acesso via service role sem filtro, o que É um vetor de vazamento se algum código usar o admin client sem `.eq('organization_id', ...)` manual.
- Índices compostos com `organization_id` como primeira coluna estão presentes na maioria das tabelas de alto tráfego (`contatos`, `tasks`, `notifications`), faltando em `whatsapp_conversations`/`whatsapp_messages` (§2).
- Nenhuma query "sem filtro de tenant" foi encontrada nas actions auditadas — o padrão `.eq('organization_id', org.id)` é consistente.

---

## 4. RLS do Supabase — classificação

| Item | Severidade |
|---|---|
| `get_user_organizations()` é `VOLATILE` (deveria ser `STABLE`), usada em 43 policies | 🔴 **CRÍTICO** |
| `profiles`/`marketing_leads` com RLS sem policy | 🔴 **CRÍTICO** (funcional, potencialmente segurança) |
| 23 funções SECURITY DEFINER expostas a `anon` | 🟠 **ALTO** |
| Padrão de 3 policies por tabela (ALL + Super admin SELECT + Super admin UPDATE) em ~50 tabelas, ao invés de 1 com OR | 🟡 **MÉDIO** (overhead de planejamento, não incorreto) |
| `can_access_org()`/`is_super_admin()` também `VOLATILE` | 🟡 **MÉDIO** |
| Policies de INSERT com `qual` nulo (esperado para `WITH CHECK`) | 🟢 **BAIXO** (checar `organizations` manualmente) |

**A correção do item CRÍTICO #1 (`STABLE`) é provavelmente o ajuste de banco de maior custo-benefício desta auditoria inteira** — afeta toda leitura autenticada do sistema, é uma mudança de uma palavra (`ALTER FUNCTION ... STABLE`), zero risco funcional.

---

## 5. Vercel

- **Nenhuma rota usa `export const maxDuration`** — tudo no timeout padrão (10s no Hobby / 60s no Pro). Candidatas a estourar: webhooks Instagram/WhatsApp (chamam IA sincronamente), `copilot/chat`, `financial-ai/chat`, extração de documento/OCR, geração de roteiro com IA.
- Sem middleware pesado — `middleware.ts` é enxuto (~25 linhas), roda em Edge. O custo real de latência por request está em `lib/supabase/middleware.ts` (refresh de token) — não quantificado nesta rodada.
- `next/dynamic` com `ssr:false` já usado em 16 arquivos (gráficos Recharts, preview público de formulário) — bom padrão já estabelecido. **`FormBuilder.tsx` (editor de formulários, ~944 linhas somadas com sub-componentes) não usa code-splitting** e é candidato óbvio.
- Uploads (`actions/upload.ts`) processam arquivo inteiro em memória via `arrayBuffer()` (até 30MB para vídeo) de forma síncrona no request — funcional mas não escala bem para arquivos maiores ou uploads concorrentes em massa.

---

## 6. Frontend

- **Confirmado: sem React Query/SWR/qualquer cache client-side.** Cada componente busca/assina dados de forma isolada, sem dedupe. Trocar de aba no Dashboard refaz **todas** as queries do zero, mesmo que dois widgets peçam o mesmo dado (`LeadSourcesWidget` é buscado independentemente em duas abas diferentes).
- **Dashboard "Inicial"**: ~19 queries/actions disparadas na carga inicial (7 na page.tsx + ~12 na aba "Visão Geral", que é a default). Cada troca de aba dispara outra rajada completa de ~7-12 queries.
- `InsightCard` busca `listDashboardInsights` de novo em cada aba — **redundante** com a chamada já feita uma vez em `page.tsx:37`.
- Realtime: todos os canais auditados (`WhatsappChat`, `SocialInbox`, `NotificationBell`, `SidebarUnreadBadge`) têm `removeChannel` no cleanup — **sem vazamento de conexão**, correto. Mas a Sidebar (presente em toda tela do app) já abre 3 canais permanentes (2× `SidebarUnreadBadge` + `NotificationBell`) — um usuário com 2 abas do CRM abertas mantém **~8 conexões WebSocket simultâneas**.
- Único `setInterval` do projeto (`WhatsappChat.tsx:45`, tick de UI de 30s pra recalcular texto de "janela 24h") — benigno, não é polling de rede.
- `<img>` cru (sem `next/image`) em ~20 arquivos, incluindo avatares e mídia de conversa (alto tráfego) e páginas públicas de vitrine/proposta (a "vitrine" externa do produto, onde performance de imagem importa mais para conversão).

---

## 7. CRM / Dashboards — risco por tela

| Tela | Requests estimados | Paginação | Risco em 1000+ usuários simultâneos |
|---|---|---|---|
| Dashboard (Inicial) | ~19 na carga + ~10 por troca de aba | N/A (agregações) | 🟡 Médio — muitas queries, mas cada uma é leve |
| Contatos | 2-3 (paginado) | ✅ | 🟢 Baixo |
| **Pipeline/Kanban** | 1 query, mas **sem limite** | ❌ | 🔴 Alto |
| **Conversas** | 2 queries, **sem limite** em ambas | ❌ | 🔴 Alto |
| **Tarefas** | 1 query, **sem limite** | ❌ | 🔴 Alto |
| Relatórios | não totalmente auditado nesta rodada | ? | 🟡 A confirmar |
| Configurações | baixo volume, config | ✅ | 🟢 Baixo |

---

## 8. Realtime — impacto por escala

Tabelas publicadas: `notifications`, `whatsapp_conversations`, `whatsapp_messages`, `social_conversations`, `social_messages` (adicionadas nesta mesma sessão de trabalho).

| Usuários simultâneos | Conexões WebSocket estimadas (baseline 3-8 por usuário/aba) | Observação |
|---|---|---|
| 100 | 300-800 | Confortável nos planos pagos do Supabase |
| 500 | 1.500-4.000 | Pode exigir add-on de conexões Realtime dependendo do plano |
| 1.000 | 3.000-8.000 | Precisa confirmar limite do plano contratado + validar filtro `organization_id` no client (ver abaixo) |
| 3.000+ | 9.000-24.000 | Exige revisão de arquitetura de canal (ex.: 1 canal por org compartilhado entre componentes, não 1 por widget) |

**Ponto não verificável só por SQL** (fica como recomendação de checagem de código): confirmar que toda subscrição usa `filter: organization_id=eq.X` no `.channel().on('postgres_changes', {...})` — sem isso, o servidor Realtime processa fan-out de TODA linha nova da tabela pra todo client conectado antes do filtro, o que é o padrão de degradação mais comum do Realtime em escala.

---

## 9. Automações

- **Webhook do Instagram chama a IA de forma síncrona por mensagem** (`app/api/webhooks/instagram/route.ts:116-122`) dentro do handler que a Meta espera responder rápido — sem fila. Isso é o único ponto onde `API → processamento pesado → resposta` deveria virar `API → fila → worker → resposta`. É o achado #1 desta seção.
- Contraste revelador: `actions/public_forms.ts:145-153` já faz a qualificação de lead corretamente via `inngest.send` (assíncrono) — o padrão certo já existe no código, só não foi replicado para o webhook do Instagram nem para `actions/contatos.ts:493-494` (qualificação síncrona direto na server action).
- Cron jobs: só 3 de 15+ functions têm proteção contra execução concorrente sobreposta (`automation.ts`, `health-cron.ts`, `push.ts`). As demais (`alerts-cron.ts`, `automation-crons.ts`, `marketing-sync-cron.ts`, `trial-emails.ts`) rodam sem trava — risco baixo hoje (cron não costuma atrasar a ponto de sobrepor), mas cresce com o volume de dados processado por execução.
- Loops sequenciais (`for`+`await`) em vez de `Promise.all`/batch em quase todos os crons — não trava usuário (roda em background), mas o tempo de execução do cron escala linearmente com o número de orgs/leads processados por tick.
- Pontos positivos: `scheduled-messages-cron.ts` e `send-campaigns-cron.ts` usam claim atômico (`update ... eq('status','pending')`) — protegidos contra double-send mesmo com overlap.
- **Não foi encontrado uso de n8n no código** — as automações são todas nativas (Inngest + lógica própria), n8n mencionado no pedido do usuário não está integrado hoje.

---

## 10. Inteligência Artificial

Pontos de uso identificados: qualificação de lead (`qualifier.ts`), respostas de automação de Instagram/WhatsApp, copiloto de insights (`copilot/chat`), chat financeiro (`financial-ai/chat`), atendente IA (`ai_attendant.ts`), extração de documento/OCR, geração de roteiro de viagem.

- **Nenhum ponto tem cache de resposta** — mesma pergunta/contexto gera nova chamada à Anthropic todas as vezes.
- **Nenhum rate limit próprio** — depende só do rate limit da própria Anthropic.
- **Controle de custo existe e parece robusto**: `consumeAiCredits` (`lib/plans/server.ts:118-152`) é uma RPC Postgres, o que sugere débito atômico protegido contra race condition — recomendo confirmar o SQL da function diretamente no Supabase pra ter certeza absoluta (não verificado end-to-end nesta rodada).
- **Assíncrono vs síncrono é inconsistente**: alguns fluxos (formulário público) já disparam IA via Inngest corretamente; outros (webhook Instagram, `actions/contatos.ts`) chamam direto, síncrono, dentro do request do usuário/webhook.
- **Recomendação prática**: mover toda chamada de IA disparada por webhook (Instagram, WhatsApp) para Inngest, seguindo o padrão já existente em `public_forms.ts`. Isso resolve simultaneamente o risco de timeout do webhook E melhora a resiliência (retry automático do Inngest se a IA falhar).

---

## 11. Cache

Sem nenhuma camada de cache hoje — nem HTTP, nem Redis, nem React Query/SWR, nem materialized view (exceto `refresh_admin_dashboard_metrics`, que sugere já existir 1 materialized view para métricas administrativas — bom sinal, padrão a replicar).

**Onde cache traria ganho real, sem redis:**
- **React Query ou SWR no frontend** — resolve o problema #1 do frontend (zero dedupe, refetch completo a cada troca de aba do dashboard) sem precisar de infraestrutura nova. É a recomendação de cache mais impactante e mais barata desta auditoria.
- **Materialized view para métricas de dashboard** por org (refresh via cron a cada N minutos) — os widgets do Dashboard fazem ~19-30 queries agregadas por carga; muitas são candidatas a virar 1 leitura de materialized view.
- **Cache de resposta de IA** para prompts determinísticos/repetitivos (ex.: qualificação com o mesmo contexto) — economia direta de custo de API, não só performance.
- **Redis NÃO é necessário agora** — não há justificativa real no volume atual nem no de 1.000-3.000 usuários; React Query + materialized views cobrem o ganho de forma mais simples e barata. Revisitar Redis só se filas/rate-limit distribuído entre múltiplas instâncias serverless virarem necessidade real (ex.: rate limiting cross-region).

---

## 12. Paginação — OFFSET/LIMIT vs Cursor

| Lista | Hoje | Recomendação |
|---|---|---|
| Contatos | OFFSET/LIMIT (`.range()`) | Manter — volume por org (dezenas de milhares no teto realista) não justifica cursor ainda |
| Conversas WhatsApp | Nenhuma | Implementar OFFSET/LIMIT já resolve; cursor só se a lista crescer para centenas de milhares por org, pouco provável |
| Mensagens de conversa | Nenhuma | **Cursor-based** (por `created_at`/`id`) é melhor aqui — histórico de conversa cresce indefinidamente por thread, e o padrão de acesso é sempre "últimas N + carregar mais pra trás", caso clássico de cursor |
| Tarefas | Nenhuma | OFFSET/LIMIT resolve — volume por org é naturalmente limitado (tarefas concluídas deveriam ter alguma forma de arquivamento) |
| Notificações | `.limit(30)` fixo | Adicionar cursor se quiser "carregar mais"; hoje é aceitável como está |
| Logs (`social_interactions`, `automation_runs`) | Não auditado a fundo | Cursor-based, por serem tabelas de evento que só crescem |

---

## 13. Observabilidade

Não foi encontrada nenhuma ferramenta de APM/error tracking dedicada (Sentry, Datadog, etc.) no código auditado. O que existe:
- `lib/health/checks.ts` + cron de health check (`health-cron.ts`) — monitoramento próprio de integrações.
- Logs via `console.error` espalhados pelo código (padrão consistente de "best-effort, não quebra o fluxo principal").
- Supabase tem `get_advisors` (usado nesta auditoria) e logs de query nativos do projeto.

**Estratégia mínima recomendada para produção**, em ordem de custo-benefício:
1. **Sentry (ou similar) no frontend + Server Actions** — captura de erro não tratado, hoje invisível.
2. **Vercel Analytics/Speed Insights** (já parcialmente presente — script bloqueado por CSP foi visto nos testes desta sessão; vale revisar a política de CSP pra não estar cegando a própria telemetria da Vercel).
3. **Alertas de cron falho** — os crons já logam erro, mas não há alerta ativo (Slack/e-mail) quando uma execução falha.
4. **Dashboard de uso de créditos de IA por org** — já existe a base de dados (`consumeAiCredits`), falta visualização agregada para detectar abuso/anomalia cedo.

---

## 14. Estratégia de teste de carga

**Ferramenta recomendada:** k6 ou Artillery (ambos suportam cenários HTTP + WebSocket, JS-based, rodam bem contra Vercel+Supabase sem infra própria).

**Cenários e métricas por etapa:**

| Etapa | Usuários simultâneos | Foco |
|---|---|---|
| 1 | 100 | Baseline — login, dashboard, CRUD básico. Não deve haver erro. |
| 2 | 500 | Adicionar Realtime (conexões WS) + pipeline/conversas sem paginação — primeiro ponto onde os achados desta auditoria devem aparecer nos números. |
| 3 | 1.000 | Confirmar se RLS `VOLATILE` aparece como gargalo de CPU do banco. |
| 4 | 3.000 | Só depois de aplicar as correções de Fase 1-2 (ver §19) — testar o "novo baseline". |

**Fluxos a testar, com métrica-alvo sugerida (p95):** Login (&lt;800ms), Dashboard (&lt;2s carga completa), Listagem de Contatos (&lt;500ms), Pipeline (&lt;1s hoje / degradação linear visível sem paginação), Busca (&lt;300ms), Criar Lead/Contato (&lt;500ms), Atualizar negócio (&lt;500ms), Notificações via Realtime (&lt;1s de latência de entrega), Automação disparada por webhook (&lt;5s ponta a ponta hoje, deve cair para &lt;1s de resposta ao webhook após mover IA para fila).

Métricas de banco a observar durante o teste: CPU do Postgres, número de conexões ativas (pool), tempo médio de query nas 5 queries mais chamadas, lock waits.

---

## 15. Segurança + Performance (interseção)

| Achado | Segurança | Performance |
|---|---|---|
| `profiles`/`marketing_leads` RLS sem policy | 🔴 Acesso via service role sem filtro (se for o caso) | — |
| Fail-open de HMAC se env var ausente (Instagram/WhatsApp webhooks) | 🔴 Endpoint pode ficar 100% aberto por erro de config | 🔴 Abuso = flood de processamento |
| 23 SECURITY DEFINER expostas a `anon` (`consume_ai_credits`, `redeem_coupon`, `create_organization_for_user_manual`) | 🔴 Possível abuso não-autenticado | 🟡 Chamadas em massa não-autenticadas |
| `actions/public-leads.ts` sem rate limit | 🟡 Spam | 🔴 Flood pode degradar banco/IA |
| `get_user_organizations()` VOLATILE | — | 🔴 Reavaliada por linha em vez de por statement |

---

## 16. Score de escalabilidade (0-10)

| Área | Nota | Justificativa curta |
|---|---|---|
| Arquitetura geral | 7 | Padrão App Router + Server Actions + Inngest é sólido e moderno; falta fila para IA em webhooks |
| Banco de dados | 6 | Bem modelado e majoritariamente bem indexado; 2 gaps críticos de índice + paginação faltando em 3 telas |
| Supabase (config) | 6 | RLS consistente na maioria; função crítica VOLATILE; 2 tabelas sem policy |
| Vercel | 6 | Sem `maxDuration`, sem fila para rotas longas; code-splitting parcialmente aplicado |
| Frontend | 5 | Zero cache/dedupe client-side é o maior débito técnico do frontend |
| Backend | 6 | Bom uso de Server Actions; poucos N+1 reais; webhook-IA síncrono é o ponto fraco |
| Multi-tenancy | 8 | `organization_id` consistente em quase tudo, sem vazamento identificado |
| RLS | 5 | Correto na cobertura, mas com bug de performance crítico (`VOLATILE`) e 2 tabelas quebradas |
| Realtime | 6 | Implementado corretamente (cleanup ok), mas sem validação de filtro por org confirmada e sem estratégia de canal compartilhado |
| Automações | 6 | Boa base (Inngest, claim atômico em 2 crons), falta padronizar assíncrono em todo lugar |
| IA | 6 | Controle de custo existe; falta cache e mover pra fila os pontos síncronos |
| Observabilidade | 3 | Sem APM/error tracking dedicado — maior lacuna junto com frontend |
| Segurança | 6 | Nenhum CRITICAL, mas vários WARN que se acumulam (RLS quebrado, fail-open, funções expostas) |
| Escalabilidade geral | 6 | Fundação correta; os ajustes necessários são todos táticos, não estruturais |

### **NOTA GERAL DO ALTHOS: 6,0 / 10**

Arquitetura fundamentalmente correta e moderna, sem nenhum erro estrutural que exija reescrita. As notas mais baixas (Observabilidade, Frontend, RLS) são todas endereçáveis com mudanças pontuais e de baixo risco, não com nova arquitetura.

---

## 17. Mapa de gargalos

| Prioridade | Gargalo | Impacto | Probabilidade | Usuários onde aparece | Solução |
|---|---|---|---|---|---|
| **P0** | `get_user_organizations()` é VOLATILE, usada em 43 policies RLS | Degradação de toda leitura autenticada conforme tabelas crescem | Alta | 500-1.000 | `ALTER FUNCTION ... STABLE` (ou reescrever como SQL puro) |
| **P0** | Webhook Instagram chama IA sincronamente, sem fila | Timeout do webhook, retry-storm da Meta, mensagens perdidas | Alta | Já hoje, sob rajada de mensagens | Mover para `inngest.send`, padrão já usado em `public_forms.ts` |
| **P0** | Fail-open de validação HMAC se secret ausente | Endpoint 100% aberto por erro de config | Baixa (mas catastrófica) | Qualquer volume | Fail-closed: rejeitar se secret não configurado |
| **P0** | `profiles`/`marketing_leads` RLS sem policy | Acesso possivelmente via service role sem filtro de tenant | Média | Já hoje | Adicionar policy correta ou confirmar uso exclusivo via server-side com filtro manual |
| **P1** | Conversas WhatsApp sem paginação (lista + mensagens) | Tela trava/lenta com milhares de conversas/mensagens | Alta | 500-1.000 | `.range()` na lista; cursor nas mensagens |
| **P1** | Tarefas/Kanban sem paginação | Idem acima | Alta | 500-1.000 | `.range()` + arquivamento de concluídas antigas |
| **P1** | Pipeline/Kanban de leads carrega tudo sem limite | Payload grande + render pesado no DOM | Média-Alta | 1.000-3.000 | Paginação ou virtualização de coluna |
| **P1** | Zero cache client-side (sem React Query/SWR) | Refetch completo a cada troca de aba/navegação | Alta | Já hoje, piora com mais usuários simultâneos | Adotar React Query nas telas de maior tráfego primeiro (Dashboard, Conversas) |
| **P1** | 23 funções SECURITY DEFINER expostas a `anon` | Abuso não-autenticado de créditos/cupons/criação de org | Baixa-Média | Qualquer volume | Restringir a `authenticated`/`service_role` conforme o caso |
| **P2** | `whatsapp_messages`/`whatsapp_conversations` sem índice composto correto | Sort lento em thread/lista conforme volume cresce | Média | 1.000-3.000 | Criar os 2 índices compostos (§2) |
| **P2** | `actions/public-leads.ts` sem rate limit | Flood/spam no formulário público do site | Baixa-Média | Qualquer volume | Reaproveitar `lib/security/antispam.ts`, já existe e é usado em outro form |
| **P2** | Nenhuma rota com `maxDuration` | Timeout em rotas de IA/upload sob carga | Média | 500-1.000 | Configurar `maxDuration` nas rotas de IA/webhook |
| **P2** | Sem observabilidade (Sentry/APM) | Problemas em produção ficam invisíveis até reclamação de cliente | Alta (certeza de que vai acontecer) | Qualquer volume | Sentry + alertas de cron falho |
| **P3** | Buckets de Storage sem lifecycle/expurgo | Custo cresce sem teto | Baixa no curto prazo | 3.000+ | Job de arquivamento por idade |
| **P3** | `<img>` cru em vez de `next/image` | Performance de página pública (vitrine/proposta) | Baixa | Qualquer volume | Migrar gradualmente, priorizando páginas públicas |
| **P3** | Loops sequenciais em crons (marketing-sync, alerts) | Tempo de execução do cron cresce linearmente | Baixa (roda em background) | 3.000+ | Paralelizar com `Promise.all` em lotes |

---

## 18. Capacidade estimada

> **A arquitetura atual provavelmente suporta entre 300 e 800 usuários simultâneos ativos (não usuários cadastrados — usuários realmente usando o sistema ao mesmo tempo) antes de exigir intervenção, e entre 1.000-1.500 depois de aplicadas as correções P0/P1 deste relatório.**

**Premissas usadas para essa estimativa (nenhuma inventada, todas derivadas dos achados acima):**
- O gargalo mais provável de aparecer primeiro é a RLS `VOLATILE` combinada com as 3 telas sem paginação (Conversas/Tarefas/Pipeline) — ambos degradam sob volume de **linhas por tabela**, não diretamente sob número de usuários; então a estimativa depende mais de "quantos leads/conversas as organizações têm" do que de "quantos usuários logados simultâneos" — para orgs pequenas/médias (o perfil atual, com tabelas na casa de dezenas de linhas), 1.000+ usuários simultâneos provavelmente não sentiriam nada ainda.
- Realtime é o segundo limitador: sem confirmar que os canais filtram por `organization_id` no servidor (não verificável só por SQL), o limite de conexões concorrentes do plano Supabase contratado é o teto mais provável de bater primeiro em termos de "usuários simultâneos" puro (não de volume de dados).
- Nenhuma chamada de IA síncrona tem timeout configurado (`maxDuration`) — sob rajada simultânea de webhooks (ex.: campanha de marketing gerando muitas respostas de Instagram ao mesmo tempo), a Vercel pode começar a matar functions por timeout bem antes de 1.000 usuários "normais" no resto do sistema.
- Não foi feito nenhum teste de carga real nesta auditoria (só leitura de código) — os números acima são estimativa de engenharia baseada nos padrões encontrados, não medição. O plano de teste de carga (§14) é o próximo passo pra transformar isso em número medido.

---

## 19. Plano de otimização

### FASE 1 — AGORA (antes de qualquer crescimento, baixo risco/esforço)
1. `ALTER FUNCTION get_user_organizations() ... STABLE` (+ mesma checagem em `can_access_org`/`is_super_admin`).
2. Corrigir fail-open de HMAC em `webhooks/instagram` e `webhooks/whatsapp` — rejeitar se secret não configurado.
3. Adicionar policy correta (ou confirmar e documentar uso admin-only) em `profiles` e `marketing_leads`.
4. Paginar a lista de Conversas WhatsApp (`.range()`) e adicionar `.limit()` em Tarefas.
5. Criar os 2 índices compostos faltando (`whatsapp_conversations.last_message_at`, `whatsapp_messages.conversation_id+created_at`).
6. Restringir as funções SECURITY DEFINER mais sensíveis (`create_organization_for_user_manual`, `consume_ai_credits`, `redeem_coupon`, `redeem_referral`) a roles autenticados/service_role.

### FASE 2 — ATÉ 500 USUÁRIOS (preventivo)
1. Mover a chamada de IA do webhook do Instagram para Inngest (mesmo padrão de `public_forms.ts`).
2. Adicionar rate limit (reaproveitando `lib/security/antispam.ts`) em `actions/public-leads.ts`.
3. Paginar/virtualizar o Pipeline (Kanban de leads) e o histórico de mensagens de conversa (cursor-based).
4. Configurar `maxDuration` nas rotas de IA/webhook/upload.
5. Introduzir React Query (ou SWR) nas 2-3 telas de maior tráfego (Dashboard, Conversas) — não precisa ser no app inteiro de uma vez.
6. Sentry (ou equivalente) básico no frontend + Server Actions.

### FASE 3 — ATÉ 3.000 USUÁRIOS (escalabilidade)
1. Expandir React Query para o resto do app; eliminar fetches redundantes identificados (`InsightCard` por aba).
2. Materialized views para métricas de Dashboard (seguindo o padrão já existente de `refresh_admin_dashboard_metrics`).
3. Paralelizar loops sequenciais nos crons de maior volume (`marketing-sync-cron`, `alerts-cron`).
4. Job de arquivamento/expurgo de mídia antiga nos buckets de Storage.
5. Validar (e corrigir se preciso) filtro `organization_id` em todas as subscrições Realtime.
6. Rodar o plano de teste de carga (§14) com números reais, recalibrar as fases seguintes com dados medidos em vez de estimativa.

### FASE 4 — 3.000+ USUÁRIOS (arquitetura avançada, só se necessidade real for confirmada pelos testes)
1. Avaliar Redis **somente se** o teste de carga mostrar necessidade real de rate-limit distribuído entre múltiplas instâncias serverless, ou de cache compartilhado que materialized view + React Query não resolvam.
2. Avaliar read replica do Postgres se CPU do banco for o gargalo medido (não estimado) em testes de 3.000+.
3. Avaliar mover processamento de mídia/IA pesada para worker dedicado fora do Vercel (ex.: fila própria + container) se o volume de campanhas/automações simultâneas justificar.
4. Revisar arquitetura de canal Realtime (1 canal compartilhado por org em vez de 1 por widget) se o número de conexões WebSocket for o limitador confirmado.

**Nada nesta fase deve ser implementado antes de o teste de carga (Fase 3, item 6) confirmar que é realmente necessário.**

---

## 20. Resultado final

### 1. Resumo executivo
O Althos CRM tem uma arquitetura fundamentalmente sólida — Next.js App Router + Server Actions + Supabase + Inngest é uma escolha moderna e correta para o estágio atual. Não há nenhum erro estrutural que exija reescrita. Os problemas encontrados são todos táticos: uma função de RLS mal configurada, duas telas sem paginação, um ponto de IA síncrona onde deveria ser fila, e ausência de observabilidade. Nota geral **6,0/10** — "bom o suficiente pra crescer, com uma lista curta de correções antes de acelerar".

### 2. Principais gargalos
RLS `VOLATILE`, paginação ausente em Conversas/Tarefas/Pipeline, zero cache client-side, webhook do Instagram síncrono com IA.

### 3. Vulnerabilidades críticas
`profiles`/`marketing_leads` sem policy RLS, fail-open de HMAC nos webhooks, 23 funções SECURITY DEFINER expostas a `anon`.

### 4. Problemas de banco
Índices compostos faltando em `whatsapp_*`, alguns índices redundantes, `.select('*')` disperso (sem impacto crítico hoje), upserts em loop que deveriam ser batch.

### 5. Problemas de Vercel
Nenhum `maxDuration` configurado; `FormBuilder.tsx` sem code-splitting.

### 6. Problemas de frontend
Zero React Query/SWR; ~19-30 queries redundantes por carga do Dashboard; `<img>` cru generalizado.

### 7. Problemas de backend
Webhook Instagram com IA síncrona; `actions/public-leads.ts` sem rate limit; loops sequenciais em quase todos os crons.

### 8. Problemas de RLS
Função crítica `VOLATILE`; 2 tabelas sem policy; padrão de 3 policies por tabela em vez de 1 (overhead de planejamento).

### 9. Problemas de Realtime
Implementação tecnicamente correta (cleanup ok); risco não confirmado de filtro por org ausente em alguma subscrição; sem estratégia de canal compartilhado entre abas.

### 10. Problemas de automação
Só 3 de 15+ crons protegidos contra overlap; loops sequenciais; n8n mencionado no pedido mas não encontrado integrado ao código.

### 11. Problemas de IA
Sem cache de resposta; inconsistência síncrono/assíncrono entre pontos de uso; controle de custo (créditos) existe e parece robusto.

### 12. Oportunidades de cache
React Query/SWR no frontend (maior custo-benefício), materialized views para métricas de dashboard, cache de resposta de IA para prompts repetitivos. Redis não justificado agora.

### 13. Recomendações de arquitetura
Nenhuma mudança estrutural necessária — só disciplina de aplicar os padrões que já existem no próprio código (o padrão assíncrono de `public_forms.ts`, o padrão de índice composto de `social_messages`) nos lugares que ainda não os seguem.

### 14. Score geral
**6,0/10** — ver tabela completa em §16.

### 15. Capacidade estimada
**300-800 usuários simultâneos hoje, 1.000-1.500 após Fase 1+2.** Estimativa de engenharia, não medição — teste de carga (§14) é o próximo passo para números reais.

### 16. Roadmap de otimização
4 fases detalhadas em §19, da correção crítica de RLS (minutos de trabalho, maior impacto) até itens de Fase 4 condicionados a confirmação por teste de carga real.
