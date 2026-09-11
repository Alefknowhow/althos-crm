# CLAUDE.md — Manual Operacional do Althos CRM

Este é o manual operacional principal para Claude Code (e agentes equivalentes) trabalhando neste repositório. Ele documenta a arquitetura **real** encontrada no código, não uma arquitetura idealizada — quando este arquivo conflitar com o código, **o código vence**. Atualize este arquivo quando descobrir a diferença.

> Contrato multi-modelo (Claude, Codex, outros agentes): ver [AGENTS.md](./AGENTS.md).
> Regras invioláveis de segurança/arquitetura: ver [.harness/invariants.md](./.harness/invariants.md).
> Perfis de agente especializados: ver [.harness/agents/](./.harness/agents/).
> Protocolo de handoff entre agentes/sessões (obrigatório antes de tarefa relevante): ver [AGENTS.md § 0](./AGENTS.md) e [.ai/](./.ai/).

---

## 1. Identidade do Althos

Althos CRM é um CRM multi-tenant que atende várias verticais (não só agências de viagem — ver "Módulos principais" abaixo e `lib/niche.ts`). Uma instância serve várias organizações (`organizations`), cada usuário pertence a uma ou mais orgs via `memberships`, e o isolamento entre orgs é feito por `organization_id` + RLS no Postgres.

### Stack real (confirmada no código, não assumida)

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript `strict: true` |
| UI | Tailwind CSS + shadcn/ui (Radix primitives) |
| Dados | Supabase (Postgres + Auth + Realtime), Row Level Security |
| Storage | **Cloudflare R2** (S3-compatible, via `@aws-sdk/client-s3`) é o destino de todo upload novo, sempre por trás de `lib/storage/index.ts` (`StorageService`) — nunca chamar o SDK R2 ou `supabase.storage` direto. Supabase Storage ainda existe só para objetos antigos (`storage_objects.storage_provider = 'supabase'`), leitura apenas. Ver `lib/storage/providers/{r2,supabase}.ts`. |
| Mutations | Server Actions (`'use server'`, em `/actions`) |
| Validação | Zod (nem todo endpoint usa — ver seção Gaps) |
| Jobs em background | Inngest (~40 functions em `lib/inngest/`, registradas em `app/api/inngest/route.ts` — não assuma um número exato, conte o array `functions: [...]`) |
| E-mail | Resend |
| WhatsApp | Meta WhatsApp Cloud API (oficial), API v26.0 |
| Instagram | Instagram API with Instagram Login (`graph.instagram.com`) |
| Telefonia/SMS/Voice AI | **Twilio** (`twilio` + `@twilio/voice-sdk`), abstraído via `lib/voice/provider.ts` (`VoiceProvider` interface) — nunca importar o SDK da Twilio fora de `lib/voice/providers/`. Módulo "Althos Voice", gated a Pro/Business. |
| IA | Anthropic (`@anthropic-ai/sdk`) como motor principal, Google Gemini (`@google/genai`) como alternativa em alguns pontos (qualificação de lead, OCR, transcrição de chamada) |
| MCP | Servidor MCP próprio em `app/api/mcp/route.ts` (`@modelcontextprotocol/sdk`) — expõe tools do CRM (`lib/agent/tools/registry.ts`) para agentes de IA externos (Claude Code, Codex) autenticados via token pessoal gerado em Configurações → Conector MCP (`app/app/[orgSlug]/configuracoes/agentes/`). |
| Billing | **Duas taxonomias coexistindo** (reconciliação "Prompt 8" ainda não aconteceu): (1) legado por-ORG, `lib/billing/plans.ts` (`PlanKey`: trial/starter/pro/scale/agency/internal, coluna `organizations.plan`) — ainda é o que gateia limites/features na maior parte do app (`app/app/[orgSlug]/layout.tsx`, `actions/*-crud.ts`, `lib/billing/limits.ts`); (2) novo por-CONTA, `lib/plans/config.ts`/`lib/plans/server.ts` (`PlanId`: free/starter/pro/business, tabelas `plans`/`subscriptions`) — fonte de verdade para `checkFeatureAccess`/créditos de IA/Voice. Pagamento em si é **Asaas** (`lib/asaas/`) nas duas. Não assuma que uma substituiu a outra. |
| Deploy | Vercel (região `gru1`, ver `vercel.json`) |
| Testes | Vitest (unit, `tests/unit/`) — **sem E2E/Playwright configurado** |
| Lint | ESLint 9 (flat config, `eslint.typed.config.mjs`) — `npm run lint`/`lint:fix`/`lint:types`, roda dentro de `scripts/verify.sh` (ver seção Deployment) |
| Observability | **Sem Sentry configurado** — não assuma que existe |
| Anti-spam | Cloudflare Turnstile (opcional, env-gated) + honeypot + rate limit por IP |

