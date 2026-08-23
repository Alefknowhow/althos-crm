# Auditoria — Módulo Contatos

> Gerado em 2026-07-29. Faz parte da auditoria completa do app (layout/mobile + funcional). Ver também `docs/audit/pipeline.md`, `docs/audit/reservas.md`, `docs/audit/cotacoes.md`.

## 1. Rotas

| Rota | Arquivo | Função |
|---|---|---|
| `/app/[orgSlug]/contatos` | `app/app/[orgSlug]/contatos/page.tsx` | Lista mestre + painel de detalhe (server component). Interpreta ~15 search params (`q`, `pipeline_id`, `stage`, `tag`, `source`, `has_email`, `has_phone`, `no_contact_days`, `created_from/to`, `value_min/max`, `tier`, `status`, `sel`, `page`), monta query dinâmica em `contatos` com paginação (`PAGE_SIZE = 50`), busca `pipelines`, filtros salvos, tags/fontes distintas (scan não indexado `.limit(1000)`), membros da org e — se `sel` setado — o contato completo selecionado. Renderiza `<ContatosView>`. |
| `/app/[orgSlug]/contatos/[id]` | `app/app/[orgSlug]/contatos/[id]/page.tsx` | Página de detalhe em tela cheia. Busca lead + `pipeline_stages`, `contato_activities` (limit 50), `tasks`, `email_sends`+templates, `whatsapp_conversations`, `sales`, `contato_documents`, relacionamentos e (se nicho viagem) créditos — tudo via `Promise.all`. Layout desktop `md:grid-cols-3`. |
| `/app/[orgSlug]/contatos/importar` | `app/app/[orgSlug]/contatos/importar/page.tsx` | Client component sem fetch server-side. Wizard de 3 passos: CSV → parsing ingênuo (`split('\n')`/`split(',')`, sem suporte a campos com vírgula/aspas) → mapeamento de colunas → `triggerCsvImport`. |

Sem `layout.tsx` próprio — herda o layout da org.

## 2. Componentes

| Componente | Papel | Problemas encontrados |
|---|---|---|
| `ContatosView.tsx` (1274 linhas) | "God component": toolbar, lista mestre, painel detalhe, upload de avatar, editor de tags, diálogos de vínculos — tudo em um arquivo. | Monólito difícil de manter/testar. Coluna mestre fixa em `lg:w-[360px]` sem breakpoint intermediário — entre `sm` e `lg` tudo vira `flex-col` (tablet 768–1023px cai no layout empilhado de mobile mesmo tendo espaço). Botões-chave ("Página completa", WhatsApp, E-mail, "Nova negociação") são `hidden lg:flex` — inacessíveis abaixo de 1024px, sem menu alternativo. `<Select>` de status também `hidden lg:block` — mobile/tablet não reclassifica lead/cliente/inativo pelo painel. Grid de métricas mistura dados computados com campos estáticos já visíveis no cabeçalho (duplicação). Duas UIs diferentes de edição de tags (chip vs. string separada por vírgula) dependendo da tela. Ícones de atalho da lista (Conversas/Cotações/Reservas) sem rótulo visível em nenhum breakpoint — problema de descoberta em touch. Paginação sem estado de loading/disabled durante navegação (dá pra clicar duas vezes). `NewContatoDialog` usa padrão de trigger fora do `DialogTrigger asChild`, inconsistente com o resto do app. |
| `ContatoQuickEditCard.tsx` | Edição inline na página completa: nome/e-mail/telefone/etapa/tags. | Tags como string separada por vírgula — inconsistente com o editor de chips do `ContatosView`. `<select>` nativo para etapa dá altura visual diferente dos `Input` do shadcn ao redor. |
| `ContatoRelationships.tsx` | Vínculos de parentesco entre contatos. | Sem paginação/virtualização — renderiza tudo de uma vez. |
| `CustomerProfileForm.tsx` (333 linhas) | Form de CPF/RG/passaporte/endereço. Renderizado **duas vezes por contato** (página cheia + painel split), cada um com estado local independente. | Grid de endereço usa `md:col-span-2/4/1/3` sem `sm:` intermediário — como o form é reaproveitado dentro de um painel de largura fixa (não a viewport inteira), o breakpoint de mídia não corresponde à largura real do container (bug clássico media-query vs. container). Checkbox "Visto americano" é `<label><input type=checkbox>` cru em vez do `Checkbox` compartilhado. |
| `CustomerDocuments.tsx` (299 linhas) | Upload/lista/preview de documentos — também duplicado nas duas telas de contato. | Preview em tela cheia é um overlay `fixed inset-0` próprio, não o `Dialog` compartilhado (risco de faltar focus-trap/escape-to-close). |
| `CustomersSplit.tsx`, `CustomersTable.tsx`, `AddCustomerDialog.tsx` (`components/features/customers/`) | Implementação paralela de lista/detalhe de clientes. | Precisa confirmar se ainda está roteada em algum lugar — pode ser código morto duplicando o mesmo domínio do `ContatosView`. |

