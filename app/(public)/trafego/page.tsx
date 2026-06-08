import type { Metadata } from 'next'
import { NicheLanding } from '@/components/site/NicheLanding'
import { NICHES } from '@/lib/landing/niches'

const c = NICHES.trafego

export const metadata: Metadata = {
  title: c.metaTitle,
  description: c.metaDescription,
  alternates: { canonical: '/trafego' },
}

export default function TrafegoPage() {
  return <NicheLanding c={c} />
}