### Módulos principais

- **CRM genérico**: pipeline (`pipelines`/`pipeline_stages`), leads/contatos (`contatos`), tarefas, formulários públicos, campanhas de marketing.
- **Verticais por nicho** (`org.niche`, gated via `lib/niche.ts` + `lib/niche-modules.ts` — 6 chaves em `NicheKey`, cada uma com módulos e permissões próprias):
  - `viagens` (`isTravelNiche`): Cotações, Ofertas, Reservas (`travel_sales`), Embarques, Bloqueios, Explorar Voos, Documentos, Roteirista.
  - `clinicas` (`isClinicNiche`): prontuário eletrônico (com log de acesso e retenção — dado sensível, ver migrations `0206-0208`), estoque de insumos, profissionais, atendimentos/check-in-out, tratamentos, lista de espera. Rotas em `prontuario/`, `estoque/`, `profissionais/`, `atendimentos/`, etc. Crons próprios em `lib/inngest/clinic-crons.ts`.
  - `imoveis` (`isRealEstateNiche`): catálogo de imóveis + pipeline/visitas (`imoveis/`, `pipeline-imoveis/`, `visitas/`).
  - `seguros` (`isInsuranceNiche`): apólices, sinistros, seguradoras, cotações/produtos de seguro. Crons em `lib/inngest/insurance-crons.ts`.
  - `trafego` (`isTrafficNiche`): gestão de contas de anúncio de clientes de agência de tráfego (`agencias-trafego/trafego/`).
  - `advocacia` (`isLawNiche`): existe como `NicheKey`/opção de cadastro, mas **sem rotas/actions dedicadas ainda** — trate como stub, não como vertical funcional.
- **Comunicação**: WhatsApp (Conversas), Instagram (Social — DM/comentários/automações), e-mail.
- **Althos Voice**: telefonia (chamadas humanas + Voice AI), SMS, gravação/transcrição/insights, automações de chamada — ver linha "Telefonia/SMS/Voice AI" acima e `lib/voice/`.
- **Agente IA**: atendimento conversacional real no WhatsApp (`lib/ai/attendant-engine.ts` + `lib/inngest/whatsapp-inbound.ts`), qualificação automática de lead (`lib/ai/run-qualification.ts`), automação simples do Instagram (`lib/social/engine.ts`).
- **Financeiro**: `financial_entries`, integração Asaas, relatórios.
- **Google Business Profile**: OAuth + avaliações (puxar/responder direto do CRM).
- **Super-admin**: `/super-admin`, impersonação de org com banner e auditoria.

---

## 2. Regras fundamentais

### Segurança e multi-tenancy
- Toda tabela com dado de organização tem `organization_id` e RLS habilitada. Padrão de policy: `organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid())` — a função helper real usada na maioria das migrations é `get_user_organizations()`.
- `SUPABASE_SERVICE_ROLE_KEY` só é usado via `createAdminClient()` (`lib/supabase/server.ts`), nunca no client. Toda Server Action que usa admin client bypassa RLS deliberadamente — precisa filtrar `organization_id` manualmente.
- Toda Server Action recebe `orgSlug` e resolve a org via `getCurrentOrganization(orgSlug)` — nunca confie em um `organization_id` vindo do client sem essa resolução.

