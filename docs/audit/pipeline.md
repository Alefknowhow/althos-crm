# Auditoria — Módulo Pipeline

> Gerado em 2026-07-29, **revisado em 2026-08-23** (retomada da auditoria
> completa). Ver também `docs/audit/contatos.md`, `docs/audit/reservas.md`,
> `docs/audit/cotacoes.md`.

## 0. Confirmação arquitetural (pedido explícito do usuário)

**Pipeline continua sendo um módulo único/core, reaproveitado por
todos os nichos — confirmado, nenhuma duplicação encontrada.**
`/pipeline-imoveis` (Imobiliárias) é só uma rota fina de redirect
(`ensureRealEstatePipeline` get-or-create + `redirect` pro
`/pipeline?pipeline_id=X`), não um board próprio — reaproveita
`KanbanBoard.tsx` 100%. Nenhuma outra vertical (Seguros, Tráfego,
Clínicas) criou pipeline/board dedicado. `pipelines.kind` (coluna
usada só por Imóveis pra marcar "esse é o pipeline imobiliário") é
metadado, não uma bifurcação de código.

## 1. Rotas

Só uma rota, sem `layout.tsx`/`loading.tsx`/`error.tsx` próprios:

| Rota | Arquivo | Função |
|---|---|---|
| `/app/[orgSlug]/pipeline` | `app/app/[orgSlug]/pipeline/page.tsx` | Resolve `org`, carrega todos os `pipelines` da org, escolhe o ativo via `?pipeline_id=` (fallback `is_default` → primeiro), redireciona se o param for inválido. Busca `pipeline_stages` (ordenado por `position`) e `contatos` (leads) em paralelo; carrega `memberships`+perfis via `createAdminClient()` best-effort (nunca quebra o board). Renderiza `KanbanBoard`. Estado vazio (nenhum pipeline) mostra mensagem simples com link pra criar um. |

Relacionada (fora do escopo direto): `app/app/[orgSlug]/configuracoes/pipelines/page.tsx` — CRUD de pipelines via `PipelinesManager.tsx`, compartilha as mesmas actions.

Sem `loading.tsx`/`error.tsx` — um fetch lento de `contatos`/`pipeline_stages` não mostra skeleton, só blank layout shift.

## 2. Componentes

| Componente | Papel | Problemas encontrados |
|---|---|---|
| `KanbanBoard.tsx` | Raiz client compartilhada: toolbar (busca/dono/tier/ordenação/parados), board dnd-kit, view em lista, modal de KPIs, diálogo de novo lead. Renderiza `MobilePipelineList` abaixo de `md` e colunas/tabela acima. | Toolbar com 6+ controles sem estratégia de wrap responsivo — larguras fixas (`w-[150px]`, `w-[130px]`) competem com a busca `min-w-[180px]`; em tablet/desktop estreito (768–1024px) quebra de forma bagunçada. `handleDragEnd` recalcula o estágio antigo a partir do snapshot original do servidor (`initialLeads`), não do estado imediatamente anterior — dois drags seguidos sem refresh podem fazer o rollback do segundo apagar o primeiro drag bem-sucedido. Botão "Dashboard" (que abre o `PipelineKpiBar`) é `md:hidden` — **desktop não tem acesso nenhum aos KPIs do pipeline**, já que o único gatilho é escondido justamente no desktop. Ambas as árvores (mobile `MobilePipelineList` e desktop board/tabela) são montadas simultaneamente independente do viewport — sem lazy mount, dobra o custo de render em todo carregamento. |
| `KanbanColumn.tsx` | Coluna com droppable: cabeçalho (nome, contagem, valor total, botão adicionar), lista de cards com scroll. | Largura fixa `md:w-[320px]` — não é fluida; desperdiça espaço em telas 4K e força scroll horizontal excessivo em viewports ~700-900px. `max-h-[75vh]` fixo pode cortar conteúdo em mobile paisagem. `rounded-none` enquanto `MobileLeadCard` usa `rounded-[8px]` — raio de canto inconsistente entre variantes mobile/desktop. |
| `LeadCard.tsx` | Card desktop/tablet: drag handle, editor de valor inline, seletor de vendedor/etapa, editor de tags, badges, ações rápidas no rodapé. | Ações do rodapé usam `opacity-0` + `group-hover:opacity-100` — **inacessíveis em touch** (sem fallback de hover-on-tap); afeta tablets ≥768px que ainda recebem este card desktop. Três popovers (`SellerPicker`, `TagEditor`, `StagePicker`) reimplementam a mesma lógica de fechar-ao-clicar-fora de forma independente e duplicada. `rounded-none` inconsistente com o resto do app (ex: empty-state do `KanbanColumn` usa `rounded-lg`). |
| `MobilePipelineList.tsx` + `MobileLeadCard` | Acordeão de estágios só-mobile (`md:hidden`), um aberto por vez. | Só a **primeira etapa** abre automaticamente — se a maioria dos leads está numa etapa posterior, o mobile abre vazio por padrão. `pb-4` fixo sem considerar a altura do `BottomNav` fixo — pode cobrir o "Adicionar lead" da última etapa. Expõe só 3 das 5 ações rápidas do card desktop (falta "Abrir conversa" e `LeadProposalsButton`) — gap de paridade. Avatar do dono em tamanho diferente do desktop (`h-8 w-8` vs `h-6 w-6`) sem razão documentada. Sem drag-and-drop no mobile — mudar etapa exige abrir o drawer, que só tem um `<select>` de etapa dentro do sheet de edição (sem o dot `StagePicker` do desktop). |
| `LeadDetailDrawer.tsx` | Drawer (`Sheet`) com dados completos do lead, timeline e automações. | Estado de loading é só texto "Carregando..." — sem skeleton, inconsistente com o resto do app. Badge de automação concluída usa `bg-green-500` hardcoded, fora da paleta `emerald-*` usada no resto do módulo. |
| `LeadDetailActions.tsx` | Editar/excluir lead a partir do drawer. | Ao excluir com sucesso, `router.push` **redireciona pra Contatos**, tirando o usuário do Pipeline em vez de só fechar o drawer e atualizar o board. Usa `import('sonner')` dinâmico em vez do import estático usado no resto do módulo. |
| `PipelineKpiBar.tsx` | Tiles de KPI (valor aberto, negócios ativos, ticket médio, parados 7d+, quentes/IA) — só aparece dentro do modal de dashboard. | `lg:grid-cols-5` referencia o breakpoint da **viewport global**, não da largura do modal (`max-w-3xl`) onde é renderizado — descompasso clássico viewport vs. container. |
| `PipelineSwitcher.tsx` | Dropdown de pipelines da org + link pra configurações. | Sem problemas relevantes. |
| `PipelineConfigDialog.tsx` | Gerencia etapas do pipeline atual: cor, adicionar/excluir, toggle ganho/perdido. | **Não é possível renomear etapa** por aqui, apesar de `updateStage` suportar isso — gap de funcionalidade. `max-h-[52vh]` fixo. Color picker nativo `<input type="color">` sem paleta de fallback nem validação de contraste (uma cor muito clara pode deixar badges ilegíveis em outros lugares). |

