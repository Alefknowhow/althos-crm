'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  removeMember,
  cancelInvitation,
  type TeamMember,
  type PendingInvitation,
} from '@/actions/team'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { isTravelNiche } from '@/lib/niche'
import {
  UserPlus,
  Users,
  Mail,
  Trash2,
  Settings,
  Clock,
  Crown,
  X,
  ChevronDown,
} from 'lucide-react'
import { InviteDialog, EditPermissionsDialog, VisibilityRow } from './TeamClientDialogs'

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
  niche,
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
  niche?:               string | null
}) {
  const router = useRouter()
  const isTravel = isTravelNiche(niche)
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
        <InviteDialog orgSlug={orgSlug} onClose={() => setShowInvite(false)} isTravel={isTravel} />
      )}
      {editMember && (
        <EditPermissionsDialog
          orgSlug={orgSlug}
          member={editMember}
          onClose={() => setEditMember(null)}
          isTravel={isTravel}
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
