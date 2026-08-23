# Auditoria — Módulo Forms

> Gerado em 2026-07-29. Faz parte da auditoria completa do app. Ver também os demais docs em `docs/audit/`.

## 1. Rotas

| Rota | Notas |
|---|---|
| `/app/[orgSlug]/forms` | Lista com contagem de submissões, badge de status, links pra editar/respostas. |
| `/app/[orgSlug]/forms/[id]/edit` | `FormBuilder`. |
| `/app/[orgSlug]/forms/[id]/insights` | `FormInsightsView` (KPIs + Recharts). |
| `/app/[orgSlug]/forms/[id]/respostas` | `FormResponsesView` (filtros via URL). |
| `/f/[slug]` (pública) | Página de captura de lead. Client admin, 404 se `!is_active`. Injeta Meta Pixel. |
| `/f/[slug]/preview` (pública) | **Sem checagem de auth nem de `is_active`** — qualquer anônimo que descubra/adivinhe o slug pode ver o preview de um formulário rascunho/pausado de qualquer org. |

## 2. Componentes

| Componente | Papel | Problemas encontrados |
|---|---|---|
| `FormBuilder.tsx` | Editor de schema (campos, boas-vindas, aparência, CTA WhatsApp/agendamento, assinatura) + drag-and-drop + preview ao vivo. | Split desktop só ≥1024px; `isDesktop` começa `true` antes do `matchMedia` rodar — flash de layout desktop no carregamento mobile. Painel de propriedades (`w-72` fixo) não vira drawer/sheet no mobile. Usa `<select>` nativo em vez do `Select` do shadcn. |
| `FormPageHeader.tsx` | Header/tabs compartilhado (editar/respostas/insights). | Tabs sem `overflow-x-auto` — pode quebrar mal se labels crescerem. |
| `FormInsightsView.tsx` | Dashboard read-only (KPIs + gráfico + top sources/campanhas/mediums). | Grid `grid-cols-2 md:grid-cols-3` deixa um card órfão sozinho na 2ª linha no mobile. |
| `FormResponsesView.tsx` | Tabela de submissões com filtros/paginação + drawer de detalhe. | `whitespace-nowrap` em toda célula/header + colunas dinâmicas por campo — tabela fica muito larga no mobile, **sem coluna fixa** (nome do lead) pra ancorar o scroll horizontal. |
| `FormListActions.tsx` | Ações de linha (Editar/Copiar URL/Pausar/Excluir). | A tabela da página de lista (`forms/page.tsx`) **não tem `overflow-x-auto`** — combinado com 4 botões de texto sempre visíveis por linha, força overflow horizontal no mobile sem indicação de scroll. |
| `PublicFormPreview.tsx` / `OneQuestionForm.tsx` | Renderizadores do formulário público (clássico vs. uma-pergunta-por-tela). | Imagens por campo usam `<img>` cru sem `width`/`height` — CLS em conexões móveis lentas. `OneQuestionForm` sem texto alternativo pro progresso (só barra visual) — gap de acessibilidade em leitor de tela mobile. |
| `LeadFormResponsesButton.tsx` | Botão no `LeadCard` (Pipeline) que abre diálogo com respostas do lead. | Grid fixo `40%/60%` label/valor pode quebrar mal com labels longos em diálogo mobile, sem fallback empilhado. |
| `PublicFormClient.tsx` | Wrapper client da página pública/preview: code-split por modo, estado de submit, Meta Pixel client-side. | Lê `input[name="cf-turnstile-response"]` mas **nenhum widget Turnstile é renderizado** em lugar nenhum encontrado — a camada antispam do Turnstile é efetivamente inerte/morta na prática atual. |

## 3. Server Actions

### `actions/forms.ts`
`getForms`, `createForm` (schema padrão de 2 campos, auto-atribui pipeline padrão), `updateForm`, `deleteForm` (hard delete, sem cascade/soft-delete explícito verificado), `toggleFormActive` — todas com permissão `forms`.

### `actions/public_forms.ts`
`submitPublicForm` — pipeline completo: antispam (honeypot, tempo mínimo, Turnstile [inerte], rate limit IP 10/hora/slug) → valida contra Zod → upsert de lead por e-mail → insere `form_submissions` + `contato_activities` → dispara `form.submitted`/`lead.qualify_requested` (Inngest) → notificação push/in-app → evento Meta CAPI `Lead`.

