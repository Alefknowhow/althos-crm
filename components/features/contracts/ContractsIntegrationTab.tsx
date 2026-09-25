'use client'

import Link from 'next/link'
import { CheckCircle2, XCircle, ExternalLink, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const EVENT_LABEL: Record<string, string> = {
  'contract.created': 'Contrato criado',
  'contract.generated': 'Documento gerado',
  'contract.sent': 'Enviado para assinatura',
  'contract.signed': 'Assinado (via webhook)',
  'contract.cancelled': 'Cancelado',
}

type RecentEvent = { id: string; type: string; created_at: string; contracts: { id: string; title: string } | null }

/** Painel de status da integração Autentique — a chave de API em si é
 *  configurada em Configurações → Autentique (compartilhada com Reservas/
 *  Tráfego, uma credencial por org, não um dado de contrato). Aqui só
 *  mostramos status, a URL do webhook e a atividade recente do módulo
 *  global de Contratos, pra não duplicar a gestão da chave em dois lugares. */
export default function ContractsIntegrationTab({
  orgSlug, hasApiKey, webhookUrl, recentEvents,
}: {
  orgSlug: string
  hasApiKey: boolean
  webhookUrl: string
  recentEvents: RecentEvent[]
}) {
  async function copyWebhookUrl() {
    await navigator.clipboard.writeText(webhookUrl)
    toast.success('URL do webhook copiada')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Autentique — assinatura digital</h3>
            <p className="text-xs text-muted-foreground">Chave de API compartilhada por toda a organização (Reservas, Tráfego e Contratos).</p>
          </div>
          {hasApiKey ? (
            <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Conectado</Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-destructive border-destructive"><XCircle className="w-3.5 h-3.5" /> Não configurado</Badge>
          )}
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/app/${orgSlug}/configuracoes/autentique`}>
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> {hasApiKey ? 'Gerenciar chave' : 'Configurar chave de API'}
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <h3 className="text-sm font-semibold">Webhook</h3>
        <p className="text-xs text-muted-foreground">
          Cadastre esta URL no painel da Autentique pra receber atualização automática de status (assinado, recusado) sem precisar clicar em &quot;Verificar status&quot; manualmente.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate rounded-md bg-muted px-2.5 py-1.5 text-xs">{webhookUrl}</code>
          <Button type="button" size="sm" variant="outline" onClick={copyWebhookUrl}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <h3 className="text-sm font-semibold">Atividade recente</h3>
        {recentEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum evento registrado ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {recentEvents.map(e => (
              <div key={e.id} className="flex items-center justify-between text-xs">
                <span className="truncate">
                  <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString('pt-BR')}</span>
                  {' — '}{EVENT_LABEL[e.type] || e.type}
                  {e.contracts && <span className="text-muted-foreground"> · {e.contracts.title}</span>}
                </span>
                {e.contracts && (
                  <Link href={`/app/${orgSlug}/contratos/${e.contracts.id}`} className="text-primary hover:underline shrink-0 ml-2">Ver</Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
