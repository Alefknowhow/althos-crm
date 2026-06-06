import type { Metadata } from 'next'
import LegalMarkdown from '@/components/LegalMarkdown'
import { COOKIES_MD } from '@/lib/legal/cookies'

export const metadata: Metadata = {
  title: 'Política de Cookies — Althos CRM',
  description:
    'Como a Althos CRM usa cookies e tecnologias similares, os tipos de cookies utilizados e como você pode gerenciá-los.',
}

export default function CookiesPage() {
  return (
    <div className="light min-h-screen bg-white">
      <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed text-slate-700">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Política de Cookies</h1>
        <p className="mt-2 text-slate-500">Última atualização: junho de 2026</p>

        <div className="mt-6">
          <LegalMarkdown source={COOKIES_MD} />
        </div>
      </main>
    </div>
  )
}
