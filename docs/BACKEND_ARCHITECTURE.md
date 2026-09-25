# Arquitetura de backend — Vercel × Railway × Inngest

> Issue #13. Mapa de responsabilidades reais (não idealizadas) entre as três plataformas de execução do Althos CRM, produzido a partir do diagnóstico de compute da issue #12 (`docs/audit/2026-09-compute-bundle-issue-12.md`) e de leitura direta dos webhooks/Inngest functions existentes. Quando este arquivo conflitar com o código, o código vence — atualize aqui quando descobrir a diferença.

## Resumo executivo

A separação de responsabilidades que a issue #13 pede **já existe na prática para o fluxo mais crítico** (WhatsApp): o webhook na Vercel só valida assinatura, resolve a org e enfileira no Inngest — todo o trabalho pesado (resolver conversa/lead, atribuição CTWA, baixar mídia, IA) roda em `lib/inngest/whatsapp-ingest.ts` e `lib/inngest/whatsapp-inbound.ts`. Não foi uma migração pendente; já foi feita. O que falta é (1) documentar isso formalmente (este arquivo), (2) auditar os fluxos que ainda não seguem esse padrão, e (3) decidir, com dados reais (não suposição), o que efetivamente precisa sair da Vercel para Railway.

## 1. Vercel — o que roda aqui hoje

- Next.js App Router completo (UI, Server Components, Server Actions).
- Webhooks — recepção e validação de assinatura (`app/api/webhooks/{whatsapp,instagram,asaas,autentique,resend,voice}/route.ts`).
- `app/api/inngest/route.ts` — o **handler HTTP** que o Inngest chama de volta pra executar cada step (a orquestração/estado vive no Inngest, mas o código roda como função serverless da Vercel — ver seção 3).
- `app/api/mcp/route.ts` — servidor MCP (Agent Layer) pra agentes externos (Claude Code/Codex).
- `app/api/orchestrator/chat/route.ts` — chat do Copiloto/Orquestrador (streaming, síncrono, por natureza precisa responder rápido ou manter conexão aberta — adequado a Function, não a worker).

### Webhooks — estado real por integração

