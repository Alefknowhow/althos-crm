import type { Metadata } from 'next'
import { NicheLanding } from '@/components/site/NicheLanding'
import { NICHES } from '@/lib/landing/niches'

const c = NICHES.clinicas

export const metadata: Metadata = {
  title: c.metaTitle,
  description: c.metaDescription,
  alternates: { canonical: '/clinicas' },
}

export default function ClinicasPage() {
  return <NicheLanding c={c} />
}
