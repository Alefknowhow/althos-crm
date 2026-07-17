import type { Metadata } from 'next'
import { NicheLanding } from '@/components/site/NicheLanding'
import { FEATURES } from '@/lib/landing/features'
import { buildLandingMetadata } from '@/lib/landing/seo'

const c = FEATURES['crm-whatsapp']

export const metadata: Metadata = buildLandingMetadata(c)

export default function CrmWhatsappPage() {
  return <NicheLanding c={c} />
}
