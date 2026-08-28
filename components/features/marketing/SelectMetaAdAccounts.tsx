'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import type { MetaAdAccountOption } from '@/lib/meta/ads-oauth'
import { connectMetaAdsAccounts } from '@/actions/marketing'

export default function SelectMetaAdAccounts({
  orgSlug,
  options,
  listError,
}: {
  orgSlug: string
  options: MetaAdAccountOption[]
  listError: string | null
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function confirm() {
    if (selected.size === 0) { toast.error('Selecione ao menos uma conta'); return }
    setSaving(true)
    const res = await connectMetaAdsAccounts(orgSlug, Array.from(selected))
    setSaving(false)
    if (res.ok) {
      toast.success(
        res.campaignsSynced > 0
          ? `${res.accountsConnected} conta(s) conectada(s) e ${res.campaignsSynced} campanha(s) sincronizada(s)`
          : `${res.accountsConnected} conta(s) conectada(s)`,
      )
      // Vai direto pro painel principal, já com o dado sincronizado — fluxo
      // fluido: conectar → selecionar → sincronizar → ver dado, sem passo
      // manual extra em Contas.
      router.replace(`/app/${orgSlug}/marketing`)
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  if (listError) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-destructive">{listError}</CardContent>
      </Card>
    )
  }

  if (options.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma conta de anúncio encontrada para este usuário do Facebook.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {options.map(o => (
          <label
            key={o.id}
            className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/30"
          >
            <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{o.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{o.id}</p>
            </div>
          </label>
        ))}
      </div>
      <Button onClick={confirm} disabled={saving || selected.size === 0}>
        {saving ? 'Conectando e sincronizando...' : `Conectar ${selected.size || ''} conta(s)`}
      </Button>
    </div>
  )
}
