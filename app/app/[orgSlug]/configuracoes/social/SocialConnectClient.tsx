'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deleteSocialConnection, type SocialConnection } from '@/actions/social-automations'
import { toast } from 'sonner'
import { AtSign, Plus, Trash2, Check, AlertTriangle } from 'lucide-react'

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: 'A integração ainda não foi configurada no servidor (faltam as credenciais do App Meta).',
  no_instagram: 'Nenhuma conta do Instagram profissional vinculada às suas Páginas do Facebook foi encontrada.',
  oauth: 'Você cancelou ou negou a autorização no Facebook.',
  missing_code: 'O Facebook não retornou o código de autorização. Tente novamente.',
  org_not_found: 'Organização não encontrada.',
  exchange: 'Falha ao trocar o código por um token de acesso.',
  invalid_state: 'Sessão de conexão expirada. Tente novamente.',
}

export default function SocialConnectClient({
  orgSlug,
  connections,
  configured,
  flash,
}: {
  orgSlug: string
  connections: SocialConnection[]
  configured: boolean
  flash: { connected?: string; error?: string; msg?: string }
}) {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Surface the OAuth round-trip result once, then clean the URL.
  useEffect(() => {
    if (flash.connected) {
      toast.success('Instagram conectado com sucesso!')
      router.replace(`/app/${orgSlug}/configuracoes/social`)
    } else if (flash.error) {
      toast.error(ERROR_MESSAGES[flash.error] || flash.msg || 'Erro ao conectar')
      router.replace(`/app/${orgSlug}/configuracoes/social`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash.connected, flash.error])

  function handleConnect() {
    window.location.href = `/api/social/instagram/connect?org=${encodeURIComponent(orgSlug)}`
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSocialConnection(orgSlug, id)
        toast.success('Conta desconectada')
        router.refresh()
      } catch (e: any) {
        toast.error(e.message || 'Erro ao desconectar')
      } finally {
        setDeleteId(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Connected accounts */}
      <div className="rounded-none border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Contas conectadas</h2>
          <Button size="sm" onClick={handleConnect}>
            <Plus className="w-4 h-4 mr-1.5" /> Conectar Instagram
          </Button>
        </div>

        {connections.length === 0 ? (
          <div className="flex flex-col items-center text-center py-8 px-4 rounded-lg border border-dashed">
            <div
              className="w-12 h-12 rounded-none grid place-items-center text-white mb-3"
              style={{ background: 'linear-gradient(135deg, #f09433, #dc2743 50%, #bc1888)' }}
            >
              <AtSign className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium">Nenhuma conta conectada</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Conecte uma conta profissional do Instagram (Business/Creator) vinculada a uma Página do Facebook.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {connections.map(conn => (
              <div key={conn.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div
                  className="w-9 h-9 rounded-lg grid place-items-center text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg, #f09433, #dc2743 50%, #bc1888)' }}
                >
                  <AtSign className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {conn.username ? `@${conn.username}` : conn.page_name || 'Conta Instagram'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{conn.page_name}</p>
                </div>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                  <Check className="w-3 h-3 mr-1" /> Ativo
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => setDeleteId(conn.id)}
                  disabled={pending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Server-not-configured warning */}
      {!configured && (
        <div className="rounded-none border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Integração ainda não configurada no servidor</p>
            <p className="mt-1 text-amber-700">
              As variáveis <code className="text-xs bg-amber-100 px-1 rounded">META_APP_ID</code> e{' '}
              <code className="text-xs bg-amber-100 px-1 rounded">META_APP_SECRET</code> precisam ser definidas
              no ambiente (Vercel) para o botão de conexão funcionar.
            </p>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar conta?</AlertDialogTitle>
            <AlertDialogDescription>
              As automações pararão de responder por esta conta. Você pode reconectar a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => handleDelete(deleteId!)}
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
