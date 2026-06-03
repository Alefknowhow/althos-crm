import Link from 'next/link'
import type { Metadata } from 'next'
import { CheckCircle2, Minus, X } from 'lucide-react'

// ── SEO Metadata ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Planos e Preços · Althos CRM — CRM com IA, WhatsApp e Automações',
  description:
    'Transforme mais leads em clientes com IA, automações e dados inteligentes. Comece de graça no plano Free ou teste qualquer plano pago por 7 dias. Planos a partir de R$197/mês. CRM completo com WhatsApp, Meta Ads, Instagram e IA 24/7.',
  keywords: [
    'CRM com IA',
    'CRM para WhatsApp',
    'automação de vendas',
    'CRM para pequenas empresas',
    'CRM brasileiro',
    'Althos CRM preços',
    'CRM com automação',
    'follow-up automático',
    'gestão de leads',
    'CRM para agências',
    'integração Meta Ads',
  ],
  openGraph: {
    title: 'Planos e Preços · Althos CRM',
    description:
      'CRM completo com IA, WhatsApp, automações e Meta Ads. Comece de graça no plano Free, sem cartão.',
    type: 'website',
    url: 'https://althos.io/pricing',
    siteName: 'Althos CRM',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Althos CRM — Venda mais com IA e automações',
    description:
      'Central de crescimento com CRM, WhatsApp, IA e Meta Ads em uma única plataforma. Comece de graça.',
  },
  alternates: {
    canonical: 'https://althos.io/pricing',
  },
}

// ── Types ─────────────────────────────────────────────────────────────────────

type FeatureValue = true | false | string

interface Feature {
  label:    string
  starter:  FeatureValue
  pro:      FeatureValue
  business: FeatureValue
  group?:   string
}

// ── Feature matrix ────────────────────────────────────────────────────────────

