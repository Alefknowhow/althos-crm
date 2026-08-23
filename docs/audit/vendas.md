# Auditoria — Módulo Vendas

> Gerado em 2026-07-29. Faz parte da auditoria completa do app. Ver também os demais docs em `docs/audit/`.

## 0. Distinção confirmada

"Vendas" é o módulo **genérico não-viagem**, gateado por nicho (`!isTravelNiche`) — completamente separado de "Reservas" (`travel_sales`, auditado à parte). `lib/dashboard/sales-source.ts` documenta explicitamente essa divisão: `fetchNormalizedSales()` lê `travel_sales` pro nicho viagem e `sales` pros demais nichos, unificando os dois numa forma normalizada pro dashboard.

## 1. Rotas

| Rota | Arquivo | Função |
|---|---|---|
| `/app/[orgSlug]/vendas` | `app/app/[orgSlug]/vendas/page.tsx` | Única página — sem `[id]`, sem sub-rotas. Busca `listSales`, `listActiveProducts`, `listOrgMembers` em paralelo, computa KPIs do mês client-side, renderiza 3 KPI cards + `SalesTable`. |

`getSale(orgSlug, id)` existe em `actions/sales.ts` mas **nunca é chamado em lugar nenhum** — código morto (não há página de detalhe).

## 2. Componentes

| Componente | Papel | Problemas encontrados |
|---|---|---|
| `SaleDialog.tsx` | Diálogo de criar/editar venda. | Grid de 4 colunas (Data/Qtd/Valor) colapsa pra 2 no mobile, mas o campo de valor (`col-span-2`) fica espremido ao lado de Data/Qtd — sem empilhamento de coluna única, diferente do bloco de campos logo acima que usa `grid-cols-1 md:grid-cols-2`. |
| `SalesTable.tsx` | Lista de vendas, edição/exclusão inline. | Colunas de Vendedor e Forma de pagamento/parcelas **escondidas abaixo de `lg` sem fallback inline** (ao contrário de Lead/Status, que têm fallback duplicado dentro da célula do item) — usuário mobile/tablet não vê quem vendeu nem como foi pago sem abrir o diálogo de edição. `overflow-x-auto` torna a tabela scrollável horizontalmente em vez de verdadeiramente responsiva. |
| `LeadCombobox.tsx` | Seletor de lead com busca (reaproveitado). | Combo `Popover`/`Command` dentro de um diálogo já scrollável (`max-h-[90vh]`) pode criar scroll aninhado em telas pequenas. |

## 3. Server Actions (`actions/sales.ts`)

| Action | Propósito | Tabela |
|---|---|---|
| `listSales` | Lista todas as vendas da org | `sales` join `leads`, `products` — **sem verificação de permissão** |
| `getSale` | Busca uma venda | `sales` — **código morto**, nenhuma chamada em lugar nenhum |
| `createSale` | Cria venda (validada por `saleInputSchema`) | `sales` insert; dispara notificação push/in-app (`new_sale`) best-effort |
| `updateSale` | Atualização parcial | `sales` update — **usa `.partial()` no schema inteiro**, permitindo omitir campos obrigatórios sem erro de validação |
| `deleteSale` | Exclusão | `sales` delete |
| `listActiveProducts` | Opções de produto pro seletor | `products` (ativos) |
| `listOrgMembers` | Opções de vendedor pro seletor | `memberships` |

Toda action de escrita chama `checkMemberPermission(org.id, user.id, 'sales')` e `isAccessBlocked` (congelamento). **Actions de leitura (`listSales`, `getSale`, `listActiveProducts`, `listOrgMembers`) não têm verificação de permissão nenhuma.**

## 4. Permissões

Chave: **`sales`**, marcada como `NON_TRAVEL_ONLY_KEYS` (só relevante pra orgs fora do nicho viagem). Gating duplo no menu: `can('sales') && !isTravelNiche`. **Gap**: a página (`vendas/page.tsx`) nunca chama `checkMemberPermission` — só as actions de escrita checam. Um membro sem a permissão `sales` ainda consegue acessar a página e ler todos os dados de vendas via URL direta.

## 5. Conexões com outros módulos

- **Contatos**: `sales.contato_id` FK; `SaleDialog` usa `LeadCombobox`/`searchLeads`. Reverso: `/contatos/[id]` busca e mostra o histórico de vendas do contato.
- **Catálogo**: `sales.product_id` FK; selecionar produto auto-preenche `amount_cents = price_cents * quantity`. **Gap conhecido**: a página de detalhe do produto (`/catalogo/[id]`) tem um TODO explícito no código admitindo que o histórico de vendas por produto ainda não é mostrado ali — assimetria com o que já existe em Contatos.
- **Financeiro**: **sem integração nenhuma encontrada** — vendas completas na tabela `sales` não geram lançamento financeiro/ledger correspondente; a receita só aparece via agregações de dashboard, não no modelo de dados do Financeiro. Gap real a ser considerado.
- **Dashboard/Insights/Relatórios**: `lib/dashboard/sales-source.ts`, `actions/dashboard-tabs.ts` (ticket médio, mais vendidos), `actions/reports.ts` (relatório tipo `'sales'`), e `lib/ai/insights-tools.ts` (Copiloto de IA) todos consomem a tabela `sales` diretamente.

## 6. Notas de mobile

- Sem componente/layout mobile dedicado — responsividade só via classes Tailwind (`hidden sm:table-cell`, `hidden md:table-cell`, `hidden lg:table-cell`) + fallback de scroll horizontal.
- Fallback parcial tipo "card" construído à mão na primeira célula da tabela (nome do lead + badge de status duplicados quando as colunas somem), mas vendedor e pagamento **não têm esse fallback**.
- Botão de abrir `SaleDialog` colapsa pra ícone-só abaixo de `sm`.
- Grid de KPIs empilha limpo em coluna única no mobile — sem problema ali.
- Grid do formulário do diálogo colapsa de até 4 colunas pra 2 (nunca pra 1) — principal ponto de aperto no mobile.

## Lista de problemas concretos

1. **[Segurança]** Página e actions de leitura sem verificação de permissão — só as actions de escrita checam `sales`.
2. Código morto: `getSale()` nunca é chamado.
3. **[Funcional]** Sem integração com Financeiro — vendas completas não geram lançamento financeiro.
4. Página de detalhe de produto no Catálogo com TODO explícito — histórico de vendas por produto ainda não implementado.
5. `SalesTable` — vendedor e forma de pagamento escondidos abaixo de `lg` sem fallback inline (diferente de lead/status, que têm).
6. `SaleDialog` — grid de 4 colunas cramped em telas estreitas, sem empilhamento de coluna única.
7. `listSales` engole erros do Supabase silenciosamente, retornando `[]` — usuário vê "sem vendas" em vez de erro real.
8. `updateSale` usa `.partial()` no schema inteiro — permite atualização que omite campos obrigatórios sem validação.
9. Auto-preenchimento de valor só funciona na criação; editar quantidade numa venda existente nunca recalcula — comportamento razoável mas não documentado.
