# Project Context — Althos CRM

Contexto rápido e relativamente permanente do projeto, para um agente novo
(Claude Code, Codex, ou outro) se orientar em segundos. **Isto não substitui
[CLAUDE.md](../CLAUDE.md) nem [AGENTS.md](../AGENTS.md)** — leia os dois
para regras de workflow e convenções detalhadas. Este arquivo é só o mapa;
atualize-o apenas quando algo aqui descrito deixar de ser verdade (ver regra
de manutenção em AGENTS.md § Handoff Protocol).

## O que é

Althos CRM: CRM multi-tenant para agências, nicho principal **agências de
viagem** (nicho genérico "marketing/vendas" também suportado — ver
`lib/niche.ts`). Uma instância serve várias organizações (`organizations`);
isolamento entre orgs via `organization_id` + RLS no Postgres.

## Stack real

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript `strict: true` |
| UI | Tailwind CSS + shadcn/ui (`components/ui/*` — gerado, não editar à mão) |
| Dados | Supabase (Postgres + Auth + Storage + Realtime), RLS |
| Mutations | Server Actions (`'use server'`, em `/actions`) |
| Jobs em background | Inngest (`lib/inngest/`) |
| E-mail | Resend |
| WhatsApp | Meta WhatsApp Cloud API |
| Instagram | Instagram API with Instagram Login |
| IA | Anthropic (`@anthropic-ai/sdk`) principal; Google Gemini (`@google/genai`) em pontos específicos (OCR, qualificação) |
| Telefonia | Twilio, abstraído via `lib/voice/provider.ts` (módulo Althos Voice) |
| Billing | Asaas (`lib/asaas/`) |
| Deploy | Vercel (auto-deploy em push pra `master`) |
| Testes | Vitest (`tests/unit/`) — sem E2E configurado |

## Arquitetura / convenções centrais

- **Server Action padrão**: `orgSlug` → `getCurrentOrganization(orgSlug)` →
  `checkMemberPermission(org.id, user.id, key)` / `checkFeatureAccessByOrgSlug` →
  query filtrada por `organization_id` → `{ok:true,...}` / `{ok:false,error}`.
  Template de referência: `actions/tasks-columns.ts`.
- **Multi-tenant**: toda tabela com dado de org tem `organization_id` + RLS
  (`get_user_organizations()`). Nunca confiar em `organization_id` vindo do
  client sem passar por `getCurrentOrganization`.
- **Autorização**: `role` (`owner`/`admin`/`member`) + `PermissionKey`
  granular (`lib/permissions.ts`), checado server-side
  (`lib/permissions.server.ts`) — nunca só client-side.
- **`'use server'` só exporta async functions** — nem uma constante, nem um
  `export { X } from ...` puro. Quebra o build do Next.js silenciosamente
  até você rodar `npm run build` (o `tsc`/dev server não pegam isso).
- **Billing/planos**: nova taxonomia por CONTA (`accounts` → N
  `organizations`) em `lib/plans/{config,server}.ts` — `subscriptions` +
  `plans.features` jsonb é a fonte de verdade; `lib/plans/config.ts` é só
  espelho estático pra UI. Créditos de IA (`ai_credits`) e créditos do
  Althos Voice (`voice_credits`) são ledgers **separados** — nunca misturar.
- **Migrations**: `supabase/migrations/NNNN_descricao.sql`, numeradas,
  aplicadas incrementalmente via Supabase MCP. Nunca editar uma já aplicada.
  Padrão de RLS: `ENABLE ROW LEVEL SECURITY` + policy
  `organization_id IN (SELECT get_user_organizations())` + policy de
  super-admin (`is_super_admin()`).
- **Automações**: motor genérico único (`lib/inngest/automation.ts` +
  `automation-step-executor.ts`) orientado a eventos de domínio
  (`<domínio>.<ação>` ou `<domínio>/<ação>.<particípio>`) — não criar um
  segundo motor de workflow por vertical/módulo.
- **Timeline unificada**: toda atividade de um contato (WhatsApp, tarefas,
  chamadas, SMS) vai pra `contato_activities` — nunca uma tabela de timeline
  separada por canal.
- **Design System**: `components/ui/*` é gerado (shadcn) — nunca editar à
  mão; se um primitive não suporta algo, resolva no componente que chama,
  não no primitive compartilhado.

## Estrutura de diretórios (alto nível)

```
app/app/[orgSlug]/...     rotas autenticadas do CRM (App Router)
app/(public)/...          rotas públicas (formulários, convites — gate próprio)
app/api/webhooks/...      webhooks de provider (assinatura validada, fail-closed)
actions/                  Server Actions ('use server')
lib/                       lógica de domínio, integrações, Inngest, IA, voice
components/ui/             primitives shadcn (gerado)
components/features/       componentes de domínio do CRM
supabase/migrations/       schema, numerado sequencialmente
.harness/                  sistema de tarefas planejadas + invariants + agent profiles
.ai/                        contexto persistente de handoff entre agentes (este diretório)
```

## Verticais/nichos suportados

Viagens (principal), Clínicas, Imobiliárias, Seguros, Agências de Tráfego,
e um genérico "marketing/vendas". Módulos condicionais via `lib/niche.ts` +
`isModuleEnabled`.

## Onde cavar mais fundo

- Regras de workflow do agente: [AGENTS.md](../AGENTS.md)
- Context engineering detalhado + camadas de contexto: [CLAUDE.md](../CLAUDE.md)
- Regras invioláveis de arquitetura/segurança: [.harness/invariants.md](../.harness/invariants.md)
- Sistema de tarefas planejadas (features maiores): [.harness/tasks/README.md](../.harness/tasks/README.md)
- Deploy: [DEPLOY.md](../DEPLOY.md)
- Auditorias por módulo (snapshots, confirmar contra código): `docs/audit/*.md`
