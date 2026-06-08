import type { Metadata } from 'next'
import { NicheLanding } from '@/components/site/NicheLanding'
import { NICHES } from '@/lib/landing/niches'

const c = NICHES.viagens

export const metadata: Metadata = {
  title: c.metaTitle,
  description: c.metaDescription,
  alternates: { canonical: '/viagens' },
}

export default function ViagensPage() {
  return <NicheLanding c={c} />
}
