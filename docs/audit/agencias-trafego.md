# Auditoria — Vertical Agências de Tráfego

> Gerado em 2026-08-23. Módulo construído nesta sessão (Etapas 1-3 +
> correções pós-teste). Faz parte da retomada da auditoria completa do
> app — ver também os demais docs em `docs/audit/`.

## 0. Escopo

Nicho `trafego` (`isTrafficNiche`, `lib/niche.ts`). Cobre: Clientes
(`/agencias-trafego/trafego[/[id]]`), Planos (`/catalogo`, adaptado),
Vendas/assinatura (`/vendas`), Financeiro (recorrência), Contratos
(`plan_contracts`), Dashboard (aba Tráfego), e o Agent Layer/MCP Server
(Etapa 3, não exclusivo desta vertical mas construído com ela como
primeiro caso de uso real).

## 1. Segurança — problemas encontrados e corrigidos nesta auditoria

| # | Achado | Severidade | Status |
|---|---|---|---|
| 1 | `actions/contracts.ts` (Reservas/Viagens) nunca chamava `checkMemberPermission` — qualquer membro autenticado da org (independente da permissão `reservas`) conseguia gerar/enviar contrato pra assinatura, baixar PDF assinado e reenviar link por e-mail/WhatsApp via chamada direta da Server Action. **Pré-existente, não introduzido nesta sessão.** | Alta | ✅ Corrigido |
| 2 | `actions/plan-contracts.ts` (Planos/Tráfego, criado nesta sessão) replicava o mesmo gap — copiado de `contracts.ts` sem notar a ausência do check. | Alta | ✅ Corrigido |
| 3 | `actions/dashboard-trafego.ts::getTrafegoDashboardMetrics` não checava a permissão granular `trafego` — só a associação à org. `getClientPerformanceSummaryCore` (Agent Layer) **não precisou de fix** — o Execution Engine (`lib/agent/execute.ts`) já checa `trafego` antes de chamar essa função core, por design. | Média (dado agregado, não PII/financeiro direto) | ✅ Corrigido |
| 4 | `getOrgAutentiqueConfig`/`saveOrgAutentiqueConfig` (`actions/contracts.ts`) só checavam `requireAuth`, sem permissão granular — qualquer membro podia ler se a integração estava configurada e **sobrescrever a API key da Autentique da organização inteira**. | Média-Alta (é uma credencial de integração, escopo org-wide) | ✅ Corrigido (gate por `settings`) |
| 5 | RLS conferida em todas as tabelas novas (`agent_tokens`, `agent_audit_log`, `campaign_creatives`, `plan_contracts`) — todas com policy padrão `organization_id IN (SELECT get_user_organizations())` + policy de super-admin. Sem gap encontrado aqui. | — | OK |
| 6 | RPC pública `update_public_creative_status` (aprovação de criativo) restringe corretamente a escrita a `status`/`client_comment` do registro do token — não permite alterar outro campo nem outro registro. Sem gap encontrado. | — | OK |

**Recomendação prioritária**: aplicar o mesmo `requireAccess()` (permissão `settings`) em `getOrgAutentiqueConfig`/`saveOrgAutentiqueConfig` — é a lacuna mais séria restante (sobrescrever credencial de assinatura eletrônica da org inteira).

## 2. Bugs funcionais encontrados e corrigidos

| # | Bug | Causa raiz | Status |
|---|---|---|---|
| 1 | Lista de Vendas aparecia sempre vazia, em **qualquer nicho**, não só Tráfego. | `actions/sales.ts::listSales`/`getSale` faziam `.select('..., leads(...))` — a tabela `leads` foi renomeada pra `contatos` na migration `0070` (Julho). PostgREST rejeitava a query inteira (`PGRST200`), erro engolido silenciosamente, retornava `[]`. Confirmado nos logs de runtime da Vercel: quebrado desde 13/08. | ✅ Corrigido (`leads:contatos(...)`) |
| 2 | Mesmo bug em `actions/appointments.ts::listAppointments` e `components/features/dashboard/TasksTodayWidget.tsx`. | Idêntica causa raiz. | ✅ Corrigido |
| 3 | `actions/clinic.ts` ainda referencia `appointments.lead_id` (renomeado pra `contato_id` na mesma migration 0070) em ~8 pontos. | Mesma causa raiz, nicho Clínicas. | ⏳ Não corrigido — task separada já registrada (`task_813b2cbb`) |
| 4 | Editar uma venda existente pra adicionar `duration_months` depois de criada não gera as parcelas em `financial_entries` — só a criação (`createSale`) faz isso. | Decisão de escopo consciente, mas não documentada na UI — usuário pode achar que "só editar" resolve. | ⏳ Comportamento conhecido, considerar aviso na UI |

