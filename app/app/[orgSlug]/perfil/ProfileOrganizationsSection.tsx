'use client'

/**
 * "Minhas organizações" section for ProfileClient: org list + the
 * delete-organization confirmation dialog. Owns its own delete state.
 * Split out of ProfileClient.tsx.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building2, ExternalLink, Trash2 } from 'lucide-react'
import { deleteOrganization } from '@/actions/organization'
import { type UserProfile } from '@/actions/profile'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Section } from './ProfileSection'

const ROLE_LABEL: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Admin',
  member: 'Membro',
}

export function ProfileOrganizationsSection({
  profile, orgSlug,
}: {
  profile: UserProfile
  orgSlug: string
}) {
  const router = useRouter()
  const [orgToDelete, setOrgToDelete] = useState<{ slug: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const canDeleteOrgs = profile.memberships.filter(m => m.organizations).length > 1

  async function handleDeleteOrg() {
    if (!orgToDelete) return
    setDeleting(true)
    const res = await deleteOrganization(orgToDelete.slug)
    setDeleting(false)
    if (res.ok) {
      toast.success('Organização excluída.')
      const deletedActive = orgToDelete.slug === orgSlug
      setOrgToDelete(null)
      if (deletedActive && res.nextSlug) {
        window.location.href = `/app/${res.nextSlug}/pipeline`
      } else {
        router.refresh()
      }
    } else {
      toast.error(res.error)
    }
  }

  return (
    <>
      <Section icon={Building2} title="Minhas organizações">
        <div className="space-y-2">
          {profile.memberships.map((m, i) => {
            const org = m.organizations
            if (!org) return null
            const isActive = org.slug === orgSlug
            return (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isActive
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-muted/30'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{org.name}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABEL[m.role] ?? m.role}</p>
                </div>
                {isActive && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">atual</Badge>
                )}
                {!isActive && (
                  <Link href={`/app/${org.slug}/pipeline`}>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                      Abrir <ExternalLink className="w-3 h-3" />
                    </Button>
                  </Link>
                )}
                {canDeleteOrgs && ['owner', 'admin'].includes(m.role) && (
                  <button
                    type="button"
                    title="Excluir organização"
                    onClick={() => setOrgToDelete({ slug: org.slug, name: org.name })}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      <AlertDialog open={!!orgToDelete} onOpenChange={op => !op && setOrgToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir organização?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir <strong>{orgToDelete?.name}</strong>. Esta ação é
              permanente e remove todos os leads, pipelines, formulários e demais dados dessa
              organização. Não há como desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault()
                handleDeleteOrg()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo…' : 'Excluir permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
