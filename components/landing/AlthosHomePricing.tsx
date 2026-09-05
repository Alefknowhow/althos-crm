import { useState } from 'react'
import {
  PUBLIC_PLANS,
  getPlanPricing,
  ANNUAL_DISCOUNT_PCT,
  SEMESTRAL_DISCOUNT_PCT,
  type BillingCycle,
  type PlanConfig,
} from '@/lib/billing/plans'
import { PLAN_LIMITS, PLAN_META, type PlanId } from '@/lib/plans/config'
import { CHECK, CROSS, nBR } from './AlthosHomeShared'

/**
 * Lista de funcionalidades por plano pago — espelha exatamente
 * components/site/PricingPlans.tsx (fonte: lib/plans/config). Starter/Pro/
 * Business têm as MESMAS funcionalidades; muda a QUANTIDADE de uso e dois
 * recursos premium (Insights IA + Exportar relatórios) ficam em Pro/Business.
 */
function planFeats(plan: PlanConfig): [string, boolean][] {
  const id = plan.key as PlanId
  const lim = PLAN_LIMITS[id] ?? PLAN_LIMITS.starter
  const meta = PLAN_META[id] ?? PLAN_META.starter
  const isPro = id === 'pro' || id === 'business'
  return [
    [lim.users === -1 ? 'Usuários ilimitados' : `${lim.users} usuário${lim.users > 1 ? 's' : ''}`, true],
    [lim.orgs === -1 ? 'Empresas ilimitadas' : `${lim.orgs} empresa${lim.orgs > 1 ? 's' : ''}`, true],
    ['Leads ilimitados', true],
    [lim.customers === -1 ? 'Clientes ilimitados' : `${nBR(lim.customers)} clientes`, true],
    [`${nBR(meta.aiCreditsMonthly)} créditos de IA/mês`, true],
    [lim.automations === -1 ? 'Automações ilimitadas' : `${lim.automations} automações`, true],
    ['Meta Ads (Pixel + CAPI)', true],
    ['WhatsApp e Instagram', isPro],
    ['Atendente de IA 24h + score', true],
    ['Agendamentos online', true],
    ['Insights de vendas com IA', isPro],
    ['Exportar relatórios', isPro],
  ]
}

const FREE_FEATS: [string, boolean][] = [
  ['Todos os recursos do Pro', true],
  ['Módulo do seu nicho incluso', true],
  ['WhatsApp, Instagram e Meta Ads', true],
  ['Atendente de IA 24h + score', true],
  ['Automações e agendamentos', true],
  ['Sem necessidade de cartão', true],
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
        {/* Trial — não entra no checkout, é o teste completo de 15 dias */}
        <article className="plan reveal">
          <h3>Teste grátis</h3>
          <p className="ptag">Experimente o app completo</p>
          <div className="price">
            <span className="val">15 dias</span>
          </div>
          <p className="annual-note">Sem cartão de crédito</p>
          <p className="pdesc">Acesso completo ao plano Pro por 15 dias — incluindo o módulo do seu nicho, sem limitação.</p>
          <a href="/signup" className="btn btn-outline">Começar teste grátis</a>
          <ul>
            {FREE_FEATS.map(([label, on], i) => (
              <li className={on ? '' : 'off'} key={i}>{on ? CHECK : CROSS} {label}</li>
            ))}
          </ul>
        </article>

        {PUBLIC_PLANS.map(plan => {
          const pricing = getPlanPricing(plan, cycle)
          const popular = plan.key === 'pro'
          const isBusiness = plan.key === 'business'
          return (
            <article className={`plan reveal${popular ? ' popular spot' : ''}`} key={plan.key}>
              {popular && <span className="plan-badge">★ Mais popular</span>}
              <h3>{plan.label}</h3>
              <p className="ptag">{plan.tagline}</p>
              {isBusiness ? (
                <>
                  <div className="price">
                    <span className="val" style={{ fontSize: '28px' }}>Sob consulta</span>
                  </div>
                  <p className="annual-note">Plano sob medida pro seu volume de operação</p>
                </>
              ) : (
                <>
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
                </>
              )}
              <p className="pdesc">{plan.description}</p>
              {isBusiness ? (
                <a href="/fale-com-vendas" className="btn btn-outline">Falar com vendas</a>
              ) : (
                <a href="/signup" className={`btn ${popular ? 'btn-solid' : 'btn-outline'}`}>Começar grátis</a>
              )}
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
        Teste <b>15 dias grátis</b>, sem cartão — esse já é o seu período de satisfação garantida. Depois do
        teste, você assina com uma forma de pagamento (Pix ou cartão) e a cobrança vale pra valer, sem reembolso.
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
