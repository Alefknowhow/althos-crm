import type { Metadata } from 'next'
import { NicheLanding } from '@/components/site/NicheLanding'
import { NICHES } from '@/lib/landing/niches'
import { buildLandingMetadata } from '@/lib/landing/seo'

const c = NICHES['pequenas-empresas']

export const metadata: Metadata = buildLandingMetadata(c)

export default function PequenasEmpresasPage() {
  return <NicheLanding c={c} />
}
