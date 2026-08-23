# Auditoria — Módulo Vendas

> Gerado em 2026-07-29, **revisado em 2026-08-23** como parte da
> retomada da auditoria completa (módulo bastante alterado nesta
> sessão: assinatura de plano, contrato, integração parcial com
> Financeiro). Ver também `docs/audit/agencias-trafego.md`.

## 0. Distinção confirmada

"Vendas" é o módulo **genérico não-viagem**, gateado por nicho (`!isTravelNiche`) — completamente separado de "Reservas" (`travel_sales`, auditado à parte). `lib/dashboard/sales-source.ts` documenta explicitamente essa divisão.

## 1. Rotas

| Rota | Arquivo | Função |
|---|---|---|
| `/app/[orgSlug]/vendas` | `app/app/[orgSlug]/vendas/page.tsx` | Busca `listSales`, `listActiveProducts`, `listOrgMembers` em paralelo, KPIs do mês client-side, `SalesTable`. |
| `/app/[orgSlug]/vendas/[saleId]/contrato` | novo (nicho tráfego) | Página de impressão do contrato de assinatura de plano — `getPlanContractRenderData` + `PlanContractPrintView`. |

`getSale(orgSlug, id)` — ✅ removido nesta auditoria (confirmado sem nenhum consumidor).

## 2. Componentes

| Componente | Papel | Problemas encontrados |
|---|---|---|
| `SaleDialog.tsx` | Diálogo de criar/editar venda. | Grid de 4 colunas ainda cramped no mobile (achado antigo, não corrigido). Ganhou campos condicionais "Início do serviço"/"Duração" quando `isTraffic && produto.is_recurring` — bem isolados, sem regressão visual nos demais nichos. |
| `SalesTable.tsx` | Lista de vendas, edição/exclusão inline. | Vendedor/forma de pagamento ainda sem fallback inline abaixo de `lg` (achado antigo). Ganhou botão "Contrato" (`isTraffic && duration_months`) — correto, mas **oculta o botão silenciosamente** em vez de indicar por que não está disponível (recomendação já registrada no audit de tráfego). |
| `LeadCombobox.tsx` | Seletor de lead com busca. | Sem mudança. |

## 3. Server Actions (`actions/sales.ts`)

| Action | Propósito | Permissão |
|---|---|---|
| `listSales` | Lista vendas (join `contatos` via `leads:contatos(...)`, `products`) | ✅ `checkMemberPermission('sales')` — **corrigido desde a auditoria original** (Jul/29 apontava ausência; hoje presente em todas as actions de leitura) |
| ~~`getSale`~~ | Busca uma venda | ✅ Removido (código morto confirmado) |
| `createSale` | Cria venda + (novo) gera parcelas em `financial_entries` quando o produto é plano recorrente | ✅ Checa permissão + `isAccessBlocked` |
| `updateSale` | Atualização parcial | ✅ Checa permissão. **Gap não corrigido**: usa `.partial()` no schema inteiro — permite salvar sem campos obrigatórios. Também **não regenera parcelas** se `duration_months` for preenchido só na edição (documentado como comportamento esperado, não como bug, mas sem aviso na UI). |
| `deleteSale` | Exclusão | ✅ Checa permissão |
| `listActiveProducts` | Produtos ativos pro seletor (agora inclui `is_recurring`/`duration_months`) | ✅ Checa permissão |
| `listOrgMembers` | Vendedores pro seletor | ✅ Checa permissão |

`listSales` **ainda engloba erros do Supabase silenciosamente** (`console.error` + retorna `[]`) — foi exatamente esse padrão que mascarou o bug do embed `leads` quebrado por ~1 semana e meia em produção sem ninguém perceber a causa raiz. Recomendação mantida: pelo menos logar em nível que dispare alerta (Vercel runtime error já serve pra isso, mas só se alguém for olhar).

## 4. Permissões

Chave **`sales`**. Todas as actions (leitura e escrita) já checam — gap original da auditoria de Jul/29 **resolvido** (não sei precisar quando, não foi nesta sessão). Página em si não checa, mas como a camada de dados já falha fechado (retorna vazio), não há vazamento de dado — risco residual é só UX confusa ("por que não vejo minhas vendas?" pra quem não tem a permissão), não segurança.

## 5. Conexões com outros módulos

- **Contatos**: `sales.contato_id` FK — sem mudança.
- **Catálogo/Planos**: `sales.product_id` FK. Produto agora carrega `is_recurring`/`duration_months`/`contract_template_id` — consumidos por `SaleDialog` e pelo motor de contrato. TODO de "histórico de vendas por produto" em `/catalogo/[id]` **continua sem implementar**.
- **Financeiro**: **gap original só parcialmente resolvido.** Uma venda comum (não-recorrente, qualquer nicho) **continua sem gerar lançamento financeiro** — só vendas de plano recorrente (nicho tráfego, `duration_months` preenchido) geram `financial_entries` agora. Uma venda avulsa de R$ 5.000 numa org não-tráfego ainda não aparece em Financeiro. Se o objetivo for consistência entre nichos, isso é um gap real a considerar numa fase futura (fora do escopo desta sessão, que resolveu só o caso de assinatura).
- **Contrato/Autentique**: novo — `plan_contracts` (tabela própria, ver auditoria de Tráfego), só ativo quando `isTraffic`.
- **Dashboard/Insights/Relatórios**: sem mudança nas integrações existentes.

## 6. Segurança

Nenhum gap novo encontrado nesta revisão além dos já corrigidos na auditoria de Tráfego (contratos). `createSale`/`updateSale` seguem o padrão correto (`isAccessBlocked` + `checkMemberPermission`) em todos os pontos de escrita.

## 7. Notas de mobile

Sem mudança desde a auditoria original — grid de 4 colunas do `SaleDialog` continua sem empilhamento de coluna única, e as colunas ocultas da tabela continuam sem fallback.

## Lista de problemas concretos (atualizada)

1. ~~**[Segurança]** Página e actions de leitura sem verificação de permissão~~ — **Resolvido** (todas as actions checam hoje).
2. ~~Código morto: `getSale()` nunca é chamado.~~ — **Resolvido (removido).**
3. **[Funcional]** Sem integração com Financeiro pra vendas comuns (não-recorrentes) — **parcialmente resolvido**, só cobre assinatura de plano (nicho tráfego).
4. Página de detalhe do produto sem histórico de vendas — **ainda aberto.**
5. `SalesTable` — vendedor/pagamento sem fallback mobile — **ainda aberto.**
6. `SaleDialog` — grid de 4 colunas cramped no mobile — **ainda aberto.**
7. `listSales` engole erros silenciosamente — **ainda aberto** (foi a causa raiz do bug de produção corrigido nesta sessão; recomendo revisitar esse padrão em todo o codebase, não só aqui).
8. `updateSale` usa `.partial()` no schema inteiro — **ainda aberto.**
9. Botão "Contrato" oculto silenciosamente quando a venda não é elegível — **novo, recomendação registrada no audit de Tráfego.**
