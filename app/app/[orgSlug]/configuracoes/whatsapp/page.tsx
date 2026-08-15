import { getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import WhatsappEmbeddedSignup from '@/components/features/WhatsappEmbeddedSignup'
import { CheckCircle2, AlertTriangle, Sparkles, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default async function WhatsappConfigPage({ params }: { params: { orgSlug: string } }) {
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()
  const { data: attendantConfig } = await supabase
    .from('ai_attendant_config')
    .select('is_enabled')
    .eq('organization_id', org.id)
    .maybeSingle()
  const aiEnabled = attendantConfig?.is_enabled ?? false

  const appId = process.env.NEXT_PUBLIC_META_APP_ID
  const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID
  const embeddedConfigured = !!(appId && configId)

  const alreadyConnected =
    !!org.whatsapp_phone_number_id &&
    !!org.whatsapp_access_token &&
    org.whatsapp_access_token !== 'mock'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp</h1>
        <p className="text-muted-foreground mt-2">
          Conecte sua conta do WhatsApp Business para enviar e receber mensagens diretamente do CRM.
        </p>
      </div>

      <div
        className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
          alreadyConnected
            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
            : 'border-muted bg-muted/30 text-muted-foreground'
        }`}
      >
        {alreadyConnected ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
        <span>
          {alreadyConnected
            ? `WhatsApp conectado — ${(org as any).whatsapp_display_phone || `número ${org.whatsapp_phone_number_id}`}`
            : 'Nenhum número de WhatsApp conectado no momento.'}
        </span>
      </div>

      <Link
        href={`/app/${params.orgSlug}/configuracoes/agente-ia`}
        className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm hover:bg-muted/40 transition-colors"
      >
        <Sparkles className="w-4 h-4 shrink-0 text-primary" />
        <span className="flex-1">
          Agente IA — <span className={aiEnabled ? 'text-emerald-600 font-medium' : 'text-muted-foreground font-medium'}>{aiEnabled ? '● Ativa' : '● Pausada'}</span>
        </span>
        <span className="text-muted-foreground">Configurar IA</span>
        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
      </Link>

      {embeddedConfigured ? (
        <div className="bg-card border rounded-none p-4 sm:p-6 space-y-4 min-w-0">
          <div>
            <h2 className="font-semibold text-base">Conexão pelo Facebook</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Conecte em um clique, escolhendo o número direto no Facebook — sem copiar tokens ou IDs.
            </p>
          </div>
          <WhatsappEmbeddedSignup
            orgSlug={params.orgSlug}
            appId={appId!}
            configId={configId!}
            alreadyConnected={alreadyConnected}
          />
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            A conexão pelo Facebook não está configurada neste ambiente. Fale com o suporte para
            liberar essa integração na sua conta.
          </span>
        </div>
      )}
    </div>
  )
}
