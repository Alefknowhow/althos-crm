# Auditoria — Módulo Reservas

> Gerado em 2026-07-29, **revisado em 2026-08-23** (retomada da auditoria
> completa). Ver também `docs/audit/pipeline.md`, `docs/audit/contatos.md`,
> `docs/audit/cotacoes.md`.

## 1. Rotas

| Rota | Arquivo | Função |
|---|---|---|
| `/app/[orgSlug]/reservas` | `app/app/[orgSlug]/reservas/page.tsx` | Lista/detalhe principal. Guarda `requireAuth` + `isTravelNiche`. Busca `listTravelSales`, `listProposals`, `listOrgMembers`, `listLeadsForPicker` em paralelo, renderiza `TravelSalesView` com botão de header linkando pra config do template de contrato. Lê `?sale=` pra pré-selecionar. |
| `/app/[orgSlug]/reservas/contrato-padrao` | `.../contrato-padrao/page.tsx` | Editor do template de contrato da org (Tiptap, reaproveitado do módulo de e-mail). |
| `/app/[orgSlug]/reservas/[saleId]/contrato` | `.../[saleId]/contrato/page.tsx` | Gera/imprime contrato. Chama `markContractGenerated` (idempotente). Usa template customizado da org se existir (`ContractTemplatePrintView`), senão fallback hardcoded (`ContractPrintView`). |
| `/voucher-print/[orgSlug]/[saleId]` | `app/voucher-print/[orgSlug]/[saleId]/page.tsx` | **Movida propositalmente pra fora de `app/[orgSlug]`** (comentário no arquivo) pra não herdar sidebar/header do CRM — só o layout raiz. Renderiza `VoucherPrintView`. |

Todas as 4 rotas duplicam verbatim o mesmo guard `requireAuth` → `getCurrentOrganization` → `isTravelNiche`, sem helper compartilhado.

## 2. Componentes

| Componente | Papel | Problemas encontrados |
|---|---|---|
| `TravelSalesView.tsx` (1127 linhas) | Componente principal: lista mestre + editor inline (`SaleEditor`), diálogo "Nova venda", sub-diálogo de voos, popover de contato. **Vive em `components/features/proposals/`, não `reservas/`** — inconsistência de local/nome com o resto do módulo. | Ver detalhamento abaixo — arquivo de maior densidade de problemas. |
| `VoucherPrintView.tsx` (356 linhas) | Voucher imprimível com seções condicionais por item incluso, QR code de check-in, botões de compartilhar. | Toolbar on-screen com 3 botões full-size (sem `size="sm"`) pode quebrar em telas estreitas. Sem loading/empty state se os campos da venda estiverem vazios — só imprime um documento quase em branco. |
| `ContractPrintView.tsx` (183 linhas) | Contrato fallback hardcoded (quando a org não tem template customizado). | Totalmente desktop-oriented (`max-w-[210mm]`), sem tratamento responsivo além do `flex-wrap` da toolbar on-screen. |
| `ContractTemplatePrintView.tsx` (90 linhas) | Renderiza o template Tiptap customizado da org via `dangerouslySetInnerHTML`. | CSS de impressão duplicado verbatim em 3 arquivos diferentes (este + `ContractPrintView` + `VoucherPrintView`) em vez de um componente/stylesheet compartilhado. |
| `ContractTemplateEditor.tsx` (70 linhas) | Editor de template na página de config, reaproveita `TiptapEmailEditor` do módulo de e-mail. | Legenda de ~15 campos de merge (`{{sale.x}}`/`{{org.x}}`) é um parágrafo longo sem agrupamento visual — difícil de escanear, principalmente no mobile. |
| `SaleTasksList.tsx` (61 linhas) | Lista de tarefas vinculadas à venda, embutida no `SaleEditor`. | Retorna `null` tanto durante loading quanto quando vazio — sem skeleton, indistinguível de "sem tarefas" numa conexão lenta. |
| `CancelTravelSaleDialog.tsx` | Cancela venda, cria crédito de viagem obrigatoriamente. | `grid sm:grid-cols-2` pra 3 campos deixa "Validade" órfã sozinha na segunda linha com espaço morto ao lado. |
| `ApplyCreditDialog.tsx` | Lista créditos disponíveis do contato pra aplicar na venda. | Sem paginação/scroll — cliente com muitos créditos faz o diálogo crescer sem limite. |
| `AttachSignedContractButton.tsx` | Upload de contrato assinado (empurra pro mesmo array `vouchers`). | Comentário no código já documenta isso como placeholder para integração futura de assinatura eletrônica (Clicksign/Autentique/DocuSign) — dívida técnica conhecida. |

