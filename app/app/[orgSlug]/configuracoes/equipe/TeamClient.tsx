'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  inviteTeamMember,
  updateMemberPermissions,
  removeMember,
  cancelInvitation,
  setOrgVisibility,
  type TeamMember,
  type PendingInvitation,
} from '@/actions/team'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  groupedModules,
  allPermissions,
  defaultMemberPermissions,
  type Permissions,
  type PermissionKey,
} from '@/lib/permissions'
import {
  UserPlus,
  Users,
  Mail,
  Trash2,
  Settings,
  Clock,
  Crown,
  X,
  Eye,
  EyeOff,
  Building2,
  ChevronDown,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(' ')
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return (email?.[0] ?? '?').toUpperCase()
}

/** Display role derived from account membership + ownership. */
function displayRole(m: TeamMember): 'owner' | 'admin' | 'member' {
  if (m.is_owner) return 'owner'
  return m.account_role
}

const ROLE_LABEL: Record<string, string> = {
  owner:  'Proprietário',
  admin:  'Admin',
  member: 'Membro',
}

const ROLE_COLOR: Record<string, string> = {
  owner:  'bg-amber-100 text-amber-800 border-amber-200',
  admin:  'bg-blue-100 text-blue-800 border-blue-200',
  member: 'bg-gray-100 text-gray-700 border-gray-200',
}

// ── Permission checkboxes ─────────────────────────────────────────────────────