## 3. Server Actions (`actions/contatos.ts` + relacionados)

| Action | Propósito | Tabela(s) |
|---|---|---|
| `createLead` | Cria lead via pipeline; checa limite de plano | `contatos`, `pipelines`/`pipeline_stages`, `negocios`, `contato_activities` |
| `updateLead` | Edita nome/e-mail/telefone/tags/etapa/notas internas; dispara Inngest em tag nova | `contatos` |
| `moveLeadToStage` | Muda etapa; promove a `cliente` em `is_won`; espelha em `negocios`; cria venda automática (`maybeCreateTravelSaleOnWon`); envia evento Meta CAPI | `contatos`, `pipeline_stages`, `negocios`, `contato_activities`, `organizations` |
| `updateLeadTags` | Sanitiza/dedup/trunca tags (máx 20, 40 chars) | `contatos` |
| `bulkUpdateLeads` / `bulkDeleteLeads` | Atualização/exclusão em lote | `contatos`, `contato_activities` |
| `listCustomers` / `getCustomer` | Listagem/detalhe de "clientes", agrega total comprado | `contatos`, `sales`, `contato_documents` |
| `upsertCustomerProfile` | Salva CPF/RG/passaporte/endereço | `contatos` |
| `getContatoPanel` | Dados do painel split (contato + docs + sales + relacionamentos) | `contatos`, `contato_documents`, `sales` |
| `setContatoStatus` | Define lead/cliente/inativo | `contatos` |
| `uploadContatoAvatar` / `removeContatoAvatar` | Foto de avatar (limite 5MB) | `contatos`, bucket `contato-avatars` |
| `listContatoDeals` / `reopenNegotiation` | Histórico de negociações / reabre negociação | `negocios`, `contatos`, `pipeline_stages` |
| `uploadCustomerDocument` / `deleteCustomerDocument` | Documentos (10MB, PDF/imagem) | `contato_documents`, bucket `customer-documents` |
| `getContatoTravelLinks` | Atalhos "Cotações enviadas"/"Reservas" | `travel_proposals`, `travel_sales` |

Relacionados: `actions/relationships.ts` (`contato_relationships`), `actions/travel-credits.ts` (`travel_credits`), `actions/saved_filters.ts` (`saved_filters`), `actions/import.ts` (`triggerCsvImport`).

## 4. Permissões

**Achado crítico**: `lib/permissions.ts` define as chaves `'leads'`/`'clients'`, mas **nenhuma action de `actions/contatos.ts` ou `actions/relationships.ts` chama `checkMemberPermission`**. O bloqueio existe só na UI (`components/features/Sidebar.tsx:177-178,384` — o link "Contatos" só aparece se `can('leads') || can('clients')`). Qualquer membro autenticado pode ler/editar/excluir qualquer contato, subir/apagar documentos, mudar tags/status e reabrir negociações direto pela rota ou pela action, independente da permissão configurada para seu papel. `isAccessBlocked` (congelamento de billing) é respeitado; a permissão por papel, não.

## 5. Conexões com outros módulos

