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
import { PLAN_META, type PlanId } from '@/lib/plans/config'

/**
 * Linhas de comparação por plano — segue a estrutura de benefícios definida
 * em docs/PRICING_ARCHITECTURE.md § 2: CRM/WhatsApp/Instagram/IA básica em
 * todos os planos; Automações/Agentes de IA/Financeiro/Produtos/API/MCP a
 * partir do Pro; Voice AI/SMS/múltiplas unidades só no Business.
 */
function planFeatures(p: PlanConfig): { label: string; on: boolean }[] {
  const id    = p.key as PlanId
  const meta  = PLAN_META[id] ?? PLAN_META.starter
  const isPro = id === 'pro' || id === 'business'
  const isBusiness = id === 'business'
  const n = (v: number) => v.toLocaleString('pt-BR')
  return [
    { label: `${meta.includedUsers} usuário${meta.includedUsers > 1 ? 's' : ''} incluído${meta.includedUsers > 1 ? 's' : ''}`, on: true },
    { label: `${n(meta.aiCreditsMonthly)} Althos Credits/mês`, on: true },
    { label: 'CRM, Pipeline e Contatos', on: true },
    { label: 'WhatsApp e Instagram', on: true },
    { label: 'Atendente de IA 24h + score', on: true },
    { label: 'Meta Ads (Pixel + CAPI)', on: true },
    { label: 'Automações', on: isPro },
    { label: 'Agentes de IA', on: isPro },
    { label: 'Financeiro e Produtos', on: isPro },
    { label: 'Insights de vendas com IA', on: isPro },
    { label: 'Integrações, API e MCP', on: isPro },
    { label: 'Voice AI e SMS', on: isBusiness },
    { label: 'Múltiplas empresas/unidades', on: isBusiness },
    { label: 'Permissões e auditoria avançadas', on: isBusiness },
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
        {/* Garantia de 14 dias (não entra no checkout — é a política de reembolso) */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex flex-col rounded-none border border-[#383838] bg-[#262626] p-5 sm:p-7"
        >
          <h3 className="text-lg font-bold text-[#f4f4f4]">Garantia de 14 dias</h3>
          <p className="mt-1 text-[13px] text-[#8d8d8d]">Teste sem risco</p>

          <div className="mt-5">
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold tracking-tight text-[#f4f4f4]">14 dias</span>
            </div>
            <p className="mt-1.5 text-[12px] text-[#8d8d8d]">Reembolso garantido</p>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-[#a8a8a8]">
            Assine qualquer plano e use por 14 dias. Não gostou? Cancele nesse período e devolvemos 100% do valor pago — sem perguntas.
          </p>

          <Link
            href="/signup"
            className="mt-6 rounded-none border border-[#525252] px-5 py-3 text-center text-[14px] font-semibold text-[#d4d4d4] transition-all hover:bg-[#1f1f1f]"
          >
            Começar agora
          </Link>

          <ul className="mt-5 space-y-2 border-t border-[#383838] pt-5 sm:mt-6 sm:space-y-2.5 sm:pt-6">
            {[
              { label: 'Acesso completo desde o primeiro dia', on: true },
              { label: 'Cancele quando quiser', on: true },
              { label: 'Reembolso de 100% em até 14 dias', on: true },
              { label: 'Sem burocracia', on: true },
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

              <p className="mt-4 text-[13px] leading-relaxed text-[#a8a8a8]">{plan.description}</p>

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
        A assinatura é cobrada no ato (Pix ou cartão). Cancelou em até <strong className="text-[#d4d4d4]">14 dias</strong>?
        Devolvemos 100% do valor pago. No semestral e no anual, pague à vista no{' '}
        <strong className="text-[#d4d4d4]">Pix</strong> ou parcele no <strong className="text-[#d4d4d4]">cartão de crédito</strong>.
        Sem fidelidade — cancele quando quiser.
      </p>
    </div>
  )
}
