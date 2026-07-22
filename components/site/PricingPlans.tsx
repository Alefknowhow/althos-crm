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
        <div className="inline-flex items-center rounded-full border border-[#383838] bg-[#333333] p-1">
          {(['monthly', 'semestral', 'annual'] as BillingCycle[]).map(c => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={`relative rounded-full px-5 py-2 text-[13px] font-semibold transition-colors ${
                cycle === c ? 'text-white' : 'text-[#8d8d8d] hover:text-[#e8e8e8]'
              }`}
            >
              {cycle === c && (
                <motion.span
                  layoutId="cycle-pill"
                  className="absolute inset-0 rounded-full bg-blue-600 shadow-blue-600/30"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">{c === 'monthly' ? 'Mensal' : c === 'semestral' ? 'Semestral' : 'Anual'}</span>
            </button>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800/50 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400">
          {cycle === 'monthly'
            ? `Economize até ${ANNUAL_DISCOUNT_PCT}% nos planos anuais`
            : `Economize ${cycle === 'annual' ? ANNUAL_DISCOUNT_PCT : SEMESTRAL_DISCOUNT_PCT}% no plano ${cycle === 'annual' ? 'anual' : 'semestral'}`}
        </span>
      </div>

      {/* Cards */}
      <div className="mt-8 grid gap-4 sm:mt-12 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Trial card (não entra no checkout — é o teste completo de 15 dias) */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex flex-col rounded-none border border-[#383838] bg-[#262626] p-5 sm:p-7"
        >
          <h3 className="text-lg font-bold text-[#f4f4f4]">Teste grátis</h3>
          <p className="mt-1 text-[13px] text-[#8d8d8d]">Experimente o app completo</p>

          <div className="mt-5">
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold tracking-tight text-[#f4f4f4]">15 dias</span>
            </div>
            <p className="mt-1.5 text-[12px] text-[#8d8d8d]">Sem cartão de crédito</p>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-[#a8a8a8]">
            Acesso completo ao plano Pro por 15 dias — pipeline, WhatsApp com Agente de IA, automações e o módulo do seu nicho, sem limitação.
          </p>

          <Link
            href="/signup"
            className="mt-6 rounded-none border border-[#525252] px-5 py-3 text-center text-[14px] font-semibold text-[#d4d4d4] transition-all hover:bg-[#1f1f1f]"
          >
            Começar teste grátis
          </Link>

          <ul className="mt-5 space-y-2 border-t border-[#383838] pt-5 sm:mt-6 sm:space-y-2.5 sm:pt-6">
            {[
              { label: 'Todos os recursos do Pro', on: true },
              { label: 'Módulo do seu nicho incluso', on: true },
              { label: 'WhatsApp, Instagram e Meta Ads', on: true },
              { label: 'Atendente de IA 24h + score', on: true },
              { label: 'Automações e agendamentos', on: true },
              { label: 'Sem necessidade de cartão', on: true },
            ].map(f => (
              <li key={f.label} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span className="text-[13px] text-[#d4d4d4]">{f.label}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {PUBLIC_PLANS.map((plan, i) => {
          const pricing    = getPlanPricing(plan, cycle)
          const highlight  = plan.key === 'pro'
          const isBusiness = plan.key === 'business'
          const features   = planFeatures(plan)

          return (
            <motion.div
              key={plan.key}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={`relative flex flex-col rounded-none border p-5 sm:p-7 ${
                highlight
                  ? 'border-blue-500/50 bg-gradient-to-b from-[#0f62fe]/10 to-[#262626] shadow-blue-600/10'
                  : 'border-[#383838] bg-[#262626]  '
              }`}
            >
              {highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-semibold text-white shadow-blue-600/30">
                  Mais popular
                </span>
              )}

              <h3 className="text-lg font-bold text-[#f4f4f4]">{plan.label}</h3>
              <p className="mt-1 text-[13px] text-[#8d8d8d]">{plan.tagline}</p>

              {/* Preço — Business não expõe preço público, é sob consulta */}
              {isBusiness ? (
                <div className="mt-5">
                  <div className="text-2xl font-bold tracking-tight text-[#f4f4f4]">Sob consulta</div>
                  <p className="mt-1.5 text-[12px] text-[#8d8d8d]">Plano sob medida pro seu volume de operação</p>
                </div>
              ) : (
                <div className="mt-5">
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold tracking-tight text-[#f4f4f4]">{pricing.perMonthLabel}</span>
                    <span className="mb-1 text-[13px] text-[#8d8d8d]">/mês</span>
                  </div>
                  {cycle === 'annual' ? (
                    <p className="mt-1.5 text-[12px] text-[#8d8d8d]">
                      {pricing.totalLabel} cobrados uma vez por ano
                      <span className="ml-1 text-emerald-600">· economize {pricing.savedLabel}</span>
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[12px] text-[#8d8d8d]">cobrado mensalmente</p>
                  )}
                </div>
              )}

              <p className="mt-4 text-[13px] leading-relaxed text-[#a8a8a8]">{plan.description}</p>

              {isBusiness ? (
                <a
                  href="mailto:suporte@althoscrm.com.br?subject=Quero%20agendar%20uma%20reuni%C3%A3o%20-%20Plano%20Business"
                  className="mt-6 rounded-none border border-[#525252] px-5 py-3 text-center text-[14px] font-semibold text-[#d4d4d4] transition-all hover:bg-[#1f1f1f]"
                >
                  Agende uma reunião
                </a>
              ) : (
                <Link
                  href="/signup"
                  className={`mt-6 rounded-none px-5 py-3 text-center text-[14px] font-semibold transition-all ${
                    highlight
                      ? 'bg-blue-600 text-white   shadow-blue-600/30 hover:bg-blue-500 hover:-translate-y-0.5'
                      : 'border border-[#525252] text-[#d4d4d4] hover:bg-[#1f1f1f]'
                  }`}
                >
                  Começar grátis
                </Link>
              )}

              {/* Features */}
              <ul className="mt-5 space-y-2 border-t border-[#383838] pt-5 sm:mt-6 sm:space-y-2.5 sm:pt-6">
                {features.map(f => (
                  <li key={f.label} className="flex items-start gap-2.5">
                    {f.on ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-[#525252]" />
                    )}
                    <span className={`text-[13px] ${f.on ? 'text-[#d4d4d4]' : 'text-[#707070] line-through'}`}>
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
      <p className="mt-8 text-center text-[13px] text-[#8d8d8d] sm:mt-10">
        Teste <strong className="text-[#d4d4d4]">15 dias grátis</strong>, sem cartão. Depois, você assina com uma forma de pagamento (Pix ou cartão) — se não ficar satisfeito nos primeiros 7 dias de assinatura,{' '}
        <strong className="text-[#d4d4d4]">reembolso total</strong>.
        No semestral e no anual, pague à vista no <strong className="text-[#d4d4d4]">Pix</strong> ou parcele no{' '}
        <strong className="text-[#d4d4d4]">cartão de crédito</strong>. Sem fidelidade — cancele quando quiser.
      </p>
    </div>
  )
}
