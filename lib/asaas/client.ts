const ASAAS_API_KEY = process.env.ASAAS_API_KEY
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3'

async function asaasFetch(endpoint: string, options: RequestInit = {}) {
  // Fail fast with a readable message instead of firing an unauthenticated
  // request that comes back with an empty body (which would otherwise blow up
  // as "Unexpected end of JSON input" on res.json()).
  if (!ASAAS_API_KEY) {
    throw new Error('Integração Asaas não configurada (ASAAS_API_KEY ausente).')
  }

  const res = await fetch(`${ASAAS_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'access_token': ASAAS_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  // Read the body as text first: some Asaas responses (204 No Content, DELETE,
  // or upstream errors) come back empty, and res.json() on an empty body throws
  // "Unexpected end of JSON input". Only parse when there's actually content.
  const raw = await res.text()
  let data: any = null
  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      // Non-JSON body (e.g. an HTML error page or plain-text gateway error).
      if (!res.ok) {
        console.error('Asaas API Error (non-JSON body):', res.status, raw.slice(0, 300))
        throw new Error(`Erro na API do Asaas (HTTP ${res.status}).`)
      }
      // OK status but unparseable body — return the raw text to the caller.
      return raw
    }
  }

  if (!res.ok) {
    console.error('Asaas API Error:', res.status, data)
    throw new Error(data?.errors?.[0]?.description || `Erro na API do Asaas (HTTP ${res.status}).`)
  }
  return data
}

type AsaasCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY'

/**
 * Value charged per Asaas billing cycle (em reais).
 *  - MONTHLY:      preço mensal do plano.
 *  - SEMIANNUALLY: total semestral à vista (−10%), cobrado a cada 6 meses.
 *  - YEARLY:       total anual à vista (−18%), cobrado 1×/ano.
 * Fonte única: lib/billing/plans.ts (junho/2026: 137 / 397 / 697).
 * 'scale' mantido como alias legado de 'business' (mesmo preço).
 */
function planValue(planKey: string, cycle: AsaasCycle = 'MONTHLY'): number {
  const key = planKey.replace(/^althos_/, '') // 'althos_pro' -> 'pro'
  const monthly:   Record<string, number> = { starter: 137,    pro: 397,    business: 697,    scale: 697 }
  const semestral: Record<string, number> = { starter: 739.80, pro: 2143.80, business: 3763.80, scale: 3763.80 }
  const annual:    Record<string, number> = { starter: 1348.08, pro: 3906.48, business: 6858.48, scale: 6858.48 }
  if (cycle === 'YEARLY')       return annual[key]    ?? annual.starter
  if (cycle === 'SEMIANNUALLY') return semestral[key] ?? semestral.starter
  return monthly[key] ?? monthly.starter
}

/** Rótulo pt-BR do ciclo, para a descrição da cobrança no Asaas. */
function cycleLabel(cycle: AsaasCycle): string {
  if (cycle === 'YEARLY') return 'anual'
  if (cycle === 'SEMIANNUALLY') return 'semestral'
  return 'mensal'
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
        description: `Althos CRM — Plano ${planKey} (${cycleLabel(cycle)})`,
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
