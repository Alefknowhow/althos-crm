import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/site/SiteShell'
import { FeaturesExplorer } from '@/components/site/FeaturesExplorer'
import { buildPageMetadata } from '@/lib/landing/seo'

export const metadata: Metadata = buildPageMetadata({
  title: 'Althos CRM | Funcionalidades do CRM com IA',
  description:
    'Funil de vendas visual, atendente de IA 24h, automações, WhatsApp e Instagram nativos, relatórios com IA e mais. Conheça tudo que o Althos CRM faz.',
  path: '/funcionalidades',
})

export default function FuncionalidadesPage() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden pt-10 pb-8 sm:pt-24 sm:pb-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/3 h-[480px] w-[480px] rounded-full bg-[#4589ff]/20 blur-[120px]" />
          <div className="absolute top-0 right-1/4 h-[360px] w-[360px] rounded-full bg-violet-400/15 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4589ff]/40 bg-[#0f62fe]/10 px-3 py-1 text-xs font-medium text-[#78a9ff]">
            Funcionalidades
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#f4f4f4] sm:mt-5 sm:text-5xl">
            Tudo que você precisa para vender mais
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-[#a8a8a8] sm:mt-4 sm:text-lg">
            Clique em cada recurso para ver como ele funciona na prática. Do primeiro contato ao fechamento, em um só lugar.
          </p>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <FeaturesExplorer />
      </section>

      <section className="relative mx-auto max-w-3xl px-4 pb-24 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-[#f4f4f4] sm:text-3xl">Pronto para ver na sua operação?</h2>
        <p className="mx-auto mt-3 max-w-md text-[14px] text-[#a8a8a8]">
          Comece de graça no plano Free. Sem cartão, sem compromisso.
        </p>
        <Link
          href="/signup"
          className="mt-6 inline-flex rounded-none bg-blue-600 px-7 py-3 text-[15px] font-semibold text-white   shadow-blue-600/30 hover:bg-blue-500 transition-colors"
        >
          Começar agora
        </Link>
      </section>
    </SiteShell>
  )
}
