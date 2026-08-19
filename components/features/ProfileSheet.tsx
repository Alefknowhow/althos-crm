'use client'

import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Loader2 } from 'lucide-react'
import { getUserProfile, type UserProfile } from '@/actions/profile'
import ProfileClient from '@/app/app/[orgSlug]/perfil/ProfileClient'

/** "Meu perfil" abre como aba lateral (Sheet), não navega pra uma tela
 *  cheia — reaproveita o mesmo ProfileClient da rota /perfil (que
 *  continua existindo como deep link direto, ex. compartilhado por
 *  URL), só troca o container. Busca o perfil sob demanda na abertura
 *  em vez de no layout, pra não pagar esse fetch em toda navegação. */
export default function ProfileSheet({
  orgSlug, open, onOpenChange,
}: { orgSlug: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getUserProfile(orgSlug).then(p => { setProfile(p); setLoading(false) })
  }, [open, orgSlug])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg w-full overflow-y-auto p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Meu perfil</SheetTitle>
        </SheetHeader>
        {loading || !profile ? (
          <div className="flex items-center justify-center h-full py-24">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ProfileClient profile={profile} orgSlug={orgSlug} />
        )}
      </SheetContent>
    </Sheet>
  )
}
