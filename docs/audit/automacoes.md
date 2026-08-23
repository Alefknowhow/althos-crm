# Auditoria — Módulo Automações

> Gerado em 2026-07-29. Faz parte da auditoria completa do app. Ver também os demais docs em `docs/audit/`.

## 1. Rotas

| Rota | Arquivo | Função |
|---|---|---|
| `/app/[orgSlug]/automacoes` (layout) | `automacoes/layout.tsx` | Busca `getAutomations`, envolve tudo em `AutomationsShell` (lista + detalhe). |
| `/app/[orgSlug]/automacoes` (index) | `automacoes/page.tsx` | Placeholder "Selecione uma automação". |
| `/app/[orgSlug]/automacoes/[id]` | `[id]/page.tsx` | Carrega automação, forms, etapas do pipeline, execuções, stats por etapa, templates de WhatsApp; renderiza `AutomationEditor`. |
| `/app/[orgSlug]/automacoes/logs` | `logs/page.tsx` | Histórico paginado/filtrável de execuções de toda a org. |
| `/app/[orgSlug]/automacoes/logs/[runId]` | `logs/[runId]/page.tsx` | Detalhe de uma execução: resumo + timeline por etapa. |

**Nota importante**: o "InstagramTabsNav" mencionado na tarefa pertence à rota `/social`, **não** a `/automacoes`. Automações de Instagram são um sistema **completamente separado**, gateado por flag de plano (`instagram_automation`), independente da permissão `automations` e do construtor de fluxo (`AutomationFlow`) auditado aqui. A premissa de que Instagram compartilha este builder não se confirma no código atual.

## 2. Componentes

| Componente | Papel | Problemas encontrados |
|---|---|---|
| `AutomationsShell.tsx` | Shell de 2 painéis (lista + editor). | Usa `minHeight: calc(100vh - 56px)` hardcoded — frágil se a altura do header mudar, e instável no mobile por causa da chrome dinâmica do navegador. Botões "Templates/Histórico/Nova Automação" **escondidos por completo no mobile** quando um detalhe está aberto — sem equivalente mobile. Ícones de toggle/excluir por automação só aparecem no `group-hover` — **inacessíveis em touch**, tornando essas duas ações praticamente impossíveis de usar no celular/tablet. |
| `AutomationEditor.tsx` | Editor principal: header nome/ativo + abas Editor/Execuções. | Segundo `calc(100vh - 205px)` hardcoded empilhado sobre o da `AutomationsShell` — qualquer mudança de altura em qualquer um dos dois quebra silenciosamente o scroll. |
| `AutomationFlow.tsx` | **Construtor de fluxo visual**: nós arrastáveis livremente, conexões por drag entre portas, conectores SVG bezier, painéis de config inline. | **Componente de maior risco do módulo — sem nenhuma adaptação mobile.** Canvas com nós posicionados absolutamente, largura fixa `NODE_W=260px`, sem zoom/pan dedicado, sem "encaixar na tela". Portas de conexão são círculos de 16px — muito abaixo do alvo de toque recomendado (~44px). Controles de inserir/remover aresta (+/✕) só revelam com `hover:opacity-100`, que **nunca ativa em touch** — ficam permanentemente em 40% de opacidade no mobile. Comentário no código diz "layout vertical" mas a implementação é **horizontal** — comentário desatualizado/enganoso. Conflito entre arrastar nó e fazer pan do canvas na mesma superfície touch — fácil de disparar sem querer. |
| `AutomationRunsPanel.tsx` | Aba "Execuções": chips de filtro + cards expansíveis com timeline. | Razoavelmente responsivo (flex-wrap, sem larguras fixas) — o componente mais bem comportado do módulo. |
| `NewAutomationButton.tsx` | Botão "Nova Automação" standalone. | **Parece código morto/duplicado** — `AutomationsShell` tem sua própria lógica `handleNew` com o mesmo payload literal hardcoded em dois lugares; risco de dessincronia. |
| `LogsFilters.tsx` | Filtros da página de logs (busca/automação/status/período). | Degrada razoavelmente por wrap, mas em telas muito estreitas (~360px) pode quebrar em 4-5 linhas. |

## 3. Server Actions