## 3. Duplicação de tabelas/entidades

| Situação | Avaliação |
|---|---|
| `sale_contracts` (Reservas) vs. `plan_contracts` (Planos) | **Duplicação intencional**, pedida explicitamente pelo usuário ("tabelas distintas, não compartilhadas, apenas copiar a estrutura"). Ambas têm a mesma forma (Autentique) mas isolamento total — decisão de produto, não falha. |
| `sale_contracts` × `travel_sales` × `plan_contracts` × `sales` | Nenhuma FK cruzada entre Tráfego e Viagens — confirmado limpo após o revert da migration 0192/0194. |
| `financial_entries.venda_id` (→ `travel_sales`) vs. `financial_entries.sales_generic_id` (→ `sales`) | Padrão já estabelecido no projeto (FK dedicada por vertical, ex. `property_deal_id`/`insurance_policy_id`) — não é duplicação indevida, é o padrão consistente do resto do schema. |

## 4. Código morto encontrado

| Item | Situação |
|---|---|
| `components/features/leads/LeadsView.tsx` (1147 linhas) | **Órfão** — zero imports em todo o projeto. Foi brevemente ligado numa rota (`/agencias-trafego/leads`) na Fase E da Etapa 2, mas essa rota foi removida na correção seguinte (duplicava o Pipeline). Componente pronto, funcional, mas sem consumidor. Decisão: manter (pode ser útil no futuro) ou apagar — recomendo perguntar ao usuário antes de decidir. |
| `lib/agencias-trafego/types.ts` | ✅ Removido nesta auditoria. |
| `components/features/agencias-trafego/PlaceholderPage.tsx` | ✅ Removido nesta auditoria. |

## 5. Caminhos quebrados

Nenhum link morto encontrado nas telas atuais (`/agencias-trafego/trafego`, `/agencias-trafego/trafego/[id]`, `/catalogo`, `/vendas`, `/vendas/[saleId]/contrato`, `/documentos`) — todos os `href`/`Link` verificados apontam pra rotas existentes.

## 6. UI/UX

| Observação | Detalhe |
|---|---|
| `ClientDetailShell` sem loading state | Ao trocar de aba (Dados/Histórico/Criativos) não há skeleton — como os dados já vêm todos carregados via props (server component pai), não é um problema real de UX, só uma observação. |
| `TrafficClientCampaignsCard` — criar conta de anúncio manualmente | Não há integração real com Meta/Google Ads pra vincular automaticamente — o gestor cadastra a conta manualmente (nome + plataforma). Consistente com a decisão documentada de não inventar integração sem pedido explícito, mas vale deixar claro pro usuário que isso é esperado, não um bug. |
| `CampaignCreativesSection` — sem preview de vídeo/PDF na lista interna | A lista de criativos mostra só título/status — o preview do arquivo só aparece na página pública de aprovação. Poderia ter uma miniatura/thumbnail na lista interna também. |
| Botão "Contrato" em `SalesTable` só aparece com `duration_months` preenchido | Já reportado pelo usuário como confuso ("não encontrei os contratos") — resolvido via explicação, mas pode valer um estado visual (botão desabilitado com tooltip "Marque o plano como recorrente pra habilitar") em vez de simplesmente não renderizar o botão. |

## 7. Recomendações de robustez (não-bloqueantes)

Itens 1, 2 e 4 da rodada anterior já corrigidos. Restam:

1. Decidir o destino de `LeadsView.tsx` (reaproveitar, arquivar ou remover) — não removido por ser código funcional (1147 linhas), diferente dos outros dois órfãos que eram só placeholder.
2. Considerar estado visual explícito no botão "Contrato" da `SalesTable` em vez de ocultá-lo silenciosamente.
3. Documentar (comentário + talvez aviso na UI) que editar uma venda existente não gera parcelas retroativas — só a criação.
