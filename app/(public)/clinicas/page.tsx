import type { Metadata } from 'next'
import { NicheLanding } from '@/components/site/NicheLanding'
import { NICHES } from '@/lib/landing/niches'
import { buildLandingMetadata } from '@/lib/landing/seo'

const c = NICHES.clinicas

export const metadata: Metadata = buildLandingMetadata(c)

export default function ClinicasPage() {
  return <NicheLanding c={c} />
}
