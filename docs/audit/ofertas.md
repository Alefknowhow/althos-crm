# Auditoria — Módulo Ofertas

> Gerado em 2026-07-29. Faz parte da auditoria completa do app. Ver também `docs/audit/cotacoes.md`.

## 1. Rotas

| Rota | Arquivo | Função |
|---|---|---|
| `/app/[orgSlug]/ofertas` | `page.tsx` | Guarda nicho, busca `listOffers` + `getVitrineToken`, renderiza `OffersList`. |
| `/app/[orgSlug]/ofertas/[id]` | `[id]/page.tsx` | Editor. Carrega via `getQuotationFull`, 404 se `!is_offer`. **Sem editor dedicado de oferta** — é 100% o `QuotationEditor` de Cotações em outro modo (prop `isOffer`). |
| `/v/[token]` | `app/(public)/v/[token]/page.tsx` | Vitrine pública. RPC `get_public_vitrine`, renderiza `PublicVitrineStorefront`. |
| `/v/[token]/[id]` | `app/(public)/v/[token]/[id]/page.tsx` | **Rota morta/inalcançável** — consulta `travel_showcase_packages` direto com client admin, mas nada linka pra ela. |
| `/p/[token]` | `app/(public)/p/[token]/page.tsx` | **A página de detalhe de oferta de verdade** — RPC `get_public_quotation`, renderiza `PublicQuotationView` (mesmo componente compartilhado com Cotações). |

**Achado arquitetural crítico**: a migração `0085_offers_as_quotations.sql` documenta explicitamente que "Ofertas (vitrine) passam a ser montadas como COTAÇÕES... Reusa o editor, as tabelas-filhas, a RPC pública e a PublicQuotationView" — migrou dados antigos de `travel_showcase_packages` pra `travel_proposals(is_offer=true)` mas **nunca removeu a tabela/rota antiga**.

## 2. Componentes

| Componente | Status | Detalhe |
|---|---|---|
| `OffersList.tsx` | Ativo | Grid de cards, ações "copiar link da vitrine"/"ver vitrine"/"nova oferta". Barra de ações sem ordenação mobile explícita — pode gerar layout de 2 linhas confuso em telas estreitas. |
| `QuotationEditor` (modo oferta) | Ativo | Mesmo editor de Cotações, com prop `isOffer` trocando campos de cliente por `offer_category`/toggle de publicação, escondendo ações de PDF/WhatsApp/"enviar pro cliente". |
| `PublicVitrineStorefront.tsx` | Ativo | Grid estilo Booking.com, busca/filtro de categoria, FAB de WhatsApp. **Único breakpoint mobile em `max-width:560px`** — telas de 375-560px landscape ou celulares maiores (~600-640px) ficam com grid de 2 colunas apertada antes de atingir o breakpoint real. FAB fixo sem padding de segurança inferior — risco de sobrepor o CTA do último card. |
| `PublicPackageView.tsx` | **Órfão** — só alcançável pela rota morta `/v/[token]/[id]` | |
| `ShowcaseBuilder.tsx` / `ShowcaseList.tsx` / `PublicVitrineView.tsx` | **Código morto** — zero importadores em todo o repo | |

## 3. Server Actions

### `actions/quotations.ts` (caminho ativo — ofertas-como-cotações)
- `listOffers`, `createOffer`, `convertOfferToQuotation`, `convertQuotationToOffer`, `saveQuotation`/`generateQuotationLink` (compartilhadas), `getQuotationFull`.
- **Todas as mutações usam permissão `'cotacoes'`**, não `'ofertas'`.
- **Não existe `deleteOffer`** — ofertas criadas nunca podem ser removidas via server action.

### `actions/travel-showcase.ts` (caminho legado — só `getVitrineToken` ainda em uso)
- `listPackages`/`getPackage`/`createPackage`/`updatePackage`/`deletePackage`/`generateProposalFromPackage` — todas gateadas por `'ofertas'`, mas **inatingíveis da UI viva** (nenhum importador de `ShowcaseList`/`ShowcaseBuilder`).

## 4. Permissões

**Achado central de inconsistência**: o fluxo real de ofertas (usado pela UI viva) checa a permissão **`cotacoes`**, enquanto o caminho legado/morto checa **`ofertas`**. Resultado prático: um usuário com só `ofertas` concedido (e não `cotacoes`) consegue ver a lista de ofertas mas **não consegue criar, editar ou converter nenhuma** — toda action mutante retorna erro de permissão silenciosamente. Inversamente, um usuário com só `cotacoes` gerencia ofertas completamente mesmo sem a permissão `ofertas`. Contradiz diretamente a taxonomia de permissões declarada (`cotacoes` e `ofertas` são chaves distintas em `lib/permissions.ts`).

## 5. Conexões com outros módulos

- **Cotações**: bridge confirmada — `convertOfferToQuotation`/`convertQuotationToOffer` duplicam a linha pai + as 4 tabelas filhas na direção oposta. Mesmo editor (`QuotationEditor`), mesma view pública (`PublicQuotationView`), mesmo esquema de RPC/cache (`get_public_quotation`, `revalidateTag('quotation:{token}')`).
- **Achado adicional**: `generateProposalFromPackage` (caminho legado) é uma **segunda ponte independente e paralela** de `travel_showcase_packages` pra `travel_proposals` — duplica lógica de negócio que conceitualmente devia estar num só lugar, mas está morta (sem rota que a alcance).
- **`organizations.vitrine_token`** é o identificador público único da vitrine raiz (`/v/[token]`), independente do `public_token` de cada oferta (`/p/[token]`).

## 6. Notas de mobile

- `OffersList` — grid colapsa pra 1 coluna abaixo de `sm`, 2 em `sm`, 3 em `lg`; barra de ação sem ordenação mobile explícita.
- `QuotationEditor` (modo oferta) usa o padrão de esconder label e mostrar só ícone abaixo de `sm` — consistente com o resto do app.
- `PublicVitrineStorefront` — só um breakpoint (560px); FAB de WhatsApp sem padding de segurança, risco de sobrepor CTAs em telas curtas.
- `PublicPackageView` — responsivo, mas código morto (rota inalcançável).

## Lista de problemas concretos

1. **[Código morto/arquitetura]** Rota `/v/[token]/[id]` e componentes `PublicPackageView`, `ShowcaseBuilder`, `ShowcaseList`, `PublicVitrineView` inalcançáveis — a vitrine linka só pra `/p/{public_token}`.
2. **[Permissão inconsistente]** Ações reais de oferta checam `'cotacoes'`, não `'ofertas'` — a permissão `ofertas` é decorativa pros usuários reais da página.
3. Sem `deleteOffer` — ofertas criadas nunca podem ser removidas.
4. Lógica de conversão duplicada entre `generateProposalFromPackage` (morto) e `convertOfferToQuotation`/`convertQuotationToOffer` (vivo) — risco de manutenção se a tabela legada for revivida.
5. `/v/[token]/[id]` usa client admin com filtro manual em vez de RPC/RLS — padrão de segurança inconsistente com o resto da superfície pública (ainda que inalcançável hoje).
6. Grid da vitrine com um único breakpoint (560px) — telas médias ficam com 2 colunas apertadas.
7. FAB de WhatsApp sem padding de segurança inferior — risco de sobreposição de CTA em telas curtas.
8. Barra de ações do `OffersList` sem ordenação mobile explícita, wrap implícito via `flex-wrap` + `ml-auto`.
