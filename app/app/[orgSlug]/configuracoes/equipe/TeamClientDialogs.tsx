'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { inviteTeamMember } from '@/actions/team'
import {
  allPermissions,
  defaultMemberPermissions,
  type Permissions,
} from '@/lib/permissions'
import { UserPlus, X } from 'lucide-react'
import { PermissionsGrid } from './TeamClientPermissionsGrid'

export { PermissionsGrid } from './TeamClientPermissionsGrid'
export { EditPermissionsDialog, VisibilityRow } from './TeamClientMemberDialogs'

// ── Invite dialog ─────────────────────────────────────────────────────────────

export function InviteDialog({
  orgSlug,
  onClose,
  isTravel,
}: {
  orgSlug:  string
  onClose:  () => void
  isTravel: boolean
}) {
  const router = useRouter()
  const [email,       setEmail]       = useState('')
  const [role,        setRole]        = useState<'admin' | 'member'>('member')
  const [permissions, setPermissions] = useState<Permissions>(defaultMemberPermissions())
  const [saving,      setSaving]      = useState(false)

  function handleRoleChange(r: 'admin' | 'member') {
    setRole(r)
    setPermissions(r === 'admin' ? allPermissions() : defaultMemberPermissions())
  }

  async function handleSubmit() {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Informe um e-mail válido.')
      return
    }
    setSaving(true)
    const res = await inviteTeamMember(orgSlug, email, role, permissions)
    if (res.ok) {
      toast.success('Convite enviado!')
      router.refresh()
      onClose()
    } else {
      toast.error(res.error)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40  ">
      <div className="bg-card border border-border rounded-none w-full max-w-[520px]   overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-primary" />
            </div>
            <h2 className="font-semibold">Convidar membro</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Email */}
          <div className="space-y-1.5">
            <Label>E-mail do convidado</Label>
            <Input
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="h-10"
              autoFocus
            />
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label>Função</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['member', 'admin'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleChange(r)}
                  className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    role === r
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  {r === 'admin' ? 'Admin' : 'Membro'}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {role === 'admin'
                ? 'Admins têm acesso completo e podem gerenciar a equipe e todas as organizações.'
                : 'Membros têm acesso limitado conforme as permissões abaixo.'}
            </p>
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <Label>Permissões de acesso</Label>
            <PermissionsGrid
              permissions={permissions}
              onChange={setPermissions}
              disabled={role === 'admin'}
              isTravel={isTravel}
            />
            {role === 'admin' && (
              <p className="text-xs text-muted-foreground">Admins têm acesso a todos os módulos.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" className="min-w-[140px]" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Enviando…' : 'Enviar convite'}
          </Button>
        </div>
      </div>
    </div>
  )
}
