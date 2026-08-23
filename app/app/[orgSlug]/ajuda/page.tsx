import { getHelpCategoriesForNiche } from '@/lib/help/content'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { nicheKeyFor } from '@/lib/niche'
import { AjudaClient } from './AjudaClient'

export const metadata = { title: 'Central de Ajuda · Althos CRM' }

export default async function AjudaPage({ params }: { params: { orgSlug: string } }) {
  const org = await getCurrentOrganization(params.orgSlug)
  const categories = getHelpCategoriesForNiche(nicheKeyFor((org as any).niche))
  return <AjudaClient categories={categories} />
}