- **Pipeline**: `contatos.pipeline_id`/`stage_id` posicionam no kanban; `negocios` é espelhado por `moveLeadToStage`/`reopenNegotiation`.
- **Reservas**: `moveLeadToStage` cria venda automática ao ganhar (`maybeCreateTravelSaleOnWon`); `getContatoTravelLinks` lê `travel_sales`.
- **Cotações**: `getContatoTravelLinks` lê `travel_proposals` por `contato_id`.
- **Créditos de viagem**: `listCreditsForContato`, ligado de volta a `sales`/reservas via `origem_sale_id`.
- **Tarefas**: só aparecem na página `/contatos/[id]` completa — **não** no painel split `/contatos?sel=`, uma assimetria funcional entre as duas telas de contato.
- **Conversas/WhatsApp**: duas rotas de deep-link diferentes (`?id=` na página completa vs. `?lead=` no `ContatosView`) — precisa confirmar se a página de Conversas trata os dois.
- **Meta Ads/CAPI**: `moveLeadToStage` envia `Purchase`/`NotQualified` ao ganhar/perder negociação.
- **Billing**: `canCreateLead` limita por plano; `isAccessBlocked` congela mutações org-wide.

## 6. Notas de mobile

- Sem árvore de componentes mobile separada — tudo em `ContatosView` com classes responsivas Tailwind + estado `mobileDetail` simulando navegação drill-down.
- Breakpoint único em `lg` (1024px) tanto para trocar de layout quanto para **esconder funcionalidades inteiras** — tablet (768–1023px) perde WhatsApp/e-mail/nova negociação/reclassificação de status, não só o layout lado a lado.
- `/contatos/[id]` (página completa) esconde a barra de ações (requalificar por IA, enviar e-mail) abaixo de `md` (768px) — comentário no código reconhece que é intencional, mas mobile perde essas ações por completo nessa tela.
- `FiltersSheet` é um dos poucos componentes bem comportados — `w-full sm:max-w-md`, tela cheia no mobile.
- `CustomerProfileForm`/`CustomerDocuments` usam breakpoints de viewport, não de container — dentro do painel split (largura menor que a viewport) o layout não reflete a largura real disponível.

## Lista de problemas concretos (para priorização)

1. **[Segurança]** Nenhuma verificação de permissão server-side em `actions/contatos.ts`/`actions/relationships.ts` — qualquer membro pode ler/editar/excluir contatos e documentos independente do papel.
2. `contatos/page.tsx:114` — scan de tags/fontes distintas sem índice, `.limit(1000)` — trunca silenciosamente acima de 1000 contatos.
3. `contatos/importar/page.tsx:32` — parsing de CSV ingênuo, quebra com campos entre aspas contendo vírgula.
4. `ContatosView.tsx` — monólito de 1274 linhas, deveria ser dividido.
5. `ContatosView.tsx:246,250,357` — breakpoint único em `lg`, tablet cai no layout mobile.
6. `ContatosView.tsx:663-687` — ações importantes (WhatsApp/e-mail/nova negociação/página completa) escondidas abaixo de `lg`, sem alternativa.
7. `ContatosView.tsx:647` — status não editável abaixo de `lg`.
8. Duas UIs de edição de tags incompatíveis (`ContatosView.tsx:614-629` vs `ContatoQuickEditCard.tsx:86`).
9. `ContatosView.tsx:691-729` — grid de métricas duplica dados já visíveis no cabeçalho.
10. `CustomerProfileForm`/`CustomerDocuments` duplicados (2 instâncias por contato, estado desincronizado).
11. `CustomerProfileForm.tsx:215-301` — grid de endereço com spans que só funcionam em `md` exato; bug de media-query vs. container.
12. `CustomerProfileForm.tsx:197-206` — checkbox customizado fora do padrão do design system.
13. `CustomerDocuments.tsx:275-298` — preview em overlay próprio em vez do `Dialog` compartilhado.
14. `ContatosView.tsx:296-320` — ícones de atalho sem rótulo visível, ruim para touch.
15. `ContatosView.tsx:336-350` — paginação sem loading/disabled state.
16. `ContatosView.tsx:952-957` — padrão de `Dialog` sem `DialogTrigger asChild`.
17. `contatos/[id]/page.tsx:148` — ações de IA/e-mail escondidas abaixo de `md` na página completa.
18. `CustomersSplit.tsx`/`CustomersTable.tsx`/`AddCustomerDialog.tsx` — possível código morto/duplicado, confirmar uso.
19. `listContatoDeals` e outras leituras sem paginação para históricos longos.
