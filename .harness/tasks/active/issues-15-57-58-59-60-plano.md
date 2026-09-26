# Plano — issues restantes: #15, #60 (+#59), #57, #58

- **Status**: active — plano aprovado para execução, nenhuma fase iniciada
- **Criado em**: 2026-09-25
- **Responsável**: Claude (Claude Code)
- **Plano irmão**: `.harness/tasks/active/trafego-22-23-27-finalizacao.md` (Tráfego). Os dois são independentes; se executar ambos, fazer o de Tráfego primeiro **ou** este — não intercalar fases (evita conflito em `lib/inngest/automation.ts` e `trigger-meta.ts`, que os dois tocam).

> **Regras de execução** (iguais ao plano de Tráfego — leia a seção "Validação" lá também):
> 1. Fases **na ordem** abaixo; passos em ordem de dependência. **Um commit por passo.**
> 2. Após cada commit: `tsc --noEmit` + `npm run lint` (0 erros; arquivo > 350 linhas é erro). Fim de fase: `next build` com o contorno do `xlsx`.
> 3. Push em `claude/vibrant-hawking-9ka67c` + fast-forward para `master` (se não for FF, `git merge origin/master`; nunca rebase/force).
> 4. **⛔ BLOQUEADO** = depende de algo externo; fazer só a parte marcada como segura. **❓ CHECKPOINT** = rodar a verificação; se divergir do esperado, parar e perguntar.
> 5. Migrations: próximo número livre em `ls supabase/migrations | tail -1` (os dois planos consomem números — sempre conferir, nunca assumir). Aplicar via `mcp__Supabase__apply_migration` (`project_id: boggtwpywbkpzkmvnbng`) + arquivo `.sql` idêntico no repo. Nunca editar migration aplicada.
> 6. Ao fim de cada fase: atualizar "Progresso" aqui, marcar checkboxes e comentar na issue; fechar a issue quando todos os critérios estiverem atendidos.

---

## 0. Estado real (consultado em produção em 2026-09-25)

| Fato | Impacto |
|---|---|
| `sale_contracts` = **0** linhas, `plan_contracts` = **0**, `contracts` (global) = 2 | **#60: não há histórico para migrar.** A "migração" vira: apontar Reservas/Tráfego para o módulo global e aposentar os fluxos legados. Risco muito menor do que o descrito na issue. |
| `social_automations` = **0** linhas | **#57 item 2: nenhuma org usa o motor antigo do Instagram.** Pode aposentar a tela/fallback sem migração (re-checar a contagem imediatamente antes). |
| `campaign_creatives` = **0** | Resolve o CHECKPOINT 1.4 do plano de Tráfego: pular migração de dados, só trocar o FK/picker. |
| `travel_sales`: sem coluna de vendedor; só `created_by`. Existe `operator` (texto = **operadora de turismo**, não pessoa) | **#15**: nome da coluna nova não pode ser `operator*` (colisão semântica). Vendedor hoje é implícito em `created_by`. |
| `travel_sales.vouchers` jsonb, itens só com `{name, url}` (14 de 16 reservas têm vouchers); URLs do bucket legado público `form-assets` | **#59**: vínculo com produto e status são extensão do jsonb, sem tabela nova. URLs públicas permanentes — não trocar para R2/URL assinada sem decisão (links impressos/enviados ao cliente dependem delas). |
| `tasks`: `assigned_to`, `sale_id`, `related_entity_type/id` | #15: tasks já têm responsável próprio — não tocar. |
| `whatsapp_conversations` já tem `assigned_agent_definition_id` e `assigned_agent_objective` (usados pelo step "Atribuir Agente IA") | #57 item 1: a correlação conversa↔agente já existe; falta sessão/resultado/retomada. |
| `automation_runs.status='waiting'` + `waiting_for_step_id` (retomada por inbound em `lib/social/generic-automation-bridge.ts` e no motor de grafo `lib/inngest/automation-run-graph.ts`) | #57: reaproveitar este mecanismo de pausa para "aguardar resultado do agente". |
| `agent_definitions` = 0 e `agent_assignments` = 0 em produção | Nenhuma org usa Agent Definitions ainda — mudanças no caminho de agente do WhatsApp afetam zero conversas até alguém configurar. |
| Nenhum `trace_id`/`correlation_id` no código | #58 item 3 é greenfield. |
| Webhook Instagram faz 2–3 queries síncronas (status de entrega/leitura) antes do `inngest.send` | #58 item 1: provavelmente aceitável; decidir com medição (Vercel runtime logs via MCP `mcp__Vercel__get_runtime_logs`). |
| `lib/automations/log-format.ts` já existe | #57 item 3 (log legível) pode estar parcialmente pronto — ler antes de implementar. |

---

## Fase A — #15 Responsável operacional da Reserva (pequena, isolada)

