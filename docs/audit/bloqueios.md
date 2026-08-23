# Auditoria — Módulo Bloqueios

> Gerado em 2026-07-29. Faz parte da auditoria completa do app. Ver também `docs/audit/pipeline.md`, `docs/audit/contatos.md`, `docs/audit/reservas.md`, `docs/audit/cotacoes.md`.

## 1. Rotas

| Rota | Arquivo | Função |
|---|---|---|
| `/app/[orgSlug]/bloqueios` | `app/app/[orgSlug]/bloqueios/page.tsx` | Única página do módulo — sem sub-rotas, todo CRUD acontece em diálogos client-side. `requireAuth` + redirect se `!isTravelNiche`. Busca todos os registros via `listTravelBlocks` (limite de 1000) e renderiza `BlocksView`. |

## 2. Componentes

| Componente | Papel | Problemas encontrados |
|---|---|---|
| `BlocksView.tsx` | View principal: toolbar (importar/novo/busca/filtro de destino), tabela de dados, diálogo de criar/editar, confirmação de exclusão. | Tabela forçada em `min-w-[960px]` com **só scroll horizontal no mobile** — nenhuma alternativa em cards/lista, ao contrário de outras telas do app. Botões de +/- assentos são `w-5 h-5` (20px) — abaixo do alvo de toque recomendado (~44px). "+" não tem limite superior — pode deixar `assentos_disponiveis` maior que `assentos_total`. `handleSeatDelta` dispara `router.refresh()` completo a cada clique, sem debounce nem estado de loading por linha — clique rápido em mobile/rede lenta pode gerar corrida/atraso visual. Linha de filtros com `flex-wrap` pode quebrar de forma estranha em viewports bem estreitos. |
| `BlockDialog` (mesmo arquivo) | Form de criar/editar bloqueio. | Grid vira 1 coluna no mobile (correto), mas o diálogo tem 10+ campos + textarea — pode exigir bastante scroll sem indicação visual clara. Sem validação de formato além de origem/destino/data obrigatórios — voo/horário são texto livre sem padrão. |
| `BlocksImporter.tsx` | Importador de CSV/XLSX/XLSM da planilha de mapa de bloqueios. | Carrega `xlsx` só quando necessário (bom). Sem UI de mapeamento de colunas — se a detecção automática errar, só corrigindo na planilha e reimportando. Linhas inválidas só sinalizadas com tooltip `title` — **inacessível em touch**. Parsing de assentos via `replace(/\D/g,'')` mangla valores tipo "10-12" em "1012" sem aviso. Diálogo mais largo (`sm:max-w-3xl`) com tabela interna `min-w-[760px]` cria **scroll duplo** (diálogo + tabela) no mobile. |

## 3. Server Actions (`actions/travel-blocks.ts`)

| Action | Propósito | Tabela/colunas |
|---|---|---|
| `listTravelBlocks` | Lista todos os bloqueios da org (limite 1000) | `travel_blocks` (select *) — **engole erros do Supabase e retorna `[]`**, indistinguível de "sem bloqueios" |
| `createTravelBlock` | Cria um bloqueio | `travel_blocks` insert |
| `updateTravelBlock` | Atualiza (usado também pelo stepper de assentos) | `travel_blocks` update |
| `bulkCreateTravelBlocks` | Insert em lote da importação | `travel_blocks` insert (com filtro de defesa server-side pra origem/destino/data) |
| `deleteTravelBlock` | Exclui (bloqueado sob impersonação) | `travel_blocks` delete |

Colunas: `origem, destino, data_ida, data_volta, voo_ida, horario_ida, voo_volta, horario_volta, assentos_total, assentos_disponiveis, prazo, observacoes`.

## 4. Permissões

Chave: **`bloqueios`** (módulo `TRAVEL_ONLY_KEYS`, padrão `false`). Toda action mutante chama `checkMemberPermission`. **Gap**: `listTravelBlocks` **não tem verificação de permissão nenhuma** — qualquer membro autenticado pode listar todos os bloqueios independente da flag; só o link do menu e o redirect de nicho protegem a navegação, não a leitura direta.

## 5. Conexões com outros módulos

**Achado principal: Bloqueios está totalmente isolado.** Grep completo no repo não encontra nenhum vínculo entre `travel_blocks` e Reservas/Cotações — criar uma venda/cotação **não decrementa** `assentos_disponiveis`. O inventário de assentos é puramente manual/informativo: o agente precisa lembrar de clicar no "-" quando vende um assento do bloqueio. Isso é uma lacuna funcional significativa pra uma feature de "allotment" — o objetivo de bloqueio de assentos é justamente rastrear disponibilidade em tempo real vinculada às vendas, mas aqui é um rastreador tipo-planilha desconectado, com reconciliação manual.

## 6. Notas de mobile

- Sem lógica de breakpoint dedicada pra tabela — só esconde texto dos botões (`hidden sm:inline`), mantendo ícones.
- Tanto a tabela principal quanto a tabela de preview da importação dependem só de `overflow-x-auto` — sem priorização/ocultação de colunas, sem escala de fonte responsiva.
- Diálogos colapsam corretamente pra 1 coluna abaixo de `sm` — a única adaptação mobile genuína do módulo.
- Botões de stepper (20×20px) e botões de ação ícone-só (28×28px) abaixo da recomendação de acessibilidade em touch (≥44px).

## Lista de problemas concretos

1. Tabela `min-w-[960px]` — só scroll horizontal no mobile, sem fallback em cards.
2. Botões de stepper 20×20px — abaixo do alvo de toque recomendado; "+" sem limite superior.
3. `handleSeatDelta` sem debounce/estado de loading por linha — corrida possível em cliques rápidos.
4. **[Segurança]** `listTravelBlocks` sem verificação de permissão — só as actions mutantes checam.
5. Sem validação de `assentos_disponiveis <= assentos_total`.
6. Parsing de assentos na importação mangla valores como "10-12" silenciosamente.
7. Linhas inválidas na importação só sinalizadas via tooltip — inacessível em touch.
8. Scroll duplo no diálogo de importação (diálogo + tabela interna).
9. **[Funcional]** Sem vínculo entre bloqueios e vendas/cotações — inventário de assentos totalmente manual e desconectado.
10. Página não checa a permissão `bloqueios` no nível de rota — só as actions mutantes; visita direta por URL ainda renderiza a lista completa (via gap #4).
