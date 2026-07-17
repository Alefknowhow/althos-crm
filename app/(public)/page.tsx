import type { Metadata } from 'next'
import { SiteShell } from '@/components/site/SiteShell'
import AlthosHome from '@/components/landing/AlthosHome'
import { HOME_FAQ } from '@/lib/site/content'

const TITLE = 'Althos CRM | CRM com IA para Pequenas Empresas'
const DESCRIPTION =
  'CRM com IA para organizar leads, automatizar vendas, integrar WhatsApp e aumentar conversões com um funil visual simples.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'CRM', 'CRM online', 'CRM brasileiro', 'CRM com IA', 'automação de vendas',
    'automação comercial', 'funil de vendas', 'pipeline', 'leads', 'CRM com WhatsApp',
    'CRM para pequenas empresas',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    siteName: 'Althos CRM',
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

/** JSON-LD FAQPage — perguntas gerais sobre CRM, pensadas para rich results e AI Overview. */
function homeFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOME_FAQ.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }
}

export default function LandingPage() {
  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqJsonLd()) }}
      />
      <AlthosHome />
    </SiteShell>
  )
}
