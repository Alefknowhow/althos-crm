'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { saveWhatsappConfig, testWhatsappConnection } from '@/actions/whatsapp'
import { traduzirErro } from '@/lib/utils/error-translator'

export default function WhatsappConfigForm({
  orgSlug,
  initialData,
  orgId,
}: {
  orgSlug: string
  initialData: any
  orgId: string
}) {
  const router = useRouter()
  const [loading, setLoading]   = useState(false)
  const [testing, setTesting]   = useState(false)
  const [copied,  setCopied]    = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const res = await saveWhatsappConfig(
      orgSlug,
      formData.get('phone_id') as string,
      formData.get('token') as string,
    )
    setLoading(false)
    if (res.ok) {
      toast.success('Credenciais salvas com sucesso!')
      router.refresh()
    } else {
      toast.error(traduzirErro(res.error, 'Erro ao salvar credenciais'))
    }
  }

  async function handleTest() {
    setTesting(true)
    const res = await testWhatsappConnection(orgSlug)
    setTesting(false)
    if (res.ok) {
      toast.success('Conexão estabelecida com sucesso! ✅')
    } else {
      toast.error(traduzirErro(res.error, 'Erro na conexão com o WhatsApp'))
    }
  }

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhooks/whatsapp/${orgId}`
      : `https://[seu-dominio]/api/webhooks/whatsapp/${orgId}`

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    toast.success('URL copiada!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Phone Number ID</Label>
          <Input
            name="phone_id"
            defaultValue={initialData.phone_id}
            placeholder="Ex: 104593459345"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Access Token (Permanente)</Label>
          <Input
            name="token"
            type="password"
            defaultValue={initialData.token}
            placeholder="EAAL..."
            required
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Gere um token permanente criando um Usuário de Sistema nas Configurações do
            Negócio da Meta.
          </p>
        </div>
      </div>

      <div className="space-y-2 pt-4">
        <Label>URL do Webhook</Label>
        <p className="text-xs text-muted-foreground">
          Configure este endereço no painel da Meta para receber mensagens.
        </p>
        <div className="flex gap-2 items-center">
          <Input
            readOnly
            value={webhookUrl}
            className="bg-muted font-mono text-xs cursor-text"
          />
          <Button type="button" variant="outline" size="sm" onClick={copyWebhook}>
            {copied ? 'Copiado!' : 'Copiar'}
          </Button>
        </div>
      </div>

      <div className="flex gap-3 pt-6 border-t">
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar credenciais'}
        </Button>
        <Button type="button" variant="secondary" onClick={handleTest} disabled={testing}>
          {testing ? 'Testando...' : 'Testar conexão'}
        </Button>
      </div>
    </form>
  )
}
