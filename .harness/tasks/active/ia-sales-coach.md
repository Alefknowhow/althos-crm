# IA Sales Coach

- **Status**: active
- **Criado em**: 2026-09-17
- **Responsável**: Claude (Claude Code)

## Objective
Novo módulo "IA Sales Coach": copiloto comercial que acompanha reuniões de vendas (Meet/Zoom/Teams) em tempo real, transcreve via ElevenLabs Scribe v2 Realtime, mantém um Sales Context Engine incremental, gera eventos comerciais (dores/objeções/buying signals) e Next Best Action ao vendedor, e após a call produz resumo/coaching/atualizações sugeridas de CRM. Pedido original do usuário tem 49 seções — grande demais para uma sessão só. Ver spec completa na mensagem do usuário desta sessão (2026-09-17).

## Context
Pedido direto do usuário: "AI Sales Coaching + Conversation Intelligence + Revenue Intelligence Engine integrado nativamente ao Althos CRM". Antes de codar, rodamos discovery completo do código real (ver Notes) e pesquisa externa da API ElevenLabs Scribe v2 Realtime + viabilidade de captura de áudio remoto via browser (`getDisplayMedia`). Usuário aprovou explicitamente, via AskUserQuestion: (1) provisionar serviço Railway novo para sustentar o WebSocket realtime com ElevenLabs (Vercel serverless não sustenta socket persistente — mesmo gap já documentado para Voice AI e nunca resolvido); (2) NÃO gravar áudio por padrão, só transcrição.

## Scope
**Dentro do escopo (MVP Fase 1, dividido em fatias — ver Notes):**
- Schema (`sales_coach_sessions`, `call_transcript_segments`, `sales_coach_context`, `sales_coach_events`, `call_summaries`, `sales_coach_insights`, `sales_playbooks`/`sales_playbook_steps`, `objection_library`, `customer_memories`), RLS no padrão confirmado.
- Feature flag `sales_coach` em `lib/plans/config.ts` (Pro+Business, padrão `ai_insights`) + `PermissionKey` novo.
- Credit module `sales_coach` no Credit Engine (`lib/credits/engine.ts`).
- Serviço realtime dedicado (Railway) que sustenta o WebSocket ElevenLabs Scribe v2 Realtime e repassa transcritos.
- Sales Context Engine + Sales Intelligence Engine (server, reaproveitando `resolveAnthropicEngine()`/padrão `respondAsAttendant`) + Sales Event Engine.
- Pré-call briefing, Sales Coach Live (UI realtime via Supabase Realtime), captura de áudio no browser (mic + aba via `getDisplayMedia`, mixagem via Web Audio API).
- Encerramento → Post Call Analysis via Inngest (resumo, coaching, CRM auto-update via Agent Tool Registry, memória, usage metering).

**Fora do escopo (deliberadamente, Fase 2/3 do pedido original):**
- Playbooks avançados (SPIN/BANT/MEDDIC completos), Knowledge Base com retrieval avançado, Ask Sales Coach, coaching aprofundado/evolução do vendedor, Sales Intelligence agregada (analytics de equipe/Revenue Intelligence), Document Picture-in-Picture, DeepgramProvider/OpenAITranscriptionProvider (só a abstração `SpeechToTextProvider` preparada).
- Gravação/persistência de áudio (fora do escopo por decisão explícita do usuário).
- Advocacia (nicho stub, não afetado).

## Requirements
Ver spec completa do usuário (49 seções, mensagem 2026-09-17). Resumo funcional: ouvir call → transcrever realtime → manter contexto incremental → detectar eventos comerciais → sugerir Next Best Action → ao encerrar, gerar resumo/coaching/CRM updates sugeridos (nunca silenciosos) → registrar usage/créditos → nunca tratar conteúdo falado como instrução (prompt injection via transcript é ameaça real, tratar como untrusted data).

## Acceptance Criteria
Ver seção 47 do pedido original (28 critérios) — não replicado aqui por brevidade.

