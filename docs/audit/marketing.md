# Auditoria — Módulo Marketing

> Gerado em 2026-07-29. Faz parte da auditoria completa do app. Ver também os demais docs em `docs/audit/`.

## 1. Rotas

| Rota | Arquivo | Função |
|---|---|---|
| `/app/[orgSlug]/marketing` | `page.tsx` | Busca `getMarketingOverview`, `listAdAccounts`, `listCampaigns` em paralelo, renderiza `MarketingOverview`. `?period=` (default 30d). |
| `/app/[orgSlug]/marketing/contas` | `contas/page.tsx` | Lista/gerencia contas de anúncio (`AdAccountsManager`). |
| `/app/[orgSlug]/marketing/importar` | `importar/page.tsx` | Import de CSV de campanhas (`CsvImporter`). |

Nenhuma das três chama `checkMemberPermission` — mesmo padrão observado em Pipeline/Bloqueios/Embarques.

## 2. Componentes

| Componente | Papel | Problemas encontrados |
|---|---|---|
| `MarketingOverview.tsx` | Tabs de período, dropdown "Novo", 6 KPI cards, gráfico multi-métrica + donut, tabela de campanhas. | `startTransition` sem usar o `isPending` — nenhum spinner/disabled durante refetch, cliques duplos sem proteção visual. Grid de KPIs (`sm:2 → lg:3 → xl:6`) cria bloco alto em tablets (768-1024px, 3 linhas de 2). Gráfico + donut empilham 100% de largura em `md`, mas a altura fixa do gráfico (260px) fica desproporcional pra largura cheia de tablet. |
| `MetricsChart.tsx` | Gráfico composto com chips de toggle de métrica. | Altura fixa `260px` não se adapta a mobile paisagem/telas baixas. |
| `CampaignsTable.tsx` | Tabela de desempenho por campanha. | **Sem view mobile alternativa** — tabela de 10 colunas com scroll horizontal forçado, ao contrário do Pipeline que tem componente mobile dedicado. Ações (pausar/excluir) sem spinner, só `disabled`. |
| `AdAccountsManager.tsx` | CRUD de contas de anúncio (cards empilhados). | Layout mobile-first genuíno, mas desperdiça espaço em desktop (sem grid). Sem paginação. |
| `CsvImporter.tsx` | Upload/preview/import de CSV. | Preview usa `<table>` HTML crua (não o componente `Table` do design system) — inconsistente. 7 colunas sofrem overflow horizontal no mobile sem tratamento. Dropzone com `rounded-none` destoa do resto do app. |
| `NewAdAccountDialog.tsx` / `NewCampaignDialog.tsx` | Diálogos de criação. | `<select>` nativo sem o `Select` do shadcn — inconsistência visual. Color picker nativo sem paleta de fallback (mesmo achado do Pipeline). |
| `RecordSpendDialog.tsx` | Lançamento manual de gasto diário. | **Parsing de moeda frágil**: `parseFloat(form.spend.replace(',', '.'))` quebra silenciosamente em valores com separador de milhar (`"1.234,56"`), lançando gasto errado sem aviso. |

## 3. Server Actions (`actions/marketing.ts`)

| Action | Propósito | Tabela(s) |
|---|---|---|
| `listAdAccounts`/`createAdAccount`/`updateAdAccount`/`deleteAdAccount` | CRUD de contas (delete bloqueado se houver campanhas vinculadas ou impersonação) | `ad_accounts` |
| `listCampaigns`/`createCampaign`/`updateCampaign`/`deleteCampaign` | CRUD de campanhas | `campaigns` |
| `recordCampaignMetric`/`bulkRecordCampaignMetrics` | Registro manual/em lote de métricas diárias | `campaign_metrics_daily` |
| `listCampaignMetrics` | Métricas de 1 campanha — **parece código morto**, sem consumidor encontrado | `campaign_metrics_daily` |
| `getMarketingOverview` | Agregação one-shot pro dashboard (totais, série temporal, leads por campanha) | `campaigns`, `campaign_metrics_daily`, `form_submissions` |

