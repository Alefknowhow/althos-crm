'use client'

/**
 * "Configurar agente de IA" aberto de dentro de Conversas — pop-up (Dialog)
 * em vez de navegar pra uma tela cheia separada, pedido explícito do
 * usuário. Carrega os dados sob demanda (só quando o dialog abre) chamando
 * as mesmas server actions que a página /configuracoes/agente-ia usa, e
 * reaproveita o <AgenteIaTabs> — sem duplicar a lógica de configuração.
 */

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import {
  getAttendantConfig, listKnowledge, listSandboxSessions, listSandboxMessages,
  createSandboxSession, checkPlatformAiKeyConfigured,
} from '@/actions/ai_attendant'
import { getOrgAIConfig } from '@/actions/organization'
import AgenteIaTabs from '@/components/features/ai/AgenteIaTabs'

export default function ConfigurarAgenteIaDialog({
  orgSlug, open, onOpenChange,
}: {
  orgSlug: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setData(null);
    (async () => {
      const [config, knowledge, sessions, qualifier, hasApiKey] = await Promise.all([
        getAttendantConfig(orgSlug),
        listKnowledge(orgSlug),
        listSandboxSessions(orgSlug),
        getOrgAIConfig(orgSlug),
        checkPlatformAiKeyConfigured(),
      ])
      let activeSessionId = sessions[0]?.id
      if (!activeSessionId) {
        const created = await createSandboxSession(orgSlug)
        if (created.ok) activeSessionId = created.sessionId
      }
      const initialMessages = activeSessionId ? await listSandboxMessages(orgSlug, activeSessionId) : []
      setData({ config, knowledge, sessions, qualifier, hasApiKey, activeSessionId, initialMessages })
      setLoading(false)
    })()
  }, [open, orgSlug])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="flex items-center justify-between gap-3 pr-6">
            <span>Configurar agente de IA</span>
            <Link
              href={`/app/${orgSlug}/configuracoes/agente-ia`}
              className="text-xs font-normal text-muted-foreground hover:text-foreground underline underline-offset-2 shrink-0"
            >
              Abrir em tela cheia
            </Link>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
          {loading || !data ? (
            <div className="h-full grid place-items-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <AgenteIaTabs
              orgSlug={orgSlug}
              initial={data.config}
              knowledge={data.knowledge}
              qualifier={data.qualifier}
              sandbox={{
                hasApiKey: data.hasApiKey,
                sessions: data.sessions,
                activeSessionId: data.activeSessionId || '',
                initialMessages: data.initialMessages,
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
