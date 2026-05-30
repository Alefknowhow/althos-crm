'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2 } from 'lucide-react'
import { deleteAdAccount } from '@/actions/marketing'
import NewAdAccountDialog from './NewAdAccountDialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type Account = {
  id: string
  provider: string
  name: string
  external_id: string | null
  status: string
  notes: string | null
}

const PROVIDER_LABEL: Record<string, string> = {
  meta: 'Meta',
  google: 'Google',
  tiktok: 'TikTok',
  other: 'Outro',
}

const PROVIDER_COLOR: Record<string, string> = {
  meta: 'bg-blue-100 text-blue-700 border-blue-200',
  google: 'bg-amber-100 text-amber-700 border-amber-200',
  tiktok: 'bg-pink-100 text-pink-700 border-pink-200',
  other: 'bg-muted text-muted-foreground',
}

export default function AdAccountsManager({
  orgSlug,
  initial,
}: {
  orgSlug: string
  initial: Account[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null)

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function remove(a: Account) {
    setBusy(a.id)
    const res = await deleteAdAccount(orgSlug, a.id)
    setBusy(null)
    if (res.ok) {
      toast.success('Conta removida')
      refresh()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NewAdAccountDialog
          orgSlug={orgSlug}
          onDone={refresh}
          trigger={<Button>+ Nova conta</Button>}
        />
      </div>

      {initial.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma conta cadastrada. Crie a primeira para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {initial.map(a => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{a.name}</CardTitle>
                    <Badge className={PROVIDER_COLOR[a.provider]}>
                      {PROVIDER_LABEL[a.provider] || a.provider}
                    </Badge>
                  </div>
                  {a.external_id && (
                    <p className="text-xs text-muted-foreground font-mono">{a.external_id}</p>
                  )}
                  {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setAccountToDelete(a)}
                  disabled={busy === a.id}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!accountToDelete} onOpenChange={o => !o && setAccountToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              {accountToDelete ? `Excluir "${accountToDelete.name}"? ` : ''}Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { remove(accountToDelete!); setAccountToDelete(null) }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