### `TravelSalesView` — detalhamento de layout/responsivo

- **Grid lista/detalhe** (`grid md:grid-cols-[320px_1fr]`): abaixo de `md` não há grid — visibilidade alternada via **3 condições booleanas independentes** (`selected && 'hidden md:flex'` na barra de filtros, `selected && 'hidden md:block'` na lista, `!selected && 'hidden md:flex'` no detalhe) codificando o mesmo estado de 3 formas diferentes — frágil, fácil de dessincronizar ao adicionar um novo painel.
- **Cabeçalho mobile duplicado**: bloco `md:hidden` inteiro reproduz nome do cliente/destino/data/ID já mostrados no bloco desktop acima — duas árvores JSX paralelas pra mesma informação, em vez de um único layout responsivo.
- **Grid "Dados da viagem"**: 9 campos (Cliente, Destino, Valor, 2 datas, Tempo de negociação, Hotel, Cia aérea, Operadora) todos numa única grade `sm:grid-cols-2 lg:grid-cols-3` sem subagrupamento lógico — contribui pra tela poluída.
- **Grid "Dados operacionais"**: usa `lg:grid-cols-4` pra só 3 campos, deixando uma coluna órfã vazia — assimétrico com a grade de 9 campos logo acima.
- **Linhas de viajantes**: larguras fixas ad hoc (`min-w-[180px]`, `w-36`, `w-40`) misturadas com `flex-wrap` — empilha estranho em telas estreitas, botão de excluir fica desalinhado.
- **3 padrões diferentes de "pill/chip" selecionável** (forma de pagamento, itens inclusos, direção do voo no `FlightsDialog`) implementados à mão com `<button>` cru + `FOCUS_RING` manual, em vez do `Button`/`Toggle` compartilhado.

## 3. Server Actions

### `actions/travel-sales.ts`

| Action | Propósito | Tabela(s) |
|---|---|---|
| `listTravelSales` / `getTravelSale` | Lista (máx 500)/busca venda | `travel_sales` |
| `updateTravelSale` | Patch genérico dos campos editáveis (permissão `reservas`) | `travel_sales`: WRITABLE (client_name, destination, datas, total_cents, hotel_name, airline, operator, services, included_items, vouchers, travelers, payment_method, locators, commission_cents, notes, cancellation_policy, important_info, service_info, **flights**) |
| `deleteTravelSale` | Exclusão (bloqueada sob impersonação, permissão `reservas`) | `travel_sales` |
| `cancelTravelSale` | Cancela + cria crédito de viagem via `createCredit` | `travel_sales.status`; `travel_credits` insert |
| ~~`toggleSaleChecklistStep`~~ | Alterna uma das 4 colunas de checklist | **Removido em 2026-08-23** — confirmado código morto, nenhum caller no app |
| `markContractGenerated` | Marca `contrato_gerado_at` (idempotente) | `travel_sales.contrato_gerado_at` — já tinha `checkMemberPermission` antes desta revisão (corrigido fora desta sessão) |
| `getContatoTravelerInfo` | Pré-preenche viajante a partir do contato | `contatos` (nome/cpf/data nasc.) |
| `attachSignedContract` | Anexa contrato assinado ao array `vouchers` | `travel_sales.vouchers` |
| `createTravelSale` | "Nova venda" manual; prefill opcional de proposta | `travel_sales` insert; lê `travel_proposals`; cria notificação |
| `saveTravelSaleAndGenerateTasks` | Salva venda + sincroniza receita no Financeiro + gera 3-4 tarefas operacionais (idempotente por `tasks_generated_at`) | `travel_sales`, `tasks` insert, `financial_entries` (via `syncSaleRevenueEntry`) |
| `maybeCreateTravelSaleOnWon` | Cria venda automática quando lead vira "ganho" com proposta vinculada | `travel_proposals` (leitura), `travel_sales` insert |

### `actions/upload.ts`
- `uploadSaleVoucher` — upload de voucher/PDF (≤15MB) pro bucket `form-assets`.

### `actions/document-extract.ts`
- `extractTravelDocument` — extração via Claude vision (gatilho "Preencher com IA"); permissão `reservas` OU `cotacoes` (compartilhado com "Orçamento IA"); consome créditos de IA.

## 4. Permissões

Chave: **`reservas`**. Toda action mutante já checava (`updateTravelSale`, `deleteTravelSale`, `cancelTravelSale`, `attachSignedContract`, `createTravelSale`, `saveTravelSaleAndGenerateTasks`, `markContractGenerated`). **Gap real encontrado nesta revisão**: 3 funções de leitura sem checagem — `listTravelSales`, `getTravelSale` (usada também por `actions/contracts.ts::getContractRenderData` na geração de contrato) e `getContatoTravelerInfo`. **Corrigidas.**

