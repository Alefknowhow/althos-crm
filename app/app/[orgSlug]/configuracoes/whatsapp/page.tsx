import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import WhatsappConfigForm from '@/components/features/WhatsappConfigForm'

export default async function WhatsappConfigPage({ params }: { params: { orgSlug: string } }) {
  const org = await getCurrentOrganization(params.orgSlug)
  
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp Cloud API</h1>
        <p className="text-muted-foreground mt-2">Conecte sua conta do WhatsApp Business usando a Meta Cloud API para enviar e receber mensagens diretamente do CRM.</p>
      </div>

      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <WhatsappConfigForm orgSlug={params.orgSlug} initialData={{
          phone_id: org.whatsapp_phone_number_id || '',
          token: org.whatsapp_access_token || ''
        }} orgId={org.id} />
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
    </div>
  )
}