const FEATURES: Feature[] = [
  // CRM & Vendas
  { group: 'Gestão de Clientes & Vendas', label: 'Leads e clientes ilimitados',         starter: true,        pro: true,       business:true       },
  { label: 'Visualização de oportunidades',                                               starter: true,        pro: true,       business:true       },
  { label: 'Registro e histórico de vendas',                                              starter: true,        pro: true,       business:true       },
  { label: 'Tarefas e atividades',                                                        starter: true,        pro: true,       business:true       },
  { label: 'Agendamentos online',                                                         starter: true,        pro: true,       business:true       },
  { label: 'Catálogo de produtos e serviços',                                             starter: false,       pro: true,       business:true       },
  // Captação
  { group: 'Captação de Leads',            label: 'Formulários inteligentes',            starter: true,        pro: true,       business:true       },
  { label: 'Páginas de captura',                                                          starter: true,        pro: true,       business:true       },
  // Comunicação
  { group: 'Comunicação',                  label: 'WhatsApp Business centralizado',      starter: true,        pro: true,       business:true       },
  { label: 'E-mail marketing',                                                            starter: false,       pro: true,       business:true       },
  { label: 'Automação Instagram (DMs + comentários)',                                     starter: false,       pro: true,       business:true       },
  // IA
  { group: 'Inteligência Artificial',      label: 'Atendimento com IA 24/7',             starter: false,       pro: true,       business:true       },
  { label: 'Score e qualificação de leads por IA',                                        starter: false,       pro: true,       business:true       },
  { label: 'Insights de vendas por IA',                                                   starter: false,       pro: true,       business:true       },
  { label: 'Previsões comerciais com IA',                                                 starter: false,       pro: false,      business:true       },
  { label: 'Análises avançadas com IA',                                                   starter: false,       pro: false,      business:true       },
  // Automações
  { group: 'Automações',                   label: 'Follow-up automático',                starter: false,       pro: true,       business:true       },
  { label: 'Fluxos de automação ilimitados',                                              starter: false,       pro: true,       business:true       },
  { label: 'Fluxos avançados e condicionais',                                             starter: false,       pro: false,      business:true       },
  // Marketing & Ads
  { group: 'Marketing & Ads',              label: 'Integração Meta Ads',                 starter: false,       pro: true,       business:true       },
  { label: 'Integração Google Ads',                                                       starter: false,       pro: true,       business:true       },
  { label: 'Pixel e CAPI para otimização',                                                starter: false,       pro: true,       business:true       },
  { label: 'Relatórios e métricas de ROI',                                                starter: false,       pro: true,       business:true       },
  // Analytics
  { group: 'Dados & Relatórios',           label: 'Visão de métricas do negócio',        starter: true,        pro: true,       business:true       },
  { label: 'Painéis personalizados',                                                      starter: false,       pro: false,      business:true       },
  { label: 'Relatórios comparativos',                                                     starter: false,       pro: false,      business:true       },
  { label: 'Exportação avançada',                                                         starter: false,       pro: false,      business:true       },
  // Equipe
  { group: 'Equipe & Acessos',             label: 'Usuários incluídos',                  starter: '1 usuário', pro: 'Até 5',    business: 'Ilimitado' },
  { label: 'Permissões por papel',                                                        starter: false,       pro: true,       business:true       },
  { label: 'Times e departamentos',                                                       starter: false,       pro: false,      business:true       },
  { label: 'Permissões granulares',                                                       starter: false,       pro: false,      business:true       },
  // Integrações
  { group: 'Integrações & API',            label: 'Webhooks',                            starter: false,       pro: false,      business:true       },
  { label: 'API aberta',                                                                  starter: false,       pro: false,      business:true       },
  { label: 'Integrações customizadas',                                                    starter: false,       pro: false,      business:true       },
  // Suporte
  { group: 'Suporte',                      label: 'Suporte por e-mail',                  starter: true,        pro: true,       business:true       },
  { label: 'Suporte prioritário',                                                         starter: false,       pro: true,       business:true       },
  { label: 'Onboarding personalizado',                                                    starter: false,       pro: false,      business:true       },
  { label: 'Gerente de conta dedicado',                                                   starter: false,       pro: false,      business:true       },
  { label: 'Suporte VIP',                                                                 starter: false,       pro: false,      business:true       },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function Check() {
  return <CheckCircle2 className="mx-auto w-4 h-4 text-blue-400" />
}
function Dash() {
  return <Minus className="mx-auto w-4 h-4 text-white/15" />
}
function Cross() {
  return <X className="mx-auto w-4 h-4 text-white/15" />
}

function FeatCell({ value }: { value: FeatureValue }) {
  if (value === true)  return <Check />
  if (value === false) return <Dash />
  return <span className="text-xs font-medium text-white/80">{value}</span>
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-white/8 py-5">
      <summary className="flex cursor-pointer items-center justify-between gap-4 text-[15px] sm:text-[17px] font-medium text-white list-none">
        {q}
        <svg
          className="w-5 h-5 shrink-0 text-white/40 transition-transform group-open:rotate-45"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </summary>
      <p className="mt-3 text-[14px] sm:text-[15px] text-white/50 leading-relaxed pr-8">{a}</p>
    </details>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <div
      className="min-h-screen antialiased"
      style={{
        background: '#0F172A',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", sans-serif',
        color: '#FFFFFF',
      }}
    >

      {/* ── Structured data / JSON-LD ─────────────────────────────────────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Althos CRM',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: [
              { '@type': 'Offer', name: 'Free',     price: '0.00',   priceCurrency: 'BRL', priceSpecification: { '@type': 'RecurringCharge', billingIncrement: 1, unitCode: 'MON' } },
              { '@type': 'Offer', name: 'Starter',  price: '197.00', priceCurrency: 'BRL', priceSpecification: { '@type': 'RecurringCharge', billingIncrement: 1, unitCode: 'MON' } },
              { '@type': 'Offer', name: 'Pro',      price: '297.00', priceCurrency: 'BRL', priceSpecification: { '@type': 'RecurringCharge', billingIncrement: 1, unitCode: 'MON' } },
              { '@type': 'Offer', name: 'Business', price: '397.00', priceCurrency: 'BRL', priceSpecification: { '@type': 'RecurringCharge', billingIncrement: 1, unitCode: 'MON' } },
            ],
          }),
        }}
      />

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/6" style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-base font-semibold tracking-tight text-white">
            Althos CRM
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-white/50 hover:text-white transition-colors hidden sm:block">
              Entrar
            </Link>
            <Link
              href="/signup"
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: '#2563EB' }}
            >
              Teste grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pb-16 pt-20 sm:pb-24 sm:pt-28 text-center">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center overflow-hidden">
          <div className="h-[500px] w-[900px] rounded-full opacity-30" style={{ background: 'radial-gradient(ellipse, #2563EB 0%, #7C3AED 40%, transparent 70%)', filter: 'blur(80px)', marginTop: '-100px' }} />
        </div>

        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium mb-6"
            style={{ borderColor: 'rgba(37,99,235,0.4)', background: 'rgba(37,99,235,0.1)', color: '#93C5FD' }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Plano Free grátis para sempre · sem cartão
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-5">
            Escolha o plano ideal para{' '}
            <span style={{ backgroundImage: 'linear-gradient(135deg, #3B82F6, #7C3AED, #3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              vender mais
            </span>{' '}
            e escalar seu negócio.
          </h1>

          <p className="text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto" style={{ color: '#94A3B8' }}>
            Central de crescimento com IA, automações e dados inteligentes —<br className="hidden sm:block" />
            tudo em uma única plataforma.
          </p>
        </div>
      </section>

      {/* ── Plan cards ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-20">

        {/* Desktop: 3 col grid */}
        <div className="hidden md:grid grid-cols-3 gap-5 max-w-5xl mx-auto">

          {/* Starter */}
          <div
            className="rounded-2xl p-7 flex flex-col gap-5 border transition-transform duration-200 hover:-translate-y-1"
            style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <div>
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest mb-3"
                style={{ background: 'rgba(255,255,255,0.07)', color: '#94A3B8' }}
              >
                Ideal para começar
              </span>
              <h2 className="text-xl font-bold text-white mb-1">Starter</h2>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-4xl font-bold tracking-tight text-white">R$ 197</span>
                <span className="mb-1 text-sm" style={{ color: '#94A3B8' }}>/mês</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>
                Para pequenos negócios que querem organizar e profissionalizar o atendimento.
              </p>
            </div>

            <ul className="flex flex-col gap-2.5 flex-1">
              {[
                'Leads e clientes ilimitados',
                'Visualize todas as oportunidades em tempo real',
                'Formulários inteligentes de captação',
                'Centralize conversas no WhatsApp',
                'Registre e acompanhe cada venda',
                'Tarefas e atividades da equipe',
                'Histórico completo do cliente',
                'Descubra quais ações geram mais vendas',
              ].map(f => (
                <li key={f} className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm" style={{ color: '#CBD5E1' }}>{f}</span>
                </li>
              ))}
              {[
                'Automações de follow-up',
                'IA para atendimento 24/7',
                'Multiusuário',
              ].map(f => (
                <li key={f} className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'rgba(255,255,255,0.12)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-sm line-through" style={{ color: 'rgba(255,255,255,0.18)' }}>{f}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-2">
              <Link
                href="/signup"
                className="block rounded-full py-3 text-center text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                Testar grátis por 7 dias
              </Link>
              <p className="text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>7 dias grátis · Pix ou cartão</p>
            </div>
          </div>

          {/* Pro — Highlighted */}
          <div
            className="relative rounded-2xl p-7 flex flex-col gap-5 transition-transform duration-200 hover:-translate-y-1"
            style={{
              background: 'linear-gradient(160deg, #1E3A5F 0%, #111827 60%)',
              border: '1px solid rgba(59,130,246,0.4)',
              boxShadow: '0 0 0 1px rgba(59,130,246,0.2), 0 20px 60px rgba(37,99,235,0.25)',
            }}
          >
            <span
              className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-5 py-1 text-[10px] font-bold text-white whitespace-nowrap tracking-widest uppercase"
              style={{ background: '#2563EB', boxShadow: '0 4px 20px rgba(37,99,235,0.5)' }}
            >
              MAIS ESCOLHIDO
            </span>

            <div>
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest mb-3"
                style={{ background: 'rgba(59,130,246,0.15)', color: '#93C5FD' }}
              >
                Para crescer
              </span>
              <h2 className="text-xl font-bold text-white mb-1">Pro</h2>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-4xl font-bold tracking-tight text-white">R$ 297</span>
                <span className="mb-1 text-sm" style={{ color: '#93C5FD' }}>/mês</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
                Para empresas que querem automatizar processos e aumentar as vendas.
              </p>
            </div>

            <ul className="flex flex-col gap-2.5 flex-1">
              {[
                'Tudo do plano Starter',
                'Atenda, qualifique e converta leads 24h com IA',
                'Automatize follow-ups e recupere oportunidades',
                'Score IA para priorizar os melhores leads',
                'Insights de vendas com inteligência artificial',
                'E-mail marketing incluído',
                'Automação Instagram (DMs e comentários)',
                'Meta Ads + Google Ads conectados',
                'Pixel e CAPI para otimizar campanhas',
                'Relatórios e métricas de ROI',
                'Catálogo de produtos e serviços',
                'Agendamentos online',
                'Até 5 usuários incluídos',
                'Suporte prioritário',
              ].map(f => (
                <li key={f} className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-white/85">{f}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-2">
              <Link
                href="/signup"
                className="block rounded-full py-3 text-center text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}
              >
                Testar grátis por 7 dias
              </Link>
              <p className="text-center text-[11px]" style={{ color: 'rgba(147,197,253,0.4)' }}>7 dias grátis · Pix ou cartão</p>
            </div>
          </div>

          {/* Business */}
          <div
            className="rounded-2xl p-7 flex flex-col gap-5 border transition-transform duration-200 hover:-translate-y-1"
            style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <div>
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest mb-3"
                style={{ background: 'rgba(124,58,237,0.15)', color: '#C4B5FD' }}
              >
                Para escalar sem limites
              </span>
              <h2 className="text-xl font-bold text-white mb-1">Business</h2>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-4xl font-bold tracking-tight text-white">R$ 397</span>
                <span className="mb-1 text-sm" style={{ color: '#94A3B8' }}>/mês</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>
                Para empresas que precisam de mais controle, dados e performance em escala.
              </p>
            </div>

            <ul className="flex flex-col gap-2.5 flex-1">
              {[
                'Tudo do plano Pro',
                'IA avançada para análises e previsões',
                'Fluxos avançados de automação',
                'Painéis personalizados de métricas',
                'Relatórios comparativos e exportação',
                'Usuários ilimitados',
                'Permissões avançadas e times',
                'Webhooks e API aberta',
                'Integrações customizadas',
                'Onboarding personalizado',
                'Gerente de conta dedicado',
                'Suporte VIP',
              ].map(f => (
                <li key={f} className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#A78BFA' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm" style={{ color: '#CBD5E1' }}>{f}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-2">
              <Link
                href="/signup"
                className="block rounded-full py-3 text-center text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}
              >
                Testar grátis por 7 dias
              </Link>
              <p className="text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>7 dias grátis · Pix ou cartão</p>
            </div>
          </div>
        </div>

        {/* Mobile: horizontal scroll */}
        <div className="md:hidden flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4">
          {[
            { name: 'Starter', tag: 'Ideal para começar', price: 'R$ 197', desc: 'Para pequenos negócios que querem organizar o atendimento.', features: ['Leads e clientes ilimitados', 'Visualize todas as oportunidades', 'Formulários inteligentes', 'WhatsApp centralizado', 'Registre e acompanhe vendas', 'Tarefas e atividades'], disabled: ['IA 24/7', 'Automações', 'Multiusuário'], cta: 'Testar grátis', accent: '#3B82F6' },
            { name: 'Pro', tag: 'MAIS ESCOLHIDO', price: 'R$ 297', desc: 'Para empresas que querem automatizar e vender mais.', features: ['Tudo do Starter', 'IA para atendimento 24/7', 'Automações ilimitadas', 'Score de leads por IA', 'Meta Ads + Google Ads', 'Até 5 usuários'], disabled: [], cta: 'Testar grátis', accent: '#2563EB', highlight: true },
            { name: 'Business', tag: 'Para escalar', price: 'R$ 397', desc: 'Para empresas que precisam de controle total em escala.', features: ['Tudo do Pro', 'IA avançada e previsões', 'Fluxos avançados', 'Usuários ilimitados', 'API aberta e webhooks', 'Gerente dedicado'], disabled: [], cta: 'Testar grátis', accent: '#7C3AED' },
          ].map(plan => (
            <div
              key={plan.name}
              className="snap-center shrink-0 w-[82vw] max-w-[310px] rounded-2xl p-6 flex flex-col gap-4 border"
              style={{ background: plan.highlight ? 'linear-gradient(160deg,#1E3A5F,#111827)' : '#111827', borderColor: plan.highlight ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)', boxShadow: plan.highlight ? '0 0 40px rgba(37,99,235,0.2)' : undefined }}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: plan.highlight ? '#93C5FD' : '#94A3B8' }}>{plan.tag}</span>
                <h3 className="text-xl font-bold text-white mt-1">{plan.name}</h3>
                <div className="flex items-end gap-1 my-1">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="mb-1 text-sm text-white/50">/mês</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{plan.desc}</p>
              </div>
              <ul className="flex flex-col gap-2 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: plan.accent }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs text-white/75">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block rounded-full py-2.5 text-center text-sm font-semibold text-white mt-auto"
                style={{ background: plan.highlight ? `linear-gradient(135deg, #2563EB, #7C3AED)` : `rgba(255,255,255,0.08)`, border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.1)' }}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-white/30 md:hidden">← Deslize para ver todos os planos →</p>

        {/* Payment info */}
        <p className="text-center text-sm mt-10" style={{ color: '#475569' }}>
          Pagamento via{' '}
          <strong className="text-white/60">PIX</strong> ou{' '}
          <strong className="text-white/60">Cartão de Crédito</strong>{' '}
          · Renovação mensal · Sem fidelidade
        </p>
      </section>

      {/* ── Feature comparison table ─────────────────────────────────────────── */}
      <section className="py-16 sm:py-24" style={{ background: '#020617' }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-14">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium mb-4"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#94A3B8' }}
            >
              Comparativo completo
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Tudo que está incluído em cada plano.</h2>
          </div>

          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>

            {/* Header */}
            <div className="grid grid-cols-4 border-b px-4 sm:px-6 py-4" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#475569' }}>Recurso</span>
              <span className="text-center text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>Starter</span>
              <span className="text-center text-xs font-semibold uppercase tracking-wide text-blue-400">Pro</span>
              <span className="text-center text-xs font-semibold uppercase tracking-wide" style={{ color: '#A78BFA' }}>Business</span>
            </div>

            {FEATURES.map((feat, i) => (
              <div key={`${feat.group ?? ''}-${feat.label}`}>
                {feat.group && (
                  <div
                    className="px-4 sm:px-6 py-2 border-t"
                    style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
                      {feat.group}
                    </span>
                  </div>
                )}
                <div
                  className="grid grid-cols-4 items-center px-4 sm:px-6 py-3 border-t text-sm"
                  style={{ background: i % 2 !== 0 ? 'rgba(255,255,255,0.015)' : 'transparent', borderColor: 'rgba(255,255,255,0.04)' }}
                >
                  <span className="font-medium text-white/70 text-xs sm:text-sm">{feat.label}</span>
                  <div className="text-center"><FeatCell value={feat.starter} /></div>
                  <div className="text-center"><FeatCell value={feat.pro} /></div>
                  <div className="text-center"><FeatCell value={feat.business} /></div>
                </div>
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* ── Value props ───────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20" style={{ background: '#0F172A' }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Por que times de alta performance escolhem o Althos.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: '📈',
                title: 'Mais vendas',
                desc: 'Converta mais leads e aumente seu faturamento com funis de venda inteligentes.',
                color: '#3B82F6',
              },
              {
                icon: '⚡',
                title: 'Mais tempo',
                desc: 'Automatize tarefas repetitivas e foque no que realmente gera resultado.',
                color: '#2563EB',
              },
              {
                icon: '🤖',
                title: 'Melhor atendimento',
                desc: 'Responda instantaneamente com IA — 24 horas por dia, 7 dias por semana.',
                color: '#7C3AED',
              },
              {
                icon: '📊',
                title: 'Escale com dados',
                desc: 'Tome decisões baseadas em métricas reais, não em achismo.',
                color: '#3B82F6',
              },
              {
                icon: '🔒',
                title: 'Seguro e confiável',
                desc: 'Infraestrutura robusta e protegida. Seus dados sempre disponíveis.',
                color: '#2563EB',
              },
              {
                icon: '🎯',
                title: 'ROI em Ads',
                desc: 'Pixel e CAPI nativos para otimizar campanhas e reduzir custo por lead.',
                color: '#7C3AED',
              },
            ].map(item => (
              <div
                key={item.title}
                className="rounded-2xl p-6 border flex gap-4 items-start transition-transform duration-200 hover:-translate-y-1"
                style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.07)' }}
              >
                <div
                  className="text-2xl w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${item.color}18` }}
                >
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust seal ───────────────────────────────────────────────────────── */}
      <section className="py-12" style={{ background: '#020617', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <div
            className="inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-6 rounded-2xl px-6 sm:px-10 py-5 border"
            style={{ background: 'rgba(37,99,235,0.07)', borderColor: 'rgba(37,99,235,0.2)' }}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-semibold text-white">Plano Free grátis para sempre</span>
            </div>
            <span className="hidden sm:block w-px h-5" style={{ background: 'rgba(255,255,255,0.1)' }} />
            <span className="text-sm" style={{ color: '#64748B' }}>7 dias grátis nos planos pagos.</span>
            <span className="hidden sm:block w-px h-5" style={{ background: 'rgba(255,255,255,0.1)' }} />
            <span className="text-sm" style={{ color: '#64748B' }}>Sem compromisso.</span>
            <span className="hidden sm:block w-px h-5" style={{ background: 'rgba(255,255,255,0.1)' }} />
            <span className="text-sm" style={{ color: '#64748B' }}>Cancele quando quiser.</span>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24" style={{ background: '#0F172A' }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-14">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium mb-4"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#94A3B8' }}
            >
              Dúvidas
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Perguntas frequentes.</h2>
          </div>
          <div>
            <FaqItem
              q="Preciso de cartão de crédito para começar?"
              a="Não para o plano Free, que é gratuito para sempre e não exige nenhuma forma de pagamento — basta criar uma conta com e-mail e senha. Já os planos pagos têm 7 dias de teste grátis, mas pedem uma forma de pagamento (PIX ou cartão) para iniciar o período."
            />
            <FaqItem
              q="Qual é a diferença entre os planos?"
              a="O Free organiza seus leads e o pipeline, de graça para sempre. O Starter profissionaliza o atendimento e as vendas. O Pro adiciona IA 24/7, automações, Meta Ads e muito mais — ideal para crescer. O Business entrega controle total com IA avançada, API aberta, usuários ilimitados e gerente dedicado para empresas em expansão acelerada."
            />
            <FaqItem
              q="Quais formas de pagamento são aceitas?"
              a="Aceitamos PIX e Cartão de Crédito. O PIX tem aprovação instantânea. O cartão é cobrado automaticamente todo mês."
            />
            <FaqItem
              q="O que acontece quando o teste dos planos pagos termina?"
              a="Após os 7 dias de teste, a assinatura do plano pago é cobrada automaticamente na forma de pagamento escolhida. Você pode cancelar antes disso a qualquer momento — e, mesmo assim, continua com acesso ao plano Free. Seus dados ficam sempre preservados."
            />
            <FaqItem
              q="Posso cancelar a qualquer momento?"
              a="Sim. Sem fidelidade mínima. O cancelamento é feito em um clique na área de assinatura e vale para o próximo ciclo — você mantém acesso até o fim do período já pago."
            />
            <FaqItem
              q="Posso fazer upgrade ou downgrade de plano?"
              a="Sim, a qualquer momento. Ao fazer upgrade, a diferença de valor é calculada proporcionalmente. Ao fazer downgrade, o novo valor entra no próximo ciclo."
            />
            <FaqItem
              q="Tem suporte para agências e consultorias?"
              a="Sim. Temos condições especiais para clientes da Althos Performance, com onboarding dedicado, acesso completo e multi-tenant. Entre em contato via suporte@althos.io."
            />
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────────── */}
      <section className="pb-16 sm:pb-24" style={{ background: '#020617' }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div
            className="relative rounded-3xl p-10 sm:p-16 text-center overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #0F172A 100%)', border: '1px solid rgba(124,58,237,0.2)' }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.15) 0%, transparent 60%)' }}
            />
            <div className="relative">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium mb-5"
                style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#94A3B8' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                Trial gratuito disponível agora
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4">
                Pronto para vender mais<br className="hidden sm:block" /> com IA e automações?
              </h2>
              <p className="text-base sm:text-lg mb-8 max-w-xl mx-auto" style={{ color: '#64748B' }}>
                Transforme leads em clientes com inteligência artificial, automações e dados — tudo em uma única plataforma.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/signup"
                  className="w-full sm:w-auto rounded-full px-8 py-3.5 text-base font-bold text-white transition-all hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 shadow-lg text-center"
                  style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)', boxShadow: '0 8px 30px rgba(37,99,235,0.3)' }}
                >
                  Começar de graça
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto rounded-full border px-8 py-3.5 text-base font-semibold text-white hover:bg-white/5 transition-colors text-center"
                  style={{ borderColor: 'rgba(255,255,255,0.15)' }}
                >
                  Já tenho uma conta
                </Link>
              </div>
              <p className="mt-5 text-xs sm:text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>
Plano Free sem cartão · Cancele quando quiser · Suporte 24h
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t py-8" style={{ background: '#020617', borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-base font-semibold text-white">Althos CRM</Link>
          <div className="flex items-center gap-6 text-sm" style={{ color: '#475569' }}>
            <Link href="/" className="hover:text-white transition-colors">Início</Link>
            <Link href="/#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</Link>
            <Link href="/login" className="hover:text-white transition-colors">Login</Link>
            <a href="mailto:suporte@althos.io" className="hover:text-white transition-colors">Suporte</a>
          </div>
          <p className="text-xs" style={{ color: '#334155' }}>© {new Date().getFullYear()} Althos Performance · Feito no Brasil 🇧🇷</p>
        </div>
      </footer>

    </div>
  )
}
