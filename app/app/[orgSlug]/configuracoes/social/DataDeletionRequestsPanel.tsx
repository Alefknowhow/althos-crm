'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { resolveDataDeletionRequest, type DataDeletionRequest } from '@/actions/data-deletion'
import { toast } from 'sonner'
import { Trash2, Check } from 'lucide-react'

export default function DataDeletionRequestsPanel({
  orgSlug,
  initialRequests,
}: {
  orgSlug: string
  initialRequests: DataDeletionRequest[]
}) {
  const [requests, setRequests] = useState(initialRequests)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const pending = requests.filter(r => r.status === 'pending')
  const resolved = requests.filter(r => r.status === 'resolved')

  function handleResolve(id: string) {
    setResolvingId(id)
    startTransition(async () => {
      const res = await resolveDataDeletionRequest(orgSlug, id)
      if (!res.ok) {
        toast.error('Não foi possível marcar como resolvido', { description: res.error })
      } else {
        setRequests(prev => prev.map(r => (r.id === id ? { ...r, status: 'resolved' as const } : r)))
        toast.success('Pedido marcado como resolvido')
      }
      setResolvingId(null)
    })
  }

  if (requests.length === 0) return null

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Trash2 className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Solicitações de exclusão de dados</h2>
        {pending.length > 0 && (
          <Badge variant="destructive" className="text-[10px]">{pending.length} pendente{pending.length !== 1 ? 's' : ''}</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Pedidos de exclusão de dados feitos por quem interagiu com seu Instagram. Exclua os dados dessa pessoa
        (lead, conversas) nas telas normais do CRM e depois marque como resolvido aqui.
      </p>

      {pending.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum pedido pendente.</p>
      ) : (
        <div className="space-y-2">
          {pending.map(r => (
            <div key={r.id} className="flex items-start gap-3 rounded-lg border p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {r.requester_name || 'Sem nome'}
                  {r.requester_contact && <span className="text-muted-foreground font-normal"> · {r.requester_contact}</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Contatou @{r.business_username} em {new Date(r.created_at).toLocaleDateString('pt-BR')}
                </p>
                {r.message && <p className="text-xs text-foreground/70 mt-1">{r.message}</p>}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResolve(r.id)}
                disabled={resolvingId === r.id}
                className="shrink-0"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Marcar resolvido
              </Button>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">{resolved.length} pedido{resolved.length !== 1 ? 's' : ''} já resolvido{resolved.length !== 1 ? 's' : ''}</summary>
          <div className="mt-2 space-y-1">
            {resolved.map(r => (
              <div key={r.id} className="flex items-center justify-between">
                <span>{r.requester_name || r.requester_contact || 'Sem identificação'} · @{r.business_username}</span>
                <span>{r.resolved_at ? new Date(r.resolved_at).toLocaleDateString('pt-BR') : ''}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