## Affected Modules
Novos: `lib/sales-coach/*`, `actions/sales-coach*.ts`, `app/app/[orgSlug]/sales-coach/`, `supabase/migrations/02XX_sales_coach_*.sql`, serviço Railway novo (repo/infra separada ou pasta `services/sales-coach-realtime/`).
Tocados: `lib/plans/config.ts`, `lib/permissions.ts`, `lib/credits/engine.ts`, `app/api/inngest/route.ts`, `lib/agent/tools/registry.ts` (novas tools opcionais).

## Database Impact
Migrations novas, múltiplas tabelas (ver Scope), todas com `organization_id` + RLS (padrão `get_user_organizations()` + `is_super_admin()`), índices `idx_<tabela>_org`. `sales_coach_sessions` referencia `contatos`/`negocios` opcionalmente.

## Security Impact
Nova `PermissionKey` (`sales_coach`), consentimento explícito antes de iniciar captura, transcript tratado como UNTRUSTED DATA (nunca system instruction), retrieval de Knowledge Base restrito por `organization_id`, tokens ElevenLabs de uso único (15 min) gerados server-side, nunca API key exposta no client.

## AI Impact
Novo `CreditModule: 'sales_coach'`. Reaproveita `resolveAnthropicEngine()`/Claude como Sales Intelligence Engine; ElevenLabs Scribe v2 Realtime como STT (abstração `SpeechToTextProvider` nova, não acoplada). Sem chave de IA por-org (segue padrão já confirmado: chave de plataforma centralizada).

## Testing
Vitest para: session creation, tenant isolation, event extraction/dedup, context update, idempotência de créditos, mocks de ElevenLabs (sem depender de API real). Sem E2E configurado no projeto — verificação funcional real via preview manual do spike de áudio.

## Risks
- Maior risco técnico: infra realtime nova (Railway) — operação/custo/deploy fora do padrão Vercel do resto do app.
- `getDisplayMedia` exige o vendedor selecionar manualmente a aba a cada sessão (sem pré-seleção programática) — UX precisa orientar isso claramente (Etapa 2 do fluxo de início).
- Reunião longa / reconexão de WebSocket — tratar sem perder a sessão.

## Verification
Preencher ao final de cada fatia implementada (ver Notes) — não mover para completed até MVP Fase 1 completo e `scripts/verify.sh` rodado.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | pendente |
| `npm test` | pendente |
| `npm run build` | pendente |
| Verificação manual/preview | pendente |

## Notes
**Discovery já feito nesta sessão (não repetir):**
- Não existe `AIProvider` genérico — padrão real é `resolveAnthropicEngine()` (`lib/ai/api-key.ts`) + `respondAsAttendant()` (`lib/ai/attendant-engine.ts`, pure function, tool-calling loop, já reaproveitada por WhatsApp e Voice AI).
- STT existente (`lib/ai/speech-to-text.ts`) é REST/batch (`scribe_v1`), não realtime — não reaproveitável para o Sales Coach Live, só como fallback/análogo.
- Não há Supabase Realtime em uso hoje em produção (confirmado, `lib/health/checks.ts:107`) nem WebSocket persistente — gap idêntico ao documentado (não resolvido) em `lib/voice/ai-conversation.ts:8-17` para Voice AI.
- Billing: usar exclusivamente taxonomia nova por-conta (`lib/plans/config.ts` `FeatureKey` + `checkFeatureAccess`/`checkFeatureAccessByOrgSlug`), Pro+Business (padrão `ai_insights`, não o de `voice` que é só Business). Créditos via `consumeCredits()` (`lib/credits/engine.ts`) com `module: 'sales_coach'` novo + `buildCreditIdempotencyKey`.
- Padrão de migration/RLS confirmado em `supabase/migrations/0233_voice_intelligence.sql` — replicar exatamente essa estrutura.
- Inngest: padrão de function em `lib/inngest/voice-intelligence.ts` (step.run + upsert onConflict + encadeamento via eventos) é o melhor análogo para Post Call Processing.
- `lib/storage/index.ts` (`StorageService`) só seria necessário se decidirmos gravar áudio — decisão do usuário foi NÃO gravar no MVP.
- `lib/agent/tools/registry.ts` reaproveitável para CRM auto-update (Next Best Action executando ações via tools existentes em vez de reimplementar).
- Timeline = tabela `contato_activities`; pipeline = `negocios`/`pipeline_stages`; tarefas em `actions/tasks-crud.ts`.
- ElevenLabs Scribe v2 Realtime (pesquisa externa, 2026-09-17): WebSocket, autenticação via `xi-api-key` ou token de uso único (`elevenlabs.tokens.singleUse.create`, expira 15min — gerar server-side, nunca client). Mensagens: `input_audio_chunk` (client→server, base64, `commit` flag), `partial_transcript`/`committed_transcript`/`committed_transcript_with_timestamps` (com `speaker_id`)/`committed_transcript_entities` (server→client). Suporta `keyterms` (array de strings, contextual biasing), VAD (`vad_threshold`, `vad_silence_threshold_secs`, `commit_strategy: manual|vad`). Idiomas: não há lista explícita de PT-BR na doc pública, validar em spike técnico antes de assumir suporte pleno. Erros: `auth_error`, `quota_exceeded`, `rate_limited`, `session_time_limit_exceeded`, etc.
- Captura de áudio (pesquisa externa): `getDisplayMedia({audio:true})` funciona em web app comum (sem extensão Chrome), mas usuário deve escolher a aba manualmente a cada sessão (sem pré-seleção programática); captura da aba silencia a reprodução local dessa aba (efeito colateral esperado). Mixagem mic+aba via `AudioContext`/`MediaStreamAudioDestinationNode`.

