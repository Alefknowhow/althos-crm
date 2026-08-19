# CLAUDE.md — Manual Operacional do Althos CRM

Este é o manual operacional principal para Claude Code (e agentes equivalentes) trabalhando neste repositório. Ele documenta a arquitetura **real** encontrada no código, não uma arquitetura idealizada — quando este arquivo conflitar com o código, **o código vence**. Atualize este arquivo quando descobrir a diferença.

> Contrato multi-modelo (Claude, Codex, outros agentes): ver [AGENTS.md](./AGENTS.md).
> Regras invioláveis de segurança/arquitetura: ver [.harness/invariants.md](./.harness/invariants.md).
> Perfis de agente especializados: ver [.harness/agents/](./.harness/agents/).

---

## 1. Identidade do Althos

Althos CRM é um CRM multi-tenant para agências (o nicho principal hoje é **agências de viagem**, com um nicho genérico "marketing/vendas" também suportado — ver `lib/niche.ts`). Uma instância serve várias organizações (`organizations`), cada usuário pertence a uma ou mais orgs via `memberships`, e o isolamento entre orgs é feito por `organization_id` + RLS no Postgres.

### Stack real (confirmada no código, não assumida)

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript `strict: true` |
| UI | Tailwind CSS + shadcn/ui (Radix primitives) |
| Dados | Supabase (Postgres + Auth + Storage + Realtime), Row Level Security |
| Mutations | Server Actions (`'use server'`, em `/actions`) |
| Validação | Zod (nem todo endpoint usa — ver seção Gaps) |
| Jobs em background | Inngest (16 functions em `lib/inngest/`) |
| E-mail | Resend |
| WhatsApp | Meta WhatsApp Cloud API (oficial), API v26.0 |
| Instagram | Instagram API with Instagram Login (`graph.instagram.com`) |
| IA | Anthropic (`@anthropic-ai/sdk`) como motor principal, Google Gemini (`@google/genai`) como alternativa em alguns pontos (qualificação de lead, OCR) |
| Billing | **Asaas** (`lib/asaas/`) — não é Stripe nem Pagar.me |
| Deploy | Vercel (região `gru1`, ver `vercel.json`) |
| Testes | Vitest (unit, `tests/unit/`) — **sem E2E/Playwright configurado** |
| Observability | **Sem Sentry configurado** — não assuma que existe |
| Anti-spam | Cloudflare Turnstile (opcional, env-gated) + honeypot + rate limit por IP |

### Módulos principais

- **CRM genérico**: pipeline (`pipelines`/`pipeline_stages`), leads/contatos (`contatos`), tarefas, formulários públicos, campanhas de marketing.
- **Nicho de viagens** (gated por `isTravelNiche(org.niche)`): Cotações, Ofertas, Reservas (`travel_sales`), Embarques (viagens programadas), Bloqueios, Explorar Voos, Documentos, Roteirista.
- **Comunicação**: WhatsApp (Conversas), Instagram (Social — DM/comentários/automações), e-mail.
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
- Dois níveis: **role** (`owner`/`admin`/`member`, em `memberships.role`) + **permissões granulares por módulo** (`PermissionKey` em `lib/permissions.ts` — ~28 chaves, ex.: `leads`, `reservas`, `cotacoes`, `conversations`, `financial`, `settings`). Verificação real: `checkMemberPermission(orgId, userId, key)` em `lib/permissions.server.ts`.
- Super-admin (`raw_user_meta_data->>is_super_admin`) bypassa a maioria das checagens — sempre em SQL/RLS, nunca só no client.
- **Nunca confie em gate client-side sozinho.** Toda ação sensível re-verifica no servidor.

### Banco de dados
- Toda mudança de schema é uma migration numerada em `supabase/migrations/NNNN_descricao.sql` (156 migrations até o momento). Aplicadas via MCP do Supabase (`apply_migration`) ou CLI — nunca editar uma migration já aplicada.
- RLS habilitada em praticamente toda tabela nova (52+ migrations tocam RLS). Ao criar tabela nova: `ENABLE ROW LEVEL SECURITY` + policy de isolamento por org é o padrão, não a exceção.

