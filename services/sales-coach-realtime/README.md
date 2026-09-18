# Sales Coach Realtime (Railway)

Serviço Node dedicado que sustenta o WebSocket persistente entre o browser
do vendedor e o ElevenLabs Scribe v2 Realtime — a peça de infra que o
Vercel/Next.js não consegue sustentar (função serverless não mantém socket
de longa duração). Faz parte do módulo **IA Sales Coach**
(`.harness/tasks/active/ia-sales-coach.md`, fatia 3).

Também sustenta a **chamada assistida** do Althos Voice (rotas
`/twilio-media` e `/assist-chat`, ver seção própria abaixo) — mesma peça de
infra, reaproveitada para um segundo caso de uso em vez de duplicar o
serviço.

## Fluxo

```
Browser (mic + aba mixados, PCM 16kHz base64)
  → wss://<este-serviço>/session?token=<token de sessão assinado>
  → ElevenLabs Scribe v2 Realtime (xi-api-key, só aqui — nunca no browser)
  → partial/committed transcripts
      → relay para o browser (latência baixa)
      → persistência de committed em `call_transcript_segments` (Supabase)
```

O `token` é emitido pelo Next.js (`app/api/sales-coach/realtime-token/route.ts`,
a implementar) — HMAC-SHA256 assinado com `SALES_COACH_REALTIME_SECRET`,
payload `{sessionId, organizationId, userId, exp}`, curta duração (~5 min).
Isso evita expor a `ELEVENLABS_API_KEY` e o `SUPABASE_SERVICE_ROLE_KEY` ao
browser — o browser só tem esse token escopado a UMA sessão.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PORT` | não (default 8080) | Porta HTTP/WS — Railway injeta automaticamente. |
| `SALES_COACH_REALTIME_SECRET` | sim | Segredo HMAC compartilhado com o Next.js (mesmo valor nos dois lados). Gerar com `openssl rand -hex 32`. Usado tanto pelo IA Sales Coach quanto pela chamada assistida do Voice (`signVoiceAssistRealtimeToken`, mesmo segredo). |
| `ELEVENLABS_API_KEY` | sim | Mesma chave já usada em `lib/ai/api-key.ts::getElevenLabsKey()` no repo principal — aqui é usada direto (server-to-server), sem precisar do single-use token de 15min documentado para uso client-side. |
| `SUPABASE_URL` | sim | URL do projeto Supabase (São Paulo, `boggtwpywbkpzkmvnbng`) — mesma do Next.js. |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | Service role key — bypassa RLS deliberadamente; toda query já filtra `organization_id` manualmente (ver `src/supabase.ts`). Nunca usar a chave publishable aqui. |
| `ANTHROPIC_API_KEY` | só p/ chamada assistida | Mesma chave central do repo principal (`getPlatformAiKey()`) — usada em `src/translate.ts` para traduzir a fala do fornecedor pro português. Sem ela, o serviço ainda funciona (IA Sales Coach intacto) mas a chamada assistida devolve o texto original sem tradução. |

## Chamada assistida (Althos Voice)

```
Twilio Media Stream (mulaw 8kHz, both_tracks)
  → wss://<este-serviço>/twilio-media?sessionId=...&token=...
  → decodifica mulaw→PCM16 16kHz (src/twilio-media-adapter.ts)
  → 2 conexões ElevenLabs Scribe (uma por perna: agente pt-BR, fornecedor no idioma-alvo)
  → fala do fornecedor: traduzida (src/translate.ts, Claude Haiku) + persistida
  → fala do agente: persistida sem tradução
  → ambas relayed em tempo real para
      wss://<este-serviço>/assist-chat?sessionId=...&token=...  (painel no CRM)
```

A Twilio conecta em `/twilio-media` sozinha (anexada à chamada via
`lib/voice/providers/twilio.ts::startMediaStream`, subrecurso REST
`calls(sid).streams.create` — não interrompe o `<Dial><Client>` já em
andamento). O browser do vendedor conecta em `/assist-chat` para ver a
transcrição em tempo real e mandar orientação de texto (sem síntese de voz
de volta pra ligação — decisão de produto, só chat). Ver
`actions/voice-assisted.ts` no repo principal para o fluxo completo de
início/fim de sessão.

**Assunção a validar no primeiro teste real**: qual track (`inbound`/
`outbound`) da Twilio corresponde à voz do fornecedor vs. do agente —
documentado como comentário em `src/server.ts`, mas só confirmável numa
ligação de teste de verdade.

## Deploy no Railway

1. Criar um novo serviço no projeto Railway a partir deste diretório
   (`services/sales-coach-realtime/`) — Railway detecta o `Dockerfile`
   automaticamente, ou configurar build via Nixpacks apontando
   `rootDirectory: services/sales-coach-realtime`.
2. Configurar as 5 variáveis de ambiente acima no serviço.
3. Expor a porta pública (Railway gera um domínio HTTPS/WSS automaticamente
   — o client conecta em `wss://<domínio-railway>/session?token=...`).
4. Guardar a URL pública gerada — o Next.js precisa dela
   (`SALES_COACH_REALTIME_URL`, env var a adicionar em `.env.example` e na
   Vercel) para montar a URL de conexão que devolve ao browser junto com o
   token.
5. Health check: `GET /health` retorna `{"ok": true}` — configurar como
   healthcheck path do serviço Railway.

## O que este serviço NÃO faz (fora de escopo desta fatia)

- Não roda o Sales Context Engine / Sales Intelligence Engine (isso é
  server-side no Next.js, consumindo `call_transcript_segments` via
  Supabase Realtime ou polling curto — fatia 4/5).
- Não grava áudio (decisão do produto: só transcrição, ver spec § 38).
- Não gera keyterms por organização ainda (`connect({keyterms: []})` —
  fatia futura: buscar produtos/concorrentes da org antes de conectar).
- Não lida com múltiplos idiomas dinamicamente (`languageCode: 'pt'` fixo).

## Desenvolvimento local

```bash
cd services/sales-coach-realtime
npm install
cp .env.example .env   # preencher as 5 variáveis acima
npm run dev
```