function PermissionsGrid({
  permissions,
  onChange,
  disabled,
}: {
  permissions: Permissions
  onChange:    (p: Permissions) => void
  disabled?:   boolean
}) {
  const groups = groupedModules()

  function toggle(key: PermissionKey) {
    onChange({ ...permissions, [key]: !permissions[key] })
  }

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([section, modules]) => (
        <div key={section}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {section}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {modules.map(m => (
              <label
                key={m.key}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                  permissions[m.key]
                    ? 'border-primary/40 bg-primary/5 text-foreground'
                    : 'border-border bg-transparent text-muted-foreground'
                } ${disabled ? 'opacity-50 pointer-events-none' : 'hover:border-primary/30'}`}
              >
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={!!permissions[m.key]}
                  onChange={() => toggle(m.key)}
                  disabled={disabled}
                />
                {m.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Invite dialog ─────────────────────────────────────────────────────────────

function InviteDialog({
  orgSlug,
  onClose,
}: {
  orgSlug:  string
  onClose:  () => void
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

// ── Edit permissions dialog (current org) ──────────────────────────────────────

function EditPermissionsDialog({
  orgSlug,
  member,
  onClose,
}: {
  orgSlug:  string
  member:   TeamMember
  onClose:  () => void
}) {
  const router = useRouter()
  const current = member.current_org
  const initialRole = (current?.role === 'admin' ? 'admin' : 'member') as 'admin' | 'member'
  const [role,        setRole]        = useState<'admin' | 'member'>(initialRole)
  const [permissions, setPermissions] = useState<Permissions>(
    initialRole === 'admin' ? allPermissions() : (current?.permissions ?? defaultMemberPermissions())
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
    const res = await updateMemberPermissions(orgSlug, current.membership_id, permissions, role)
    if (res.ok) {
      toast.success('Permissões atualizadas!')
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

          <div className="space-y-2">
            <Label>Permissões de acesso</Label>
            <PermissionsGrid
              permissions={permissions}
              onChange={setPermissions}
              disabled={role === 'admin'}
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

function VisibilityRow({
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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TeamClient({
  orgSlug,
  currentUserId,
  members,
  invitations,
  orgs,
  seatUsed,
  seatLimit,
  currentUserIsManager,
}: {
  orgSlug:              string
  currentUserId:        string
  currentUserRole?:     'owner' | 'admin'
  members:              TeamMember[]
  invitations:          PendingInvitation[]
  orgs:                 { id: string; name: string; slug: string }[]
  seatUsed:             number
  seatLimit:            number
  accountId?:           string | null
  currentUserIsManager: boolean
  org_id?:              string
}) {
  const router = useRouter()
  const [showInvite,  setShowInvite]  = useState(false)
  const [editMember,  setEditMember]  = useState<TeamMember | null>(null)
  const [removingId,  setRemovingId]  = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  const unlimited = seatLimit === -1
  const atLimit   = !unlimited && seatUsed >= seatLimit
  const multiOrg  = orgs.length > 1

  async function handleRemove(member: TeamMember) {
    setRemovingId(member.user_id)
    const res = await removeMember(orgSlug, member.user_id)
    if (res.ok) {
      toast.success('Membro removido da conta.')
      router.refresh()
    } else {
      toast.error(res.error)
    }
    setRemovingId(null)
  }

  async function handleCancelInvite(inv: PendingInvitation) {
    setCancelingId(inv.id)
    const res = await cancelInvitation(orgSlug, inv.id)
    if (res.ok) {
      toast.success('Convite cancelado.')
      router.refresh()
    } else {
      toast.error(res.error)
    }
    setCancelingId(null)
  }

  return (
    <>
      {showInvite && (
        <InviteDialog orgSlug={orgSlug} onClose={() => setShowInvite(false)} />
      )}
      {editMember && (
        <EditPermissionsDialog
          orgSlug={orgSlug}
          member={editMember}
          onClose={() => setEditMember(null)}
        />
      )}

      <div className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Equipe</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Usuários da conta. Cada usuário existe em todas as organizações; controle a visibilidade individualmente.
            </p>
          </div>
          {currentUserIsManager && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setShowInvite(true)}
              disabled={atLimit}
              title={atLimit ? `Limite de ${seatLimit} usuários atingido` : undefined}
            >
              <UserPlus className="w-4 h-4" />
              Convidar
            </Button>
          )}
        </div>

        {/* Plan usage */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-none bg-muted/50 border border-border text-sm">
          <Users className="w-4 h-4 text-muted-foreground shrink-0" />
          <span>
            {unlimited ? (
              <><strong>{seatUsed}</strong> usuário(s) — vagas <strong>ilimitadas</strong></>
            ) : (
              <><strong>{seatUsed}</strong> de <strong>{seatLimit}</strong> vagas utilizadas</>
            )}
          </span>
          {atLimit && (
            <Badge variant="outline" className="ml-auto text-[10px] text-amber-700 border-amber-300 bg-amber-50">
              Limite atingido
            </Badge>
          )}
        </div>

        {/* Members */}
        <div className="bg-card border border-border rounded-none overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <h2 className="font-semibold text-sm">Usuários da conta ({members.length})</h2>
          </div>

          <div className="divide-y divide-border">
            {members.map(m => {
              const isMe   = m.user_id === currentUserId
              const role   = displayRole(m)
              const isOwner = m.is_owner
              const expanded = expandedUser === m.user_id
              const visibleCount = m.orgs.filter(o => !o.hidden).length
              return (
                <div key={m.user_id}>
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {initials(m.name, m.email)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{m.name || m.email}</p>
                        {isMe && <span className="text-[10px] text-muted-foreground">(você)</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{m.name ? m.email : ''}</p>
                    </div>

                    {/* Visibility summary (multi-org only) */}
                    {multiOrg && !isOwner && role !== 'admin' && (
                      <span className="hidden sm:inline text-[11px] text-muted-foreground shrink-0">
                        {visibleCount}/{m.orgs.length} orgs
                      </span>
                    )}

                    {/* Role badge */}
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${ROLE_COLOR[role]}`}
                    >
                      {isOwner && <Crown className="w-2.5 h-2.5 mr-1" />}
                      {ROLE_LABEL[role] ?? role}
                    </Badge>

                    {/* Actions */}
                    {currentUserIsManager && (
                      <div className="flex items-center gap-1 shrink-0">
                        {multiOrg && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setExpandedUser(expanded ? null : m.user_id)}
                            title="Visibilidade por organização"
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                          </Button>
                        )}
                        {m.current_org && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditMember(m)}
                            title="Editar permissões (esta organização)"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {!isMe && !isOwner && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setMemberToRemove(m)}
                            disabled={removingId === m.user_id}
                            title="Remover da conta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {multiOrg && expanded && (
                    <VisibilityRow orgSlug={orgSlug} member={m} canManage={currentUserIsManager} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Pending invitations */}
        {invitations.length > 0 && (
          <div className="bg-card border border-border rounded-none overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <h2 className="font-semibold text-sm">Convites pendentes ({invitations.length})</h2>
            </div>

            <div className="divide-y divide-border">
              {invitations.map(inv => (
                <div key={inv.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Expira {new Date(inv.expires_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  <Badge variant="outline" className={`text-[10px] shrink-0 ${ROLE_COLOR[inv.role]}`}>
                    {ROLE_LABEL[inv.role] ?? inv.role}
                  </Badge>

                  {currentUserIsManager && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => handleCancelInvite(inv)}
                      disabled={cancelingId === inv.id}
                      title="Cancelar convite"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <AlertDialog open={!!memberToRemove} onOpenChange={o => !o && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário da conta?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove ? `Remover ${memberToRemove.name || memberToRemove.email} de toda a conta? Ele perderá acesso a todas as organizações. ` : ''}Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleRemove(memberToRemove!); setMemberToRemove(null) }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
