# Etapa 3 — Tabela Final de Planos (implementada em produção)

> Fecha a estratégia de preços iniciada nas etapas 1 (inventário por nicho) e 2 (viabilidade de mercado). Os números abaixo já estão aplicados na tabela `plans` do banco de produção e espelhados em `lib/plans/config.ts` / `lib/billing/plans-data.ts` (commit `3f1f8da`).

---

## 1. Preço

| Plano | Mensal | Semestral (−10%) | Anual (−18%) | Equivalente mensal no anual |
|---|---:|---:|---:|---:|
| **Starter** | R$167,00 | R$901,80 | R$1.643,28 | R$136,94 |
| **Pro** | R$397,00 | R$2.143,80 | R$3.906,48 | R$325,54 |
| **Business** | R$697,00 | R$3.763,80 | R$6.858,48 | R$571,54 |

---

## 2. Créditos de IA

Metodologia: **5% do valor do plano, convertido em créditos ao custo real do token** (R$0,01215/crédito — câmbio R$5,40, sem margem, fonte `ai_credit_pricing_settings`), arredondado.

| Plano | 5% do valor | Créditos/mês | Custo real desses créditos |
|---|---:|---:|---:|
| Starter | R$8,35 | **700** | ~R$8,51/mês |
| Pro | R$19,85 | **1.650** | ~R$20,05/mês |
| Business | R$34,85 | **2.900** | ~R$35,24/mês |

O Atendente IA (WhatsApp) consome 1 crédito por resposta automática — na prática: Starter aguenta ~700 respostas automáticas/mês, Pro ~1.650, Business ~2.900, antes de precisar de pacote avulso.

---

## 3. Recursos (features) — hoje os 3 planos pagos têm o MESMO conjunto

A reformulação eliminou a lógica antiga de "recurso ligado/desligado por plano" pros canais principais — agora a diferenciação é por **volume de uso** (seção 4), não por bloqueio de funcionalidade. Só dois recursos premium continuam exclusivos do topo:

| Recurso | Starter | Pro | Business |
|---|:-:|:-:|:-:|
| Tarefas | ✅ | ✅ | ✅ |
| Catálogo de produtos | ✅ | ✅ | ✅ |
| WhatsApp (API oficial) | ✅ | ✅ | ✅ |
| Atendente IA (WhatsApp) | ✅ | ✅ | ✅ |
| Instagram + automações | ✅ | ✅ | ✅ |
| Pixel + CAPI (Meta) | ✅ | ✅ | ✅ |
| Painel de Meta Ads | ✅ | ✅ | ✅ |
| Agendamentos | ✅ | ✅ | ✅ |
| Lead scoring (qualificação IA) | ✅ | ✅ | ✅ |
| Campanhas de Envio (WhatsApp + e-mail) | ✅ | ✅ | ✅ |
| Multi-tenant (mais de 1 organização) | ❌ | ✅ | ✅ |
| **Insights com IA** (copiloto/dashboard) | ❌ | ✅ | ✅ |
| **Exportar relatórios** (PDF/Excel) | ❌ | ✅ | ✅ |
| White-label | ❌ | ❌ | ❌ *(removido da oferta em todos os planos)* |

---

## 4. Limites de uso

| Limite | Starter | Pro | Business |
|---|:-:|:-:|:-:|
| Usuários | **1** *(adicional avulso — a definir)* | 6 | **20** *(acima disso: plano sob medida)* |
| Organizações (multi-tenant) | 1 | 5 | ilimitado |
| Pipelines | 2 | 5 | ilimitado |
| Automações ativas | 5 | 20 | ilimitado |
| Disparos de automação/mês | 1.000 | 10.000 | ilimitado |
| Contas de Social (Instagram) conectadas | 1 | 3 | ilimitado |
| Mensagens/disparos de automação Social por mês | 500 | 1.000 | ilimitado |
| Clientes cadastrados | **ilimitado** | ilimitado | ilimitado |
| Leads no pipeline | ilimitado | ilimitado | ilimitado |
| Formulários de captação ativos | **10** | **20** | ilimitado |
| **Storage de mídia** (uploads, vouchers, mídia de WhatsApp/Instagram) | **2GB** | **5GB** | **15GB** |
| **Disparos de e-mail marketing/mês** (1 e-mail = 1 disparo) | **300** | **1.000** | **5.000** |
| Créditos de IA/mês | 700 | 1.650 | 2.900 |

**Negrito** = limites novos ou recalculados nesta reformulação.

---

## 5. O que mudou de fato (resumo executivo)

1. **Starter subiu de R$137 → R$167**, mas deixou de ser "CRM sem canal real" — WhatsApp, Instagram e e-mail marketing entram habilitados, com teto de uso em vez de bloqueio total. Antes disso, o Atendente IA já vinha incluso no Starter mas sem WhatsApp habilitado pra usá-lo — inconsistência corrigida.
2. **Créditos de IA quase triplicaram no Starter** (300→700) e cresceram ~40% no Pro (1.200→1.650); Business teve um pequeno ajuste pra baixo (3.000→2.900) pra bater com a metodologia de 5% aplicada de forma consistente aos 3 planos.
3. **Fim do teto de clientes cadastrados** — substituído por teto de storage de mídia, que é o custo elástico real (clientes cadastrados não custam nada de infraestrutura; mídia enviada, sim).
4. **Formulários deixam de ser ilimitados em todo plano** — vira 10/20/ilimitado, diferenciação nova.
5. **Dois limites novos:** storage de mídia e disparos de e-mail marketing (a funcionalidade de e-mail em massa já existia via Campanhas de Envio — só não tinha teto).
6. **Business perde o "ilimitado" de usuários** — vira 20, com plano sob medida acima disso.
7. **Duas divergências banco × código corrigidas de passagem** (não relacionadas à decisão de preço, mas achadas no processo): `max_tenants` do Pro estava 1 em vez de 5, e do Business estava 5 em vez de ilimitado.

---

## 6. Pendências pra próxima etapa

- **Fluxo de compra de usuário/organização adicional avulso** (Starter acima de 1 usuário, Business acima de 20) — ainda não existe, mencionado como decisão em aberto desde a etapa 2.
- **Enforcement real dos novos limites** — `storageMb` e `emailSends` foram adicionados à configuração (`lib/plans/config.ts`), mas ainda não há checagem server-side ativa gastando/bloqueando quando o teto é atingido (mesmo estado em que `socialMessages` e `automationRuns` já estavam antes: definidos, não aplicados). Vale priorizar pelo menos storage e e-mail, que têm custo real de terceiro (Supabase Storage, Resend).
- **Comunicação da mudança pra base de clientes já ativa** (quem já paga R$137 — grandfathering, aviso de reajuste, ou aplicação só pra novos clientes) — decisão de negócio, não técnica.