## 3. Server Actions

### `actions/pipeline.ts`

| Action | Propósito | Tabela(s) |
|---|---|---|
| `listPipelines` | Lista pipelines com contagem de etapas/leads | `pipelines`, `pipeline_stages`, `contatos` |
| `createPipeline` | Cria pipeline, marca padrão se for o primeiro, semeia 3 etapas padrão | `pipelines`, `pipeline_stages` |
| `renamePipeline` / `setDefaultPipeline` / `deletePipeline` | Editar/definir padrão/excluir (só se sem leads e não padrão) | `pipelines`, leitura de `contatos` |
| `createStage` / `updateStage` / `reorderStages` / `deleteStage` | CRUD de etapas | `pipeline_stages` |

**Status em 2026-08-23**: `createStage`/`updateStage`/`reorderStages`/`deleteStage` já checavam `checkMemberPermission('pipeline')` (corrigido em algum momento entre Jul/29 e agora, fora desta sessão). As **outras 6** (`listPipelines`, `createPipeline`, `renamePipeline`, `setDefaultPipeline`, `deletePipeline`, `getPipelinesAndStages`) não checavam — **corrigidas nesta revisão**, exceto `getPipelinesAndStages` (decisão deliberada: consumida por Automações/Campanhas, que podem ter permissão própria sem ter `pipeline`; só expõe nomes de pipeline/etapa, sem dado de lead — gatear quebraria fluxo legítimo sem ganho real de segurança, documentado inline no código).

### `actions/contatos.ts` (subconjunto usado pelo Pipeline)

| Action | Propósito | Tabela(s) |
|---|---|---|
| `createLead` | Cria lead pelo diálogo "Novo Lead"; checa limite de plano | `contatos`, `negocios`, `contato_activities` |
| `updateLead` | Edição completa (nome/e-mail/telefone/tags/etapa/notas) | `contatos`; dispara Inngest por tag nova |
| `moveLeadToStage` | **Action mais consequente do módulo**: drag-and-drop de etapa | `contatos` (etapa + auto `status='cliente'` em etapa ganha), `pipeline_stages`, `negocios` (espelha), `contato_activities`; dispara Inngest; cria venda automática via `maybeCreateTravelSaleOnWon`; envia evento Meta CAPI |
| `getLead` | Dados completos pro drawer | `contatos`, `contato_activities`, `automation_runs` |
| `assignLead` / `updateLeadValue` / `updateLeadTags` | Ações inline do card | `contatos.assigned_to`/`value_cents`/`tags` |

## 4. Permissões