## 5. Conexões com outros módulos

- **Contatos**: `sale.contato_id` FK; `getContatoTravelerInfo` puxa dados de viajante. O bug de deep-link (`?venda=` vs `?sale=`) reportado em Jul/29 **já não existe** — confirmado que `/contatos/[id]` usa `?sale=${c.origem_sale_id}`, batendo com o que `reservas/page.tsx` lê. Corrigido fora desta sessão.
- **Cotações**: `sale.proposal_id` FK; `createTravelSale`/`maybeCreateTravelSaleOnWon` usam `mapProposalToSaleFields` pra prefill a partir de uma proposta.
- **Tarefas**: `saveTravelSaleAndGenerateTasks` insere em `tasks` com `sale_id`+`contato_id`; `SaleTasksList` lê/alterna via `actions/tasks.ts`.
- **Documentos**: geração de contrato lê `document_templates`/`organizations.contract_template_id`; voucher/contrato são impressos client-side (`window.print()`), sem PDF persistido a menos que o usuário reenvie manualmente.
- **Financeiro**: `saveTravelSaleAndGenerateTasks` sincroniza uma entrada de receita (`financial_entries`, categoria "Comissão") vinculada por `venda_id`, usando o dia de pagamento configurado do operador.
- **Créditos de viagem**: `cancelTravelSale` cria crédito; `ApplyCreditDialog` consome via `applyCreditToSale`.

## 6. Notas de mobile

- `TravelSalesView` é responsivo via estratégia de "trocar dois painéis inteiros" (3 condições booleanas independentes — ver acima), não um layout fluido de verdade.
- Height-fill flexbox (`flex-1 min-h-0` + `h-full overflow-y-auto`) funciona mas não tem comentário explicativo no código, ao contrário de outras decisões de UI do mesmo arquivo — risco de quebrar ao aninhar novos componentes sem perceber o padrão.
- Botões de ação do header colapsam texto via `hidden sm:inline` (ícone-só abaixo de `sm`) — ~7 botões ícone-só numa fileira, sem agrupamento entre ações de salvar e destrutivas (Cancelar/Excluir ficam ao lado de Gerar contrato só diferenciados pela cor).
- Views de impressão são desktop/print-first (`max-w-[210mm]`) — aceitável pra impressão, mas não há um "modo preview mobile" antes de imprimir.

## Lista de problemas concretos

1. `TravelSalesView.tsx` está em `components/features/proposals/`, não `reservas/` — inconsistência de local.
2. ~~**Bug de deep-link**: `?venda=` vs `?sale=`~~ — **Já corrigido** (confirmado nesta revisão, fora desta sessão).
3. ~~`toggleSaleChecklistStep` e suas 4 colunas — código morto~~ — **Removido em 2026-08-23.**
4. ~~`markContractGenerated` sem `checkMemberPermission`~~ — **Já corrigido** antes desta revisão. Gap real encontrado: `listTravelSales`/`getTravelSale`/`getContatoTravelerInfo` sem checagem — **corrigido em 2026-08-23.**
5. CSS de impressão duplicado verbatim em 3 componentes — devia ser compartilhado.
6. 3 condições booleanas independentes controlando o mesmo estado de "qual painel mostrar" no mobile.
7. Cabeçalho mobile duplicado (bloco `md:hidden` inteiro repetindo dados do bloco desktop).
8. Grid "Dados da viagem" com 9 campos sem subagrupamento — tela poluída.
9. Grid "Dados operacionais" com 4 colunas pra 3 campos — coluna órfã.
10. Linhas de viajante com larguras fixas ad hoc, empilhamento estranho no mobile.
11. 3 padrões diferentes de "chip selecionável" implementados à mão em vez do componente compartilhado.
12. `CancelTravelSaleDialog` — grid 2 colunas pra 3 campos, "Validade" órfã.
13. `SaleTasksList` — `null` tanto em loading quanto vazio, sem skeleton.
14. `ApplyCreditDialog` — sem scroll/paginação pra lista de créditos.
15. `VoucherPrintView` — toolbar on-screen com botões de tamanho inconsistente com o resto do app.
16. `ContractTemplateEditor` — legenda de merge fields sem categorização, ruim no mobile.
17. As 4 rotas duplicam o guard de auth/niche verbatim — sem helper compartilhado.
18. Assinatura eletrônica é só um placeholder manual (upload) — gap de produto conhecido, já documentado no código.
