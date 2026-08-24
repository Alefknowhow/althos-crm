'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2 } from 'lucide-react'
import type { MetaAdAccountOption } from '@/lib/meta/ads-oauth'
import { assignMetaAdAccountToClient } from '@/actions/marketing'

/**
 * A agência conecta o Facebook UMA vez (Business Manager próprio com acesso
 * às contas de todos os clientes) — aqui só se escolhe qual conta, dentre as
 * já acessíveis por esse login, pertence a ESTE cliente. Sem pedir login de
 * novo (ver actions/marketing.ts::listAssignableMetaAdAccounts).
 */
export default function AssignMetaAdAccountPanel({
  orgSlug, clientId, options, assignedElsewhere,
}: {
  orgSlug: string
  clientId: string
  options: MetaAdAccountOption[]
  assignedElsewhere: string[]
}) {
  const router = useRouter()
  const assignedSet = new Set(assignedElsewhere)
  const free = options.filter(o => !assignedSet.has(o.id))
  const [selected, setSelected] = useState<string>(free[0]?.id || '')
  const [saving, setSaving] = useState(false)

  async function confirm() {
    if (!selected) { toast.error('Selecione uma conta'); return }
    const meta = options.find(o => o.id === selected)
    if (!meta) return
    setSaving(true)
    const res = await assignMetaAdAccountToClient(orgSlug, clientId, meta.id, meta.name)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Conta vinculada a este cliente')
    router.refresh()
  }

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma conta de anúncio acessível pelo login conectado da agência.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        A agência já está conectada ao Facebook — escolha qual conta pertence a este cliente.
      </p>
      <RadioGroup value={selected} onValueChange={setSelected} className="space-y-1.5">
        {options.map(o => {
          const takenElsewhere = assignedSet.has(o.id)
          return (
            <label
              key={o.id}
              className="flex items-center gap-3 p-2.5 border rounded-md cursor-pointer hover:bg-muted/30 aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
              aria-disabled={takenElsewhere}
            >
              <RadioGroupItem value={o.id} disabled={takenElsewhere} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{o.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{o.id}{takenElsewhere ? ' · já vinculada a outro cliente' : ''}</p>
              </div>
            </label>
          )
        })}
      </RadioGroup>
      <Button size="sm" onClick={confirm} disabled={saving || !selected}>
        {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
        Vincular conta a este cliente
      </Button>
    </div>
  )
}
