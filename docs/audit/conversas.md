# Auditoria — Módulo Conversas (WhatsApp + Instagram DM)

> Gerado em 2026-07-29. Faz parte da auditoria completa do app. Ver também os demais docs em `docs/audit/`.

## 1. Rotas

| Rota | Arquivo | Notas |
|---|---|---|
| `/app/[orgSlug]/conversas` | `app/app/[orgSlug]/conversas/page.tsx` | **Inbox de WhatsApp apenas** (apesar do nome "Conversas"). `?id=` ou `?lead=` pra pré-selecionar conversa. Busca `whatsapp_conversations` + membros + templates + `getConversationContext` + `listScheduledMessages`. |
| `/app/[orgSlug]/social/inbox` | `app/app/[orgSlug]/social/inbox/page.tsx` | Inbox de DM do Instagram — **rota completamente separada**, não aninhada em `/conversas`. |
| `/app/[orgSlug]/social/*` | layout + `InstagramTabsNav` | Shell compartilhado (abas DM ↔ Automações). |

**Confirma achado da memória do projeto**: WhatsApp e Instagram DM são duas rotas/páginas/componentes completamente distintos (`/conversas` + `WhatsappChat` vs `/social/inbox` + `SocialInbox`), não um hub unificado com abas.

## 2. Componentes

| Componente | Papel | Problemas encontrados |
|---|---|---|
| `WhatsappChat.tsx` (649 linhas) | Inbox completo: lista, filtros (vendedor/etapa), chat, busca de mensagens, agendamento, emoji picker, simulador mock. | Props tipadas como `any`. Padrão de troca lista/chat no mobile (`hidden md:flex`). |
| `SocialInbox.tsx` (222 linhas) | Inbox do Instagram: lista (só busca, sem filtros), chat, toggle de pausa de automação. | Bem mais simples que o WhatsApp — sem filtros, sem busca de mensagem, sem agendamento, sem emoji picker, sem link pro lead, sem avatares de agente. |
| `ConversationDetailPanel.tsx` | Painel lateral (só WhatsApp): info do lead, etapa do pipeline, "Abrir lead", seletor de atribuição. | Terceira coluna sem lógica responsiva confirmada de esconder em tablet — risco de sobrepor o layout de 2 painéis em larguras médias. **Sem equivalente no Instagram** — `social_conversations.contato_id` existe no schema mas a UI nunca usa. |
| `ScheduleMessageButton.tsx` | Agendar mensagem (WhatsApp), com fallback de template pra janela de 24h. | Só WhatsApp — Instagram não tem equivalente. |
| Bolhas de mensagem (inline) | Renderização de cada mensagem. | **Confirma achado da memória**: WhatsApp usa `bg-primary`/`bg-secondary` (tokens de marca, não verde do WhatsApp), `rounded-[14px]` com "rabinho" de balão — o redesign mobile foi aplicado corretamente aqui. **Porém o Instagram DM não recebeu o mesmo polimento**: bolhas usam `rounded-none` com classes vazias/espaços sobrando (artefatos de um refactor incompleto) — **inconsistência visual visível entre os dois inboxes**, o Instagram ficou pra trás no redesign. |

## 3. Server Actions

### `actions/whatsapp.ts` (595 linhas)
`saveWhatsappConfig`, `connectWhatsappEmbedded`, `testWhatsappConnection`, `sendWhatsappMessage`, `markConversationAsRead`, `seedMockConversations`, `simulateInboundMessage`, `assignConversation`, `getConversationContext`, `createLeadFromConversation`, `scheduleWhatsappMessage`, `listScheduledMessages`, `cancelScheduledMessage` — tabelas: `whatsapp_conversations`, `whatsapp_messages`, `scheduled_whatsapp_messages`, `contato_activities`, `organizations`.

### `actions/whatsapp-templates.ts`
CRUD de templates + upload de mídia (bucket `whatsapp-assets`) — usa `createAdminClient()` (service-role, bypassa RLS).

