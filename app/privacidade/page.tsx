import type { Metadata } from 'next'
import LegalMarkdown from '@/components/LegalMarkdown'
import { PRIVACIDADE_MD } from '@/lib/legal/privacidade'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Althos CRM',
  description:
    'Como a Althos CRM coleta, usa, compartilha e protege dados pessoais, em conformidade com a LGPD, incluindo dados de integrações com Meta (WhatsApp, Instagram e Meta Ads).',
}

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed text-slate-700">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Política de Privacidade</h1>
      <p className="mt-2 text-slate-500">Última atualização: junho de 2026</p>

      <div className="mt-6">
        <LegalMarkdown source={PRIVACIDADE_MD} />
      </div>
    </main>
  )
}