**Fatia 3 — infra de websocket realtime (IMPLEMENTADA nesta sessão, 2026-09-17):**
- Migration `0253_sales_coach_realtime_core.sql` aplicada no projeto Supabase
  São Paulo (`boggtwpywbkpzkmvnbng`): `sales_coach_sessions` +
  `call_transcript_segments`, RLS no padrão confirmado
  (`get_user_organizations()` + `is_super_admin()`).
- `FeatureKey` novo `sales_coach` em `lib/plans/config.ts` (Pro+Business,
  padrão `ai_insights`) — refletido em `plans.features` no banco via SQL
  direto (`UPDATE plans SET features = features || ...`).
- `PermissionKey` novo `sales_coach` em `lib/permissions.ts` (seção
  Comunicação, default `false` para member — mesmo padrão de `voice`).
- `CreditModule` novo `sales_coach` em `lib/credits/engine.ts` (sem CHECK
  constraint no banco pra essa coluna — confirmado via `pg_constraint`
  antes de adicionar).
- Serviço novo `services/sales-coach-realtime/` (Node/TS standalone, fora do
  monorepo Next.js, deploy-alvo Railway): `src/server.ts` (WebSocketServer +
  health check HTTP), `src/speech-to-text-provider.ts` (abstração
  `SpeechToTextProvider`/`SpeechToTextConnection` + `ElevenLabsRealtimeProvider`
  — conecta em `wss://api.elevenlabs.io/v1/speech-to-text/realtime` com
  `xi-api-key` direto no header, já que roda 100% server-side, sem precisar
  do single-use token de 15min documentado só para uso client-side),
  `src/session-token.ts` (verifica HMAC-SHA256), `src/supabase.ts` (admin
  client, toda query filtra `organization_id` manualmente). Dockerfile +
  README com passo a passo de deploy Railway + tabela de env vars.
- `lib/sales-coach/realtime-token.ts` (Next.js) assina o mesmo formato de
  token (par com `session-token.ts` do serviço).
- `app/api/sales-coach/realtime-token/route.ts`: Route Handler que
  autentica (`requireAuth`/`getCurrentOrganization`), gateia por feature
  (`checkFeatureAccess`) e permissão (`checkMemberPermission`), cria a
  linha `sales_coach_sessions` (status `pending`) e devolve
  `{sessionId, token, wsUrl}`.
- Env vars novas documentadas em `.env.example`:
  `SALES_COACH_REALTIME_SECRET`, `SALES_COACH_REALTIME_URL`.
