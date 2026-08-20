# Auditoria Core vs. Vertical — Althos CRM

Snapshot gerado em 2026-08-20. Baseado em leitura direta do código (sem acesso a DB — schema inferido de `supabase/migrations/`).

## Status — ajustes já implementados (2026-08-20)

- **Recomendação E.1 (registry)**: criado `lib/niche-modules.ts` — `isModuleEnabled(niche, moduleKey)`. `components/features/Sidebar.tsx` trocou todos os `isTravelNiche(org.niche)`/`!isTravelNiche(org.niche)` (itens de Cotações, Roteirista, Ofertas, Embarques, Bloqueios, Catálogo, Vendas, Reservas, Documentos) por chamadas ao registry. Pronto pra ganhar entradas de Clínicas/Imobiliárias/etc. sem tocar no Sidebar de novo.
- **Recomendação E.2 (Agendamentos)**: decisão de produto do usuário — ao contrário da hipótese inicial deste relatório, Agendamentos **não** é usado por agências de viagem (a operação delas não passa por um compromisso de agenda separado da venda/reserva). Revertido: Agendamentos continua exclusivo de não-viagens, agora como entrada `GENERIC_ONLY` explícita no registry (`lib/niche-modules.ts`), junto de Catálogo e Vendas — mesmo papel, coberto por Ofertas/Reservas na vertical.
- Os ~5 pontos de `isTravelNiche` inline fora do Sidebar (`contatos/*`, `reports.ts`, `sales-source.ts`, `GeneralTab.tsx`) foram deixados como estão — são seções dentro de páginas Core Extensível, não decisões de visibilidade de módulo; não há ganho claro em abstrair para um único consumidor agora (ver E.3 abaixo).
- Recomendação E.3 (plugin engine completo) segue não implementada por decisão do usuário: outros nichos serão adicionados de verdade em cima dessa base, não nesta etapa.

## A. Arquitetura atual

O gating de nicho é minimalista e centralizado em `lib/niche.ts`: `organizations.niche` é uma string livre, e `isTravelNiche(niche)` (`niche.includes('viag') || niche.includes('travel') || niche === 'viagens'`) decide se as abas/telas de viagem aparecem. Não existe registry de "features por nicho" — cada componente/action que precisa saber se é agência de viagem importa `isTravelNiche` diretamente e faz um `if`. `NICHE_OPTIONS` em `lib/niche.ts` já lista 5 nichos-alvo (Viagens, Clínicas, Imobiliárias, Advocacia, Seguros) mas só "Viagens" tem comportamento de fato implementado — os outros 4 caem no CRM genérico sem nenhuma tela própria.

## B. Core atual

| Módulo | Categoria | Motivo | Arquivos-chave |
|---|---|---|---|
| Dashboard/Inicial | CORE PURO | Widgets vêm de dados agregados (`lead`, `deal`, `financial_entries`), sem conceito de viagem no widget em si | `app/app/[orgSlug]/page.tsx`, `lib/dashboard/` |
| Pipeline | CORE PURO | `pipelines`/`pipeline_stages` são por-org, sem estágio hardcoded no código; nenhum "hardcod" de stage encontrado em `lib/` | `supabase/migrations/0001_initial_schema.sql` |
| Contatos | CORE EXTENSÍVEL | Tabela `contatos` sem colunas travel-only, mas UI injeta bloco de "Créditos de viagem" condicionalmente | `app/app/[orgSlug]/contatos/[id]/page.tsx:106,286`, `app/app/[orgSlug]/contatos/page.tsx:251` |
| Automações | CORE PURO | Engine executa `steps` array genérico com `step_type`/`trigger_type` livres (string), sem enum travel-specific no motor | `lib/inngest/automation.ts`, `components/features/automations/AutomationFlow.tsx` |
| Campanhas de Envio | CORE PURO | Não apareceu em nenhuma busca por `isTravelNiche`/`niche ===` | `actions/campaigns.ts` (não tocado por nicho) |
| Financeiro | CORE PURO | `financial_entries` + Asaas, sem menção a nicho nos greps | `lib/asaas/`, `actions/financial*.ts` |
| Agendamentos | CORE PURO (`!isTravelNiche`) | Sidebar mostra "Agendamentos"/calendar só para não-viagem — inversão, ver Seção D | `components/features/Sidebar.tsx:315` |
| Relatórios | CORE EXTENSÍVEL | Mesma tela ganha bloco de métricas de viagem quando org é travel | `app/app/[orgSlug]/relatorios/page.tsx`, `actions/reports.ts:174` |
| WhatsApp/Conversas | CORE PURO | Nenhuma FK travel-específica encontrada nas migrations (`cotacao_id`/`reserva_id`/`travel_sale_id` — zero ocorrências) | `supabase/migrations/` (busca sem match) |
| Instagram/Social | CORE PURO | Não apareceu em nenhum grep de niche | `lib/social/` |
| Anúncios/Marketing | CORE PURO | Não apareceu em nenhum grep de niche | — |
| Tarefas | CORE PURO | `tasks` só ganhou coluna `push_notified` (não-travel) desde a criação | `supabase/migrations/0038_tasks_push_notified.sql` |

