'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Plus, History, ArrowLeft, FileText, MessageCircle } from 'lucide-react'
import { createAutomation } from '@/actions/automations'
import { toast } from 'sonner'
import CreateAutomationWithAiDialog from './CreateAutomationWithAiDialog'

/**
 * Casca do módulo Automações — só a barra superior (Templates/Histórico/
 * Criar com IA/Nova Automação) + o conteúdo da rota atual. A lista de
 * automações deixou de ser uma sidebar estreita sempre visível e virou o
 * conteúdo da rota-índice (/automacoes → AutomationsListGrid, grid de
 * cards); a rota /automacoes/[id] mostra o canvas em tela cheia — mesmo
 * padrão lista-ou-detalhe (nunca os dois split) já adotado em Formulários.
 */
export default function AutomationsShell({
  orgSlug,
  children,
}: {
  orgSlug: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleNew() {
    startTransition(async () => {
      try {
        const auto = await createAutomation(orgSlug, {
          name: 'Nova Automação',
          trigger_type: 'form.submitted',
          trigger_config: {},
          steps: [],
        })
        if (auto?.id) router.push(`/app/${orgSlug}/automacoes/${auto.id}`)
        else toast.error('Não foi possível criar a automação')
      } catch (e: any) {
        toast.error(e?.message || 'Erro ao criar automação')
      }
    })
  }

  const isDetail = pathname !== `/app/${orgSlug}/automacoes`

  return (
    <div className="-mx-6 mt-2 -mb-8 flex flex-col" style={{ minHeight: 'calc(100vh - 56px)' }}>
      <div className="px-4 py-3 border-b bg-background flex items-center gap-2 shrink-0">
        {isDetail && (
          <Button asChild variant="ghost" size="icon" className="shrink-0 -ml-2">
            <Link href={`/app/${orgSlug}/automacoes`} aria-label="Voltar para a lista">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
        )}
        {/* Some na tela de detalhe — só fazem sentido na lista. */}
        <div className={cn('flex items-center gap-2 shrink-0 ml-auto', isDetail && 'hidden')}>
          <Button asChild variant="outline" size="icon" className="rounded-md shrink-0" title="Templates de e-mail">
            <Link href={`/app/${orgSlug}/email-templates`} aria-label="Templates de e-mail">
              <FileText className="w-4 h-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" className="rounded-md shrink-0" title="Templates de WhatsApp">
            <Link href={`/app/${orgSlug}/whatsapp-templates`} aria-label="Templates de WhatsApp">
              <MessageCircle className="w-4 h-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/${orgSlug}/automacoes/logs`}>
              <History className="w-4 h-4 mr-1.5" />
              Histórico
            </Link>
          </Button>
          <CreateAutomationWithAiDialog orgSlug={orgSlug} />
          <Button onClick={handleNew} disabled={pending} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            {pending ? 'Criando...' : 'Nova Automação'}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-auto bg-muted/20">
        {children}
      </div>
    </div>
  )
}
