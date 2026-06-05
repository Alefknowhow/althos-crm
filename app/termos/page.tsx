import type { Metadata } from 'next'
import LegalMarkdown from '@/components/LegalMarkdown'
import { TERMOS_MD } from '@/lib/legal/termos'

export const metadata: Metadata = {
  title: 'Termos de Uso e Política Antifraude — Althos CRM',
  description:
    'Termos de Uso e Política Antifraude da Althos CRM: uso aceitável, proteção de dados (LGPD), monitoramento de abusos, medidas disciplinares e cooperação com autoridades.',
}

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed text-slate-700">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Termos de Uso e Política Antifraude
      </h1>
      <p className="mt-2 text-slate-500">Última atualização: novembro de 2025</p>

      <div className="mt-6">
        <LegalMarkdown source={TERMOS_MD} />
      </div>
    </main>
  )
}