- **Verificado nesta sessão** (smoke-test manual, servidor local):
  `GET /health` → `200 {"ok":true}`; conexão com token inválido → fecha
  `4401 invalid_or_expired_token`; conexão com token assinado corretamente
  mas sessão inexistente/Supabase inacessível → fecha
  `4404 session_not_found_or_finished` sem derrubar o processo (erro
  tratado, não lançado). `npx tsc --noEmit` no serviço: PASS (isolado, tem
  seu próprio `tsconfig.json`). No monorepo principal: `npx tsc --noEmit`
  PASS (só resta 1 erro pré-existente e não relacionado em
  `lib/ai/speech-to-text.ts`, de sessão anterior, não tocado aqui);
  `npm test` PASS (176/176).
- **NÃO verificado ainda** (fica para a fatia 1/próxima sessão): conexão
  real com a API da ElevenLabs (precisa de `ELEVENLABS_API_KEY` real e
  áudio de verdade); deploy real no Railway (só o Dockerfile/README foram
  preparados, nada foi de fato provisionado); captura de áudio no browser
  (mic+aba via `getDisplayMedia`) — o client browser que fala com este
  serviço ainda não foi construído.

**Fatia 1 — spike técnico de browser (IMPLEMENTADA nesta sessão, 2026-09-17,
parcialmente — falta o teste com ElevenLabs/Railway reais):**
- `lib/sales-coach/browser-audio.ts`: `startMixedAudioCapture()` — mic
  (`getUserMedia`) + aba da call (`getDisplayMedia({video:true,audio:true})`,
  vídeo descartado logo após o grant) mixados via `AudioContext({sampleRate:16000})`
  + `ScriptProcessorNode` (deprecado mas universal — trocar por
  `AudioWorklet` é melhoria futura, não bloqueia), convertido para PCM16 e
  entregue em base64 por chunk. `AudioCaptureError` tipado por motivo
  (`mic_denied`/`display_denied`/`no_remote_audio`/`unsupported`) — erros
  amigáveis em vez de exception genérica.
- `components/features/sales-coach/SalesCoachLiveSpike.tsx` (client): botão
  Iniciar/Encerrar, busca token via `/api/sales-coach/realtime-token`,
  abre o WebSocket, envia chunks de áudio, renderiza transcript
  parcial (itálico, substituído a cada evento — não acumula) vs. final.
  Ainda não é o Sales Coach Live da spec (§20/21) — sem contexto comercial,
  eventos, Next Best Action, briefing.
- `components/features/sales-coach/SalesCoachPaywall.tsx` (mesmo padrão do
  `VoicePaywall.tsx`) + `app/app/[orgSlug]/sales-coach/page.tsx` (Server
  Component, gateia por `checkFeatureAccessByOrgSlug('sales_coach')` E
  `checkMemberPermission(..., 'sales_coach')` antes de renderizar o spike).
- **Verificado nesta sessão**: `npx tsc --noEmit` PASS (0 erros, monorepo
  inteiro); `npm test` PASS (176/176); ESLint nos arquivos novos — só
  warnings (complexity/max-statements/max-lines-per-function, mesmas
  categorias já toleradas em outras partes do projeto, 0 erros);
  `npm run build` (com `NODE_OPTIONS=--max-old-space-size=8192`, necessário
  nesta máquina) — typecheck de produção completo PASS, todas as 102
  páginas geradas; os 2 erros de pré-renderização (`/login`, `/`) são de
  imagens públicas já deletadas por outra sessão em paralelo
  (`public/home/*.png`), não relacionados a esta tarefa. Dev server subiu,
  middleware bloqueou acesso não-autenticado à rota nova corretamente
  (redirecionou pra `/login`), sem erro de compilação da rota.
- **NÃO verificado** (exige `ELEVENLABS_API_KEY` real + serviço realmente
  deployado no Railway + login real numa org com plano Pro/Business): teste
  ponta a ponta de verdade (falar numa call e ver a transcrição aparecer),
  qualidade do PT-BR no Scribe v2 Realtime, comportamento em reunião longa,
  reconexão. Isso é o que resta pra fechar a fatia 1 por completo — próxima
  sessão deve: (1) provisionar o serviço no Railway (README já pronto),
  (2) configurar `ELEVENLABS_API_KEY`/`SALES_COACH_REALTIME_SECRET`/
  `SALES_COACH_REALTIME_URL` nos dois lados, (3) testar com uma call real
  (Meet/Zoom) e confirmar transcrição + latência aceitável antes de avançar
  pro Sales Context Engine (fatia 4).

