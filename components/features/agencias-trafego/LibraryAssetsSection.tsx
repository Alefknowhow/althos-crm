'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Plus } from 'lucide-react'
import { type LibraryAssetChain } from '@/actions/library-assets'
import AssetChainCard from './AssetChainCard'
import UploadLibraryAssetDialog from './UploadLibraryAssetDialog'

/** As 3 abas pedidas: material bruto (o que o cliente sobe), aguardando
 *  aprovação (a agência trabalhou e está esperando o cliente decidir) e
 *  aprovados (já pode ir pro ar). Substitui a antiga aba "Criativos"
 *  (campaign_creatives) — tudo fica dentro da Biblioteca agora. */
export default function LibraryAssetsSection({
  orgSlug, contatoId, chains, campaigns,
}: { orgSlug: string; contatoId: string; chains: LibraryAssetChain[]; campaigns: { id: string; name: string }[] }) {
  const router = useRouter()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [versionTarget, setVersionTarget] = useState<{ rootAssetId: string; latestId: string } | null>(null)

  function reload() { router.refresh() }

  const bruto = chains.filter(c => c.latest.kind === 'bruto')
  const aguardando = chains.filter(c => c.latest.kind === 'produzido' && c.latest.status !== 'aprovado')
  const aprovados = chains.filter(c => c.latest.kind === 'produzido' && c.latest.status === 'aprovado')

  function handleNewVersion(rootAssetId: string, latestId: string) {
    setVersionTarget({ rootAssetId, latestId })
    setUploadOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Biblioteca</h3>
          <p className="text-xs text-muted-foreground">Materiais brutos e criativos produzidos — versionados, com comentários e aprovação do cliente.</p>
        </div>
        <Button type="button" size="sm" onClick={() => { setVersionTarget(null); setUploadOpen(true) }}>
          <Plus className="w-4 h-4 mr-1.5" /> Enviar material
        </Button>
      </div>

      <Tabs defaultValue="bruto">
        <TabsList>
          <TabsTrigger value="bruto">Material bruto{bruto.length > 0 && ` (${bruto.length})`}</TabsTrigger>
          <TabsTrigger value="aguardando">Aguardando aprovação{aguardando.length > 0 && ` (${aguardando.length})`}</TabsTrigger>
          <TabsTrigger value="aprovados">Aprovados{aprovados.length > 0 && ` (${aprovados.length})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="bruto" className="mt-3">
          <AssetChainList orgSlug={orgSlug} chains={bruto} emptyLabel="Nenhum material bruto enviado ainda." onReload={reload} onNewVersion={handleNewVersion} campaigns={campaigns} />
        </TabsContent>
        <TabsContent value="aguardando" className="mt-3">
          <AssetChainList orgSlug={orgSlug} chains={aguardando} emptyLabel="Nenhum criativo aguardando aprovação." onReload={reload} onNewVersion={handleNewVersion} campaigns={campaigns} />
        </TabsContent>
        <TabsContent value="aprovados" className="mt-3">
          <AssetChainList orgSlug={orgSlug} chains={aprovados} emptyLabel="Nenhum criativo aprovado ainda." onReload={reload} onNewVersion={handleNewVersion} campaigns={campaigns} />
        </TabsContent>
      </Tabs>

      <UploadLibraryAssetDialog
        orgSlug={orgSlug}
        contatoId={contatoId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        parentAssetId={versionTarget?.latestId || null}
        campaigns={campaigns}
        onDone={reload}
      />
    </div>
  )
}

function AssetChainList({
  orgSlug, chains, emptyLabel, onReload, onNewVersion, campaigns,
}: {
  orgSlug: string
  chains: LibraryAssetChain[]
  emptyLabel: string
  onReload: () => void
  onNewVersion: (rootAssetId: string, latestId: string) => void
  campaigns: { id: string; name: string }[]
}) {
  if (chains.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-8 text-center">
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {chains.map(chain => (
        <AssetChainCard
          key={chain.rootAssetId}
          orgSlug={orgSlug}
          chain={chain}
          onReload={onReload}
          onNewVersion={() => onNewVersion(chain.rootAssetId, chain.latest.id)}
          campaignName={chain.latest.campaignId ? campaigns.find(c => c.id === chain.latest.campaignId)?.name : null}
        />
      ))}
    </div>
  )
}
