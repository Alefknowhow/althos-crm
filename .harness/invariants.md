# Invariants — Althos CRM

Regras que não podem ser violadas por uma mudança de código, refletindo a arquitetura **real** encontrada no repositório (discovery feito na instalação do Harness V1). Onde a proteção correspondente ainda não existe de fato, isso é marcado explicitamente como `TARGET INVARIANT — NOT YET ENFORCED` — nunca finja que uma proteção existe quando ela não existe.

---

## Multi-tenancy

- **[ENFORCED]** Toda tabela com dado pertencente a uma organização tem coluna `organization_id` e RLS habilitada.
- **[ENFORCED]** Padrão de policy: acesso restrito a `organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid())`, via a função helper `get_user_organizations()` (usada na maioria das 52+ migrations que tocam RLS).
- **[ENFORCED]** Toda Server Action resolve a organização via `getCurrentOrganization(orgSlug)` a partir do slug — nunca aceita `organization_id` cru vindo do client como fonte de verdade.
- **[TARGET INVARIANT — NOT YET ENFORCED]** Não há um teste automatizado genérico que rode contra toda tabela nova verificando RLS habilitada — `scripts/test-rls.ts` existe mas cobre casos específicos, não é uma varredura exaustiva do schema.

## Authentication

- **[ENFORCED]** Autenticação via Supabase Auth (`@supabase/ssr`), sessão gerenciada por `middleware.ts` (`updateSession`).
- **[ENFORCED]** Rotas autenticadas ficam sob `app/app/[orgSlug]/...` — o layout dessa árvore chama `requireAuth()`/`getCurrentOrganization()`.
- **[ENFORCED]** Rotas públicas (`app/(public)/...`) não devem executar nenhuma ação sensível sem seu próprio gate (Turnstile/rate-limit/honeypot quando aplicável).

## Authorization

- **[ENFORCED]** Dois níveis: `role` (`owner`/`admin`/`member`) em `memberships.role`, e permissões granulares por módulo (`PermissionKey`, `lib/permissions.ts`) verificadas via `checkMemberPermission(orgId, userId, key)` (`lib/permissions.server.ts`).
- **[ENFORCED]** Toda ação sensível é reverificada no servidor — um gate só no client (esconder botão) nunca é suficiente.
- **[ENFORCED]** Super-admin bypassa via `is_super_admin` em `raw_user_meta_data`, checado em SQL (RLS) e/ou server-side — nunca só client-side.
- **[TARGET INVARIANT — NOT YET ENFORCED]** Não existe teste automatizado de regressão de autorização (ex.: "member sem permissão X não consegue chamar a action Y") — a cobertura hoje é manual/ad-hoc.

## Database

- **[ENFORCED]** Toda mudança de schema é uma migration numerada em `supabase/migrations/NNNN_descricao.sql`, aplicada de forma incremental (nunca editar uma migration já aplicada em produção).
- **[ENFORCED]** Foreign keys com `ON DELETE CASCADE` são o padrão para dados dependentes (ex.: mensagens de uma conversa apagada).
- **[TARGET INVARIANT — NOT YET ENFORCED]** Não há política formal de índice obrigatório em toda FK — algumas migrations adicionam índice explicitamente (`0075_add_missing_fk_indexes.sql` corrigiu um lote), mas não é uma checagem automatizada contínua.

## Security

- **[ENFORCED]** `SUPABASE_SERVICE_ROLE_KEY` só é usado via `createAdminClient()` server-side, nunca em código que roda no browser.
- **[ENFORCED]** Webhooks externos (Meta/WhatsApp, Meta/Instagram, Resend, Asaas) validam assinatura HMAC/criptográfica antes de processar payload, com fail-closed quando o secret de verificação não está configurado (ver `app/api/webhooks/whatsapp/route.ts`, `app/api/webhooks/instagram/route.ts` como referência).
- **[PARTIAL]** Validação de entrada com Zod existe em partes do código (webhooks, alguns formulários) mas não é universal em toda Server Action — `.agent.md` (documento herdado) afirma que é obrigatório em toda entrada externa; na prática isso é uma meta, não um fato confirmado em 100% do código. Trate como `TARGET` para actions que ainda não validam.
- **[ENFORCED]** Secrets nunca são commitados — `.env.local`/`.env` estão no `.gitignore`. Chaves coladas em chat/conversa são tratadas como potencialmente expostas.

