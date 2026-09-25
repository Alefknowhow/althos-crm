# Auditoria — Compute/Bundle das Page Functions (Issue #12)

> Escopo: causa do bundle compartilhado de ~7,83 MB em praticamente todas as ~135 Page Functions (achado prioritário da issue #12), mais um levantamento pontual de queries redundantes no caminho crítico (layout autenticado). Não cobre N+1/queries por módulo de negócio — isso já está em `docs/audit/2026-09-performance-bugs.md`.
>
> Metodologia: leitura direta de `app/app/[orgSlug]/layout.tsx`, `lib/supabase/server.ts`/`types.ts`, dos barrels `actions/voice.ts`/`actions/storage.ts` e da cadeia de imports até os SDKs pesados, mais `du -sh`/`grep -rl` em `node_modules` pra confirmar peso e nº de pontos de uso direto.

## Resumo executivo

O bundle de ~7,83 MB replicado em quase todas as Page Functions vem de um único ponto: **`app/app/[orgSlug]/layout.tsx`** — o único layout do CRM autenticado (não há layout intermediário entre ele e as ~135 páginas de `app/app/[orgSlug]/**`, então tudo que ele importa entra no bundle de toda página). Esse layout monta incondicionalmente os providers de Voice (`CallDialerProvider`, `SmsComposeProvider`, `ActiveCallProvider`) e chama a action de Storage (`getObjectSignedUrl`, pro avatar do header) — e como esses símbolos são importados via **barrel** (`actions/voice.ts`, `actions/storage.ts`) em vez do módulo específico, o bundler inclui os SDKs inteiros de Twilio, Anthropic e AWS no grafo de módulos de toda página, mesmo em orgs/páginas que nunca usam voz, IA de voz ou upload.

Não é "SDK usado em todo lugar" — o número de arquivos que importam cada SDK diretamente é baixo (Twilio: 5, AWS SDK: 2, Anthropic: 19 majoritariamente concentrados em `lib/ai/*`/`lib/voice/*`). O problema é que esses poucos pontos são alcançáveis a partir do layout compartilhado por causa da cadeia barrel → provider sempre montado.

## 1. Cadeia de imports até os SDKs pesados

`app/app/[orgSlug]/layout.tsx` importa:
```ts
import { getObjectSignedUrl } from '@/actions/storage'
import { CallDialerProvider } from '@/components/features/voice/CallDialerModal'
import { SmsComposeProvider } from '@/components/features/voice/SmsComposeModal'
import { ActiveCallProvider } from '@/components/features/voice/ActiveCallProvider'
import { ActiveCallBar } from '@/components/features/voice/ActiveCallBar'
```

`CallDialerModal.tsx` faz `import { listOrgNumbers, listVoiceAgents, startCall } from '@/actions/voice'` — o **barrel inteiro**:
```ts
// actions/voice.ts
export * from './voice-calls'
export * from './voice-numbers'
export * from './voice-credits'
export * from './voice-token'
export * from './voice-settings'
export * from './voice-sms'
export * from './voice-agents'
export * from './voice-call-detail'
export * from './voice-team'
export * from './voice-analytics'
export * from './voice-assisted'
```
- `voice-settings.ts` → `TwilioVoiceProvider` (`lib/voice/providers/twilio.ts` → `import twilio from 'twilio'`, **21 MB** em `node_modules`)
- `voice-numbers.ts`/`voice-token.ts`/`voice-sms.ts`/`voice-assisted.ts` → `getVoiceProvider()` (`lib/voice/get-provider.ts`) → também Twilio
- `voice-agents.ts` → `lib/voice/ai-tools.ts` → `import Anthropic from '@anthropic-ai/sdk'` (**6,7 MB**) — o SDK de IA entra pelo módulo de voz, não só pelo Copiloto

`actions/storage.ts` (barrel) → `storage-read.ts`/`storage-upload.ts` → `lib/storage/index.ts` (`StorageService`) importa **ambos** os providers incondicionalmente, inclusive quando só R2 está configurado:
```ts
import { r2Provider, isR2Configured } from './providers/r2'
import { supabaseProvider } from './providers/supabase'
```
`lib/storage/providers/r2.ts` → `@aws-sdk/s3-request-presigner` (parte dos **13 MB** do `@aws-sdk` instalado). Puxado incondicionalmente porque `OrgLayout` chama `getObjectSignedUrl` sempre, pro avatar do header.

**`lib/supabase/server.ts`/`types.ts` estão limpos** — `requireAuth()`/`getCurrentOrganization()` não puxam `lib/ai/*`, `lib/voice/*` nem `lib/storage/*`. O caminho pesado entra só pelo layout, não pelo client Supabase.

## 2. Tamanho dos SDKs e nº de pontos de uso direto

```
6.7M  node_modules/@anthropic-ai
17M   node_modules/@google/genai
13M   node_modules/@aws-sdk
21M   node_modules/twilio
```
(`googleapis` não está instalado.)

| SDK | arquivos que importam direto |
|---|---|
| `@anthropic-ai/sdk` | 19 |
| `@google/genai` | 7 |
| `@aws-sdk/*` | 2 |
| `twilio` | 5 |

## 3. Config do Next ausente

`next.config.mjs` não tinha `experimental.serverComponentsExternalPackages` (Next 14.2.35 — nome ainda em `experimental`, não o `serverExternalPackages` top-level de versões mais novas), nem `optimizePackageImports`, nem bundle analyzer configurado.

## 4. Queries redundantes no caminho crítico (`OrgLayout`)

1. **`getAccountIdForOrgSlug(orgSlug)`** refazia `select('account_id') from organizations where slug=...` quando `org` (de `getCurrentOrganization`, que já faz `select('*')`) já trazia `account_id` — mesma tabela, mesma chave, round-trip evitável.
2. **Query de `memberships` (role/permissions)** rodava separadamente no layout **e** na Sidebar pro mesmo `(org.id, user.id)` na mesma renderização, sem `React.cache()` (diferente de `getUser`/`getCurrentOrganization`, que já usam).
3. **`checkFeatureAccess`** (RPC `account_has_feature`) roda sem cache por request — não corrigido nesta rodada (fica pra issue #13, junto com uma estratégia de cache mais longa já que o gate de plano não muda a cada navegação).

## Correções aplicadas nesta auditoria (baixo risco, sem mudança de comportamento)

- [x] `next.config.mjs`: `experimental.serverComponentsExternalPackages: ['twilio', '@aws-sdk/s3-request-presigner', '@anthropic-ai/sdk', '@google/genai']` — trata esses SDKs como dependência externa do runtime Node em vez de inline-ar no bundle da função. Reduz o tamanho **reportado** pela Vercel sem mudar o runtime (mesmo Node.js na Vercel).
- [x] `app/app/[orgSlug]/layout.tsx`: reaproveita `org.account_id` (já vindo de `getCurrentOrganization`) em vez de rebuscar via `getAccountIdForOrgSlug`.
- [x] `lib/permissions.server.ts`: novo `getMembershipRolePermissions(orgId, userId)`, memoizado com `React.cache()` — usado agora tanto pelo layout quanto pela Sidebar, colapsando a query duplicada de `memberships` em 1 por request.

## Recomendações para a issue #13 (não implementadas aqui — mudam comportamento de carregamento, exigem teste mais cuidadoso)

1. **Quebrar a cadeia estática barrel → SDK**: trocar `import { listOrgNumbers, listVoiceAgents, startCall } from '@/actions/voice'` (barrel inteiro) por imports diretos dos módulos específicos, ou fazer lazy-load dos providers de voz (`CallDialerProvider`/`SmsComposeProvider`/`ActiveCallProvider`) com `next/dynamic` — eles já são gated por `canUseVoice` em runtime, então o carregamento sob demanda não muda comportamento pra quem tem a permissão, só adia o carregamento do módulo pra quem não tem.
2. Mesma ideia para `getObjectSignedUrl` (avatar) — resolver via client component com fetch próprio, ou pelo menos isolar `lib/storage/index.ts` pra não importar os dois providers sempre (só o configurado).
3. Adicionar `@next/bundle-analyzer` (mesmo que só local/CI) pra validar o antes/depois com números reais por página, não só pela estimativa do dashboard da Vercel.
4. Envolver `checkFeatureAccess` em cache por request (e avaliar `unstable_cache` com TTL curto, já que o gate de plano não muda a cada navegação).
5. Confirmar o ganho real do item 1 do baseline dado no corpo da issue (230 Functions, ~7,83 MB×135) comparando antes/depois de um deploy com as mudanças acima.

## Arquivos-chave

`app/app/[orgSlug]/layout.tsx`, `components/features/Sidebar.tsx`, `lib/permissions.server.ts`, `lib/plans/server.ts`, `actions/voice.ts` (barrel) + `actions/voice-settings.ts`/`voice-numbers.ts`/`voice-token.ts`/`voice-sms.ts`/`voice-agents.ts`/`voice-assisted.ts`, `lib/voice/get-provider.ts`, `lib/voice/providers/twilio.ts`, `lib/voice/ai-tools.ts`, `actions/storage.ts` (barrel) + `actions/storage-read.ts`/`storage-upload.ts`, `lib/storage/index.ts`, `lib/storage/providers/r2.ts`, `components/features/voice/CallDialerModal.tsx`/`SmsComposeModal.tsx`/`ActiveCallProvider.tsx`, `next.config.mjs`.
