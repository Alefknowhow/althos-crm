'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Home, Plus, Star, Trash2, Loader2, User } from 'lucide-react'
import { addInterest, removeInterest, toggleFavorite, type PropertyInterestRow } from '@/actions/property-interests'

type Mode = { type: 'contato'; contatoId: string } | { type: 'property'; propertyId: string }
type PropertyOption = { id: string; title: string; code: string | null }
type ContatoOption = { id: string; name: string }

export default function PropertyInterestsSection({
  orgSlug, mode, initial, properties = [], contatos = [],
}: {
  orgSlug: string
  mode: Mode
  initial: PropertyInterestRow[]
  properties?: PropertyOption[]
  contatos?: ContatoOption[]
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleAdd() {
    if (!selectedId) return
    setSaving(true)
    const input = mode.type === 'contato'
      ? { propertyId: selectedId, contatoId: mode.contatoId }
      : { propertyId: mode.propertyId, contatoId: selectedId }
    const res = await addInterest(orgSlug, input)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Interesse registrado')
    setAdding(false); setSelectedId('')
    router.refresh()
  }

  async function handleRemove(id: string) {
    setBusyId(id)
    const res = await removeInterest(orgSlug, id)
    setBusyId(null)
    if (!res.ok) { toast.error(res.error); return }
    router.refresh()
  }

  async function handleToggleFavorite(id: string, current: boolean) {
    setBusyId(id)
    const res = await toggleFavorite(orgSlug, id, !current)
    setBusyId(null)
    if (!res.ok) { toast.error(res.error); return }
    router.refresh()
  }

  const title = mode.type === 'contato' ? 'Imóveis de interesse' : 'Leads interessados'

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Home className="w-4 h-4" /> {title}
        </CardTitle>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="flex items-center gap-2 rounded-lg border p-3 bg-muted/20">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="flex-1 min-w-0"><SelectValue placeholder={mode.type === 'contato' ? 'Escolher imóvel…' : 'Escolher lead…'} /></SelectTrigger>
              <SelectContent>
                {mode.type === 'contato'
                  ? properties.map(p => <SelectItem key={p.id} value={p.id}>{p.title || p.code || 'Imóvel'}</SelectItem>)
                  : contatos.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { setAdding(false); setSelectedId('') }}>Cancelar</Button>
            <Button size="sm" className="shrink-0" onClick={handleAdd} disabled={saving || !selectedId}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Salvar
            </Button>
          </div>
        )}

        {initial.length === 0 && !adding ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum {mode.type === 'contato' ? 'imóvel de interesse' : 'lead interessado'} ainda.</p>
        ) : (
          <div className="space-y-2">
            {initial.map(it => (
              <div key={it.id} className="flex items-center justify-between gap-2 border-b last:border-0 pb-2 last:pb-0">
                <div className="min-w-0 flex items-center gap-1.5">
                  {mode.type === 'contato' ? <Home className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                  {mode.type === 'contato' ? (
                    <Link href={`/app/${orgSlug}/imoveis/${it.property_id}`} className="text-sm truncate hover:underline">
                      {it.property_title || it.property_code || 'Imóvel'}
                    </Link>
                  ) : (
                    <span className="text-sm truncate">{it.contato_name || 'Contato'}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={busyId === it.id} onClick={() => handleToggleFavorite(it.id, it.is_favorite)}>
                    <Star className={`w-4 h-4 ${it.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={busyId === it.id} onClick={() => handleRemove(it.id)}>
                    {busyId === it.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
