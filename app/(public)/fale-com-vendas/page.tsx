import type { Metadata } from 'next'
import { SiteShell } from '@/components/site/SiteShell'
import { BusinessLeadForm } from '@/components/site/BusinessLeadForm'

const TITLE = 'Fale com vendas — Plano Business | Althos CRM'
const DESCRIPTION =
  'Conte um pouco da sua operação e nosso time monta o plano Business sob medida — multi-tenant ilimitado, insights de IA e API.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/fale-com-vendas' },
  robots: { index: false, follow: false },
}

export default function FaleComVendasPage() {
  return (
    <SiteShell>
      <section className="relative mx-auto max-w-xl px-4 pt-10 pb-20 sm:pt-24 sm:px-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4589ff]/40 bg-[#0f62fe]/10 px-3 py-1 text-xs font-medium text-[#78a9ff]">
            Plano Business
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#f4f4f4] sm:text-4xl">
            Vamos montar o plano certo pra sua operação
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-[#a8a8a8] sm:text-base">
            Multi-tenant ilimitado, insights de IA, API e gerente de conta dedicado — conte um pouco do seu negócio e retornamos com uma proposta.
          </p>
        </div>

        <div className="mt-8">
          <BusinessLeadForm />
        </div>
      </section>
    </SiteShell>
  )
}
