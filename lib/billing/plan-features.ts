/**
 * Canonical plan feature matrix — the single source of truth shown in both the
 * checkout popup (CheckoutModal) and the full-page upgrade screen (/upgrade).
 *
 * Repricing set/2026 (migration 0244, docs/PRICING_ARCHITECTURE.md): plano
 * base + usuários incluídos/adicionais + Althos Credits + consumo de
 * comunicação (WhatsApp/Voice/SMS/Email) à parte. Starter/Pro/Business
 * compartilham a maior parte das funcionalidades de CRM — a diferença real
 * está em: usuários incluídos, franquia de Althos Credits, e um conjunto de
 * recursos premium que só entram a partir de Pro (Automações, Agentes de
 * IA avançados, Financeiro, Produtos, Integrações/API, MCP) ou só em
 * Business (Voice AI, SMS, múltiplos WhatsApps/unidades, auditoria).
 *
 * Keep this in sync with:
 *   - lib/plans/config.ts (PLAN_META, PLAN_FEATURES, computeSeatCost)
 *   - o jsonb `plans.features` no Supabase (fonte de verdade server-side)
 *   - docs/PRICING_ARCHITECTURE.md § 2 (planos)
 *
 * NOTA: "WhatsApp: 1 número / múltiplos números" é a oferta comercial —
 * hoje o código NÃO enforça um teto de conexões WhatsApp por plano (só o
 * volume mensal de mensagens, org.limit_whatsapp_monthly). Documentado como
 * pendência em docs/PRICING_ARCHITECTURE.md, não fingir que já é travado.
 */

export type PaidPlan = 'starter' | 'pro' | 'business'

export interface PlanFeatureRow {
  label:    string
  starter:  boolean | string
  pro:      boolean | string
  business: boolean | string
}

export const PLAN_FEATURES: PlanFeatureRow[] = [
  // ── Usuários e créditos (fonte central: lib/plans/config.ts) ──
  { label: 'Usuários incluídos',            starter: '2',          pro: '5',          business: '10'         },
  { label: 'Usuário adicional',             starter: 'R$ 39/mês',  pro: 'R$ 49/mês',  business: 'R$ 59/mês'  },
  { label: 'Althos Credits / mês',          starter: '500',        pro: '2.500',      business: '7.500'      },
  // ── CRM (igual em todos os planos) ──
  { label: 'CRM, Pipeline e Contatos',      starter: true,         pro: true,         business: true         },
  { label: 'Tarefas e Agenda',              starter: true,         pro: true,         business: true         },
  { label: 'Conversas (WhatsApp)',          starter: '1 número',   pro: 'Avançado',   business: 'Múltiplos números' },
  { label: 'Instagram (DMs e comentários)', starter: true,         pro: true,         business: true         },
  { label: 'Formulários de captação',       starter: true,         pro: true,         business: true         },
  { label: 'Atendimento com IA (básico)',   starter: true,         pro: true,         business: true         },
  { label: 'Relatórios',                    starter: 'Básicos',    pro: 'Avançados',  business: 'Avançados'  },
  // ── Pro em diante ──
  { label: 'Pipelines',                     starter: '2',          pro: '5',          business: 'Ilimitados' },
  { label: 'Automações',                    starter: false,        pro: true,         business: 'Avançadas'  },
  { label: 'Agentes de IA',                 starter: false,        pro: true,         business: 'Avançados'  },
  { label: 'Financeiro',                    starter: false,        pro: true,         business: true         },
  { label: 'Produtos (catálogo)',           starter: false,        pro: true,         business: true         },
  { label: 'Relatórios de vendas avançados',starter: false,        pro: true,         business: true         },
  { label: 'Integrações',                   starter: false,        pro: true,         business: true         },
  { label: 'API',                           starter: false,        pro: true,         business: 'Avançada'   },
  { label: 'Conector MCP',                  starter: false,        pro: true,         business: 'Completo'   },
  { label: 'Recursos verticais do nicho',   starter: false,        pro: true,         business: true         },
  // ── Só Business ──
  { label: 'Voice AI (telefonia)',          starter: false,        pro: false,        business: true         },
  { label: 'SMS',                           starter: false,        pro: false,        business: true         },
  { label: 'Múltiplas unidades/empresas',   starter: false,        pro: false,        business: true         },
  { label: 'Permissões avançadas',          starter: false,        pro: false,        business: true         },
  { label: 'Dashboards avançados',          starter: false,        pro: false,        business: true         },
  { label: 'Webhooks',                      starter: false,        pro: false,        business: true         },
  { label: 'Auditoria',                     starter: false,        pro: false,        business: true         },
  { label: 'Suporte prioritário',           starter: false,        pro: false,        business: true         },
  // ── Consumo à parte (não é feature incluída — cobrado por uso) ──
  { label: 'E-mail marketing (disparos)',   starter: 'Consome Email Credits', pro: 'Consome Email Credits', business: 'Consome Email Credits' },
  { label: 'Meta Ads + Pixel/CAPI',         starter: true,         pro: true,         business: true         },
]

/** Short positioning + "Mais popular" flag per paid plan. */
export const PLAN_TAGLINE: Record<PaidPlan, { tagline: string; popular?: boolean }> = {
  starter:  { tagline: 'Ideal para começar' },
  pro:      { tagline: 'Para crescer', popular: true },
  business: { tagline: 'Para escalar sem limites' },
}
