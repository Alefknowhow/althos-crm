'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import type { MetaAdAccountOption } from '@/lib/meta/ads-oauth'
import { connectMetaAdsAccountsForClient } from '@/actions/marketing'

export default function SelectMetaAdAccountsForClient({
  orgSlug, clientId, options, listError,
}: {
  orgSlug: string
  clientId: string
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
    const res = await connectMetaAdsAccountsForClient(orgSlug, clientId, Array.from(selected))
    setSaving(false)
    if (res.ok) {
      toast.success(`${res.accountsConnected} conta(s) conectada(s) a este cliente`)
      router.replace(`/app/${orgSlug}/agencias-trafego/trafego/${clientId}`)
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Escolha a conta de anúncio deste cliente</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Conectado com sucesso ao Facebook — marque a(s) conta(s) que pertencem a este cliente.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {listError ? (
          <p className="text-sm text-destructive text-center py-6">{listError}</p>
        ) : options.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma conta de anúncio encontrada para este usuário do Facebook.</p>
        ) : (
          <>
            <div className="space-y-2">
              {options.map(o => (
                <label key={o.id} className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/30">
                  <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{o.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{o.id}</p>
                  </div>
                </label>
              ))}
            </div>
            <Button onClick={confirm} disabled={saving || selected.size === 0}>
              {saving ? 'Conectando...' : `Conectar ${selected.size || ''} conta(s)`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
