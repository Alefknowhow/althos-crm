'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import {
  PUBLIC_PLANS,
  getPlanPricing,
  ANNUAL_DISCOUNT_PCT,
  SEMESTRAL_DISCOUNT_PCT,
  type BillingCycle,
  type PlanConfig,
} from '@/lib/billing/plans'
import { PLAN_LIMITS, PLAN_META, type PlanId } from '@/lib/plans/config'

/**
 * Linhas de comparação por plano. Starter/Pro/Business têm as MESMAS
 * funcionalidades — o que muda é a QUANTIDADE de uso (usuários, empresas,
 * clientes, créditos de IA, automações). Dois recursos premium (Insights IA e
 * Exportar relatórios) ficam reservados a Pro/Business.
 */
function planFeatures(p: PlanConfig): { label: string; on: boolean }[] {
  const id   = p.key as PlanId
  const lim  = PLAN_LIMITS[id] ?? PLAN_LIMITS.starter
  const meta = PLAN_META[id] ?? PLAN_META.starter
  const isPro = id === 'pro' || id === 'business'
  const n = (v: number) => v.toLocaleString('pt-BR')
  return [
    { label: lim.users === -1 ? 'Usuários ilimitados' : `${lim.users} usuário${lim.users > 1 ? 's' : ''}`, on: true },
    { label: lim.orgs === -1 ? 'Empresas ilimitadas' : `${lim.orgs} empresa${lim.orgs > 1 ? 's' : ''}`, on: true },
    { label: 'Leads ilimitados', on: true },
    { label: lim.customers === -1 ? 'Clientes ilimitados' : `${n(lim.customers)} clientes`, on: true },
    { label: `${n(meta.aiCreditsMonthly)} créditos de IA/mês`, on: true },
    { label: lim.automations === -1 ? 'Automações ilimitadas' : `${lim.automations} automações`, on: true },
    { label: 'WhatsApp, Instagram e Meta Ads', on: true },
    { label: 'Atendente de IA 24h + score', on: true },
    { label: 'Agendamentos online', on: true },
    { label: 'Insights de vendas com IA', on: isPro },
    { label: 'Exportar relatórios', on: isPro },
  ]
}

