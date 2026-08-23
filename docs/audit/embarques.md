# Auditoria — Módulo Embarques

> Gerado em 2026-07-29. Faz parte da auditoria completa do app. Ver também os demais docs em `docs/audit/`.

## 1. Rotas

| Rota | Arquivo | Função |
|---|---|---|
| `/app/[orgSlug]/embarques` | `app/app/[orgSlug]/embarques/page.tsx` | Única rota do módulo. `requireAuth` + redirect se `!isTravelNiche`. Busca `listScheduledTrips`, renderiza `PageHeader` + `ScheduleClient`. **Não checa permissão nenhuma** além do nicho. |

## 2. Componentes

| Componente | Papel | Problemas encontrados |
|---|---|---|
| `ScheduleClient.tsx` | Componente principal: timeline Gantt + lista de embarques, diálogo de detalhe. Tabs "Linha do tempo"/"Lista". | **Zero classes responsivas** (`sm:`/`md:`/`hidden`) no arquivo inteiro. A timeline Gantt (3 meses, barras posicionadas por %) não tem scroll horizontal nem simplificação mobile — em 375px de largura fica praticamente ilegível/impossível de tocar com precisão. `max-h-[60vh] overflow-y-auto` nas linhas do Gantt combinado com o `Dialog` de detalhe aberto por cima pode criar armadilhas de scroll aninhado em telas pequenas. |
| `TripDetail` (interno) | Detalhe da viagem dentro do `Dialog`: datas, destino, hotel, cia aérea, localizadores, botão WhatsApp, link de check-in, tarefas relacionadas. | Grid de info `grid grid-cols-2` **nunca colapsa pra 1 coluna** — dentro de um `Dialog max-w-lg` em celular, valores longos (nome de hotel, operadora) ficam espremidos/quebram muito. |
| `Info` (interno) | Linha ícone+label+valor. | `break-words` aplicado (bom), mas sem truncamento — endereços longos podem aumentar bastante a altura do diálogo. |
| `PageHeader` (compartilhado) | Registra o hint da página. | **Achado curioso**: se `actions` não é passado (como nesta página), o componente retorna `null` inteiramente — o `title="Embarques"` e `hint` viram efetivamente no-ops pra renderização visível (só chegam ao header via contexto `usePageHint`). Provavelmente intencional, mas API confusa (componente chamado "PageHeader" que às vezes não renderiza nada). |

## 3. Server Actions (`actions/travel-schedule.ts`)

| Action | Propósito | Tabela(s) |
|---|---|---|
| `listScheduledTrips` | Busca todas as `travel_sales` com `departure_date` não nulo (limite 500), enriquecidas com nome/telefone do lead | `travel_sales`, `contatos` — **sem verificação de permissão** |
| `getTripTasks` | Tarefas vinculadas ao lead da viagem, pra seção "Tarefas relacionadas" | `tasks` filtrado por `contato_id` |

**Achado adicional**: `consultar_embarques`/`queryDepartures` em `lib/ai/insights-tools.ts` é um **caminho de leitura paralelo e independente** pro Copiloto de IA — reproduz a mesma query de "próximos embarques" contra `travel_sales`, mas com janela de N dias diferente e colunas diferentes (sem hotel/localizadores). Duplicação de lógica de negócio em dois lugares.

## 4. Permissões

Chave: **`embarques`** (módulo `TRAVEL_ONLY_KEYS`, padrão `false`). **Gap total**: a página não chama `checkMemberPermission`/`canAccess` — só verifica nicho. As actions (`listScheduledTrips`, `getTripTasks`) também não checam permissão. Enforcement existe **só** em `components/features/Sidebar.tsx` (visibilidade do link). Um membro com `embarques: false` explícito ainda consegue navegar direto pra `/app/{orgSlug}/embarques` e ver tudo (nomes de cliente, destinos, valores, telefones).

## 5. Conexões com outros módulos

- **Reservas**: fonte de dados principal — lê `travel_sales` direto (não existe tabela dedicada de embarques). Links "Abrir reserva" vão pra `/reservas?sale={id}`.
- **Contatos**: join com `contatos` (nome/telefone) via `contato_id` pro atalho de WhatsApp.
- **Tarefas**: `getTripTasks` lê `tasks` filtrado por `contato_id`; link "Ver todas as tarefas" vai pra `/tarefas`.
- **WhatsApp**: `whatsappLink()` monta link `wa.me` direto do telefone do lead (heurística de número BR: preenche `55` + dígitos se tiver 10/11 dígitos) — abre em nova aba, **não** usa a integração própria de Conversas/WhatsApp do app.
- **Copiloto de IA (Insights)**: tem sua própria ferramenta `consultar_embarques` reproduzindo a query de embarques.

## 6. Notas de mobile

- **Sem layout mobile dedicado nenhum.** Zero breakpoints responsivos no arquivo inteiro.
- Timeline Gantt (3 meses, barras por %) não tem scroll horizontal nem simplificação mobile (ex: colapsar pra 1 mês, ou default pra lista em telas pequenas).
- Visão "Lista" é mais mobile-friendly por natureza (linhas de coluna única), mas não foi explicitamente testada/estilizada pra largura estreita.
- Diálogo de detalhe com `max-w-lg` fixo e grid de 2 colunas que não colapsa — fica apertado em celular.
- Sem paginação/virtualização na visão de lista — com até 500 viagens retornadas, todas renderizam de uma vez.

## Lista de problemas concretos

1. **[Segurança]** Nenhuma verificação de permissão server-side — só nicho é checado na página e nas actions.
2. `PageHeader` sem prop `actions` retorna `null` — título/hint viram no-ops visuais, API confusa.
3. **Zero classes responsivas** em `ScheduleClient.tsx` — Gantt especialmente não adaptado pro mobile.
4. `TripDetail` — grid de 2 colunas nunca colapsa, aperta em diálogo mobile.
5. **[Arquitetura]** Lógica de "próximos embarques" duplicada entre `listScheduledTrips` e `queryDepartures` (IA) — precisa manter sincronizado manualmente.
6. `listScheduledTrips` sem limite superior de data — embarques antigos concluídos ficam ocupando o cap de 500 registros indefinidamente conforme a org acumula histórico.
7. Heurística de telefone pro link de WhatsApp é ingênua (assume BR, 10/11 dígitos) — números internacionais ou com formato diferente podem gerar link quebrado sem feedback de erro.
8. Sem paginação/virtualização na visão de lista — risco de performance com alto volume.