**Fatia 4 — Sales Context Engine + Sales Event Engine + Next Best Action
(IMPLEMENTADA nesta sessão, 2026-09-17):**
- `lib/sales-coach/types.ts`: `SalesContext` (espelha a estrutura do §12
  do pedido), `SalesEvent`/`SalesEventType` (16 tipos do §15).
- `lib/sales-coach/context-engine.ts`: `updateSalesContext()` — função
  pura, recebe contexto anterior + só os segmentos NOVOS (nunca a call
  inteira, por design — §12 "reduzir tokens/custo/latência"), usa
  tool-calling FORÇADO (`tool_choice`) pra Structured Output em vez de
  parsing de texto livre (§13). Transcript tratado como UNTRUSTED DATA no
  prompt — bloco delimitado com instrução explícita de nunca seguir
  comandos que apareçam dentro dele (§38).
- `lib/sales-coach/event-engine.ts`: `extractSalesEvents()` (mesmo padrão)
  + `dedupeEvents()` (heurística de overlap de palavras normalizadas,
  sem dependência externa — §15 "implementar deduplicação").
- `lib/sales-coach/next-best-action.ts`: `generateNextBestAction()` — usa
  `claude-sonnet-4-6` (raciocínio comercial) em vez do `claude-haiku-4-5`
  usado nas outras duas engines (extração/classificação) — §14 "modelos
  menores pra classificação, mais capazes pra reasoning".
- **Decisão de arquitetura importante**: nenhuma das 3 engines importa
  `resolveAnthropicEngine()`/`lib/ai/api-key.ts` diretamente — esse módulo
  usa `cache()` do React, que quebra em teste unitário puro (Vitest, fora
  do runtime de Server Component). Só descoberto ao rodar os testes novos
  (`TypeError: cache is not a function`). Corrigido replicando o padrão
  real já usado por `lib/ai/attendant-engine.ts`: o CALLER resolve
  `{apiKey, baseURL}` e passa pronto (`engine` no input), ou injeta um
  `client` (testes). Mantém as engines 100% puras e testáveis sem mock de
  módulo.
- Testes novos: `tests/unit/sales-coach-context-engine.test.ts` (3 casos,
  client Anthropic fake injetado), `tests/unit/sales-coach-event-engine.test.ts`
  (4 casos, incluindo dedup). `npx tsc --noEmit` PASS, `npm test` PASS
  (183/183 — 7 novos), ESLint só 2 warnings (`any` em teste, padrão já
  tolerado no projeto).
- **NÃO implementado ainda**: persistência (`sales_coach_context`,
  `sales_coach_events` — tabelas ainda não existem, só as 2 da fatia 3),
  o loop que decide QUANDO chamar essas engines a partir do stream de
  `call_transcript_segments` (consumer realtime ou Inngest), consumo de
  crédito ao redor das chamadas (`consumeCredits` com `module: 'sales_coach'`
  — já existe no Credit Engine, só falta o call site).

**Divisão em fatias — estado ao final desta sessão (2026-09-17):**
1. ~~Spike técnico isolado~~ **código pronto nesta sessão** — falta só
   validar ponta a ponta de verdade: usuário confirmou ElevenLabs key já
   configurada (não localmente disponível pra este agente — provavelmente
   só na Vercel), Railway sobe amanhã. Sem os dois no ar simultaneamente,
   não dá pra provar o fluxo completo ainda.
2. Schema — `sales_coach_context` + `sales_coach_events` **feito nesta
   sessão** (migration `0257_sales_coach_context_events.sql`, aplicada).
   **AINDA PENDENTE**: `call_summaries`, `sales_coach_insights`,
   `sales_playbooks`/`sales_playbook_steps`, `objection_library`,
   `customer_memories` — ficam pra fatia 6 (Post Call Analysis/coaching),
   quando o formato de resumo/coaching estiver definido. Nenhuma função
   de leitura/escrita para `sales_coach_context`/`sales_coach_events` foi
   escrita ainda (as engines da fatia 4 são puras, sem I/O) — isso é
   trabalho do consumer da fatia 5.