| Webhook | Valida rápido e delega? | Observação |
|---|---|---|
| WhatsApp (`webhooks/whatsapp`) | ✅ Sim | Valida HMAC → resolve `organization_id` pelo `phone_number_id` → `inngest.send()` por mensagem → responde. Todo o processamento pesado é 100% Inngest (`whatsapp-ingest.ts` → `whatsapp-inbound.ts`). Único caso síncrono no próprio webhook: atualização de status de template (`message_template_status_update`), que é 1 UPDATE simples — aceitável. |
| Instagram (`webhooks/instagram`) | ⚠️ Parcial | Valida HMAC, mas resolve status de entrega/leitura (`updateSocialMessageStatuses`) e algumas outras checagens **de forma síncrona, antes de responder** — são queries indexadas simples (não é o gargalo do diagnóstico #12), mas o padrão ainda mistura "validar" com "gravar". DMs/comentários novos passam por `lib/social/engine.ts`/`generic-automation-bridge.ts` — não confirmado nesta auditoria se 100% via Inngest ou se parte roda inline; **candidato a revisão dedicada antes de migrar** (não migrar por suposição, como a própria issue pede).
| Asaas, Autentique, Resend | ✅ Aceitável | Volume baixo (eventos de pagamento/assinatura/e-mail, não mensageria em tempo real), processamento síncrono é 1-poucas queries — não são candidatos a mudança agora. |
| Voice (`webhooks/voice`) | Não auditado nesta rodada | Fica para uma auditoria dedicada — é o fluxo mais novo (Althos Voice) e o CLAUDE.md já registra `lib/voice/ai-conversation.ts` como um gap conhecido "mesmo padrão de infra fora do Vercel ainda não resolvido". |

## 2. Railway — o que já está lá e o que é candidato

- **`services/sales-coach-realtime/`** — único serviço Railway hoje confirmado (Node standalone). Sustenta o WebSocket persistente com ElevenLabs Scribe v2 Realtime pro IA Sales Coach — motivo explícito: uma function serverless da Vercel não aguenta uma conexão WebSocket de longa duração.
- **Candidato conhecido, ainda não resolvido**: `lib/voice/ai-conversation.ts` (Voice AI — conversa por telefone em tempo real) tem o mesmo tipo de necessidade (conexão persistente/streaming) que já justificou o Sales Coach ir pro Railway — registrado como gap no CLAUDE.md, não implementado. **Não mover sem medir primeiro** (issue #13 é explícita: implementação segue os findings reais, não suposição) — precisa de uma auditoria própria de quanto tempo/CPU cada chamada de Voice AI consome hoje na Vercel antes de decidir.
- Nenhum outro worker/consumer persistente foi identificado nesta auditoria. A grande maioria do processamento assíncrono (WhatsApp, automações, e-mail, backups, crons) já vive no Inngest, que por sua vez invoca funções da Vercel via HTTP para cada step — ou seja, hoje "background job" no Althos quase sempre significa "Inngest orquestrando, Vercel executando o step", não Railway.

## 3. Inngest — papel real (orquestração, não hospedagem)

Importante esclarecimento arquitetural que faltava documentar: **o Inngest não é uma quarta plataforma de compute** — ele é a camada de orquestração (eventos, steps, retries, `step.sleep`, concorrência, idempotência via `step.run` memoizado), mas o *código de cada step ainda executa como função da Vercel* (`app/api/inngest/route.ts` é o endpoint que o Inngest invoca). Isso significa:

- Um step do Inngest com processamento pesado ainda consome CPU/duração da Vercel — mover algo "pro Inngest" não tira carga da Vercel por si só, só adiciona orquestração/retry/observabilidade em cima. O que de fato tira carga da Vercel é mover o *runtime de execução* pro Railway (um worker que roda continuamente, sem invocar `app/api/inngest`).
- Funções Inngest hoje registradas em `app/api/inngest/route.ts` (a lista cresce — não hardcode um número; ver `functions: [...]` no arquivo): automações (motor genérico + crons de data relativa/aniversário/embarque/tarefa vencida), WhatsApp/Instagram inbound, backups, digest diário, distribuição de pipeline, Voice (chamadas/SMS/transcrição), e-mail, importação de leads, health checks, alertas.
- Limite prático já batido: o Inngest permite no máximo 10 triggers por function — o motor de automações já precisou ser dividido em 3 functions (`processAutomationEvent`, `...Verticals`, `...Verticals2`) só pra caber os eventos de trigger existentes (ver `lib/inngest/automation.ts`). Ao adicionar novo evento de automação, verificar espaço antes de adicionar sempre na primeira.

### Idempotência — padrões já em uso (não um a implementar do zero)

- **WhatsApp**: dedupe por `meta_message_id` antes de processar/enviar.
- **Automações (evento)**: `automation_runs` como registro único por disparo + prevenção de loop genérica (issue #18 — 5+ disparos pro mesmo contato em 10 min é bloqueado).
- **Automações (data relativa)**: tabela `automation_date_fires`, UNIQUE `(automation_id, entity_id, fire_date)` — nunca dispara duas vezes no mesmo dia mesmo com replay do Inngest.
- **Inngest `step.run`**: memoização nativa por step id — reprocessar um evento não reexecuta steps já concluídos.

Ou seja: o critério de aceite "garantir idempotência para webhooks e jobs" já está majoritariamente atendido para os fluxos auditados; o trabalho real que falta é estender esse padrão pros fluxos que não foram auditados nesta rodada (Instagram, Voice) e formalizar num guia único em vez de padrões implícitos espalhados.

## 4. Onde este mapeamento é incompleto (não adivinhar — auditar antes de mexer)

- **Instagram**: confirmar se `lib/social/engine.ts`/`generic-automation-bridge.ts` já delegam 100% pro Inngest ou se há processamento síncrono real no webhook além das atualizações de status já identificadas.
- **Voice AI (`lib/voice/ai-conversation.ts`)**: medir duração/CPU real antes de decidir se migra pra Railway — é o candidato mais provável, mas "provável" não é "confirmado".
- **Rate limits/concorrência por integração** (além do `concurrency: { key: 'event.data.orgId', limit: 5 }` já configurado nas functions de automação) — não levantado nesta rodada para WhatsApp/Instagram/Voice.
- **Logs correlacionáveis entre as três camadas** (critério de aceite da issue #13) — hoje cada camada loga separadamente (Vercel logs, Inngest dashboard, `agent_audit_log`/`automation_step_logs` no Postgres); não há um `trace_id`/`correlation_id` único propagado do webhook até o resultado final. Não implementado nesta auditoria — candidato real de trabalho futuro.

## Conclusão para a issue #13

O critério de aceite mais temido (fluxos síncronos pesados presos na Vercel, sem separação) **já está resolvido para o fluxo de maior volume (WhatsApp)** — não era uma migração pendente. O que resta é bem mais cirúrgico do que um "big-bang rewrite": auditar Instagram e Voice AI com o mesmo rigor que já foi aplicado ao WhatsApp, medir antes de mover qualquer coisa pro Railway, e adicionar correlação de logs entre as camadas. Ver issue de continuação criada a partir desta auditoria para o detalhamento desse trabalho.