## C. Viagens atual (VERTICAL)

| Módulo | Categoria | Motivo | Arquivos-chave |
|---|---|---|---|
| Vendas/Reservas | VERTICAL | Tabela dedicada `travel_sales`, tela só renderiza se `isTravelNiche` | `app/app/[orgSlug]/reservas/page.tsx`, `actions/travel-sales.ts` |
| Cotações | VERTICAL | Fluxo de orçamento/PDF exclusivo de viagem | `app/app/[orgSlug]/cotacoes/*` |
| Bloqueios | VERTICAL | Gestão de bloqueio de assentos/vagas, conceito só de operadora de turismo | `app/app/[orgSlug]/bloqueios/page.tsx` |
| Embarques | VERTICAL | Viagens programadas/embarque de grupo | `app/app/[orgSlug]/embarques/page.tsx` |
| Documentos | VERTICAL | Documentos de viajante (passaporte etc.), gated por niche | `app/app/[orgSlug]/documentos/*` |
| Roteirista | VERTICAL | Gerador de roteiro de viagem via IA, feature flag própria (`TRAVEL_PLANNER_ENABLED`) além do niche gate | `app/app/[orgSlug]/roteirista/page.tsx`, `actions/roteirista.ts` |
| Ofertas | VERTICAL | Pacotes/ofertas de viagem | `app/app/[orgSlug]/ofertas/*` |
| Explorar Voos | VERTICAL | Não localizado como rota própria nesta busca — possivelmente dentro de Cotações/Ofertas; confirmar se necessário |  |

## D. Problemas encontrados

1. **Sidebar com inversão implícita "não-travel = catálogo/vendas genéricas"**: `components/features/Sidebar.tsx:275,286,315` usa `!isTravelNiche(org.niche)` para mostrar "Catálogo", "Vendas" e "Agendamentos" — ou seja, o CRM genérico e o vertical de viagem já se comportam como dois produtos alternados no mesmo componente, ao invés de o core sempre aparecer e o vertical se somar. Isso é o ponto de maior acoplamento: qualquer nicho novo (Clínicas, Imobiliárias) cai automaticamente no ramo "genérico" sem chance de ter sua própria vertical, porque o único branch hoje é binário (`isTravelNiche` / não).
2. **10 pontos de leak de `isTravelNiche`/`niche ===` fora dos módulos verticais** (ou seja, dentro de telas/ações que deveriam ser CORE):
   - `components/features/Sidebar.tsx:224,235,246,257,266,275,286,295,304,315` (10 ocorrências, é o componente com mais leaks — mas é o esperado para um menu, já que é o único lugar que decide o que exibir)
   - `app/app/[orgSlug]/contatos/[id]/page.tsx:106,286` — tela de contato (CORE) injeta bloco de crédito de viagem
   - `app/app/[orgSlug]/contatos/page.tsx:251` — lista de contatos passa `isTravel` pro componente de lista
   - `actions/reports.ts:174` — a Server Action de relatórios (CORE) ramifica pra métricas de viagem
   - `lib/dashboard/sales-source.ts:44` — fonte de dados do dashboard (CORE) decide "vendas" vs "travel sales" por niche
   - `components/features/GeneralTab.tsx:458` — configurações gerais da org
   - `app/app/[orgSlug]/configuracoes/equipe/TeamClient.tsx:58-59` — tela de equipe usa `isTravelNiche` só para exibir badge no seletor de nicho (uso legítimo, não é leak)
   - `app/app/[orgSlug]/configuracoes/notificacoes/page.tsx` — não inspecionado em detalhe, mas aparece no grep
   Nenhum desses é grave isoladamente (são `if`s curtos, não lógica de negócio duplicada), mas o padrão confirma que **não existe uma camada de "módulos habilitados por nicho"** — cada tela reimplementa o próprio check.
