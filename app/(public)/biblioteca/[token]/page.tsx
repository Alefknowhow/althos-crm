import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPublicLibraryAsset } from '@/actions/library-assets-public'
import PublicLibraryAssetView from '@/components/features/agencias-trafego/PublicLibraryAssetView'

/**
 * Aprovação pública de material da Biblioteca de Tráfego (issue #23) — sem
 * login. Mesmo padrão de app/(public)/criativo/[token]/page.tsx.
 */

export const revalidate = 0

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const asset = await getPublicLibraryAsset(params.token)
  return { title: asset ? `Aprovação — ${asset.title}` : 'Material não encontrado' }
}

export default async function LibraryAssetApprovalPage({ params }: { params: { token: string } }) {
  const asset = await getPublicLibraryAsset(params.token)
  if (!asset) notFound()
  return <PublicLibraryAssetView token={params.token} asset={asset} />
}
