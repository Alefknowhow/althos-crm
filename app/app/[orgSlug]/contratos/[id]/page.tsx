import { notFound } from 'next/navigation'
import { getContract } from '@/actions/contracts-global'
import ContractDetailView from '@/components/features/contracts/ContractDetailView'

export default async function ContractDetailPage({ params }: { params: { orgSlug: string; id: string } }) {
  const contract = await getContract(params.orgSlug, params.id)
  if (!contract) notFound()

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <ContractDetailView orgSlug={params.orgSlug} contract={contract} />
    </div>
  )
}
