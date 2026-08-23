# Auditoria — Módulo Financeiro

> Gerado em 2026-07-29. Faz parte da auditoria completa do app. Ver também os demais docs em `docs/audit/`.

## 1. Rotas

| Rota | Arquivo | Função |
|---|---|---|
| `/app/[orgSlug]/financeiro` | `app/app/[orgSlug]/financeiro/page.tsx` | Única página. `requireAuth` + redirect se `!isTravelNiche`. Busca `listFinancialEntries` + `listFinancialSettings` em paralelo, renderiza `PageHeader` + `FinanceiroTabs`, passando um `<FinancialDashboard/>` já instanciado server-side como prop `ReactNode` (padrão interessante: componente client montado no servidor e passado como children). Sem sub-rota `[id]` — seleção de lançamento é estado client-side, **não é possível deep-link/bookmark** de um lançamento específico. |

## 2. Componentes

| Componente | Papel | Problemas encontrados |
|---|---|---|
| `FinanceiroTabs.tsx` | Shell com 3 abas (Lançamentos/Dashboard/Configurações). | Sem tratamento mobile específico além do `Tabs` genérico. |
| `FinancialDashboard.tsx` | KPIs, 2 gráficos, próximos vencimentos, DRE simplificado. | Breakpoints inconsistentes: KPIs quebram em `sm` (640px), gráficos em `lg` (1024px) — entre 640–1024px fica "3 KPIs lado a lado mas 1 gráfico por linha". Tabela de DRE sem `overflow-x-auto` — nomes de categoria longos podem forçar scroll horizontal da página inteira. Lista de vencimentos com `max-h-[280px] overflow-y-auto` aninhado dentro do scroll da página — scroll duplo no mobile. Um spinner único bloqueia todo o dashboard a cada troca de período, sem skeleton por seção. |
| `FinancialEntriesView.tsx` | Lista mestre + editor split view de lançamentos. | Altura calculada com número mágico `h-[calc(100dvh-19rem)]` — frágil a mudanças de altura do header/abas. Barra de filtros (busca + 2 selects + 2 botões) pode quebrar em várias linhas em telas ~360px, sem UI compacta alternativa (ex: sheet de filtros). Grid do editor com 10 campos numa coluna única no mobile sem agrupamento — edição vira um scroll longo sem seções. `StatusQuickMenu` é um badge pequeno como trigger — alvo de toque provavelmente abaixo de 24-44px recomendado. |
| `FinancialSettingsView.tsx` | Cards de configuração (categoria/subcategoria/centro de custo/conta/operadora/forma de pagamento). | Input de `payment_day` sem validação inline (só toast de erro no submit, sem dica de faixa válida 1-31 antes disso). Listas com `max-h-64 overflow-y-auto` sem busca — difícil de escanear listas longas, scroll aninhado dentro do scroll da página. |
| `FinancialCsvImporter.tsx` | Importador de CSV client-side (`lib/csv.ts`). | Tabela de preview sem `overflow-x-auto` — clipping em diálogos estreitos. **Toda linha importada recebe `categoria: 'A categorizar'` hardcoded** — exige recategorização manual completa depois de qualquer importação. Detecção de tipo (receita/despesa) só pelo sinal `-` no início do valor bruto — bancos que usam parênteses pra negativo (`(150,00)`) são classificados errado. Lista de sinônimos de cabeçalho hardcoded, sem UI de correção manual se a detecção errar. |
| Gráficos (`CashFlowChart`, `DailyCashFlowChart`, `ExpensesByCategoryChart`) | Recharts via `next/dynamic({ssr:false})`. | Altura fixa `h-[280px]` **não responsiva** — no mobile os gráficos ficam achatados/largos demais, dificultando leitura de tendência. |

## 3. Server Actions

### `actions/financial.ts` (`financial_entries`)

