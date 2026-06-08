import type { Metadata } from 'next'
import { NicheLanding } from '@/components/site/NicheLanding'
import { NICHES } from '@/lib/landing/niches'

const c = NICHES['pequenas-empresas']

export const metadata: Metadata = {
  title: c.metaTitle,
  description: c.metaDescription,
  alternates: { canonical: '/pequenas-empresas' },
}

export default function PequenasEmpresasPage() {
  return <NicheLanding c={c} />
}