### A.1 Schema
- **Migration** `travel_sales_backoffice_owner.sql`:
  - `alter table travel_sales add column seller_id uuid references profiles(id) on delete set null;` — **vendedor explícito**. Backfill: `update travel_sales set seller_id = created_by where seller_id is null;` (preserva o comportamento atual em que o criador é o vendedor).
  - `alter table travel_sales add column backoffice_owner_id uuid references profiles(id) on delete set null;` — responsável operacional (nullable, sem backfill).
  - Índices `(organization_id, seller_id)` e `(organization_id, backoffice_owner_id)`.
  - Comentários SQL explicando que `operator` é a operadora de turismo (evitar confusão futura).
  - RLS: tabela já tem; colunas novas não mudam policy.
- **❓ CHECKPOINT**: conferir se `profiles(id)` é o alvo certo de FK para usuário (outras tabelas usam `profiles(id)` — ex. `library_assets.created_by`). Validar também que o membro escolhido pertence à org **na action** (FK não garante isso).

### A.2 Actions
- Em `actions/travel-sales-crud.ts` (ou onde fica o update da reserva — grep `from('travel_sales').update`): aceitar `seller_id` e `backoffice_owner_id` no schema Zod; validar ambos contra `memberships` da org (`select 1 from memberships where organization_id=? and user_id=?`) — rejeitar senão.
- `createTravelSale*`: default `seller_id = user.id` (explícito, não depender só de `created_by`).
- Timeline: gravar `contato_activities` (`type: 'reserva_backoffice_owner_changed'`) ao trocar o responsável.
- Automação (padrão de baixo risco já documentado): evento `viagens.reserva.backoffice_assigned` com `data: { orgId, leadId: contato_id, saleId, backofficeOwnerId }` + entrada no `trigger-meta.ts` (`niche: 'viagens'`) + registrar numa function com slot livre (ou nova). Opcional — incluir só se couber sem estourar arquivos.

### A.3 UI
- Tela da Reserva (`TravelSalesViewSaleEditor*.tsx` — localizar o header/resumo): dois selects "Vendedor" e "Responsável operacional (backoffice)" com membros da org (`listOrgMembers` de `actions/team.ts`, já usado no plano de projetos).
- Lista de Reservas: filtro "Responsável operacional" (inclui "Sem responsável") e coluna/avatar. Filtro "Meus (backoffice)" como atalho.
- **Tasks**: não alterar nada automaticamente (critério da issue). Ao criar task manual a partir da reserva, **pré-selecionar** o responsável operacional como sugestão editável — só se o form de task já recebe um default; senão, deixar para depois (anotar).

### A.4 Fechamento
- Critérios do #15 conferidos um a um; comentar e fechar.

---

## Fase B — #60 Contratos unificados (+ #59 item 2: indicador na Reserva)

Premissa corrigida: legado vazio → **não há migração de dados**; o trabalho é fazer Reservas e Tráfego usarem o módulo global e aposentar os fluxos paralelos.

### B.1 Registro de campos de mesclagem por origem
- `lib/contracts/merge-fields.ts`: registry `{ entityType: 'reserva'|'venda'|'oportunidade'|'cliente'|'projeto', fields: [{ key: 'sale.destino', label, resolve(ctx) }] }` + `resolveMergeFields(supabase, orgId, entityType, entityId) => Record<string,string>`.
  - `reserva`: reaproveitar exatamente os campos `{{sale.*}}` que `actions/contracts-render.ts` já resolve a partir de `travel_sales` (destino, hotel, datas, operadora, valor, pagamento, políticas) + `{{org.*}}`.
  - `venda`: `sales` + `products` + `contatos` (+ campos de plano recorrente `service_start_date`/`duration_months` que `actions/plan-contracts-render.ts` usa para Tráfego).
  - `oportunidade`/`cliente`: `contatos` (nome, email, telefone, documento) + valor da oportunidade.
  - `{{org.*}}`: nome, CNPJ, endereço (mesmo que o render atual usa).
- `createContract` (`actions/contracts-global.ts`): quando há `templateId` + entidade, preencher `fieldValues` automaticamente via `resolveMergeFields` (valores passados explicitamente têm precedência).
- Teste Vitest das funções puras de formatação (datas/moeda).

### B.2 Gestão: origem obrigatória generalizada
- `NewContractDialog.tsx` hoje exige **Venda** (`sales`). Regra do usuário: "todo contrato ligado a uma venda/assinatura e a clientes". Generalizar mantendo a regra:
  - Nicho viagens → origem **Reserva** (`travel_sales`, que é a venda do nicho); demais → **Venda** (`sales`). Opcional secundário: Oportunidade. Cliente sempre derivado da origem.
  - Nova action `listContractOriginOptions(orgSlug, type, query)` (reserva/venda/oportunidade) no lugar de `listSalesForContractPicker` (manter o antigo como wrapper se ainda usado).
  - Aceitar `?origin=reserva&id=...` na URL de `/contratos` para abrir o diálogo pré-preenchido (usado pelos atalhos B.3).
- Painel de variáveis disponíveis no editor de modelos (`ContractTemplatesTab.tsx`): listar `{{chaves}}` do registry B.1 por tipo de origem, clicáveis para inserir no TipTap.

