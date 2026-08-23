# Auditoria — Módulo Tarefas

> Gerado em 2026-07-29. Faz parte da auditoria completa do app. Ver também `docs/audit/pipeline.md`, `docs/audit/contatos.md`, `docs/audit/reservas.md`, `docs/audit/cotacoes.md`, `docs/audit/bloqueios.md`.

## 1. Rotas

| Rota | Arquivo | Função |
|---|---|---|
| `/app/[orgSlug]/tarefas` | `app/app/[orgSlug]/tarefas/page.tsx` | Única página — sem `[id]`/`novo`. Busca `tasks` (join com `contatos`), membros da org e colunas do kanban em paralelo. Renderiza `PageHeader` + `TasksBoard`, mais um FAB mobile-only (`fixed bottom-20 right-4 md:hidden`) com um segundo `TaskDialog` pra criar tarefa. |

## 2. Componentes

| Componente | Papel | Problemas encontrados |
|---|---|---|
| `TasksBoard.tsx` | Componente principal: filtros, 3 visões (kanban/lista/calendário), CRUD de colunas, drag-and-drop, sheet de edição. | Detecta mobile via `matchMedia('(max-width: 639px)')` — se `isMobile && view==='kanban'`, downgrada silenciosamente pra `list` (que na verdade é um acordeão de 3 buckets: Atrasadas/Hoje/Próximas, não a mesma lista do desktop). Dois mecanismos de detecção de mobile (classe Tailwind `sm:hidden` em 640px + JS `matchMedia` em 639px) podem dessincronizar por 1 frame na hidratação. Colunas do kanban fixas em `w-[300px]` sem breakpoint responsivo — só scroll horizontal. **Calendário não tem nenhum tratamento mobile** (ao contrário do kanban, que é explicitamente rebaixado) — renderiza grid de 7 colunas com texto `text-[10px]` em qualquer largura. `TaskRow` (visão lista) esconde a coluna de lead vinculado abaixo de `sm` — **mobile perde completamente o link pro contato**, inclusive na visão de buckets que reusa o mesmo componente. Usa `window.confirm()` nativo pra excluir coluna, inconsistente com o resto do design system. Typos de espaço duplo em classNames (cosmético, mas sinaliza falta de revisão). |
| `TaskCard.tsx` | Componente de linha mais antigo/simples. | **Aparentemente órfão** — nenhum importador encontrado fora dele mesmo; `TasksBoard` reimplementou tudo inline (`KanbanCard`/`TaskRow`). Cores de prioridade hardcoded (não usa os tokens semânticos) — duas fontes de verdade divergentes, e não se adapta corretamente ao dark mode. Botão de excluir é `hidden md:flex` — mobile não tem exclusão inline na linha. |
| `TaskDialog.tsx` | Diálogo "Nova Tarefa" (react-hook-form + zod). Usado tanto no header quanto no FAB mobile. | Grid `grid-cols-2` fixo pra data/prioridade sem breakpoint de empilhamento no mobile. |
| `SaleTasksList.tsx` | Tarefas vinculadas a uma venda, dentro do detalhe de Reservas. | Ponto de contato confirmado com Reservas. |
| `TasksToday`/`TasksTodayWidget` | Widgets do dashboard mostrando tarefas de hoje. | Mais um caminho de leitura independente de `tasks`, duplicando lógica de formatação de prioridade/data fora de `TasksBoard`/`TaskCard`. |

## 3. Server Actions (`actions/tasks.ts`)

| Action | Propósito | Tabela(s) |
|---|---|---|
| `createTask` | Cria tarefa; auto-cria coluna padrão se a org não tiver nenhuma | `tasks` insert; lê `task_columns` |
| `listTasksForSale` | Tarefas de uma venda (usado por `SaleTasksList`) | `tasks` select por `sale_id` |
| `updateTask` / `deleteTask` | Edição/exclusão | `tasks` |
| `toggleTaskStatus` | Toggle aberto/concluído (checkbox) | `tasks.status` |
| `setTaskStatus` / `setTaskPriority` | Setters — **código morto**, nenhuma UI atual os chama | `tasks` |
| `listTaskColumns` / `createTaskColumn` / `renameTaskColumn` / `deleteTaskColumn` / `moveTaskToColumn` | CRUD de colunas do kanban | `task_columns`, `tasks.column_id` |

