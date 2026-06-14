/**
 * Canonical plan feature matrix — the single source of truth shown in both the
 * checkout popup (CheckoutModal) and the full-page upgrade screen (/upgrade).
 *
 * Starter, Pro e Business compartilham as MESMAS funcionalidades — a diferença
 * está na QUANTIDADE de uso. Dois recursos premium (Insights IA e Exportar
 * relatórios) ficam reservados a Pro/Business, e o gerente dedicado a Business.
 *
 * Keep this in sync with lib/plans/config.ts (PLAN_META.aiCreditsMonthly etc.).
 */

export type PaidPlan = 'starter' | 'pro' | 'business'

export interface PlanFeatureRow {
  label:    string
  starter:  boolean | string
  pro:      boolean | string
  business: boolean | string
}

export const PLAN_FEATURES: PlanFeatureRow[] = [
  // ── Quantidades ──
  { label: 'Usuários incluídos',            starter: '1',          pro: 'Até 6',      business: 'Ilimitados' },
  { label: 'Pipelines',                     starter: '2',          pro: '5',          business: 'Ilimitados' },
  { label: 'Leads no pipeline',             starter: 'Ilimitados', pro: 'Ilimitados', business: 'Ilimitados' },
  { label: 'Clientes cadastrados',          starter: '500',        pro: '2.000',      business: 'Ilimitados' },
  { label: 'Créditos de IA / mês',          starter: '300',        pro: '1.200',      business: '3.000'      },
  { label: 'Automações ativas',             starter: '5',          pro: '20',         business: 'Ilimitadas' },
  { label: 'Disparos de automação / mês',   starter: '1.000',      pro: '10.000',     business: 'Ilimitados' },
  { label: 'Contas de social (DM)',         starter: '1',          pro: '3',          business: 'Ilimitadas' },
  { label: 'Mensagens de social / mês',     starter: '500',        pro: '5.000',      business: 'Ilimitadas' },
  // ── Funcionalidades (iguais em todos) ──
  { label: 'Formulários de captação',       starter: true,         pro: true,         business: true         },
  { label: 'WhatsApp centralizado',         starter: true,         pro: true,         business: true         },
  { label: 'Catálogo de produtos',          starter: true,         pro: true,         business: true         },
  { label: 'Tarefas e atividades',          starter: true,         pro: true,         business: true         },
  { label: 'Agendamentos online',           starter: true,         pro: true,         business: true         },
  { label: 'Atendimento com IA 24/7',       starter: true,         pro: true,         business: true         },
  { label: 'Score e qualificação por IA',   starter: true,         pro: true,         business: true         },
  { label: 'Instagram (DMs e comentários)', starter: true,         pro: true,         business: true         },
  { label: 'Meta Ads + Pixel/CAPI',         starter: true,         pro: true,         business: true         },
  // ── Premium (Pro/Business) ──
  { label: 'Insights de vendas com IA',     starter: false,        pro: true,         business: true         },
  { label: 'Exportar relatórios',           starter: false,        pro: true,         business: true         },
  { label: 'Gerente de conta dedicado',     starter: false,        pro: false,        business: true         },
]

/** Short positioning + "Mais popular" flag per paid plan. */
export const PLAN_TAGLINE: Record<PaidPlan, { tagline: string; popular?: boolean }> = {
  starter:  { tagline: 'Ideal para começar' },
  pro:      { tagline: 'Para crescer', popular: true },
  business: { tagline: 'Para escalar sem limites' },
}