### B.3 Atalhos e indicador nos módulos consumidores
- Componente `components/features/contracts/ContractStatusIndicator.tsx`: dado `(entityType, entityId)` busca o contrato mais recente não cancelado (`contracts where related_entity_type/id`) e mostra **ícone + texto + tooltip** (nunca só cor): Assinado ✓ / Pendente (enviado, aguardando) / Rascunho / Ausente. Clique: existente → `/contratos/[id]`; ausente → `/contratos?origin=...&id=...`.
  - Action leve `getContractStatusFor(orgSlug, type, id)`; para listas, versão em lote `getContractStatusMap(orgSlug, type, ids[])` (evita N+1).
- Onde colocar:
  - **Reserva** (`TravelSalesViewSaleEditor*.tsx`, header) — fecha o item 2 do **#59**.
  - **Venda** (`/vendas`, `SalesTable.tsx` — hoje referencia contrato legado; trocar pela coluna com o indicador).
  - **Oportunidade** (`LeadDetailDrawer`) — botão "Criar contrato".
  - **Tráfego** (`ClientContractTab.tsx`): substituir o fluxo `PlanoContrato*` por lista de contratos globais do cliente (via vendas do contato) + indicador + "Criar contrato".
- `travel_sales.contrato_gerado_at`/`contrato_assinado_at` são usados no checklist de Reservas: ao criar/assinar contrato global com origem `reserva`, **atualizar esses timestamps** (em `createContract`, `sendContractForSignature`, webhook e `refreshContractStatus`) para o checklist continuar funcionando.

### B.4 Aposentar fluxos legados
- **❓ CHECKPOINT**: re-rodar `select count(*) from sale_contracts; select count(*) from plan_contracts;` — só seguir se continuarem 0.
- Remover da UI: `ContratoManagerDialog`/`ContratoManager*Card` (Reservas) e `PlanoContrato*` (Tráfego), trocando os pontos de entrada pelo indicador/atalho B.3. Remover actions legadas **só depois** de grep confirmar zero importadores (`actions/contracts-signature.ts`, `actions/contracts-render.ts` parte de render de venda, `actions/plan-contracts*.ts`, `lib/trafego/plan-contract-autocreate.ts` — este último: entender o que ele auto-cria e reimplementar sobre `contracts` se for comportamento desejado; **❓ perguntar** se não estiver claro).
- **Não** dropar tabelas nem remover o ramo `sale_contracts` do webhook nesta fase (custo zero mantê-los, evita risco). Anotar no follow-up.
- `organizations.contract_template_id` ("contrato padrão" de Reservas) → na criação a partir de Reserva, usar esse template como default do Select.

### B.5 Envio, status e reenvio
- Reenvio do link de assinatura: `sendGlobalContractLinkByEmail(orgSlug, contractId, signerId?)` (padrão `getResend`/`clientEmailFrom`) e `...ByWhatsapp` (achar a conversa do contato: `whatsapp_conversations where contato_id` mais recente; se não houver, desabilitar o botão com motivo). Botões no `ContractSignersPanel` por signatário (cada signatário tem seu link na Autentique — **verificar** se `createAutentiqueDocument` devolve link por signatário; hoje só o do primeiro é salvo em `contracts.signature_link`. Se devolver, salvar por signatário: coluna `contract_signers.signature_link`).
- Status `rejected`/`viewed`: estender `app/api/webhooks/autentique/route.ts` (ramo global `handleGlobalContractSigned` → generalizar para `handleGlobalContractEvent`) para eventos de recusa/visualização da Autentique — **conferir os nomes reais de eventos** no payload já tratado (hoje só `signature.accepted`). Atualizar `contract_signers.status` e `contracts.status` + `contract_events`. `expired`: **decidido pelo usuário (2026-09-25): NÃO expira automaticamente.** Em vez disso, gestão manual:
  - **Excluir** (nova action `deleteContract`): só para contrato **nunca enviado** (`status in ('draft','ready')` e sem `autentique_document_id`) — apaga contrato + signatários + eventos (FKs já têm `on delete cascade`). Confirmação na UI.
  - **Cancelar** (já existe `cancelContract`): para contrato enviado e ainda não assinado. Se houver `autentique_document_id`, também tentar cancelar/remover o documento na Autentique (conferir se `lib/autentique.ts` tem mutation de delete; se não tiver, adicionar a mutation GraphQL `deleteDocument` — best-effort, não bloquear o cancelamento local se falhar, registrar em `contract_events`).
  - Contrato **assinado**: não pode ser excluído nem cancelado (registro legal) — UI esconde as duas ações e a action recusa no servidor.
- Painel de verificação: a aba Integração já lista eventos; adicionar filtro por status e por contrato.

### B.6 Eventos de Automação
- `contract.sent`, `contract.signed`, `contract.rejected` (`data: { orgId, leadId: contato do contrato, contractId }`) disparados em `sendContractForSignature`, webhook e `refreshContractStatus` (best-effort). Registrar em function com slot livre/nova + `trigger-meta.ts` (sem `niche`: é Core).
- Contato do contrato: derivar da origem (venda/reserva → `contato_id`); se não houver contato, não disparar (automação exige lead).

