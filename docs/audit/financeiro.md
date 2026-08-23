# Auditoria — Módulo Financeiro

> Gerado em 2026-07-29, **revisado em 2026-08-23** como parte da retomada
> da auditoria completa. Ver também `docs/audit/vendas.md` e
> `docs/audit/agencias-trafego.md`.

## 1. Rotas

| Rota | Arquivo | Função |
|---|---|---|
| `/app/[orgSlug]/financeiro` | `app/app/[orgSlug]/financeiro/page.tsx` | Única página. **Correção à auditoria original**: o texto de Jul/29 dizia que o módulo era exclusivo do nicho viagem — isso está **desatualizado**; hoje a página não faz gate de nicho nenhum, é genérica pra qualquer org (confirmado no código atual). `requireAuth` + `getCurrentOrganization`, busca `listFinancialEntries` + `listFinancialSettings` em paralelo. Sem sub-rota `[id]` — lançamento selecionado não é deep-linkável (ainda aberto). |

## 2. Componentes

Sem mudança desde a auditoria original — `FinanceiroTabs`, `FinancialDashboard`, `FinancialEntriesView`, `FinancialSettingsView`, `FinancialCsvImporter`, gráficos Recharts. Todos os problemas de UI/mobile listados em Jul/29 **continuam abertos** (breakpoints inconsistentes, número mágico de altura, filtros sem UI compacta, gráficos com altura fixa, listas sem busca) — não foram tocados nesta sessão, que focou em segurança/dados.

## 3. Server Actions

### `actions/financial.ts`

**Achado principal desta revisão — corrigido**: as 12 funções de agregação read-only do dashboard (`getFinancialSummary`, `getFinancialKpis`, `getCashFlowSeries`, `getExpensesByCategory`, `getRevenueBreakdown`, `getExpenseBreakdown`, `getSimpleDRE`, `getDailyCashFlow`, `getUpcomingDueEntries`, `getCashFlowProjection`, `getAccountsOverview`, `getStrategicIndicators`) resolviam a org mas **nunca chamavam `checkMemberPermission`** — só as actions de escrita e as de leitura mais óbvias (`listFinancialEntries`, `getFinancialEntry`) checavam. Qualquer membro autenticado da organização, mesmo com `permissions.financial` explicitamente `false`, conseguia ler receita/despesa/fluxo de caixa/contas a pagar-receber/indicadores estratégicos completos chamando a Server Action diretamente (sem precisar da UI). **Corrigido**: `requireFinancialAccess()` centraliza a checagem, aplicada nas 12 funções.

`syncSaleRevenueEntry` não precisa desse gate — é uma chamada interna disparada depois que `saveTravelSaleAndGenerateTasks` (Reservas) já validou a permissão de quem está salvando a venda; não é invocável diretamente pelo cliente com um `orgSlug` arbitrário de fora desse fluxo.

### `actions/financial-settings.ts`

Todas as 4 funções (`listFinancialSettings`, `createFinancialSetting`, `updateFinancialSettingPaymentSchedule`, `deleteFinancialSetting`) já checavam `checkMemberPermission('financial')` — **sem gap encontrado aqui**, nada a corrigir.

## 4. Permissões

Chave: **`financial`**. Gap de leitura da auditoria original (item 1) **corrigido nesta revisão** — as 12 agregações listadas acima. A página em si ainda não chama `checkMemberPermission` diretamente, mas como toda a cadeia de dados abaixo dela agora falha fechado (lança erro/retorna vazio sem permissão), não há mais vazamento de dado — mesma situação já observada em Vendas.

**Guard de impersonação — reclassificado, não é bug**: a auditoria original apontava "inconsistente: só os deletes bloqueiam, create/update não" como problema. Revisão confirma que esse é o **padrão consistente do projeto inteiro** (`deleteFinancialEntry`, `deleteFinancialSetting`, `deleteAdAccount`, `attachSignedContract`-adjacent flows, etc. bloqueiam; criações/edições reversíveis não) — impersonação existe pra suporte/debug, e bloquear só o irreversível (hard delete) é a decisão de design deliberada, não uma lacuna. Removido da lista de problemas.

## 5. Conexões com outros módulos

- **Reservas → Financeiro**: `syncSaleRevenueEntry`, sem mudança.
- **Vendas (genérico) → Financeiro**: **novo nesta sessão** — `createSale` (`actions/sales.ts`) gera parcelas em `financial_entries` quando a venda é de um plano recorrente (nicho tráfego). Ainda não existe pra vendas avulsas comuns (ver `docs/audit/vendas.md`, achado #3).
- **Config de dia de pagamento do operador**: sem mudança — `ilike` contra `sale.operator`, ainda falha silenciosamente sem vencimento se o nome não bater (achado antigo, ainda aberto, não corrigido nesta rodada — é uma melhoria de UX/robustez, não uma falha de segurança).

## 6. Notas de mobile

Sem mudança — ver auditoria original.

## Lista de problemas concretos (atualizada)

1. ~~**[Segurança]** Página só verifica nicho, não permissão~~ — **Parcialmente resolvido**: a premissa "só verifica nicho" estava desatualizada (a página não gateia por nicho há tempo); o gap real (agregações sem `checkMemberPermission`) foi encontrado e corrigido nesta revisão.
2. ~~Guard de impersonação inconsistente~~ — **Reclassificado**: é o padrão consistente do projeto (só bloqueia hard-delete), não um bug.
3. `syncSaleRevenueEntry` — match de operador por `ilike` sem feedback de falha — **ainda aberto**.
4. `FinancialDashboard` — breakpoints inconsistentes entre KPIs e gráficos — **ainda aberto**.
5. Tabela de DRE sem `overflow-x-auto` — **ainda aberto**.
6. `FinancialEntriesView` — altura com número mágico — **ainda aberto**.
7. Barra de filtros pode quebrar em telas estreitas — **ainda aberto**.
8. Tabela de preview do CSV sem scroll horizontal — **ainda aberto**.
9. **[Funcional]** Import de CSV sempre cai em "A categorizar" — **ainda aberto**.
10. Detecção de tipo por sinal `-` só (não trata parênteses) — **ainda aberto**.
11. Gráficos com altura fixa não responsiva — **ainda aberto**.
12. Listas de configuração sem busca — **ainda aberto**.
13. Sem sub-rota `[id]` — lançamento não é deep-linkável — **ainda aberto**.
14. **[Segurança, novo]** 12 agregações do dashboard sem checagem de permissão — **corrigido nesta revisão**.