export function PricingPlans() {
  const [cycle, setCycle] = useState<BillingCycle>('annual')

  return (
    <div>
      {/* Toggle mensal / semestral / anual */}
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] p-1">
          {(['monthly', 'semestral', 'annual'] as BillingCycle[]).map(c => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={`relative rounded-full px-5 py-2 text-[13px] font-semibold transition-colors ${
                cycle === c ? 'text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {cycle === c && (
                <motion.span
                  layoutId="cycle-pill"
                  className="absolute inset-0 rounded-full bg-blue-600 shadow-lg shadow-blue-600/30"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">{c === 'monthly' ? 'Mensal' : c === 'semestral' ? 'Semestral' : 'Anual'}</span>
            </button>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
          {cycle === 'monthly'
            ? `Economize até ${ANNUAL_DISCOUNT_PCT}% nos planos anuais`
            : `Economize ${cycle === 'annual' ? ANNUAL_DISCOUNT_PCT : SEMESTRAL_DISCOUNT_PCT}% no plano ${cycle === 'annual' ? 'anual' : 'semestral'}`}
        </span>
      </div>

      {/* Cards */}
      <div className="mt-8 grid gap-4 sm:mt-12 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Free card (não entra no checkout — é o ponto de partida grátis) */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-7"
        >
          <h3 className="text-lg font-bold text-white">Free</h3>
          <p className="mt-1 text-[13px] text-white/50">Para dar o primeiro passo</p>

          <div className="mt-5">
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold tracking-tight text-white">R$ 0</span>
              <span className="mb-1 text-[13px] text-white/45">/mês</span>
            </div>
            <p className="mt-1.5 text-[12px] text-white/45">Gratuito para sempre · sem cartão</p>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-white/55">
            Organize seus leads e o pipeline e comece a vender com método — sem pagar nada.
          </p>

          <Link
            href="/signup"
            className="mt-6 rounded-xl border border-white/15 px-5 py-3 text-center text-[14px] font-semibold text-white transition-all hover:bg-white/5"
          >
            Começar grátis
          </Link>

          <ul className="mt-5 space-y-2 border-t border-white/8 pt-5 sm:mt-6 sm:space-y-2.5 sm:pt-6">
            {[
              { label: 'Até 100 leads', on: true },
              { label: 'Pipeline e oportunidades', on: true },
              { label: '1 formulário de captação', on: true },
              { label: 'WhatsApp e Instagram', on: false },
              { label: 'Atendente de IA 24h', on: false },
              { label: 'Automações de tarefas', on: false },
            ].map(f => (
              <li key={f.label} className="flex items-start gap-2.5">
                {f.on ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-white/20" />
                )}
                <span className={`text-[13px] ${f.on ? 'text-white/75' : 'text-white/30 line-through'}`}>
                  {f.label}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>

        {PUBLIC_PLANS.map((plan, i) => {
          const pricing   = getPlanPricing(plan, cycle)
          const highlight = plan.key === 'pro'
          const features  = planFeatures(plan)

          return (
            <motion.div
              key={plan.key}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={`relative flex flex-col rounded-2xl border p-5 sm:p-7 ${
                highlight
                  ? 'border-blue-500/40 bg-gradient-to-b from-blue-500/[0.08] to-white/[0.02] shadow-2xl shadow-blue-600/10'
                  : 'border-white/10 bg-white/[0.02]'
              }`}
            >
              {highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-semibold text-white shadow-lg shadow-blue-600/30">
                  Mais popular
                </span>
              )}

              <h3 className="text-lg font-bold text-white">{plan.label}</h3>
              <p className="mt-1 text-[13px] text-white/50">{plan.tagline}</p>

              {/* Preço */}
              <div className="mt-5">
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold tracking-tight text-white">{pricing.perMonthLabel}</span>
                  <span className="mb-1 text-[13px] text-white/45">/mês</span>
                </div>
                {cycle === 'annual' ? (
                  <p className="mt-1.5 text-[12px] text-white/45">
                    {pricing.totalLabel} cobrados uma vez por ano
                    <span className="ml-1 text-emerald-400">· economize {pricing.savedLabel}</span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-[12px] text-white/45">cobrado mensalmente</p>
                )}
              </div>

              <p className="mt-4 text-[13px] leading-relaxed text-white/55">{plan.description}</p>

              <Link
                href="/signup"
                className={`mt-6 rounded-xl px-5 py-3 text-center text-[14px] font-semibold transition-all ${
                  highlight
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 hover:-translate-y-0.5'
                    : 'border border-white/15 text-white hover:bg-white/5'
                }`}
              >
                Começar grátis
              </Link>

              {/* Features */}
              <ul className="mt-5 space-y-2 border-t border-white/8 pt-5 sm:mt-6 sm:space-y-2.5 sm:pt-6">
                {features.map(f => (
                  <li key={f.label} className="flex items-start gap-2.5">
                    {f.on ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-white/20" />
                    )}
                    <span className={`text-[13px] ${f.on ? 'text-white/75' : 'text-white/30 line-through'}`}>
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )
        })}
      </div>

      {/* Nota de pagamento */}
      <p className="mt-8 text-center text-[13px] text-white/45 sm:mt-10">
        Comece no <strong className="text-white/70">Free</strong>, sem cartão. Nos planos pagos, os{' '}
        <strong className="text-white/70">7 dias de teste grátis</strong> pedem uma forma de pagamento (Pix ou cartão) para iniciar.
        No semestral e no anual, pague à vista no <strong className="text-white/70">Pix</strong> ou parcele no{' '}
        <strong className="text-white/70">cartão de crédito</strong>. Sem fidelidade — cancele quando quiser.
      </p>
    </div>
  )
}