Chave: **`pipeline`**. **Status em 2026-08-23**: as actions de lead usadas pelo board (`moveLeadToStage`, `createLead`, `updateLead`, `deleteLead`, `assignLead`, etc., em `actions/contatos.ts`) **já checam permissão** — via `checkContatoPermission` (libera se `pipeline`/`leads`/`clients`, corrigido na auditoria de Contatos desta mesma sessão). O gap real era a **página `/pipeline` em si**, que nunca checava nada e montava o board completo (nomes/valores/tags/e-mail/telefone de todos os leads) pra qualquer membro autenticado da org, mesmo com `pipeline: false` explícito — **corrigido nesta revisão** (`checkMemberPermission` + redirect no topo da página). `listPipelines`/`createPipeline`/`renamePipeline`/`setDefaultPipeline`/`deletePipeline` também corrigidos (seção 3).

## 5. Conexões com outros módulos

- **Contatos**: leads do Kanban **são** linhas de `contatos` — qualquer edição no Pipeline reflete direto em Contatos.
- **Negócios (`negocios`)**: `createLead` insere negócio espelhado; `moveLeadToStage` mantém sincronizado (etapa, `won`/`lost`, `won_at`/`lost_at`).
- **Conversão automática em cliente**: `moveLeadToStage` seta `status='cliente'` + `became_customer_at` ao cair numa etapa `is_won` — silenciosamente converte lead em cliente com um simples drag.
- **Reservas**: em etapa ganha, dispara `maybeCreateTravelSaleOnWon` — cria venda pré-preenchida para orgs de viagem.
- **Automações (Inngest)**: `updateLead` dispara `lead.tag_added`; `moveLeadToStage` dispara `lead.stage_changed` — consumidos pelo motor de automações (não auditado aqui).
- **Meta Ads/CAPI**: em ganho/perda de etapa, envia `Purchase`/`NotQualified` usando credenciais da org.
- **Configurações > Pipelines**: compartilha 1:1 as mesmas actions de `actions/pipeline.ts`.

## 6. Notas de mobile

- Troca de breakpoint é pura classe Tailwind (`md:hidden`/`hidden md:flex`) — sem `useMediaQuery` nem flag JS; **ambas as árvores (mobile e desktop) montam ao mesmo tempo**, sempre, independente do viewport real.
- Mobile é um acordeão de etapas, **sem drag-and-drop** — mudar etapa exige abrir o drawer e usar um `<select>`.
- Só a primeira etapa abre por padrão, sem heurística de "etapa com mais leads".
- `pb-4` fixo no acordeão sem considerar altura do `BottomNav`.
- Botões de ação rápida no mobile (`h-7 w-7` = 28px) abaixo do alvo de toque recomendado (44px).
- Toolbar não colapsa em um sheet de filtros no mobile — em telas muito estreitas (&lt;360px) empilha em várias linhas antes mesmo de mostrar leads.

## Lista de problemas concretos

1. Botão "Dashboard"/KPIs é `md:hidden` — desktop não vê KPIs do pipeline em lugar nenhum.
2. Ambas as árvores (mobile+desktop) sempre montadas — custo de render dobrado.
3. `handleDragEnd` usa snapshot do servidor pro rollback — dois drags seguidos podem corromper o primeiro.
4. Toolbar com larguras fixas competindo por espaço, sem colapso em tablet/desktop estreito.
5. Largura de coluna fixa (`md:w-[320px]`) — não fluida, desperdiça/aperta espaço conforme a tela.
6. Ações do card só aparecem no hover — inacessíveis em touch (tablet ≥768px inclusive).
7. Raio de canto inconsistente entre `LeadCard` (`rounded-none`) e `MobileLeadCard` (`rounded-[8px]`).
8. Paridade de funcionalidade: mobile tem só 3 de 5 ações rápidas do card.
9. Avatar do dono em tamanhos diferentes entre mobile/desktop sem razão aparente.
10. Mobile abre sempre a primeira etapa, mesmo se vazia.
11. `pb-4` do acordeão sem espaço de segurança pro `BottomNav`.
12. Loading do drawer é texto puro, sem skeleton.
13. Badge de automação com cor hardcoded (`green-500`) fora da paleta do design system.
14. Excluir lead do Pipeline redireciona pra Contatos — UX abrupta.
15. Import dinâmico de `sonner` inconsistente com o resto do módulo.
16. `PipelineConfigDialog` não permite renomear etapa; color picker sem validação de contraste.
17. `PipelineKpiBar` usa breakpoint de viewport dentro de um modal de largura fixa.
18. ~~**[Segurança]** Nenhuma verificação de permissão server-side~~ — **Corrigido em 2026-08-23**: página `/pipeline` + 5 actions de `actions/pipeline.ts` (ver seção 4).
19. ~~`actions/pipeline.ts`: `createStage`/`updateStage`/`reorderStages`/`deleteStage` sem `requireAuth()`~~ — **Desatualizado**: essas 4 já checavam permissão antes desta revisão (corrigido em algum ponto entre Jul/29 e Ago/23, fora desta sessão).
20. `moveLeadToStage` tem 5+ efeitos colaterais sem transação/rollback compartilhado — falha parcial (ex: CAPI) deixa mudanças já commitadas.
21. Sem `loading.tsx`/`error.tsx` na rota — fetch lento gera blank layout shift.