### B.7 Fechamento
- Fechar **#60**. No **#59**, marcar item 2 como feito (issue continua aberta pelo item 1 → Fase C).

---

## Fase C — #59 item 1 + redesign das abas da Reserva (referências do usuário)

**Referências visuais (fornecidas pelo usuário em 2026-09-25, versionadas no repo — abrir com Read antes de começar):**
- `docs/design-refs/reservas/abas-internas-modulo.png` — **padrão global de abas horizontais internas dos módulos** (segmented control).
- `docs/design-refs/reservas/aba-produtos.png` — aba Produtos.
- `docs/design-refs/reservas/aba-viajantes.png` — aba Viajantes.
- `docs/design-refs/reservas/aba-vouchers.png` — aba Vouchers.

Regra do usuário: **copiar layout e organização; manter os campos e a estrutura de dados atuais** (não remover campo nenhum só porque não aparece na imagem). As imagens são tema escuro/claro de mock — implementar com tokens (`bg-muted`, `bg-background`, `text-muted-foreground`, `border`), funcionando nos dois temas; nada de hex hardcoded (exceto as cores de identificação por tipo de produto, ver C.3).

Arquivos atuais (em `components/features/proposals/`): `TravelSalesViewSaleEditor.tsx` (define as abas, linhas ~240), `...DadosTab.tsx`, `...ViajantesTab.tsx`, `...VouchersTab.tsx`, `...Header.tsx`; Produtos usa `SaleProductInlineForm.tsx` (grep a localização). Abas hoje: Dados da reserva · Viajantes · Vouchers · Tarefas · Produtos.

### C.1 Componente global de abas internas (padrão do Design System)
- Descrição da referência: container arredondado (`rounded-xl`) com fundo sutil (`bg-muted`), padding ~4px; triggers só texto (sem ícone), `text-sm`, cor `text-muted-foreground`; **ativo** = pílula preenchida `bg-background` (ou `bg-secondary` no escuro) com `shadow-sm`, texto `text-foreground font-medium`, `rounded-lg`; sem underline.
- `components/ui/` é gerado (shadcn) — **não editar `tabs.tsx`**. Criar `components/design/ModuleTabs.tsx` exportando `ModuleTabs`, `ModuleTabsList`, `ModuleTabsTrigger`, `ModuleTabsContent` que envolvem os primitives de `@/components/ui/tabs` só com `className`. Rolagem horizontal em telas estreitas (`overflow-x-auto`, sem quebrar linha).
- Aplicar na Reserva (C.2). **Adoção nos demais módulos** (Biblioteca, Contratos, Portal, Voice — a própria referência é da tela de Voice: Visão geral / Chamadas / Agente de Voice AI / Números / SMS): fazer num commit separado, trocando só os `TabsList`/`TabsTrigger` de navegação interna de módulo (não diálogos/formulários). Listar com `grep -rn "TabsList" app components/features` e trocar os que são navegação de página. Registrar o padrão no CLAUDE.md (seção Design System).

### C.2 Ordem e shell das abas da Reserva
- Nova ordem (numeração da referência): **Dados da reserva · Produtos · Viajantes · Vouchers · Tarefas** (Tarefas não aparece na referência → fica por último, mantida).
- Trocar para `ModuleTabs`. Manter contagem em Viajantes (ex.: "Viajantes 4") como texto discreto.
- Referência mostra cada aba como **seção em card branco arredondado** (`rounded-2xl border bg-card p-4`) com título pequeno em caixa-alta cinza (`text-xs font-semibold uppercase tracking-wide text-muted-foreground`), ex.: "PRODUTOS (HABILITADOS CONFORME A ABA 1)".

### C.2b Regra "produtos habilitados conforme Dados da reserva" (aprovada pelo usuário em 2026-09-25)
Base existente: na aba Dados há o checklist **"O que está incluso"** → `travel_sales.included_items` (string[]; chaves de `INCLUDED_ITEMS` em `components/features/proposals/TravelSalesViewShared.tsx`), além do legado `travel_sales.services` (`transfer`/`insurance`/`car_rental`). Produtos: `sale_products.kind` ∈ `aereo, hospedagem, transfer, passeio, cruzeiro, seguro, ingresso, veiculo, outro` (migration 0198).
- **Mapa central** em `lib/travel/product-types.ts` (mesmo arquivo do mapa de ícone/cor/label da C.3):
  `voos→aereo · hospedagem→hospedagem · transfer→transfer · cruzeiros→cruzeiro · seguro→seguro · passeios→passeio · carros→veiculo · ingressos→ingresso · servicos→outro`; legado `services`: `transfer→transfer · insurance→seguro · car_rental→veiculo`.
