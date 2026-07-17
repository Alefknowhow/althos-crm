import type { Metadata } from 'next'
import { NicheLanding } from '@/components/site/NicheLanding'
import { FEATURES } from '@/lib/landing/features'
import { buildLandingMetadata } from '@/lib/landing/seo'

const c = FEATURES['atendimento-ia']

export const metadata: Metadata = buildLandingMetadata(c)

export default function AtendimentoIaPage() {
  return <NicheLanding c={c} />
}
