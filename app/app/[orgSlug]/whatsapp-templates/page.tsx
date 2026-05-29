import { getWaTemplates } from '@/actions/whatsapp-templates'
import { WaTemplatesClient } from './WaTemplatesClient'

export const dynamic = 'force-dynamic'

export default async function WaTemplatesPage({ params }: { params: { orgSlug: string } }) {
  const templates = await getWaTemplates(params.orgSlug).catch(() => [])
  return <WaTemplatesClient orgSlug={params.orgSlug} initialTemplates={templates} />
}
