import type { Metadata } from 'next'
import { NicheLanding } from '@/components/site/NicheLanding'
import { NICHES } from '@/lib/landing/niches'

const c = NICHES.imobiliarias

export const metadata: Metadata = {
  title: c.metaTitle,
  description: c.metaDescription,
  alternates: { canonical: '/imobiliarias' },
}

export default function ImobiliariasPage() {
  return <NicheLanding c={c} />
}