3. **Nenhum registry central de nicho → módulos**: a lista de módulos que cada nicho habilita vive espalhada (Sidebar decide o menu, cada `page.tsx` decide se renderiza, `actions/reports.ts` decide métricas). Não há um único arquivo tipo `lib/niche-modules.ts` que diga "nicho X habilita [reservas, cotacoes, bloqueios]".
4. **`contatos`/`tasks` (tabelas CORE) não têm colunas travel-only** — isso é um ponto positivo, não um problema: o isolamento de dado está correto, o vazamento é só na camada de apresentação (item 2).
5. **Conversas (WhatsApp/Instagram) não têm FK genérica nem travel-específica para "entidade relacionada"** (cotação/reserva) — não existe `related_entity_type`/`related_entity_id` nem `cotacao_id`/`reserva_id` em nenhuma migration. Se o produto hoje já linka uma conversa a uma cotação na UI, é por busca/relacionamento indireto (por `contato_id` + lookup), não por FK dedicada — não há uma feature "abrir cotação a partir da conversa" com link direto no banco. Vale confirmar com o time se isso é esperado ou é uma lacuna de produto (não é um problema de arquitetura core/vertical, é ausência de feature).
6. **"Canva" não está acoplado a Automações.** As únicas ocorrências de "canva" em `components/features/automations/AutomationFlow.tsx` são a palavra "canvas" (editor visual antigo) em comentários — não há integração com a ferramenta de design Canva em lugar nenhum do código.
7. **Roteirista tem dois gates simultâneos** (`isTravelNiche` + `TRAVEL_PLANNER_ENABLED` feature flag) — redundância pequena, não é um problema real, só uma curiosidade a documentar.

## E. Arquitetura proposta (pragmática, sem overengineering)

Não é necessário criar uma abstração de "plugin system" ou motor de módulos dinâmico. O código já separa bem dados (nenhuma tabela core contaminada) — o problema é só na apresentação. Proposta mínima:

1. **Um registry simples** `lib/niche-modules.ts`: `Record<string niche-key, string[] moduleKeys>` (ex.: `{ viagens: ['cotacoes','reservas','bloqueios','embarques','documentos','ofertas','roteirista'] }`). Sidebar e as `page.tsx` de cada módulo vertical passam a checar `isModuleEnabled(org.niche, 'cotacoes')` em vez de `isTravelNiche(org.niche)` direto. Muda a chamada, não a lógica — baixo risco.
2. **Sidebar**: trocar o padrão binário (`isTravelNiche` / `!isTravelNiche`) por "vertical soma ao core" — ou seja, Catálogo/Vendas/Agendamentos (que hoje só aparecem pra não-travel) deveriam poder coexistir com os módulos de viagem quando fizer sentido, ao invés de serem mutuamente exclusivos. Isso é uma decisão de produto, não só técnica — sinalizar para o dono do produto antes de mexer.
3. **Contatos/Relatórios/Dashboard**: manter como estão (CORE EXTENSÍVEL) mas trocar o `isTravelNiche` inline por um ponto de extensão nomeado (ex.: `getExtraContatoBlocks(niche)`) só se/quando um segundo nicho precisar do mesmo padrão — não vale a pena abstrair para um único consumidor hoje.

Não recomendamos: motor de plugins, DSL de configuração por nicho, tabela `niche_features` no banco — nenhum desses se paga com só 1 vertical implementada. Revisitar quando o segundo nicho real (Clínicas ou Imobiliárias) começar a ser implementado.

## F. Mapa de migração

| Atual | Destino |
|---|---|
| `isTravelNiche(org.niche)` inline em `Sidebar.tsx`, `contatos/*`, `reports.ts`, `sales-source.ts` | `isModuleEnabled(org.niche, '<moduleKey>')` lendo de `lib/niche-modules.ts` |
| Menu binário travel/não-travel na Sidebar | Composição aditiva (core sempre visível + vertical soma) — pendente de decisão de produto |
| Resto (tabelas, actions, Inngest, Storage, Financeiro, WhatsApp/Instagram) | Nenhuma mudança — já está corretamente separado |

## G. Riscos e pendências

- A mudança de "binário" para "aditivo" na Sidebar (item E.2) muda comportamento visível para todo usuário travel hoje — precisa validação de produto antes de implementar, não é um refactor neutro.
- Não foi possível confirmar contra o banco real (sem acesso MCP Supabase nesta sessão) se existem colunas/tabelas travel-only fora do que as migrations mostram — os arquivos de migration são a fonte usada, mas migrations aplicadas fora de ordem ou via SQL direto não apareceriam aqui.
- "Explorar Voos" não foi localizado como rota própria — pode estar dentro de Cotações/Ofertas ou ser um módulo ainda não implementado; vale confirmar com o time antes de classificá-lo.
- Item D.5 (ausência de FK conversa→cotação/reserva) é uma observação de lacuna de produto, não de arquitetura — não tratar como bug sem confirmar a intenção original.