### `actions/automations.ts`
`getAutomations`, `getAutomation`, `getAutomationRuns`, `getLeadAutomationRuns`, `createAutomation`, `updateAutomation`, `getStepStats`, `deleteAutomation`, `toggleAutomation` — tabelas `automations`, `automation_runs`, `automation_step_logs`. **Todas as mutantes (`create`/`update`/`delete`/`toggle`) usam `createAdminClient()` (bypassa RLS).**

### `actions/automation-logs.ts`
`getAutomationRunsPage`, `getRunDetail`, `getAutomationsForFilter` — leitura paginada/filtrada de execuções.

## 4. Permissões

Chave: **`automations`** (padrão `false`). **Achado crítico**: enforcement **só** em `components/features/Sidebar.tsx` (visibilidade do link). Nenhuma das rotas nem das actions em `actions/automations.ts`/`automation-logs.ts` chama `checkMemberPermission` — e as mutantes usam client admin após só resolver o slug da org. **Qualquer membro autenticado pode criar/editar/pausar/excluir automações e ver logs de execução**, mesmo com `automations: false` explícito, desde que acesse a URL diretamente.

## 5. Conexões com outros módulos

Eventos disparados via Inngest, consumidos por `processAutomationEvent` (`lib/inngest/automation.ts`):

| Evento | Disparado de |
|---|---|
| `form.submitted` | `actions/public_forms.ts` |
| `lead.stage_changed` | `actions/contatos.ts` (`moveLeadToStage`) |
| `lead.tag_added` | `actions/contatos.ts` — **em 2 pontos diferentes** (criação e edição de lead) — risco de dessincronia |
| `appointment.booked` | `actions/appointments.ts` |
| `task.overdue`, `lead.stale`, `customer.birthday` | Crons diários (`lib/inngest/automation-crons.ts`) |

Execução (`executeAutomationRun`) escreve diretamente em: `tasks` (criar tarefa), `contatos.stage_id` (mover etapa — **potencial loop**: se um `move_stage` de automação re-dispara `lead.stage_changed`, duas automações apontando pra etapa uma da outra podem se auto-disparar indefinidamente; nenhum guard de ciclo visível), `contatos.tags`, WhatsApp (`sendTemplateMessage`), `email_sends`, push/notificações, e webhook de saída (fetch com timeout de 10s).

## 6. Notas de mobile

`AutomationFlow.tsx` é o componente de maior risco de todo o app pra uso mobile: canvas de posicionamento absoluto sem zoom/pan, nós de largura fixa (260px, maior que a tela de um celular), portas de conexão minúsculas, controles de inserir/remover aresta permanentemente semi-transparentes em touch (o `hover` nunca ativa). Editar ou construir um fluxo com mais de 1-2 passos no celular é essencialmente inviável hoje.

## Lista de problemas concretos

1. **[Segurança]** Nenhuma verificação de permissão server-side em `automations`/`automation-logs` — só o menu lateral esconde o link.
2. Dois números mágicos de altura (`calc(100vh - 56px)` e `calc(100vh - 205px)`) empilhados e independentes — frágeis a qualquer mudança de header.
3. Botões de "Templates/Histórico/Nova Automação" escondidos no mobile quando um detalhe está aberto — sem alternativa.
4. Ícones de toggle/excluir por automação só em `group-hover` — inacessíveis em touch.
5. **[Mobile crítico]** `AutomationFlow` sem zoom/pan, nós de 260px fixos, portas de 16px, controles de aresta sempre semi-transparentes em touch — construtor de fluxo praticamente inutilizável no celular.
6. Comentário no código de `AutomationFlow` diz "layout vertical" mas a implementação é horizontal — desatualizado.
7. `NewAutomationButton.tsx` — possível código morto duplicando lógica de `AutomationsShell.handleNew`.
8. `move_stage` na execução de automação escreve direto em `contatos.stage_id` sem reusar a action que emite o evento — risco de loop de auto-disparo sem guard de ciclo visível.
9. `lead.tag_added` disparado de 2 pontos diferentes em `actions/contatos.ts` — duplicação que deveria ser consolidada.
10. **[Documentação]** Premissa de que automações de Instagram compartilham este builder está incorreta — são sistemas totalmente separados.
11. `getAutomationRunsPage` sanitiza busca de usuário de forma incompleta antes de interpolar num filtro PostgREST — vale checar edge cases de injeção de filtro.