### Autorização
- Dois níveis: **role** (`owner`/`admin`/`member`, em `memberships.role`) + **permissões granulares por módulo** (`PermissionKey` em `lib/permissions.ts` — ~37 chaves, cobrindo CRM genérico + todos os nichos + `voice`, ex.: `leads`, `reservas`, `cotacoes`, `conversations`, `financial`, `settings`, `voice`). Verificação real: `checkMemberPermission(orgId, userId, key)` em `lib/permissions.server.ts`.
- Super-admin (`raw_user_meta_data->>is_super_admin`) bypassa a maioria das checagens — sempre em SQL/RLS, nunca só no client.
- **Nunca confie em gate client-side sozinho.** Toda ação sensível re-verifica no servidor.

### Banco de dados
- Toda mudança de schema é uma migration numerada em `supabase/migrations/NNNN_descricao.sql` (231+ migrations até o momento — não hardcode esse número em prosa, confira `ls supabase/migrations | tail -1` pro próximo). Aplicadas via MCP do Supabase (`apply_migration`) ou CLI — nunca editar uma migration já aplicada.
- RLS habilitada em praticamente toda tabela nova. Ao criar tabela nova: `ENABLE ROW LEVEL SECURITY` + policy de isolamento por org é o padrão, não a exceção.

### Storage
- **Todo upload novo vai pro Cloudflare R2**, sempre através de `lib/storage/index.ts` (`StorageService`) — nunca chame o SDK da AWS (`@aws-sdk/client-s3`) nem `supabase.storage` diretamente em outro módulo. Buckets antigos do Supabase Storage continuam existindo só para leitura de objetos legados (`storage_objects.storage_provider = 'supabase'`).
- **Não altere nada de Storage sem necessidade explícita** — é uma área sensível a vazamento de dado entre orgs.

### IA
- Duas arquiteturas de crédito coexistem: (1) créditos de IA por conta, medidos via `consumeAiCredits()`/`checkFeatureAccess()` em `lib/plans/server.ts`; (2) chave de plataforma centralizada (`getPlatformAiKey()`, `hasPlatformAiKey()` em `lib/ai/api-key.ts`) — não há chave de API por-org para o Agente IA/qualificador (existiu um design anterior de chave por-org, já removido).
- O motor de atendimento conversacional (`lib/ai/attendant-engine.ts`) é uma função pura (sem I/O) — quem busca dados e chama a API é o caller (`lib/inngest/whatsapp-inbound.ts` ou `actions/ai_attendant.ts` no sandbox).
- Sempre valide `checkFeatureAccess`/créditos ANTES de chamar a API de IA — nunca depois.

### Background jobs (Inngest)
- Todas as functions registradas em `app/api/inngest/route.ts` (`functions: [...]`) — uma function não listada ali nunca roda, mesmo que o arquivo exista. Padrão de nome de evento: `<domínio>/<ação>.<particípio>` (ex.: `whatsapp/inbound.received`, `voice/call.requested`) ou `<domínio>.<ação>` pra eventos de automação (`lead.stage_changed`, `voice.call.completed`).
- Idempotência é responsabilidade de cada function — não existe um mecanismo genérico. Padrão comum: checar se já existe registro com o mesmo ID externo (`meta_message_id`, etc.) antes de processar.

### Design System
- Componentes shadcn/ui em `components/ui/` — **não editar manualmente**, são gerados. Componentes de domínio em `components/features/`.
- Cores/tema: variáveis CSS (`bg-background`, `bg-secondary`, `bg-primary`, etc.) — nunca hexadecimal hardcoded fora de casos muito específicos (ex.: cores de marca do WhatsApp/Instagram).

### Testes
- `tests/unit/*.test.ts` (Vitest) — cobre antispam, billing plans, currency, date filters, webhooks, slugify. Rodar com `npm test`.
- **Não existe suíte de integração nem E2E configurada.** Se uma tarefa pedir isso, é trabalho novo, não "rodar o que já existe".

### Deployment
- CI (`.github/workflows/ci.yml`) roda `bash scripts/verify.sh` — o MESMO script que roda localmente (Harness), sem pipeline paralelo. Ordem real: env check → integridade de deps → `tsc --noEmit` → `npm run lint` (ESLint 9) → `npm test` → integração/segurança/E2E (todos reportam `NOT CONFIGURED`, não fingir que existem) → `npm run build` → `git status`/`git diff` de sanidade.
- Deploy real é via Vercel (não está no workflow do GitHub — integração direta Vercel↔GitHub, auto-deploy em push pra `master`).

