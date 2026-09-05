'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  updateMemberPermissions,
  updateMemberMonthlyGoal,
  setOrgVisibility,
  type TeamMember,
} from '@/actions/team'
import {
  allPermissions,
  defaultMemberPermissions,
  type Permissions,
} from '@/lib/permissions'
import {
  Settings,
  X,
  Eye,
  EyeOff,
  Building2,
} from 'lucide-react'
import { PermissionsGrid } from './TeamClientPermissionsGrid'

// ── Edit permissions dialog (current org) ──────────────────────────────────────

export function EditPermissionsDialog({
  orgSlug,
  member,
  onClose,
  isTravel,
}: {
  orgSlug:  string
  member:   TeamMember
  onClose:  () => void
  isTravel: boolean
}) {
  const router = useRouter()
  const current = member.current_org
  const initialRole = (current?.role === 'admin' ? 'admin' : 'member') as 'admin' | 'member'
  const [role,        setRole]        = useState<'admin' | 'member'>(initialRole)
  const [permissions, setPermissions] = useState<Permissions>(
    initialRole === 'admin' ? allPermissions() : (current?.permissions ?? defaultMemberPermissions())
  )
  const [goalInput, setGoalInput] = useState(
    current?.monthly_goal_cents ? String(current.monthly_goal_cents / 100) : ''
  )
  const [saving, setSaving] = useState(false)

  function handleRoleChange(r: 'admin' | 'member') {
    setRole(r)
    setPermissions(r === 'admin' ? allPermissions() : defaultMemberPermissions())
  }

  async function handleSave() {
    if (!current) {
      toast.error('Membro sem acesso nesta organização.')
      return
    }
    setSaving(true)
    const trimmedGoal = goalInput.trim()
    const goalCents = trimmedGoal ? Math.round(parseFloat(trimmedGoal.replace(',', '.')) * 100) : null
    if (trimmedGoal && (Number.isNaN(goalCents) || (goalCents as number) < 0)) {
      toast.error('Meta mensal inválida.')
      setSaving(false)
      return
    }
    const [permRes, goalRes] = await Promise.all([
      updateMemberPermissions(orgSlug, current.membership_id, permissions, role),
      updateMemberMonthlyGoal(orgSlug, current.membership_id, goalCents),
    ])
    if (permRes.ok && goalRes.ok) {
      toast.success('Permissões atualizadas!')
      router.refresh()
      onClose()
    } else {
      toast.error(permRes.error || goalRes.error)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40  ">
      <div className="bg-card border border-border rounded-none w-full max-w-[520px]   overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Editar permissões (esta organização)</h2>
              <p className="text-xs text-muted-foreground">{member.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
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
          </div>

          <div className="space-y-1.5">
            <Label>Meta mensal individual <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="Deixe em branco pra usar a meta da empresa dividida entre os vendedores"
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Usada no dashboard (aba Equipe). Sem valor aqui, o sistema usa a meta mensal da empresa dividida igualmente entre os vendedores ativos.
            </p>
          </div>

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

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" className="min-w-[120px]" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Visibility matrix (per member) ─────────────────────────────────────────────

export function VisibilityRow({
  orgSlug,
  member,
  canManage,
}: {
  orgSlug:   string
  member:    TeamMember
  canManage: boolean
}) {
  const router = useRouter()
  const [pendingOrg, setPendingOrg] = useState<string | null>(null)
  const isManagerTarget = member.is_owner || member.account_role === 'admin'

  async function toggle(orgId: string, currentlyHidden: boolean) {
    setPendingOrg(orgId)
    const res = await setOrgVisibility(orgSlug, member.user_id, orgId, !currentlyHidden)
    if (res.ok) {
      toast.success(!currentlyHidden ? 'Organização ocultada.' : 'Organização liberada.')
      router.refresh()
    } else {
      toast.error(res.error)
    }
    setPendingOrg(null)
  }

  return (
    <div className="px-5 pb-4 pt-1 bg-muted/20 border-t border-border">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Building2 className="w-3 h-3" /> Visibilidade por organização
      </p>
      {isManagerTarget ? (
        <p className="text-xs text-muted-foreground">
          {member.is_owner ? 'O proprietário' : 'Administradores da conta'} sempre enxergam todas as organizações.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {member.orgs.map(o => {
            const visible = !o.hidden
            return (
              <button
                key={o.org_id}
                type="button"
                disabled={!canManage || pendingOrg === o.org_id}
                onClick={() => toggle(o.org_id, o.hidden)}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  visible
                    ? 'border-primary/40 bg-primary/5 text-foreground'
                    : 'border-border bg-transparent text-muted-foreground'
                } ${canManage ? 'hover:border-primary/30 cursor-pointer' : 'opacity-70 cursor-default'}`}
                title={canManage ? (visible ? 'Clique para ocultar' : 'Clique para liberar') : undefined}
              >
                <span className="truncate">{o.org_name}</span>
                {visible
                  ? <Eye className="w-3.5 h-3.5 text-primary shrink-0" />
                  : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
