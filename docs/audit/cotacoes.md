# Auditoria — Módulo Cotações

> Gerado em 2026-07-29, **revisado em 2026-08-23** (retomada da auditoria
> completa). Ver também `docs/audit/pipeline.md`, `docs/audit/contatos.md`,
> `docs/audit/reservas.md`.

## 0. Status 2026-08-23

`CotacoesTabs.tsx` (achado #1, exclusão sem commit) **não existe mais no
repo** — resolvido em algum momento fora desta sessão. `ProposalBuilder.tsx`
(1212 linhas) e `PublicProposalView.tsx` (927 linhas) — confirmados código
morto (zero importadores, superados por `QuotationEditor`/
`PublicQuotationView`) e **removidos nesta revisão**.

`BudgetDocumentsView.tsx`/`BudgetDocumentPrintView.tsx`/`actions/budget-documents.ts`
(Orçamento IA) **mantidos como estão** — decisão deliberada: é uma
feature inteira (tabela própria, CRUD completo, rota de impressão viva)
órfã só de navegação, não código morto de verdade; removê-la fecha a
porta pra religar sem reconstruir. Fica documentado como recomendação
(religar no menu ou decidir descontinuar formalmente), não como
correção automática.

Gap de permissão real encontrado e corrigido: `getProposal`,
`listProposalsForLead`, `listOffers`, `getBudgetDocumentSourceUrl` (mais
sensível — URL assinada de documento) sem `checkMemberPermission`.
`listLeadsForPicker` também sem nenhuma checagem (nem `requireAuth`) —
mas é reaproveitada por Seguros/Imóveis/Reservas além de Cotações, então
foi gateada por `checkContatoPermission` (domínio certo) em vez de
`cotacoes` (que quebraria os outros chamadores). `tripadvisorLookup`/
`unsplashSearch`/`unsplashTrackDownload` só tinham `requireAuth` — usam
chave de API compartilhada de toda a plataforma (não por-org), então
qualquer membro de qualquer org podia consumir a cota mesmo sem a
permissão `cotacoes`; gateadas também. `geocodePlace` (Nominatim/OSM,
serviço gratuito sem chave) deixado como está — já exige sessão
autenticada, que é a única proteção que faz sentido pra um serviço sem
custo/cota.

## 1. Rotas

| Rota | Arquivo | Função |
|---|---|---|
| `/app/[orgSlug]/cotacoes` | `.../cotacoes/page.tsx` | Lista. `requireAuth` + `isTravelNiche`. Busca `listProposals`, `listOrgMembers`, `listLeadsForPicker`, renderiza `ProposalsList`. **Não busca mais `budgetDocuments` nem renderiza `CotacoesTabs`** — regressão deliberada do commit `b71df25` (remove aba Orçamento IA). |
| `/app/[orgSlug]/cotacoes/[id]` | `.../[id]/page.tsx` | Editor. Carrega `getQuotationFull` (proposta + 4 tabelas filhas), renderiza `QuotationEditor`. |
| `/app/[orgSlug]/cotacoes/[id]/pdf` | `.../[id]/pdf/page.tsx` | Impressão whitelabel via `QuotationPrintView`. |
| `/app/[orgSlug]/cotacoes/[id]/orcamento` | `.../[id]/orcamento/page.tsx` | Impressão de **um** Orçamento IA — reusa o nome de segmento `[id]` só que pra `budget_documents.id`, entidade diferente da `travel_proposals.id` usada pelos irmãos `[id]/page.tsx` e `[id]/pdf/page.tsx` — mesmo nome de segmento, significado diferente, fácil de confundir. **Sem entrada de UI** — só acessível digitando/marcando a URL. |
| `/p/[token]` | `app/(public)/p/[token]/page.tsx` | **View pública da cotação**, sem auth, só via RPC `get_public_quotation` (security-definer, anon key). Cache `revalidate: 300` + tag `quotation:{token}`. `noindex,nofollow`. |
| `/v/[token]`, `/v/[token]/[id]` | `app/(public)/v/...` | Vitrine pública de ofertas (`travel_showcase_packages`) — módulo adjacente (Ofertas), tabela diferente. |
| `/api/track/proposal` | `app/api/track/proposal/route.ts` | POST sem auth (admin client) — marca `sent`→`viewed`, registra `cta_clicked`, dispara eventos Inngest pra lead scoring/CAPI. |

Não existe rota pública para os documentos de Orçamento IA — só a página de impressão autenticada.

## 2. Componentes

| Componente | Papel | Problemas encontrados |
|---|---|---|
| `ProposalsList.tsx` | Lista/detalhe de `travel_proposals`. Painel de detalhe é só resumo read-only + link "Abrir editor". | Barra de filtros escondida (`selected && 'hidden md:flex'`) sempre que uma proposta está aberta no mobile — some completamente, só volta ao fechar. Lógica de visibilidade (`selected && ...`) duplicada em 3 strings de classe diferentes (linhas 138, 202, 251) — frágil de manter sincronizado. Padrão "título acima dos botões no mobile" já implementado corretamente (`flex-col sm:flex-row`, título `order-1`, botões `order-2`) — consistente com fix já registrado no git log. |
| `QuotationEditor.tsx` (1168 linhas) | Editor split-view: formulário (Capa/Viagem/Introdução/Hospedagens/Aéreo/Investimento/Fechamento) + preview ao vivo usando o **mesmo componente** que o cliente vê (`PublicQuotationView`). Autosave debounced 800ms. | Toolbar sticky com offset negativo hardcoded `style={{ top: -20 }}` + margens negativas pra contrapor o padding da página — acoplamento frágil ao layout do shell. Split mobile via estado manual `mobileTab` + tabs `lg:hidden`, **não CSS** — ambos os painéis ficam sempre montados (`hidden lg:block`), então o preview (mapa Leaflet + HTML rico do Tiptap) roda fora de tela no mobile mesmo escondido, com custo de performance. Altura do preview usa números mágicos (`h-[calc(100vh-140px)]`, `lg:top-[52px]`) não derivados de nenhuma constante compartilhada — tende a dessincronizar se a altura do header do app mudar. Toolbar com até 8 botões + texto de estado + aviso de campos faltando, tudo num `flex-wrap` — quebra de forma desigual em tablet. |
| `PublicQuotationView.tsx` (1225 linhas) | Renderizador público/preview — hero, roteiro, hospedagem com dados TripAdvisor, voos, mapa Leaflet, preços, condições de pagamento, CTAs de WhatsApp. Reaproveitado sem modificação como preview do editor. | Como serve tanto a página pública quanto o preview do editor, todo trabalho pesado (init do Leaflet, import dinâmico do `dompurify` por bloco rico) roda duas vezes por ciclo de debounce dentro do editor. |
| `QuotationPrintView.tsx` (284 linhas) | Layout whitelabel de impressão/PDF. | Página HTML pura `window.print()`; sem CSS `@media print` explícito verificado além do escopo do componente — vale confirmar paginação em roteiros longos. |
| `BudgetDocumentsView.tsx` (390 linhas) | Master/detalhe de `budget_documents` (Orçamento IA/OCR). | **Órfã/inalcançável**: nada no app importa. Era montada via `CotacoesTabs.tsx`, que a página atual não renderiza mais (commit `b71df25`). Componente, actions, tabela e rota de impressão continuam todos plugados entre si, mas sem ponto de entrada na UI — código morto a ser removido ou religado. |
| `BudgetDocumentPrintView.tsx` (267 linhas) | PDF whitelabel de um Orçamento IA. | Mesmo problema de inalcançabilidade acima. |
| `OffersList.tsx` (93 linhas) | Lista de `/ofertas` — linhas de `travel_proposals` com `is_offer=true`. | Viva, ligada à `app/app/[orgSlug]/ofertas/page.tsx`. Compartilha a mesma tabela/editor de Cotações. |
| `ItineraryEditor.tsx` (195 linhas) | Editor de roteiro dia-a-dia. | Vivo, usado por `QuotationEditor` e pelo `ProposalBuilder` morto. |
| ~~`ProposalBuilder.tsx`~~ (1212 linhas) | Editor de proposta legado, anterior ao split-view. | **Removido em 2026-08-23** — confirmado zero importadores. |
| ~~`PublicProposalView.tsx`~~ (927 linhas) | Renderizador público anterior, predecessor do `PublicQuotationView`. | **Removido em 2026-08-23** — confirmado zero importadores. |
| ~~`CotacoesTabs.tsx`~~ | Antes envolvia `ProposalsList` + `BudgetDocumentsView` em `Tabs`. | **Não existe mais no repo** — resolvido fora desta sessão. |

## 3. Server Actions

| Arquivo | Action | Propósito | Tabela(s) |
|---|---|---|---|
| `actions/travel-proposals.ts` | `listProposals`/`getProposal` | Listar/buscar | `travel_proposals` |
| | `createProposal`/`updateProposal`/`deleteProposal` | CRUD (permissão `cotacoes`) | `travel_proposals` |
| | `duplicateProposal` | Copia pra outro contato, reseta `public_token`/status | `travel_proposals`, `contatos` (leitura) |
| | `geocodePlace` | Geocodifica local (Nominatim → Photon) pros pins do mapa | nenhuma (HTTP externo) |
| `actions/quotations.ts` | `getQuotationFull` | Carrega proposta + 4 tabelas filhas + config da org | `travel_proposals`, `quotation_lodgings`, `quotation_flights`, `quotation_itinerary_days`, `quotation_map_pins`, `org_settings` |
| | `saveQuotation` | Autosave validado com Zod; substitui completamente (delete+insert) cada tabela filha | as mesmas 5 tabelas |
| | `generateQuotationLink` | Emite/roda `public_token`, `draft`→`sent` | `travel_proposals` |
| | `listOffers`/`createOffer` | Ofertas de vitrine (`is_offer=true`) | `travel_proposals` |
| | `convertOfferToQuotation`/`convertQuotationToOffer` | Duplica proposta+filhas na direção oposta | `travel_proposals` + 4 tabelas |
| | `createSaleFromQuotation` | **Ponte Cotações → Reservas.** Idempotente por `proposal_id`; monta `travel_sales` a partir da cotação | lê `travel_proposals`/`quotation_lodgings`/`quotation_flights`; insere em `travel_sales`; cria notificação |
| | `tripadvisorLookup` | Busca hotel via TripAdvisor Content API | nenhuma (HTTP externo) |
| `actions/budget-documents.ts` | CRUD completo de `budget_documents` | Órfão de UI (ver acima) | `budget_documents`, bucket `budget-documents` |

Todas as actions mutantes de `quotations.ts`/`travel-proposals.ts` (exceto `geocodePlace`) e `budget-documents.ts` chamam `checkMemberPermission(org.id, user.id, 'cotacoes')`.

## 4. Permissões

Chave: **`cotacoes`**, módulo `TRAVEL_ONLY_KEYS` (só relevante pra orgs de viagem). Padrão `false` pra membros não-admin. `listProposals`/`getQuotationFull`/`getBudgetDocument`/`listBudgetDocuments` (achado original) **já checavam** antes desta revisão — corrigido fora desta sessão. Gaps reais encontrados e corrigidos em 2026-08-23: `getProposal`, `listProposalsForLead`, `listOffers`, `getBudgetDocumentSourceUrl`, `tripadvisorLookup`, `unsplashSearch`, `unsplashTrackDownload`. `listLeadsForPicker` gateada por `checkContatoPermission` (não `cotacoes` — é reaproveitada por Seguros/Imóveis/Reservas).

## 5. Conexões com outros módulos

- **Cotações → Reservas**: `createSaleFromQuotation` cria `travel_sales` com `proposal_id`; botão "Gerar venda" no editor salva e redireciona pra `/reservas?sale={id}`.
- **Cotações ↔ Ofertas**: mesma tabela `travel_proposals`, diferenciada por `is_offer`. `convertOfferToQuotation`/`convertQuotationToOffer` duplicam nas duas direções.
- **Cotações → Contatos**: `contato_id` FK; `listLeadsForPicker` alimenta o seletor; `listProposalsForLead` alimenta o popup do card no Pipeline.
- **Vitrine pública (Ofertas)**: `/v/[token]` usa `travel_showcase_packages`, tabela separada — adjacente mas estruturalmente distinta do link público de cotação (`/p/[token]`).
- **Tracking/lead scoring**: `/api/track/proposal` promove status e alimenta Inngest, consumido por pipelines de scoring/CAPI em outro lugar do CRM.
- **Notificações**: `createSaleFromQuotation` chama `createNotification` com link de volta pra `/reservas`.

## 6. Notas de mobile

- Editor split-view não colapsa via CSS — usa estado manual `mobileTab` com dois botões `lg:hidden`, alternando `hidden lg:block` em cada painel. Ambos ficam sempre montados independente do viewport.
- `ProposalsList.tsx` implementa corretamente o padrão "título acima dos botões no mobile" (comentário no código confirma).
- Filtros de período usam a convenção do repo: `ResponsiveSelect` (dropdown) abaixo de `sm`, pills acima — idêntico em `ProposalsList` e `BudgetDocumentsView`.
- Toolbar do editor com até 8 botões quebra de forma desigual em tablet (mistura ícone-só e ícone+label dependendo do `hidden sm:inline`).
- Sizing do painel de preview usa números mágicos só válidos em `lg`+, acoplado às alturas exatas do header/padding do shell.

## Lista de problemas concretos

1. ~~`CotacoesTabs.tsx` deletado mas sem commit~~ — **Resolvido** (arquivo não existe mais).
2. "Orçamento IA" completamente inalcançável da UI — **ainda aberto, decisão deliberada** (ver seção 0): religar no menu ou descontinuar formalmente é decisão de produto, não código morto puro.
3. ~~`ProposalBuilder.tsx`/`PublicProposalView.tsx` — código morto~~ — **Removidos em 2026-08-23.**
4. `QuotationEditor.tsx:1076` — toolbar sticky com `top: -20` hardcoded + margens negativas, frágil a mudanças no shell.
5. `QuotationEditor.tsx:1151,1146` — sizing do preview com números mágicos não compartilhados.
6. Ambos os painéis do split-view sempre montados — Leaflet/Tiptap rodando fora de tela no mobile.
7. `ProposalsList.tsx:138,202,251` — lógica de visibilidade duplicada em 3 lugares.
8. Rota `[id]/orcamento` reusa nome de segmento pra entidade diferente (`budget_documents.id` vs `travel_proposals.id`) — confuso na manutenção.
9. ~~Sem `checkMemberPermission` nos paths de leitura~~ — **Corrigido em 2026-08-23** (ver seção 4).
10. `tripadvisorLookup`/`geocodePlace` sem cache/rate-limit — cliques repetidos batem na API externa toda vez. **Ainda aberto** (agora ao menos gateado por permissão, mas sem cache/throttle).