| Action | Propósito | Tabela |
|---|---|---|
| `syncSaleRevenueEntry` | **Ponte Reservas → Financeiro**: cria/atualiza entrada de receita de comissão, agendada no dia de pagamento configurado do operador. Idempotente por `venda_id`. | Lê `financial_settings` (payment_day); escreve `financial_entries` |
| `listFinancialEntries` / `getFinancialEntry` | Leitura com filtros | `financial_entries` |
| `createFinancialEntry` | Insere; se `is_recurring`, gera 11 ocorrências futuras agrupadas por `recurrence_group_id` (permissão `financial`) | `financial_entries` |
| `updateFinancialEntry` / `deleteFinancialEntry` | Editar/excluir (permissão `financial`; delete bloqueado sob impersonação) | `financial_entries`, Storage `financial-attachments` |
| `bulkCreateFinancialEntries` | Import CSV — insere como `status:'pago'` (permissão `financial`) | `financial_entries` |
| `suggestCategoryForEntry` | Sugestão de categoria via IA (Claude Haiku) | nenhuma (só chamada LLM) |
| `uploadFinancialAttachment`/`deleteFinancialAttachment`/`getFinancialAttachmentUrl` | Anexos (PDF/imagem, ≤15MB) | `financial_entries.anexos`, Storage |
| `getFinancialSummary`, `getCashFlowSeries`, `getExpensesByCategory`, `getSimpleDRE`, `getDailyCashFlow`, `getUpcomingDueEntries`, `getFinancialDashboardData` | Agregações read-only pro dashboard | `financial_entries` reads |

### `actions/financial-settings.ts` (`financial_settings`)

- `listFinancialSettings`, `createFinancialSetting`, `updateFinancialSettingPaymentDay`, `deleteFinancialSetting` (CRUD das 6 listas de configuração, permissão `financial`, delete bloqueado sob impersonação).

## 4. Permissões

Chave: **`financial`**. **Gap significativo**: todas as actions de **leitura** (`listFinancialEntries`, `getFinancialEntry`, `listFinancialSettings`, `getFinancialAttachmentUrl`, todas as agregações do dashboard, `suggestCategoryForEntry`) **não chamam `checkMemberPermission`** — só as mutantes checam. A página em si só verifica nicho, não permissão. Qualquer membro autenticado — mesmo com `permissions.financial` explicitamente `false` — pode ver todos os dados financeiros (lançamentos, anexos via URL assinada, dashboard) chamando as actions diretamente. Guard de impersonação também inconsistente: `deleteFinancialEntry`/`deleteFinancialSetting` bloqueiam, mas create/update não.

## 5. Conexões com outros módulos

- **Reservas → Financeiro**: `saveTravelSaleAndGenerateTasks` chama `syncSaleRevenueEntry` após salvar uma venda — único ponto de entrada externo no módulo.
- **Config de dia de pagamento do operador**: `financial_settings` (`type='operadora'`, `payment_day`) é lido via match `ilike` contra `sale.operator`. **Se o nome do operador em Reservas não bater** (typo, capitalização diferente, ou operador não cadastrado), a entrada é criada **sem vencimento**, silenciosamente — sem aviso de volta pra UI de Reservas.
- Nenhum outro arquivo importa `actions/financial.ts`/`financial-settings.ts` fora do próprio módulo e de `travel-sales.ts`.
- Visibilidade no menu depende de `isTravelNiche` — orgs fora do nicho viagem nunca alcançam o módulo.

## 6. Notas de mobile

- Dashboard: sem lógica mobile dedicada além dos breakpoints de grid — tudo empilha em coluna única, mas os gráficos mantêm altura fixa de 280px independente da largura.
- Lista/editor de lançamentos: única adaptação mobile genuína do módulo — painel único por vez (lista OU editor) com seta de voltar, escondendo a barra de filtros quando um lançamento está selecionado.
- Configurações e importador de CSV: sem lógica mobile específica, dependem do wrap padrão de grid/flex.

## Lista de problemas concretos

1. **[Segurança]** Página só verifica nicho, não permissão `financial`; actions de leitura sem `checkMemberPermission`.
2. Guard de impersonação inconsistente (só nos deletes).
3. `syncSaleRevenueEntry` — match de operador por `ilike` sem feedback de falha; comissão fica sem vencimento silenciosamente.
4. `FinancialDashboard` — breakpoints inconsistentes entre KPIs (`sm`) e gráficos (`lg`).
5. Tabela de DRE sem `overflow-x-auto`.
6. `FinancialEntriesView` — altura com número mágico `19rem`, frágil a mudanças de layout.
7. Barra de filtros pode quebrar em várias linhas em telas muito estreitas.
8. Tabela de preview do importador de CSV sem scroll horizontal.
9. **[Funcional]** Todo import de CSV cai em "A categorizar" — recategorização manual completa sempre necessária.
10. Detecção de tipo (receita/despesa) por sinal `-` só — bancos com parênteses pra negativo classificam errado.
11. Gráficos com altura fixa não responsiva — achatados no mobile.
12. Listas de configuração sem busca, `max-h-64` com scroll aninhado.
13. Sem sub-rota `[id]` — lançamento selecionado não é deep-linkável nem sobrevive a refresh/voltar.