---

## 3. Workflow obrigatório

Para qualquer tarefa não-trivial:

```
DISCOVER → UNDERSTAND → CONTEXT SELECTION → PLAN → IMPLEMENT → TEST → VERIFY → REVIEW
```

- **DISCOVER**: leia o código real relacionado à área da tarefa. Não assuma.
- **UNDERSTAND**: confirme o problema/objetivo antes de programar solução.
- **CONTEXT SELECTION**: ver seção 4 — carregue só o necessário.
- **PLAN**: para tarefas médias/grandes, esboce o plano (mentalmente ou em `.harness/tasks/`) antes de editar.
- **IMPLEMENT**: mudanças incrementais, reaproveitando o que já existe.
- **TEST**: rode `npm test` e `npx tsc --noEmit` no que foi tocado.
- **VERIFY**: rode `scripts/verify.sh` antes de considerar a tarefa pronta.
- **REVIEW**: releia o diff final — nada supérfluo, nada fora de escopo.

---

## 4. Context Engineering (OBRIGATÓRIO)

**Não carregue toda a documentação do Althos em toda tarefa.** Mais contexto não é melhor contexto — o objetivo é maximizar relevância por token.

### Camada 1 — Global (sempre)
- Este arquivo (`CLAUDE.md`)
- `AGENTS.md` (inclui o protocolo de handoff, § 0)
- `.harness/invariants.md`
- `.ai/CURRENT_TASK.md` e `.ai/HANDOFF.md` (estado da tarefa em andamento, se houver)

### Camada 2 — Domínio (só quando a tarefa tocar a área)
| Área da tarefa | Carregar |
|---|---|
| Storage/upload | `lib/storage/index.ts` (`StorageService`) + o provider relevante (`lib/storage/providers/r2.ts`) |
| Banco/schema | migrations relevantes (`supabase/migrations/`), não o histórico inteiro |
| IA/Agente | `lib/ai/attendant-engine.ts`, `actions/ai_attendant.ts`, `lib/plans/server.ts` |
| WhatsApp | `lib/whatsapp/meta-client.ts`, `app/api/webhooks/whatsapp/route.ts` |
| Instagram/Social | `lib/social/*.ts`, `app/api/webhooks/instagram/route.ts` |
| Althos Voice | `lib/voice/provider.ts`, `lib/voice/get-provider.ts`, `actions/voice*.ts` |
| MCP (agentes externos) | `app/api/mcp/route.ts`, `lib/agent/tools/registry.ts`, `lib/agent/execute.ts` |
| UI/Design System | `components/ui/`, o componente `features/` mais próximo do que já existe |
| Nicho (viagens/clínicas/imóveis/seguros/tráfego) | `lib/niche.ts`, `lib/niche-modules.ts` + a área específica do nicho |
| Permissões | `lib/permissions.ts`, `lib/permissions.server.ts` |
| Billing | `lib/asaas/`, `lib/billing/plans.ts` (legado, por-org) **e** `lib/plans/config.ts`/`lib/plans/server.ts` (novo, por-conta) — confirme qual dos dois a tarefa toca antes de assumir |

### Camada 3 — Implementação
- Arquivos diretamente relacionados à mudança.
- Dependências diretas (imports usados/consumidos).
- Testes relacionados, se existirem.

### Camada 4 — Verificação
- Saída de `scripts/verify.sh`, erros de typecheck, diff final.

**Regra prática**: antes de fazer `Grep`/`Read` amplo em `/docs` ou em módulos não relacionados à tarefa, pergunte-se se é realmente necessário. Prefira busca cirúrgica (nome de função, rota, tabela) a varredura.

---

## 5. Onde encontrar o quê

- Documentação de features já auditadas: `docs/audit/*.md` (não confiar cegamente — são snapshots, confirme contra o código se a tarefa depende disso).
- Guia de deploy: `DEPLOY.md`.
- Perfil de projeto herdado (pré-Harness, pode conter itens desatualizados — ex.: menciona Stripe/Pino/Playwright que não existem no código real): `.agent.md`.