3. ~~Serviço Railway (esqueleto)~~ **feito** — falta só o deploy real
   (amanhã, por conta do usuário) + configurar as env vars no serviço
   (`SALES_COACH_REALTIME_SECRET` já gerado e salvo em `.env.local`, mesmo
   valor precisa ir pro Railway) + `SALES_COACH_REALTIME_URL` na Vercel
   apontando pra URL que o Railway gerar.
4. ~~Sales Context Engine + Sales Event Engine~~ **feito nesta sessão**
   (+ Next Best Action, adiantado da fatia 5) — ver acima. Falta o
   consumer que liga isso ao stream real de transcrição (próximo item).
5. Sales Coach Live UI (realtime via Supabase Realtime subscription) +
   Pré-call briefing + o consumer que decide QUANDO chamar as engines a
   partir de `call_transcript_segments` (por utterance final, não por
   partial — §14) e debita crédito antes de cada chamada.
6. Encerramento + Post Call Analysis (Inngest) + CRM auto-update (via
   Agent Tool Registry) + memória (`customer_memories`) + usage metering.
7. Harness/handoff/docs final + `scripts/verify.sh` completo.

**Bloqueio real para fechar a fatia 1**: precisa do Railway no ar (amanhã)
E de rodar com a `ELEVENLABS_API_KEY` de produção simultaneamente — só
então dá pra testar uma call de verdade e confirmar qualidade do PT-BR,
latência e reconexão. Até lá, a próxima sessão pode avançar na fatia 2
(schema) e no consumer da fatia 5, que não dependem de nenhum dos dois.

**Atualização — Railway deployado (mesma sessão, 2026-09-17, mais cedo do
que o previsto):**
- Projeto Railway `althos-sales-coach-realtime` criado via CLI (`npx
  @railway/cli`, login browserless — usuário autenticou no navegador).
  Precisou de um plano pago (trial da conta Railway tinha expirado —
  usuário resolveu antes de eu tentar de novo).
- Serviço deployado a partir de `services/sales-coach-realtime/`
  (`railway up`), domínio público gerado:
  `https://althos-sales-coach-realtime-production.up.railway.app`.
- **Env vars do serviço**: configuradas MANUALMENTE pelo usuário no
  dashboard Railway (`ELEVENLABS_API_KEY`, `SALES_COACH_REALTIME_SECRET`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) — o auto mode classifier
  bloqueou `railway variables --set` (e até `--help`) rodado por mim por
  envolver segredos via CLI; não tentei contornar, expliquei a restrição e
  o usuário configurou pelo dashboard.
- **Verificado contra o serviço real (não mockado)**: `GET /health` → `200
  {"ok":true}`; `wss://.../session?token=invalid` → fecha `4401
  invalid_or_expired_token` (mesmo comportamento validado localmente antes,
  agora confirmado em produção); `railway logs` mostra o processo subindo
  limpo (`[sales-coach-realtime] ouvindo na porta 8080`), sem erro de boot.
- `.env.local` (dev local) atualizado: `SALES_COACH_REALTIME_URL` trocado
  de `ws://localhost:8080` pra `wss://althos-sales-coach-realtime-production.up.railway.app`.
- **PENDENTE, fica com o usuário**: configurar as mesmas 2 variáveis
  (`SALES_COACH_REALTIME_SECRET`, `SALES_COACH_REALTIME_URL`) no
  Environment Variables da Vercel (produção do Next.js) + redeploy — sem
  isso, a Route Handler `/api/sales-coach/realtime-token` em produção não
  consegue emitir token válido. Eu não tenho tool de escrita de env var da
  Vercel disponível (só leitura/deploy/logs) e não devo passar segredo via
  CLI sem aprovação explícita por item, então deixei como instrução pro
  usuário.
- **AINDA NÃO testado**: uma call real ponta a ponta (áudio do navegador →
  Railway → ElevenLabs → transcrição de volta) — só a rejeição de token
  inválido foi validada contra o serviço real. Esse é o próximo teste
  natural, e pode ser feito a qualquer momento agora que a infra está no
  ar (não depende mais de "amanhã").
