import { getCurrentOrganization } from '@/lib/supabase/types'
import WhatsappEmbeddedSignup from '@/components/features/WhatsappEmbeddedSignup'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

export default async function WhatsappConfigPage({ params }: { params: { orgSlug: string } }) {
  const org = await getCurrentOrganization(params.orgSlug)

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

      {alreadyConnected && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            WhatsApp conectado
            {org.whatsapp_phone_number_id ? ` (número ${org.whatsapp_phone_number_id})` : ''}.
          </span>
        </div>
      )}

      {embeddedConfigured ? (
        <div className="bg-card border rounded-none p-6 space-y-4">
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
