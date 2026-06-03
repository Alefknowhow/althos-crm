const ASAAS_API_KEY = process.env.ASAAS_API_KEY
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3'

async function asaasFetch(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${ASAAS_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'access_token': ASAAS_API_KEY || '',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data = await res.json()
  if (!res.ok) {
    console.error('Asaas API Error:', data)
    throw new Error(data.errors?.[0]?.description || 'Erro na API do Asaas')
  }
  return data
}

type AsaasCycle = 'MONTHLY' | 'YEARLY'

/**
 * Value charged per Asaas billing cycle.
 *  - MONTHLY: the plan's monthly price.
 *  - YEARLY:  the annual à-vista price (already ~18% off), charged once/year.
 * Single source of truth: lib/billing/plans.ts.
 */
function planValue(planKey: string, cycle: AsaasCycle = 'MONTHLY'): number {
  const key = planKey.replace(/^althos_/, '') // 'althos_pro' -> 'pro'
  // 'scale' kept as a legacy alias of 'business' (same price).
  const monthly: Record<string, number> = { starter: 197, pro: 297, business: 397, scale: 397 }
  const annual:  Record<string, number> = { starter: 1940, pro: 2900, business: 3900, scale: 3900 }
  if (cycle === 'YEARLY') return annual[key] ?? annual.starter
  return monthly[key] ?? monthly.starter
}

// First charge due 1 business day from now (gives time to process card)
function nextDueDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export const asaas = {
  async createCustomer(orgData: {
    name: string
    email: string
    phone?: string
    cpfCnpj?: string
    externalReference?: string
  }) {
    return asaasFetch('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name:              orgData.name,
        email:             orgData.email,
        phone:             orgData.phone,
        cpfCnpj:           orgData.cpfCnpj,
        externalReference: orgData.externalReference,
      }),
    })
  },

  /**
   * Create a monthly subscription for a plan.
   * billingType defaults to PIX (boleto was removed — no technical advantage over Pix).
   * Returns the Asaas subscription object.
   */
  async createSubscription(
    customerId: string,
    planKey: string,
    billingType: 'CREDIT_CARD' | 'PIX' = 'PIX',
    cycle: AsaasCycle = 'MONTHLY',
  ) {
    return asaasFetch('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        customer:    customerId,
        billingType,
        value:       planValue(planKey, cycle),
        nextDueDate: nextDueDate(),
        cycle,
        description: `Althos CRM — Plano ${planKey} (${cycle === 'YEARLY' ? 'anual' : 'mensal'})`,
        // externalReference lets us map the payment back in the webhook
        externalReference: planKey,
      }),
    })
  },

  /** Get all payments for a subscription (ordered by dueDate asc). */
  async getSubscriptionPayments(subscriptionId: string) {
    return asaasFetch(`/subscriptions/${subscriptionId}/payments?limit=1`)
  },

  async cancelSubscription(subscriptionId: string) {
    return asaasFetch(`/subscriptions/${subscriptionId}`, { method: 'DELETE' })
  },

  async updateSubscriptionValue(subscriptionId: string, newPlanKey: string) {
    return asaasFetch(`/subscriptions/${subscriptionId}`, {
      method:  'POST',
      body: JSON.stringify({
        value:       planValue(newPlanKey),
        description: `Althos CRM — Plano ${newPlanKey}`,
      }),
    })
  },

  async getInvoices(customerId: string) {
    return asaasFetch(`/payments?customer=${customerId}&limit=12`)
  },
}
