'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FolderOpen, Plus } from 'lucide-react'
import PortalAssetChainCard from './PortalAssetChainCard'
import UploadPortalAssetDialog from './UploadPortalAssetDialog'
import type { PortalLibraryAssetChain } from '@/actions/client-portal-library'

/** Biblioteca do Portal (issue #23) — 3 grupos iguais ao painel interno:
 *  Material bruto (o cliente sobe), Aguardando aprovação (a agência subiu
 *  um produzido) e Aprovados. */
export default function PortalLibraryTab({ contatoId, chains }: { contatoId: string; chains: PortalLibraryAssetChain[] }) {
  const router = useRouter()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [versionTarget, setVersionTarget] = useState<string | null>(null)

  function reload() { router.refresh() }

  const bruto = chains.filter(c => c.latest.kind === 'bruto')
  const aguardando = chains.filter(c => c.latest.kind === 'produzido' && c.latest.status !== 'aprovado')
  const aprovados = chains.filter(c => c.latest.kind === 'produzido' && c.latest.status === 'aprovado')

  function handleNewVersion(latestId: string) {
    setVersionTarget(latestId)
    setUploadOpen(true)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2"><FolderOpen className="w-4 h-4" /> Biblioteca</CardTitle>
        <Button type="button" size="sm" onClick={() => { setVersionTarget(null); setUploadOpen(true) }}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Enviar material
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <LibraryGroup title="Material bruto" chains={bruto} emptyLabel="Nenhum material bruto enviado ainda." contatoId={contatoId} onReload={reload} onNewVersion={handleNewVersion} canUploadVersion />
        <LibraryGroup title="Aguardando aprovação" chains={aguardando} emptyLabel="Nenhum criativo aguardando sua aprovação." contatoId={contatoId} onReload={reload} onNewVersion={handleNewVersion} canUploadVersion={false} />
        <LibraryGroup title="Aprovados" chains={aprovados} emptyLabel="Nenhum criativo aprovado ainda." contatoId={contatoId} onReload={reload} onNewVersion={handleNewVersion} canUploadVersion={false} />
      </CardContent>

      <UploadPortalAssetDialog
        contatoId={contatoId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        parentAssetId={versionTarget}
        onDone={reload}
      />
    </Card>
  )
}

function LibraryGroup({
  title, chains, emptyLabel, contatoId, onReload, onNewVersion, canUploadVersion,
}: {
  title: string
  chains: PortalLibraryAssetChain[]
  emptyLabel: string
  contatoId: string
  onReload: () => void
  onNewVersion: (latestId: string) => void
  canUploadVersion: boolean
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}{chains.length > 0 && ` (${chains.length})`}</p>
      {chains.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">{emptyLabel}</p>
      ) : (
        <div className="space-y-3">
          {chains.map(chain => (
            <PortalAssetChainCard
              key={chain.rootAssetId}
              contatoId={contatoId}
              chain={chain}
              onReload={onReload}
              onNewVersion={() => onNewVersion(chain.latest.id)}
              canUploadVersion={canUploadVersion}
            />
          ))}
        </div>
      )}
    </div>
  )
}
