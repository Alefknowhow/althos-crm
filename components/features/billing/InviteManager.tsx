'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createInvite, revokeInvite } from '@/actions/invites'
import { toast } from 'sonner'
import { Copy, Trash2, Plus, CheckCircle2, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const PLAN_OPTIONS = [
  { value: 'agency',  label: 'Agency (cliente agência)' },
  { value: 'pro',     label: 'Pro' },
  { value: 'starter', label: 'Starter' },
]

export default function InviteManager({ initialInvites }: { initialInvites: any[] }) {
  const [invites, setInvites]     = useState<any[]>(initialInvites)
  const [plan, setPlan]           = useState('agency')
  const [email, setEmail]         = useState('')
  const [expiryDays, setExpiryDays] = useState('')
  const [creating, setCreating]   = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [revokeId, setRevokeId]   = useState<string | null>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  async function handleCreate() {
    setCreating(true)
    const res = await createInvite({
      plan,
      email:          email.trim() || undefined,
      expiresInDays:  expiryDays ? Number(expiryDays) : undefined,
    })
    setCreating(false)

    if (!res.ok) {
      toast.error(res.error)
      return
    }

    toast.success('Convite criado!')
    setInvites(prev => [res.invite, ...prev])
    setEmail('')
    setExpiryDays('')
    setShowForm(false)
  }

  async function handleRevoke(id: string) {
    const res = await revokeInvite(id)
    if (res.ok) {
      setInvites(prev => prev.filter(i => i.id !== id))
      toast.success('Convite revogado')
    } else {
      toast.error(res.error)
    }
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${origin}/invite/${token}`)
    toast.success('Link copiado!')
  }

  return (
    <div className="space-y-4">
      {/* Create form */}
      {showForm ? (
        <div className="rounded-xl border p-4 space-y-4 bg-card">
          <h3 className="font-semibold text-sm">Novo convite</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Plano</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input px-3 text-sm bg-background"
                value={plan}
                onChange={e => setPlan(e.target.value)}
              >
                {PLAN_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Expira em (dias, opcional)</Label>
              <Input
                type="number"
                placeholder="ex: 30"
                value={expiryDays}
                onChange={e => setExpiryDays(e.target.value)}
                min={1}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Restringir a e-mail (opcional)</Label>
            <Input
              type="email"
              placeholder="cliente@empresa.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={creating} size="sm">
              {creating ? 'Criando...' : 'Gerar convite'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> Novo convite
        </Button>
      )}

      {/* List */}
      {invites.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum convite criado ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {invites.map(inv => {
            const used      = !!inv.used_at
            const expired   = inv.expires_at && new Date(inv.expires_at) < new Date() && !used
            const inviteUrl = `${origin}/invite/${inv.token}`

            return (
              <div
                key={inv.id}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                  used ? 'opacity-50' : expired ? 'border-destructive/50' : ''
                }`}
              >
                {/* Status icon */}
                {used ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : expired ? (
                  <Clock className="w-4 h-4 text-destructive shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500 shrink-0" />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wide bg-muted px-2 py-0.5 rounded-full">
                      {inv.plan}
                    </span>
                    {inv.email && (
                      <span className="text-xs text-muted-foreground truncate">→ {inv.email}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {used
                      ? `Usado ${formatDistanceToNow(new Date(inv.used_at), { locale: ptBR, addSuffix: true })}`
                      : expired
                        ? 'Expirado'
                        : inv.expires_at
                          ? `Expira ${formatDistanceToNow(new Date(inv.expires_at), { locale: ptBR, addSuffix: true })}`
                          : `Criado ${formatDistanceToNow(new Date(inv.created_at), { locale: ptBR, addSuffix: true })}`
                    }
                  </p>
                </div>

                {/* Actions */}
                {!used && !expired && (
                  <button
                    onClick={() => copyLink(inv.token)}
                    title="Copiar link"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
                {!used && (
                  <button
                    onClick={() => setRevokeId(inv.id)}
                    title="Revogar"
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AlertDialog open={!!revokeId} onOpenChange={o => !o && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar convite?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleRevoke(revokeId!); setRevokeId(null) }}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
