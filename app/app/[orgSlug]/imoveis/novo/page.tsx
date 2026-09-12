import { redirect, notFound } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createProperty } from '@/actions/properties'
import { requireModuleEnabled } from '@/lib/module-flags'

export const dynamic = 'force-dynamic'

/** Cria um imóvel vazio e redireciona pro editor — mesmo padrão do botão
 *  "+ Cotação" (cria rascunho, edição acontece na página seguinte). */
export default async function NewPropertyPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  await requireModuleEnabled(org.niche, 'imoveis')

  const res = await createProperty(params.orgSlug, {})
  if (!res.ok) notFound()

  redirect(`/app/${params.orgSlug}/imoveis/${res.id}`)
}