**Achado central de atribuição**: leads são atribuídos a campanhas via `form_submissions.utm_campaign` comparado a `campaigns.utm_campaign` — **não existe uma tabela `marketing_leads` usada por este módulo**. A tabela `marketing_leads` (migração 0100) é um recurso totalmente diferente e não relacionado: captura de leads do site institucional público (plano Business), sem `organization_id`. Referências de memória que assumem essa tabela como parte do dashboard de campanhas estão erradas.

**Achado de segurança grave**: as queries de atribuição de leads (`form_submissions`, dentro de `getMarketingOverview`) **não filtram por `organization_id`** — só por `created_at`/`utm_campaign`. Se dois orgs distintos usam o mesmo valor de `utm_campaign` (bem provável com slugs genéricos como `promo-verao`), leads de uma org são contados na atribuição de outra — **vazamento cross-tenant**.

## 4. Permissões

Chave: **`marketing`**, padrão `false`. Enforcement **só** em `components/features/Sidebar.tsx` (link "Campanhas"). Nenhuma das 3 rotas nem nenhuma das 12 actions em `actions/marketing.ts` chama `checkMemberPermission` — um membro com `marketing: false` explícito ainda lê/escreve tudo via URL/action direta.

## 5. Conexões com outros módulos

- **Pipeline → Meta CAPI**: `moveLeadToStage` (`actions/contatos.ts`), ao ganhar/perder etapa, busca `organizations.meta_pixel_id`/`meta_access_token` e dispara `Purchase`/`NotQualified` via `sendCapiEvent`. Erros só logados no console, não bloqueiam o Kanban.
- **Formulários públicos → Meta CAPI**: `submitPublicForm` (`actions/public_forms.ts`) dispara evento `Lead` no submit — **é aqui, não no módulo Marketing, que o Pixel/CAPI realmente conecta captura de lead a conversão**.
- **Configurações > Integrações**: card "Capi/Pixel" aponta pra config em `configuracoes/meta`, via `getOrgMetaConfig`/`saveOrgMetaConfig` (`actions/organization.ts`). Token nunca retorna ao client, só um booleano.
- **`ad_accounts`/`campaigns` sem integração de API real** com Meta/Google/TikTok — tudo é CRUD manual + import de CSV. Campo `external_id` existe "pra futuras integrações" mas não é consumido hoje.

## 6. Notas de mobile

- Sem atalho na `BottomNav` — acesso só pelo drawer/hamburger do menu lateral.
- KPIs empilham em coluna única no mobile — scroll vertical longo antes de chegar aos gráficos/tabela.
- `CampaignsTable`/`CsvImporter` — sem view mobile dedicada, diferente do Pipeline; tabelas largas com scroll horizontal forçado.
- `AdAccountsManager` é a única tela com layout mobile-first genuíno.

## Lista de problemas concretos

1. **[Segurança grave]** Vazamento cross-tenant na atribuição de leads — query em `form_submissions` sem filtro de `organization_id`.
2. **[Segurança]** Permissão `marketing` é só cosmética — nenhuma rota/action verifica server-side.
3. Sem view mobile dedicada pra tabela de campanhas e preview de CSV — scroll horizontal forçado.
4. `listCampaignMetrics` parece código morto.
5. Parsing de moeda frágil em `RecordSpendDialog` — separador de milhar quebra silenciosamente.
6. **[Nomenclatura]** Tabela `marketing_leads` é enganosa — não tem relação com este módulo, é captura pública do site institucional.
7. `revalidatePath` sempre aponta só pra `/marketing` — outras sub-rotas não revalidadas explicitamente (mitigado por `router.refresh()` no client, mas inconsistente).
8. Inconsistências visuais: `<select>` nativo sem estilização, `rounded-none` no dropzone, preview de CSV em `<table>` crua.
9. Sem feedback de loading nas ações da tabela (pausar/ativar/excluir) além de `disabled`.
10. Erros de CAPI só logados no console — falha de token/pixel é silenciosa pro usuário final, sem painel de status em Marketing ou Configurações.