## Storage

- **[ENFORCED]** Uploads de arquivo passam por Server Action usando `createAdminClient()` — o client nunca escreve direto no bucket com credencial própria.
- **[ENFORCED]** Buckets seguem o padrão: leitura pública (quando o conteúdo precisa ser servido pra fora, ex.: mídia de WhatsApp/Instagram), escrita restrita a service-role.
- **[TARGET INVARIANT — NOT YET ENFORCED]** Não há isolamento de path por organização verificado automaticamente em todo bucket — depende de cada Server Action montar o path com `org.id` corretamente (convenção, não uma constraint do bucket).

## AI

- **[ENFORCED]** Chave de IA é centralizada na plataforma (`getPlatformAiKey()`), não por-org — não reintroduza um campo de "API key da organização" para o Agente IA/qualificador sem decisão explícita (esse design existiu e foi removido).
- **[ENFORCED]** Consumo de IA é gated por `checkFeatureAccess()`/`consumeAiCredits()` (`lib/plans/server.ts`) ANTES da chamada à API — nunca depois.
- **[ENFORCED]** O motor de atendimento (`lib/ai/attendant-engine.ts`) é uma função pura, sem I/O de banco/tempo — quem resolve dados (config, horário comercial, histórico) é o caller. Não reintroduza chamadas de banco dentro do engine.
- **[TARGET INVARIANT — NOT YET ENFORCED]** Não há rate-limit específico contra abuso do Agente IA por conversa além do `max_replies_per_conversation` (teto de respostas, não de tempo/frequência).

## Inngest

- **[ENFORCED]** Toda function nova é registrada em `app/api/inngest/route.ts` (`functions: [...]`) — uma function não registrada ali nunca roda, mesmo que o arquivo exista.
- **[PARTIAL]** Idempotência é responsabilidade de cada function individualmente (padrão comum: checar `meta_message_id`/ID externo antes de processar) — não há um mecanismo genérico de dedupe no nível do Inngest client.
- **[TARGET INVARIANT — NOT YET ENFORCED]** Tratamento de erro/retry não é uniforme entre as 16 functions — algumas usam `retries` explícito na config, outras não declaram.

## UI

- **[ENFORCED]** Componentes shadcn/ui (`components/ui/`) não são editados manualmente — são a base gerada. Customização vai em `components/features/`.
- **[ENFORCED]** Cores usam variáveis de tema (`bg-background`, `bg-primary`, etc.), não hex hardcoded — exceção documentada: cores de marca de canal externo (verde do WhatsApp, azul do Instagram/Facebook).
- **[PARTIAL]** Mobile-first não é uniforme em toda tela — confirmado em telas públicas (formulários, landing, WhatsApp/Instagram mobile) mas não auditado tela a tela.

## Testing

- **[ENFORCED]** Testes unitários existem em `tests/unit/*.test.ts` (Vitest) para lógica pura (antispam, billing, currency, date-filter, webhooks, slugify).
- **[TARGET INVARIANT — NOT YET ENFORCED]** Não há testes de integração (contra Supabase real ou mockado) nem E2E — qualquer alegação em contrário (inclusive no `.agent.md` herdado, que menciona Playwright) está desatualizada.

## Deployment

- **[ENFORCED]** CI (`.github/workflows/ci.yml`) roda `tsc --noEmit` → `npm test` → `npm run build` em todo push/PR pra `master`. Um PR que quebra qualquer um desses três não deveria ser mergeado.
- **[ENFORCED]** Deploy de produção é via Vercel, região `gru1` (São Paulo).
- **[TARGET INVARIANT — NOT YET ENFORCED]** CI não roda o `scripts/verify.sh` do Harness — os dois evoluíram em paralelo; alinhar isso é um próximo passo natural (ver relatório final).