**Inconsistência**: só `createTask`/`updateTask`/`deleteTask` checam `isAccessBlocked` (congelamento de billing) — `toggleTaskStatus`, `setTaskStatus`, `setTaskPriority`, CRUD de colunas e `moveTaskToColumn` **não** — drag-and-drop e toggle de status continuam funcionando numa conta congelada.

## 4. Permissões

Chave: **`tasks`**. **Achado**: `actions/tasks.ts` **não tem nenhuma chamada a `checkMemberPermission`** — ao contrário da maioria dos outros arquivos de actions. Enforcement existe **só** em `components/features/Sidebar.tsx` (visibilidade do link). Qualquer membro autenticado com sessão válida pode chamar `createTask`/`updateTask`/`deleteTask`/etc. diretamente independente da flag `permissions.tasks`, já que as actions só checam `organization_id`, não a permissão por membro.

## 5. Conexões com outros módulos

- **Contatos**: `tasks.contato_id` FK; `createTask` revalida a página do contato quando um lead é vinculado; `/contatos/[id]` consulta `tasks` **diretamente** (não via `actions/tasks.ts`).
- **Reservas**: `saveTravelSaleAndGenerateTasks` (`actions/travel-sales.ts`) insere tarefas **diretamente na tabela**, bypassando `actions/tasks.ts` e sua validação Zod (`taskSchema`) por completo. `SaleTasksList` lê de volta via `listTasksForSale`.
- **Automações (Inngest)**: `lib/inngest/automation.ts` também insere direto em `tasks`, bypassando a camada de actions.
- **Dashboard**: `actions/dashboard.ts` e `TasksTodayWidget` consultam `tasks` direto.
- **IA/Insights**: `lib/ai/insights-tools.ts` também lê `tasks` direto.

**Achado principal**: pelo menos 4 caminhos de código diferentes tocam a tabela `tasks` diretamente em vez de passar por uma camada única de acesso a dados — qualquer mudança futura de validação/colunas precisa ser replicada em vários lugares, e tarefas geradas automaticamente (por vendas/automações) **nunca passam pela validação Zod** de `createTask`.

## 6. Notas de mobile

- Detecção de mobile client-side via `matchMedia` força kanban → lista (na verdade um terceiro modo, os buckets de 3 seções).
- Colunas do kanban usam `min-h-[200px]` (sizing por conteúdo, não fill de viewport) — por isso não precisou do fix de "preencher a tela inteira" aplicado em outras telas do app.
- Calendário sem nenhum tratamento mobile — grid de 7 colunas cramped em qualquer largura.
- FAB "Nova Tarefa" (mobile-only) duplica o `TaskDialog` do header (`hidden md:block`) — duas instâncias montadas simultaneamente, uma escondida por breakpoint, cada uma com seu próprio estado de form — não é bug, mas overhead redundante de DOM.

## Lista de problemas concretos

1. **[Segurança]** `actions/tasks.ts` sem nenhuma verificação de permissão server-side.
2. Gating de billing (`isAccessBlocked`) inconsistente — só em create/update/delete, faltando em toggle/status/prioridade/colunas/mover.
3. `setTaskStatus`/`setTaskPriority` — código morto, nenhuma UI atual usa.
4. `TaskCard.tsx` — órfão, duplica lógica já reimplementada em `TasksBoard`, cores hardcoded fora dos tokens semânticos, sem dark mode correto.
5. `TaskCard.tsx` — botão de excluir escondido no mobile.
6. `TasksBoard.tsx` — colunas do kanban fixas em 300px, sem responsividade.
7. `TasksBoard.tsx` — cabeçalho de coluna sem `min-w-0`, nomes longos podem empurrar ícones pra fora.
8. Typos de espaço duplo em classNames — cosmético, mas indica falta de revisão.
9. `TaskRow` esconde o link do lead abaixo de `sm` — mobile perde a conexão com Contatos completamente (afeta inclusive a visão principal de buckets).
10. Calendário sem tratamento mobile algum — ao contrário do kanban, que é rebaixado explicitamente.
11. `window.confirm()` nativo pra excluir coluna — inconsistente com o design system.
12. Dois mecanismos de detecção de mobile (CSS 640px vs JS 639px) — risco de flash de 1 frame na hidratação.
13. `TaskDialog` — grid de 2 colunas sem breakpoint de empilhamento no mobile.
14. **[Arquitetura]** Fragmentação de acesso a dados — pelo menos 6 lugares diferentes leem/escrevem `tasks` direto, bypassando `actions/tasks.ts`.
15. Tarefas geradas por vendas (`saveTravelSaleAndGenerateTasks`) nunca passam pela validação `taskSchema`.
