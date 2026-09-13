import { useState } from 'react'
import {
  PUBLIC_PLANS,
  getPlanPricing,
  ANNUAL_DISCOUNT_PCT,
  SEMESTRAL_DISCOUNT_PCT,
  type BillingCycle,
  type PlanConfig,
} from '@/lib/billing/plans'
import { PLAN_META, type PlanId } from '@/lib/plans/config'
import { CHECK, CROSS, nBR } from './AlthosHomeShared'

/**
 * Lista de funcionalidades por plano pago — espelha
 * components/site/PricingPlans.tsx / docs/PRICING_ARCHITECTURE.md § 2: CRM/
 * WhatsApp/Instagram/IA básica em todos os planos; Automações/Agentes de
 * IA/Financeiro/Produtos/API/MCP a partir do Pro; Voice AI/SMS/múltiplas
 * unidades só no Business.
 */
function planFeats(plan: PlanConfig): [string, boolean][] {
  const id = plan.key as PlanId
  const meta = PLAN_META[id] ?? PLAN_META.starter
  const isPro = id === 'pro' || id === 'business'
  const isBusiness = id === 'business'
  return [
    [`${meta.includedUsers} usuário${meta.includedUsers > 1 ? 's' : ''} incluído${meta.includedUsers > 1 ? 's' : ''}`, true],
    [`${nBR(meta.aiCreditsMonthly)} Althos Credits/mês`, true],
    ['CRM, Pipeline e Contatos', true],
    ['WhatsApp e Instagram', true],
    ['Atendente de IA 24h + score', true],
    ['Meta Ads (Pixel + CAPI)', true],
    ['Automações', isPro],
    ['Agentes de IA', isPro],
    ['Financeiro e Produtos', isPro],
    ['Insights de vendas com IA', isPro],
    ['Integrações, API e MCP', isPro],
    ['Voice AI e SMS', isBusiness],
    ['Múltiplas empresas/unidades', isBusiness],
    ['Permissões e auditoria avançadas', isBusiness],
  ]
}

const FREE_FEATS: [string, boolean][] = [
  ['Acesso completo desde o primeiro dia', true],
  ['Cancele quando quiser', true],
  ['Reembolso de 100% em até 14 dias', true],
  ['Sem burocracia', true],
]

/* ----------------------------- Pricing ----------------------------- */
export function Pricing() {
  const [cycle, setCycle] = useState<BillingCycle>('annual')
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <section className="pricing" aria-label="Planos e preços">
      <div className="pricing-head">
        <div className="eyebrow reveal" data-d="0"><span className="star">✦</span> Planos</div>
        <h2 className="reveal" data-d="1">Preço que cabe em qualquer fase</h2>
        <div className="billing-toggle reveal" data-d="2" role="group" aria-label="Ciclo de cobrança">
          <button className={cycle === 'monthly' ? 'active' : ''} aria-pressed={cycle === 'monthly'} onClick={() => setCycle('monthly')}>Mensal</button>
          <button className={cycle === 'semestral' ? 'active' : ''} aria-pressed={cycle === 'semestral'} onClick={() => setCycle('semestral')}>Semestral</button>
          <button className={cycle === 'annual' ? 'active' : ''} aria-pressed={cycle === 'annual'} onClick={() => setCycle('annual')}>Anual</button>
        </div>
        <p className="save-pill reveal" data-d="3">
          {cycle === 'monthly'
            ? `Economize até ${ANNUAL_DISCOUNT_PCT}% nos planos anuais`
            : cycle === 'annual'
              ? `Economize ${ANNUAL_DISCOUNT_PCT}% no plano anual`
              : `Economize ${SEMESTRAL_DISCOUNT_PCT}% no plano semestral`}
        </p>
      </div>

      <div className="plans">
        {/* Garantia de 14 dias — não entra no checkout, é a política de reembolso */}
        <article className="plan reveal">
          <h3>Garantia de 14 dias</h3>
          <p className="ptag">Teste sem risco</p>
          <div className="price">
            <span className="val">14 dias</span>
          </div>
          <p className="annual-note">Reembolso garantido</p>
          <p className="pdesc">Assine qualquer plano e use por 14 dias. Não gostou? Cancele nesse período e devolvemos 100% do valor pago.</p>
          <a href="/signup" className="btn btn-outline">Começar agora</a>
          <ul>
            {FREE_FEATS.map(([label, on], i) => (
              <li className={on ? '' : 'off'} key={i}>{on ? CHECK : CROSS} {label}</li>
            ))}
          </ul>
        </article>

        {PUBLIC_PLANS.map(plan => {
          const pricing = getPlanPricing(plan, cycle)
          const popular = plan.key === 'pro'
          return (
            <article className={`plan reveal${popular ? ' popular spot' : ''}`} key={plan.key}>
              {popular && <span className="plan-badge">★ Mais popular</span>}
              <h3>{plan.label}</h3>
              <p className="ptag">{plan.tagline}</p>
              <div className="price">
                <span className="cur">R$</span>
                <span className="val">{fmt(pricing.perMonthCents)}</span>
                <span className="per">/mês</span>
              </div>
              <p className="annual-note">
                {cycle === 'monthly'
                  ? 'cobrado mensalmente'
                  : cycle === 'annual'
                    ? `${pricing.totalLabel} por ano · economize ${pricing.savedLabel}`
                    : `${pricing.totalLabel} a cada 6 meses · economize ${pricing.savedLabel}`}
              </p>
              <p className="pdesc">{plan.description}</p>
              <a href="/signup" className={`btn ${popular ? 'btn-solid' : 'btn-outline'}`}>Começar grátis</a>
              <ul>
                {planFeats(plan).map(([label, on], i) => (
                  <li className={on ? '' : 'off'} key={i}>{on ? CHECK : CROSS} {label}</li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>

      <p className="price-note reveal" data-d="0">
        A assinatura é cobrada no ato (Pix ou cartão). Cancelou em até <b>14 dias</b>? Devolvemos 100% do valor pago.
        No semestral e no anual, pague à vista no Pix ou parcele no cartão de crédito.
        <b> Sem fidelidade</b> — cancele quando quiser.
      </p>

      <div className="seals reveal" data-d="0">
        <span className="seal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 6L9 17l-5-5" /></svg> Cancelamento fácil</span>
        <span className="seal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg> Sem fidelidade</span>
        <span className="seal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg> Ambiente seguro</span>
        <span className="seal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg> Suporte humanizado</span>
      </div>
    </section>
  )
}
