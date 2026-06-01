import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import WhatsappConfigForm from '@/components/features/WhatsappConfigForm'
import WhatsappEmbeddedSignup from '@/components/features/WhatsappEmbeddedSignup'
import { CheckCircle2 } from 'lucide-react'

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
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp Cloud API</h1>
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
        <>
          {/* Caminho fácil: 1 clique, sem dados técnicos */}
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="font-semibold text-base">Conexão rápida</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Recomendado. Conecte em um clique, escolhendo o número direto no Facebook.
              </p>
            </div>
            <WhatsappEmbeddedSignup
              orgSlug={params.orgSlug}
              appId={appId!}
              configId={configId!}
              alreadyConnected={alreadyConnected}
            />
          </div>

          {/* Caminho manual escondido como avançado */}
          <details className="bg-muted/30 border rounded-xl">
            <summary className="cursor-pointer px-6 py-4 text-sm font-medium select-none">
              Configuração manual (avançado)
            </summary>
            <div className="px-6 pb-6">
              <WhatsappConfigForm
                orgSlug={params.orgSlug}
                initialData={{
                  phone_id: org.whatsapp_phone_number_id || '',
                  token: org.whatsapp_access_token || '',
                }}
                orgId={org.id}
              />
            </div>
          </details>
        </>
      ) : (
        <>
          <div className="bg-card border rounded-xl p-6 shadow-sm">
            <WhatsappConfigForm
              orgSlug={params.orgSlug}
              initialData={{
                phone_id: org.whatsapp_phone_number_id || '',
                token: org.whatsapp_access_token || '',
              }}
              orgId={org.id}
            />
          </div>

          <div className="bg-muted/30 border rounded-xl p-6 space-y-4 text-sm mt-8">
            <h2 className="font-semibold text-base">Passo a passo para integração</h2>
            <ol className="list-decimal pl-5 space-y-3 mt-4 text-muted-foreground">
              <li>Acesse o <a href="https://developers.facebook.com/" target="_blank" className="text-primary hover:underline font-medium">Meta for Developers</a> e crie um App do tipo &ldquo;Business&rdquo;.</li>
              <li>Adicione o produto &ldquo;WhatsApp&rdquo; ao seu App.</li>
              <li>Copie o <strong>Phone Number ID</strong> e gere um <strong>Access Token</strong> permanente. Coloque-os no formulário acima e salve.</li>
              <li>Na configuração do WhatsApp no Meta, adicione a URL do Webhook informada acima.</li>
              <li>O Verify Token a ser utilizado no momento do Webhook é: <code className="bg-background px-2 py-1 rounded border text-xs font-mono">{process.env.META_WEBHOOK_VERIFY_TOKEN || 'althos_meta_token_verify_2024'}</code></li>
              <li>Inscreva-se nos campos de Webhook: <code className="bg-background px-2 py-1 rounded border text-xs font-mono">messages</code>.</li>
            </ol>
          </div>
        </>
      )}
    </div>
  )
}