- **Normalização na leitura** (produção tem itens em texto livre de versões antigas — ex.: "Hospedagem", "Seguro viagem", "Aéreo ida e volta", "Transfer aeroporto ⇄ hotel", "Taxas e impostos"): função pura `normalizeIncludedKeys(included, services)` que reconhece as chaves e os rótulos conhecidos sem diferenciar maiúsculas/acentos (`Aéreo…/Voo…`→voos, `Hospedagem`→hospedagem, `Transfer…/Traslado`→transfer, `Seguro…`→seguro, `Cruzeiro…`→cruzeiros, `Passeio…`→passeios, `Ingresso…`→ingressos, `Locação/Carro…`→carros). Texto livre não reconhecido é **ignorado pela regra e preservado no banco** (é exibido em outros lugares, ex. proposta pública). **Nunca reescrever `included_items` existente por causa da normalização.**
- `enabledProductKinds(included, services): Set<Kind>` = kinds mapeados das chaves normalizadas. Testes Vitest: chaves novas, rótulos legados, texto livre ignorado, lista vazia.
- **Comportamento na aba Produtos:**
  1. "+ Adicionar produto" lista **habilitados primeiro**; os não habilitados aparecem abaixo, esmaecidos, com ação **"Habilitar em Dados"** que marca o item correspondente em `included_items` (mesma `toggleIncluded` da aba Dados, salvando a reserva) e já cria o card — evita obrigar o usuário a trocar de aba.
  2. **Nenhum item marcado em Dados** (reservas antigas/novas vazias): todos os tipos ficam disponíveis + aviso discreto "Marque em Dados da reserva o que está incluso para filtrar os produtos" com link que troca para a aba Dados. Não bloquear.
  3. **Produtos já existentes nunca somem** nem ficam somente-leitura por causa da regra — mesmo que o tipo não esteja marcado (mostrar um aviso pequeno no card: "Tipo não marcado como incluso em Dados — Marcar").
- **Sincronização inversa** (consistência): ao criar produto de um tipo não marcado por qualquer caminho (manual após "Habilitar", OCR do `VoucherExtractDialog`, IA/agente `import_travel_voucher` se criar produto — grep os pontos que inserem em `sale_products`), marcar automaticamente o item em `included_items` no servidor (action que insere o produto faz o `update` do array com a chave canônica, sem duplicar e sem remover textos livres). Centralizar em um helper `ensureIncludedForProductKind(supabase, saleId, kind)`.
- **Desmarcar** um item em Dados que tem produtos daquele tipo: confirmar "Existem N produto(s) de Hospedagem nesta reserva — eles continuam salvos. Desmarcar mesmo assim?"; nunca apagar produto.
- `outro` (Serviços): habilitado pela chave `servicos`; se nada estiver marcado, cai na regra 2.