### `actions/social-inbox.ts`
`listConversations`, `getConversationMessages`, `sendManualMessage`, `toggleAutomationPause`, `markConversationRead` — todas passam por um `guard()` que checa `checkMemberPermission(org.id, user.id, 'social')` **e** a feature de plano `instagram_automation`.

## 4. Permissões

Chaves: **`conversations`** (WhatsApp, label "Conversas (WA)") e **`social`** (Instagram DM) — duas chaves independentes.

**Achado crítico**: `actions/whatsapp.ts` **nunca chama `checkMemberPermission`** em nenhuma export — só `requireAuth`/`getCurrentOrganization` e, pra enviar/agendar, checagem de plano (`checkFeatureAccessByOrgSlug`, não é permissão de papel). Qualquer membro autenticado — mesmo com "Conversas" explicitamente revogado — pode invocar essas server actions diretamente. Isso contrasta com `actions/social-inbox.ts`, que corretamente aplica `checkMemberPermission('social')` em toda action mutante. `actions/whatsapp-templates.ts` tem o mesmo gap (zero verificação), e usa client admin, bypassando RLS por completo.

## 5. Conexões com outros módulos

- **Contatos**: `?lead=` resolve a conversa de WhatsApp correspondente; `ConversationDetailPanel`/`WhatsappChat` linkam pro `/contatos/{id}`; `createLeadFromConversation` cria lead a partir do contato do WhatsApp; `sendWhatsappMessage` grava `contato_activities`. **No Instagram, o campo `contato_id` existe no schema mas a UI nunca usa** — sem link pro lead.
- **Automações**: Instagram DM ↔ `social-automations.ts`/`social-funnels.ts` via flag `automation_paused`. **WhatsApp não tem conceito de automação exposto no `WhatsappChat`** — só botões de simulação mock.
- **Templates de WhatsApp**: header do `WhatsappChat` linka pra `/whatsapp-templates`; usados pelo fallback de 24h do agendamento.
- **Planos**: WhatsApp gateado pela feature `'whatsapp'`, Instagram por `'instagram_automation'`.

## 6. Notas de mobile

- Ambos os inboxes usam o mesmo padrão de 2 painéis: lista (`hidden md:flex` quando conversa selecionada) e chat (`hidden md:flex` até selecionar).
- **Voltar no mobile faz navegação de rota completa** (`router.push`), não só limpa estado local — cada toque em "voltar" dispara round-trip ao servidor, não é instantâneo.
- Botões da barra de input com `min-h-[44px] min-w-[44px]` — bom alvo de toque no WhatsApp; Instagram tem só o botão de enviar (sem emoji/anexo/agendamento).
- `ConversationDetailPanel` (3ª coluna, só WhatsApp) sem lógica de colapso confirmada em tablet — risco de overflow de layout.

## Lista de problemas concretos

1. **[Segurança]** `actions/whatsapp.ts` sem nenhuma verificação de permissão server-side — só checagem de plano, não de papel.
2. **[Segurança]** `actions/whatsapp-templates.ts` sem verificação nenhuma, usa client admin (bypassa RLS).
3. Instagram DM sem link "Abrir lead" na UI, apesar do campo `contato_id` existir no schema — gap de paridade com WhatsApp.
4. Bolhas do Instagram com `rounded-none` e classes vazias/artefatos — não recebeu o mesmo polimento visual do WhatsApp.
5. Nome "Conversas" no menu é só WhatsApp — Instagram vive em rota/permissão separada sem agrupamento visual claro.
6. Voltar no mobile faz navegação de rota completa em vez de limpar estado local — round-trip desnecessário a cada toque.
7. Props tipadas como `any` em `WhatsappChat.tsx` — reduz segurança de tipo comparado ao `SocialInbox.tsx`.
8. `ConversationDetailPanel` — possível overflow de 3ª coluna em larguras de tablet, sem breakpoint confirmado.
