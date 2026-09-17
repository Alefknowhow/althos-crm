import DataImportExportCard from '@/components/features/DataImportExportCard'

export default function DadosPage({ params }: { params: { orgSlug: string } }) {
  return <DataImportExportCard orgSlug={params.orgSlug} />
}
