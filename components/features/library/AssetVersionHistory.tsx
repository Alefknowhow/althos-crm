'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LibraryAsset } from '@/actions/library-assets'
import MediaPreview from './MediaPreview'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pendente: { label: 'Aguardando aprovação', cls: 'bg-amber-100 text-amber-700' },
  aprovado: { label: 'Aprovado', cls: 'bg-success text-success-foreground' },
  alteracao_solicitada: { label: 'Alteração solicitada', cls: 'bg-destructive text-destructive-foreground' },
}

/** Lista todas as versões de uma cadeia (mais recente primeiro), com
 *  status de cada uma e preview sob demanda — critério de aceite do #23
 *  "versionamento sem sobrescrever histórico" / "versão final aprovada
 *  identificável". A versão aprovada mais recente ganha o selo "Final
 *  aprovada" mesmo que não seja a versão mais recente da cadeia (ex.: uma
 *  versão aprovada seguida de uma nova versão ainda pendente). */
export default function AssetVersionHistory({ versions }: { versions: LibraryAsset[] }) {
  const [openVersionId, setOpenVersionId] = useState<string | null>(null)
  const latestApprovedId = versions.find(v => v.status === 'aprovado')?.id ?? null

  return (
    <div className="space-y-1.5">
      {versions.map(v => {
        const status = STATUS_LABEL[v.status] || STATUS_LABEL.pendente
        const isOpen = openVersionId === v.id
        const isFinalApproved = v.id === latestApprovedId
        return (
          <div key={v.id} className="rounded-md border">
            <button
              type="button"
              onClick={() => setOpenVersionId(isOpen ? null : v.id)}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs"
            >
              <span className="font-medium shrink-0">v{v.version}</span>
              <span className="text-muted-foreground shrink-0">{new Date(v.createdAt).toLocaleDateString('pt-BR')}</span>
              <Badge className={cn('text-[10px] shrink-0', status.cls)}>{status.label}</Badge>
              {isFinalApproved && <Badge className="text-[10px] shrink-0 bg-primary text-primary-foreground">Final aprovada</Badge>}
              <span className="ml-auto shrink-0">
                {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </button>
            {isOpen && (
              <div className="border-t p-2">
                {v.signedUrl ? (
                  <MediaPreview src={v.signedUrl} mimeType={v.mimeType} width={v.width} height={v.height} title={v.title} />
                ) : (
                  <p className="text-xs text-muted-foreground">Sem preview disponível.</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function VersionHistoryToggle({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  return (
    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onToggle}>
      {open ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
      Histórico ({count} versões)
    </Button>
  )
}
