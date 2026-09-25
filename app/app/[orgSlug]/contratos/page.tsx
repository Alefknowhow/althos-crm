import { listContracts } from '@/actions/contracts-global'
import { listDocumentTemplates } from '@/actions/document-templates'
import ContractsListView from '@/components/features/contracts/ContractsListView'

export default async function ContratosPage({ params }: { params: { orgSlug: string } }) {
  const [contracts, templates] = await Promise.all([
    listContracts(params.orgSlug),
    listDocumentTemplates(params.orgSlug).catch(() => []),
  ])

  return (
    <div className="p-4 md:p-6">
      <ContractsListView orgSlug={params.orgSlug} initialContracts={contracts} templates={templates} />
    </div>
  )
}