### `actions/form_submissions.ts`
`getFormInsights`, `getLeadFormResponses`, `getFormWithSubmissions` — **nenhuma checa `checkMemberPermission`**.

## 4. Permissões

Chave: **`forms`**, padrão `false` (opt-in). Enforcement correto em `actions/forms.ts` (toda mutação). **Gap**: `actions/form_submissions.ts` (as 3 exports) não checa permissão nenhuma — qualquer membro autenticado pode ver submissões/insights/respostas de lead independente de ter `forms` concedido, se algum deep-link alcançar essas actions.

**Achado adicional**: em `components/features/Sidebar.tsx`, o atributo `dataTour="forms"` parece estar no link de **Marketing**, não no de Forms — provável bug de copy-paste que afeta qualquer tour/tooltip de onboarding mirando `[data-tour="forms"]`.

## 5. Conexões com outros módulos

- **Pipeline/Automações**: `submitPublicForm` dispara `form.submitted` (Inngest), consumido por `processAutomationEvent`, populando o trigger "Formulário Submetido" no `AutomationFlow`.
- **Qualificação de lead**: dispara também `lead.qualify_requested` a cada submissão com lead resolvido.
- **Notificações**: push/in-app "Novo lead recebido" a cada submissão.
- **Marketing (atribuição)**: `actions/marketing.ts` lê `form_submissions.utm_campaign` e casa (case/trim-insensitive, sem fuzzy match) contra `campaigns.utm_campaign` — **UTMs sem correspondência exata são silenciosamente descartados do gráfico**, subestimando atribuição sem aviso.
- **Pipeline lead card**: `LeadFormResponsesButton` chama `getLeadFormResponses` pra mostrar respostas no popup.
- **Meta Ads**: dupla emissão de evento `Lead` (client-side `fbq` + server-side CAPI), deduplicados pelo mesmo `leadEventId`.
- **Agendamento**: CTA "Consultar horários" linka pra `/book/{orgSlug}/{eventTypeSlug}` quando `schema.booking.enabled`.

## 6. Notas de mobile

- **Builder** (ferramenta interna, desktop-first): preview lado a lado só ≥1024px; abaixo disso vira botão "Preview" com modal fullscreen. Drag-and-drop sem tuning explícito de touch sensor — risco de conflito entre arrastar campo e rolar a página.
- **Formulário público** (mobile-first, já que a maioria dos leads preenche pelo celular vindo de anúncio): usa `min-h-[100dvh]` corretamente (considera chrome do navegador mobile). Code-split por modo especificamente pra carregar menos JS em landing de anúncio mobile — boa prática. Opções de múltipla escolha em botões grandes tocáveis — boa ergonomia. Sem `inputMode="tel"` explícito no campo de telefone — teclado numérico pode não abrir de forma confiável em todos os navegadores mobile.

## Lista de problemas concretos

1. **[Segurança/Privacidade]** `/f/[slug]/preview` sem auth nem checagem de `is_active` — vaza design/copy de formulário rascunho/pausado pra qualquer anônimo com o slug.
2. **[Segurança]** `actions/form_submissions.ts` sem verificação de permissão — só o menu esconde a entrada.
3. Antispam Turnstile efetivamente morto/inerte — widget nunca é renderizado, token sempre nulo.
4. `FormBuilder` — flash de layout desktop no mobile antes do `matchMedia` rodar.
5. Tabela de lista de formulários sem `overflow-x-auto` — 4 botões de ação por linha forçam overflow no mobile.
6. `FormResponsesView` — tabela muito larga no mobile, sem coluna fixa de identidade do lead.
7. `FormInsightsView` — grid de KPI deixa card órfão sozinho na 2ª linha no mobile.
8. Imagens por campo/pergunta sem dimensões explícitas — CLS no mobile.
9. `OneQuestionForm` — progresso sem alternativa textual pra leitor de tela.
10. **[Nomenclatura/bug]** `dataTour="forms"` no link errado (Marketing em vez de Forms) no Sidebar.
11. **[Funcional]** Atribuição de campanha descarta silenciosamente UTMs sem correspondência exata — subestima atribuição sem aviso.
12. `deleteForm` — hard delete sem cascade/limpeza explícita verificada de `form_submissions`/referências em automações.