### Storage
- Buckets do Supabase Storage (14 buckets criados via migration, ex.: `whatsapp-media`, `instagram-media`). Padrão: bucket público para leitura, escrita restrita a service-role (upload feito em Server Actions via `createAdminClient()`).
- **Não altere nada de Storage sem necessidade explícita** — é uma área sensível a vazamento de dado entre orgs.

### IA
- Duas arquiteturas de crédito coexistem: (1) créditos de IA por conta, medidos via `consumeAiCredits()`/`checkFeatureAccess()` em `lib/plans/server.ts`; (2) chave de plataforma centralizada (`getPlatformAiKey()`, `hasPlatformAiKey()` em `lib/ai/api-key.ts`) — não há chave de API por-org para o Agente IA/qualificador (existiu um design anterior de chave por-org, já removido).
- O motor de atendimento conversacional (`lib/ai/attendant-engine.ts`) é uma função pura (sem I/O) — quem busca dados e chama a API é o caller (`lib/inngest/whatsapp-inbound.ts` ou `actions/ai_attendant.ts` no sandbox).
- Sempre valide `checkFeatureAccess`/créditos ANTES de chamar a API de IA — nunca depois.

### Background jobs (Inngest)
- 16 functions registradas em `app/api/inngest/route.ts`. Padrão de nome de evento: `<domínio>/<ação>.<particípio>` (ex.: `whatsapp/inbound.received`, `instagram/inbound.received`).
- Idempotência é responsabilidade de cada function — não existe um mecanismo genérico. Padrão comum: checar se já existe registro com o mesmo ID externo (`meta_message_id`, etc.) antes de processar.

### Design System
- Componentes shadcn/ui em `components/ui/` — **não editar manualmente**, são gerados. Componentes de domínio em `components/features/`.
- Cores/tema: variáveis CSS (`bg-background`, `bg-secondary`, `bg-primary`, etc.) — nunca hexadecimal hardcoded fora de casos muito específicos (ex.: cores de marca do WhatsApp/Instagram).

### Testes
- `tests/unit/*.test.ts` (Vitest) — cobre antispam, billing plans, currency, date filters, webhooks, slugify. Rodar com `npm test`.
- **Não existe suíte de integração nem E2E configurada.** Se uma tarefa pedir isso, é trabalho novo, não "rodar o que já existe".

### Deployment
- CI (`.github/workflows/ci.yml`): typecheck (`tsc --noEmit`) → `npm test` → `npm run build`, em todo push/PR pra `master`.
- Deploy real é via Vercel (não está no workflow do GitHub — provavelmente integração direta Vercel↔GitHub).

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
- `AGENTS.md`
- `.harness/invariants.md`

### Camada 2 — Domínio (só quando a tarefa tocar a área)
| Área da tarefa | Carregar |
|---|---|
| Storage/upload | `lib/supabase/server.ts`, o bucket relevante nas migrations |
| Banco/schema | migrations relevantes (`supabase/migrations/`), não o histórico inteiro |
| IA/Agente | `lib/ai/attendant-engine.ts`, `actions/ai_attendant.ts`, `lib/plans/server.ts` |
| WhatsApp | `lib/whatsapp/meta-client.ts`, `app/api/webhooks/whatsapp/route.ts` |
| Instagram/Social | `lib/social/*.ts`, `app/api/webhooks/instagram/route.ts` |
| UI/Design System | `components/ui/`, o componente `features/` mais próximo do que já existe |
| Nicho de viagens | `lib/niche.ts` + a área específica (Reservas/Cotações/Embarques) |
| Permissões | `lib/permissions.ts`, `lib/permissions.server.ts` |
| Billing | `lib/asaas/`, `lib/billing/plans.ts`, `actions/billing.ts` |

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