### C.3 Aba Produtos (layout da referência, campos atuais)
- Um **card por produto** (`rounded-xl bg-muted/50 p-4`), empilhados com gap, dentro do card da seção.
- Header do card: **ícone em quadrado arredondado colorido** (≈28px, ícone branco) + nome do tipo em negrito; à direita, **chip** de estado OCR quando aplicável: "Leitura OCR disponível" (tipo suporta OCR e ainda não foi lido) / "Preenchido via OCR do voucher" (dados vieram de OCR) — só se o dado de origem existir hoje; **conferir** se há flag de origem OCR no produto (grep `ocr` em `SaleProductInlineForm`/actions de produto). Se não houver, mostrar só "Leitura OCR disponível" para tipos com extrator (aéreo: `lib/ai/flight-ocr-extract.ts`; hospedagem/outros: `VoucherExtractDialog`) e anotar.
- Cores por tipo (identidade de categoria, única exceção permitida a cor fixa — definir num mapa central `lib/travel/product-types.ts` junto com ícone e label): Aéreo = azul (Plane), Hospedagem = verde (Home/BedDouble), Transfer = laranja (Car), Seguro viagem = rosa (ShieldPlus/Umbrella), Cruzeiro = ciano (Ship), Ingressos/Passeios = roxo (Ticket), Outros = cinza (Package). Manter **todos os tipos já suportados** (conferir a lista real).
- Corpo: **grid de 4 colunas** (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3`), cada campo = label pequeno (`text-xs text-muted-foreground`) + **campo preenchido com fundo** (`bg-background` ou `bg-muted`, `rounded-md`, sem borda forte, `h-9`). **Os campos são editáveis no próprio card** (a referência mostra os valores já dentro dos inputs, sem modo "ver/editar"): substituir o padrão atual expandir-para-editar por inputs sempre visíveis, com **salvamento por card** (botão "Salvar" que aparece só quando o card está sujo, + atalho Enter) — não salvar a cada tecla. Remover/ações secundárias num menu `⋯` no header do card.
- Campos = **exatamente os atuais de cada tipo** (mapear em `SaleProductInlineForm.tsx` antes de reescrever; checklist campo a campo no commit). Exemplos da referência só orientam ordem/agrupamento: Aéreo (Cia, Nº voo, Localizador, Origem→Destino, Saída, Chegada); Hospedagem (Hotel, Categoria do quarto, Regime, Check-in, Check-out); Transfer (Telefone, Retirada, Retorno, Ponto de encontro); Seguro (Seguradora, Nº apólice, Cobertura, Vigência).
- Rodapé: botão largura total **tracejado** `+ Adicionar produto` (`border-dashed rounded-xl text-muted-foreground`), abrindo seletor de tipo (popover com os tipos + ícones coloridos) que cria o card vazio em modo editável.
- Extrair componentes para não passar de 350 linhas: `ProductCard.tsx`, `ProductFieldsGrid.tsx`, `AddProductButton.tsx`.

### C.4 Aba Viajantes (layout da referência)
- Tabela dentro de container `rounded-xl bg-muted/50`: colunas **NOME · DOCUMENTO · NASCIMENTO · TELEFONE** (cabeçalho `text-xs uppercase text-muted-foreground`), linhas com divisor sutil, nome em negrito, documento com prefixo do tipo (`CPF 111.222.333-44`), datas `dd/mm/aaaa`, "—" quando vazio.
- Manter os campos atuais do jsonb `travelers` (conferir chaves reais — pode haver mais que os 4 da referência: e-mail, passaporte, validade, observação); os extras ficam num expandir por linha ou no editor da linha, **não somem**.
- Edição: clique na linha abre edição inline (mesma lógica de salvar por linha dos produtos) ou o diálogo atual se for pequeno — preferir inline.
- Rodapé: botão tracejado `+ Adicionar viajante`. Manter `travelers_note`.

### C.5 Aba Vouchers (layout da referência) — fecha #59 item 1
- Tabela no mesmo estilo: colunas **DATA · ARQUIVO · FORNECEDOR · STATUS · (ação baixar)**. Data curta (`10 set.`), arquivo em negrito, fornecedor em texto normal, status como **badge com texto** (`Processado` verde, `Processando` âmbar, `Pendente` cinza, `Erro` vermelho — texto sempre presente, nunca só cor), ícone de download à direita. Ações extras (extrair dados, remover, vincular produto) num menu `⋯` por linha.
- Rodapé com **dois botões lado a lado**: à esquerda, largo e tracejado, `+ Add voucher (original do fornecedor)` → upload atual (`uploadSaleVoucher`, mantém bucket `form-assets`); à direita, botão primário de destaque `Gerar voucher white label` (ícone de documento) → **conferir** o fluxo existente `VoucherPrintView.tsx`/`VoucherPrintSections.tsx` (é o voucher com a marca da agência) e ligar o botão a ele. Se o destaque roxo da referência não for a cor primária do tema, usar `bg-primary` (não hardcode) — ou `variant` de destaque se o design system tiver.
- **Dados** (extensão retrocompatível do jsonb `travel_sales.vouchers`, hoje itens só `{name, url}`): `{ id, name, url, uploaded_at?, supplier?, product_id?, processing_status?: 'pendente'|'processando'|'processado'|'erro', source?: 'upload'|'agente' }`. Tipo + normalizador em `lib/travel/vouchers.ts` (tolera formato antigo; item legado sem `uploaded_at` mostra "—", sem status mostra "Processado" se já tiver dados extraídos associados, senão "Pendente" — definir a regra lendo como a extração grava hoje). Teste Vitest do normalizador.
- **Fornecedor**: preenchido pela extração/OCR quando disponível (`VoucherExtractDialog`/`VoucherUploadWithOcr` — ver o que já retornam: cia aérea, hotel, seguradora) ou pelo produto vinculado (`product_id` → fornecedor do produto); editável manualmente no menu `⋯`.
- **Status "Processando"**: setar ao iniciar a extração e "Processado"/"Erro" ao terminar — **só se a extração for assíncrona hoje**; se for síncrona no diálogo, o estado "Processando" aparece só durante o upload+OCR na UI (não persistir estado transitório). Conferir.
- Não mudar storage (continua `form-assets` público): URLs de voucher são entregues ao cliente e precisam ser permanentes; migrar para R2 exigiria rota proxy com token — fora de escopo, documentado.
- `voucher_entregue_at` (checklist): conferir onde é setado hoje e **não** mudar a regra.
- Vouchers continuam separados de Contratos — nada de renomear.

### C.6 Fechamento
- Validação visual: comparar lado a lado com os 4 PNGs de `docs/design-refs/reservas/` (subir o dev server se possível e tirar screenshot com Playwright — Chromium está em `/opt/pw-browsers`; login exige credencial: se não houver, validar por leitura e dizer isso explicitamente ao usuário).
- Responsivo: grid de 4 colunas colapsa para 2/1; tabelas com `overflow-x-auto`.
- Fechar **#59**. Comentar no #11 (fechada) que a 3ª imagem original ("guia geral da Reserva") foi parcialmente coberta por este redesign das abas.

---

## Fase D — #57 Automações (menor risco primeiro; o item arriscado por último)

### D.1 Log legível na tela de execuções
- Ler `lib/automations/log-format.ts` e a tela de runs (grep `automation_step_logs` em `components/features/automations`). Se o formatador já existe mas não é usado na UI, só plugar. Senão: formatar cada step log como linha humana "09:00 · Gatilho disparado → Condição 'Tag VIP': verdadeiro → Enviar WhatsApp: enviado", com erro destacado e duração.
- Timeline por run com expandir detalhes técnicos (JSON) sob demanda.

### D.2 Aposentar motor antigo do Instagram
- **❓ CHECKPOINT**: `select count(*) from social_automations;` imediatamente antes — seguir só se 0.
- `/social/automacoes`: virar redirect para o editor genérico de Automações com filtro/atalho "Instagram" (trigger `instagram.dm.received`/`instagram.comment.received` pré-selecionado na criação).
- `lib/social/engine.ts`: remover o fallback que consulta `social_automations` (código morto com 0 linhas) — manter funis (`funnel-engine.ts`) e a ponte genérica intactos. Remover actions/componentes exclusivos da tela antiga após grep de importadores.
- **Não** dropar a tabela (follow-up).

### D.3 Retries, idempotência e rate limits por integração
- Auditar os steps que chamam APIs externas no motor (`lib/inngest/automation-run-graph.ts` e steps WhatsApp/e-mail/SMS/webhook/Instagram): garantir que cada chamada externa está dentro de `step.run()` com id **determinístico** (evita reenvio em retry) e que erros 4xx permanentes **não** são re-tentados (usar `NonRetriableError` do Inngest) enquanto 5xx/timeout são.
- Rate limit por integração com `throttle` do Inngest nas functions de envio (não na function de automação inteira): WhatsApp por `phone_number_id` da org, Instagram por conta conectada. Valores iniciais conservadores documentados em comentário (conferir limites atuais na doc da Meta via WebSearch antes de fixar números).

### D.4 Aguardar resultado do Agente IA (maior risco — por último)
- **Contexto**: step "Atribuir Agente IA" já grava `whatsapp_conversations.assigned_agent_definition_id/assigned_agent_objective`. `whatsapp-inbound.ts` ainda responde via `respondAsAttendant` — **ler como ele usa hoje `assigned_agent_definition_id`** antes de mudar.
- **Schema** — tabela `agent_conversation_runs`: `id, organization_id, agent_definition_id, contato_id, conversation_id, automation_run_id, automation_step_id, objective, status ('in_progress'|'completed'|'timeout'|'handoff'|'cancelled'), result_type text, result_data jsonb, expires_at timestamptz, created_at, completed_at`. Unique parcial: 1 sessão `in_progress` por `conversation_id` (**ownership** — garante que só um processo "possui" a conversa). RLS padrão.
- **Step novo** `wait_agent_result` no builder: cria a sessão (status in_progress, `expires_at = now + timeout configurável`, default 24h), atribui o agente na conversa (reusa o step existente internamente), pausa o run (`status='waiting'`, mesmo mecanismo de `wait_for_reply`). Edges de saída por `result_type` (novo tipo de condição de edge `agent_result`, análogo a `field_result`) + edge obrigatório `timeout`.
- **Pipeline WhatsApp** (`whatsapp-inbound.ts`): se existir sessão `in_progress` para a conversa → responder com `invokeAgentDefinition()` (que tem `emit_result`) em vez de `respondAsAttendant`; mesma cobrança de créditos, mesma gravação de outbound, mesmo handoff. Se o agente chamar `emit_result` → marcar sessão `completed` com `result_type/data` e `inngest.send('automation/agent.result', { runId, stepId, resultType, resultData })`. **Sem sessão ativa → caminho atual intocado** (SDR padrão).
- **Retomada**: handler de `automation/agent.result` retoma o run pelo edge correspondente ao `result_type` (seguir exatamente como o grafo retoma após `wait_for_reply`).
- **Timeout**: cron a cada 15 min marca sessões expiradas `timeout` e retoma pelo edge `timeout`; libera `assigned_agent_definition_id` da conversa.
- **Proteção**: tudo atrás de env `AUTOMATION_AGENT_WAIT_ENABLED` — sem a env, o step não aparece no builder e o pipeline nunca entra no ramo novo. Com 0 `agent_definitions` em produção, o risco real é zero mesmo ligado, mas a env evita surpresa.
- **Teste ponta-a-ponta**: o usuário autorizou usar o **celular pessoal dele** como o lado "lead" (número informado no chat em 2026-09-25 — **não versionar número pessoal no repo/issue**; pedir de novo na sessão se não estiver no contexto). Roteiro:
  1. Implementar e validar com testes unitários (roteamento de edges, estado da sessão, timeout).
  2. Ligar `AUTOMATION_AGENT_WAIT_ENABLED` **só no preview/ambiente de teste** se houver; se só existir produção, ligar com o usuário ciente (risco baixo: 0 agent_definitions em produção, e só a automação de teste usa o step).
  3. Na org do usuário (WhatsApp Business já conectado): criar um Agent Definition de teste com objetivo simples ("perguntar se o cliente quer confirmar a reunião; emitir resultado `confirmado` ou `recusado`"), uma automação com gatilho manual/tag → step "Aguardar resultado do Agente" → edges `confirmado`/`recusado`/`timeout` aplicando tags diferentes.
  4. Contato de teste com o número do usuário; disparar a automação; o usuário responde pelo celular; conferir: sessão `completed`, `result_type` correto, run retomado pelo edge certo, tag aplicada, e que outras conversas continuam no atendente padrão.
  5. Testar timeout com `expires_at` curto (ex. 2 min).
  - A sessão **não consegue enviar/receber WhatsApp sozinha** — o passo 4 depende do usuário respondendo em tempo real; combinar o momento com ele.

### D.5 Fechamento
- Comentar no #57 com o roteiro de teste manual do D.4. Fechar o #57 **somente** após o usuário confirmar o teste; senão deixar aberto com "aguardando QA manual".

---

## Fase E — #58 Backend/observabilidade

### E.1 Correlação de logs (trace_id)
- `lib/observability/trace.ts`: `newTraceId()` (uuid), `withTrace(data, traceId)` e helper de log `logWithTrace(traceId, scope, message, extra)` (prefixo consistente `[trace:<id>]` — compatível com o console atual; o projeto não tem logger central além da regra de lint `quality/no-direct-console`: **usar o helper de logging do projeto** que a regra de lint sugere — grep para achá-lo).
- Gerar `trace_id` nos pontos de entrada: webhooks WhatsApp, Instagram, Autentique, Twilio/Voice, formulário público, e server actions que disparam eventos Inngest de automação. Propagar em `event.data.traceId`.
- **Migration**: coluna `trace_id text` (nullable, indexada) em `automation_runs`, `automation_step_logs`, `agent_audit_log`, `capi_event_log` (se já criada pelo plano de Tráfego), `contract_events`. Gravar onde houver traceId disponível.
- Tela/uso: na tela de execução de automação, mostrar o `trace_id` com botão copiar; documentar em `docs/BACKEND_ARCHITECTURE.md` como reconstruir o caminho de uma mensagem (query por `trace_id` nas tabelas + busca do prefixo nos logs da Vercel/Inngest).

### E.2 Auditoria do pipeline do Instagram
- Mapear em `docs/BACKEND_ARCHITECTURE.md` o fluxo completo (webhook → status updates síncronos → `inngest.send('instagram/inbound.received')` → `lib/social/engine.ts` → funil / automação genérica → envio) no mesmo formato já usado para WhatsApp.
- **Medir** com `mcp__Vercel__get_runtime_logs`/observability (listar projeto/time primeiro): duração p50/p95 da rota `/api/webhooks/instagram` nos últimos dias. Se p95 < 1s, documentar "manter"; se alto, mover as atualizações de status de entrega/leitura para dentro de uma function Inngest (`instagram/status.received`).

### E.3 Decisão Voice AI (Vercel × Railway)
- Medir duração/erros das rotas de voz (`app/api/voice/*`, grep para listar) nos logs da Vercel; cruzar com timeouts da função (plano Vercel). Escrever decisão com números em `docs/BACKEND_ARCHITECTURE.md` (manter na Vercel, ou migrar seguindo o padrão `services/sales-coach-realtime/`).
- **Implementação da migração, se a decisão for migrar: fora deste plano** (vira issue própria — escopo de infra nova).

### E.4 Rate limits/concorrência por integração
- Coberto em D.3 (mesmas functions). Aqui só documentar a tabela final de limites por integração em `docs/BACKEND_ARCHITECTURE.md`.

### E.5 Fechamento
- Fechar **#58** se E.1–E.4 feitos e a decisão de Voice AI documentada (a implementação Railway, se decidida, vira issue nova).

---

## Ordem de commits sugerida
A.1 · A.2 · A.3 · (fecha #15) · B.1 · B.2 · B.3 · B.4 · B.5 · B.6 · (fecha #60) · C.1 (ModuleTabs) · C.2 · C.2b (regra de habilitação) · C.3 · C.4 · C.5 · C.1b (adoção de ModuleTabs nos outros módulos) · (fecha #59) · D.1 · D.2 · D.3 · E.1 · E.2 · E.3 · (fecha #58) · D.4 (último; #57 aguarda QA).

## Riscos
- **B.3/B.4** mexem no fluxo de contrato de Reservas em produção (checklist `contrato_gerado_at`/`contrato_assinado_at`) — por isso sincronizar esses timestamps a partir do módulo global antes de remover o fluxo antigo, e checkpoint de contagem imediatamente antes.
- **B.5** depende do formato real do payload da Autentique para recusa/visualização — nunca adivinhar nome de evento; ler o que o webhook recebe (logs) ou a doc oficial.
- **D.2** remove código de produção — só com a contagem 0 re-confirmada.
- **D.4** toca o pipeline de mensageria WhatsApp — atrás de env, sem sessão ativa o caminho é idêntico ao atual, liberação só após QA manual do usuário.
- **E.1** adiciona colunas em tabelas de log de alto volume — colunas nullable sem default (não reescreve a tabela no Postgres 17).

## Progresso

| Passo | Status | Commit | Notas |
|---|---|---|---|
| A (#15) | concluído | `e9fa982` | seller_id/backoffice_owner_id + UI + evento de automação. Issue fechada |
| B (#60, #59.2) | pendente | | |
| C (#59.1 + redesign Reserva + ModuleTabs) | pendente | | refs em docs/design-refs/reservas/ |
| D.1–D.3 | pendente | | |
| E (#58) | pendente | | |
| D.4 | pendente | | aguarda QA manual do usuário |
