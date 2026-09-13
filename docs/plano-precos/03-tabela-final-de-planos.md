# Etapa 3 — Tabela Final de Planos (SUPERSEDIDO — ver docs/PRICING_ARCHITECTURE.md)

> ⚠️ **Documento histórico, preços desatualizados.** Esta repricing (Starter R$167/Pro R$397/Business R$697) foi substituída em set/2026 pela repricing "Althos Credits" (Starter R$149/Pro R$299/Business R$599 + usuários incluídos/adicionais + Voice AI exclusivo do Business) — ver **[docs/PRICING_ARCHITECTURE.md](../PRICING_ARCHITECTURE.md)**, **[docs/ALTHOS_CREDITS.md](../ALTHOS_CREDITS.md)** e **[docs/BILLING.md](../BILLING.md)** para a arquitetura vigente. Mantido só como registro histórico de decisão — não usar os números abaixo como referência atual.

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

Metodologia: **10% do valor do plano, convertido em créditos ao custo real do token**, arredondado. Custo real recalibrado (migration 0156) com o valor observado em produção: **R$0,054/crédito** (US$0,01/resposta do Atendente IA, câmbio R$5,40 — a estimativa original por tokens, US$0,00225, ficava ~4,4x abaixo do real porque não considerava iterações de tool-use). Fonte: `ai_credit_pricing_settings`.

| Plano | 10% do valor | Créditos/mês | Custo real desses créditos |
|---|---:|---:|---:|
| Starter | R$16,70 | **310** | ~R$16,74/mês |
| Pro | R$39,70 | **740** | ~R$39,96/mês |
| Business | R$69,70 | **1.290** | ~R$69,66/mês |

O Atendente IA (WhatsApp) consome 1 crédito por resposta automática — na prática: Starter aguenta ~310 respostas automáticas/mês, Pro ~740, Business ~1.290, antes de precisar de pacote avulso.

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
| Disparos de e-mail marketing | ~~300/mês~~ **metered — ver seção 7 (Email Credits)** | ~~1.000/mês~~ **idem** | ~~5.000/mês~~ **idem** |
| Créditos de IA/mês | 310 | 740 | 1.290 |

**Negrito** = limites novos ou recalculados nesta reformulação.

---

## 5. O que mudou de fato (resumo executivo)

1. **Starter subiu de R$137 → R$167**, mas deixou de ser "CRM sem canal real" — WhatsApp, Instagram e e-mail marketing entram habilitados, com teto de uso em vez de bloqueio total. Antes disso, o Atendente IA já vinha incluso no Starter mas sem WhatsApp habilitado pra usá-lo — inconsistência corrigida.
2. **Créditos de IA recalculados pra 10% do valor do plano** ao custo real do crédito (R$0,054 — recalibrado depois que o custo estimado por tokens se mostrou ~4,4x abaixo do observado em produção): Starter 300→310, Pro 1.200→740, Business 3.000→1.290. O Pro e o Business caem em volume bruto porque o custo real por crédito é maior do que o presumido inicialmente — mas o gasto em IA como % da receita fica consistente (~10%) nos três planos, o que não acontecia antes.
3. **Fim do teto de clientes cadastrados** — substituído por teto de storage de mídia, que é o custo elástico real (clientes cadastrados não custam nada de infraestrutura; mídia enviada, sim).
4. **Formulários deixam de ser ilimitados em todo plano** — vira 10/20/ilimitado, diferenciação nova.
5. **Dois limites novos:** storage de mídia e disparos de e-mail marketing (a funcionalidade de e-mail em massa já existia via Campanhas de Envio — só não tinha teto).
6. **Business perde o "ilimitado" de usuários** — vira 20, com plano sob medida acima disso.
7. **Duas divergências banco × código corrigidas de passagem** (não relacionadas à decisão de preço, mas achadas no processo): `max_tenants` do Pro estava 1 em vez de 5, e do Business estava 5 em vez de ilimitado.

---

## 6. Pendências pra próxima etapa

- **Fluxo de compra de usuário/organização adicional avulso** (Starter acima de 1 usuário, Business acima de 20) — ainda não existe, mencionado como decisão em aberto desde a etapa 2.
- **Enforcement real do limite de storage** — `storageMb` foi adicionado à configuração (`lib/plans/config.ts`), mas ainda não há checagem server-side ativa bloqueando quando o teto é atingido (mesmo estado em que `socialMessages` e `automationRuns` já estavam antes: definidos, não aplicados). `emailSends` deixou de precisar de enforcement de teto — virou Email Credits (seção 7), que já bloqueia envio por saldo insuficiente via `consume_email_credits`.
- **Comunicação da mudança pra base de clientes já ativa** (quem já paga R$137 — grandfathering, aviso de reajuste, ou aplicação só pra novos clientes) — decisão de negócio, não técnica.

---

## 7. Email Credits (2026-09 — substitui o cap fixo de "disparos de e-mail/mês" da seção 4)

**Mudança de modelo**: "disparos de e-mail marketing/mês" deixou de ser um teto incluso fixo (300/1.000/5.000) e virou **cobrança por unidade**, mesmo padrão de Voice Credits e Créditos de IA — o usuário compra um pacote de créditos e cada e-mail disparado pelo pipeline de envio (`lib/inngest/functions.ts::sendEmail`, usado tanto por automações quanto por futuras campanhas em massa) debita o saldo. Ledger separado (`email_credits`/`email_credit_transactions`), nunca compartilha saldo com créditos de IA/Voice.

Metodologia: **25% de margem sobre o custo real do Resend** (pedido explícito do produto), não os 10%-do-plano usado nos créditos de IA — cobrado por e-mail, não por resposta de IA.

| Item | Valor |
|---|---:|
| Custo Resend (overage, plano Pro) | US$0,90 / 1.000 e-mails |
| Câmbio de referência | R$5,40 |
| Custo real por e-mail | ~R$0,0049 |
| Preço de venda (25% de margem) | ~R$0,0061/e-mail |
| Pacotes à venda | R$50 / R$150 / R$500 (via PIX, Asaas) |

Config editável só por super-admin em `email_pricing_config` (custo do provider + câmbio + margem) — nunca hardcodear no código, mesma regra de `voice_pricing_config`/`ai_credit_pricing_settings`.

**Pendência explícita**: hoje não existe um construtor de campanha de e-mail em massa no produto — a cobrança por crédito está conectada no pipeline de envio que já existe (`queueEmailForLead`/`sendEmail`, usado por automações e envio avulso pelo CRM). Quando/se um construtor de campanha em lote for construído, ele reusa esse mesmo pipeline e portanto já sai cobrado corretamente, sem trabalho adicional de billing.
