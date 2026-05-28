'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { saveWhatsappConfig, testWhatsappConnection } from '@/actions/whatsapp'

export default function WhatsappConfigForm({ orgSlug, initialData, orgId }: { orgSlug: string, initialData: any, orgId: string }) {
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const res = await saveWhatsappConfig(orgSlug, formData.get('phone_id') as string, formData.get('token') as string)
    setLoading(false)
    if (res.ok) alert('Configurações salvas!')
    else alert('Erro: ' + res.error)
  }

  async function handleTest() {
    setTesting(true)
    const res = await testWhatsappConnection(orgSlug)
    setTesting(false)
    if (res.ok) alert('Conexão estabelecida com sucesso!')
    else alert('Erro na conexão: ' + res.error)
  }

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/whatsapp/${orgId}` : `https://[seu-dominio]/api/webhooks/whatsapp/${orgId}`

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Phone Number ID (ID do número de telefone)</Label>
          <Input name="phone_id" defaultValue={initialData.phone_id} placeholder="Ex: 104593459345" required />
        </div>
        <div className="space-y-2">
          <Label>Access Token (Permanente)</Label>
          <Input name="token" type="password" defaultValue={initialData.token} placeholder="EAAL..." required />
          <p className="text-[11px] text-muted-foreground mt-1">Gere um token permanente criando um Usuário de Sistema nas Configurações do Negócio da Meta.</p>
        </div>
      </div>
      
      <div className="space-y-2 pt-4">
        <Label>URL do Webhook (Configure isso no painel da Meta)</Label>
        <div className="flex gap-2 items-center">
          <Input readOnly value={webhookUrl} className="bg-muted font-mono text-xs cursor-text" />
          <Button type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(webhookUrl); alert('URL Copiada!') }}>Copiar</Button>
        </div>
      </div>

      <div className="flex gap-3 pt-6 border-t">
        <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar credenciais'}</Button>
        <Button type="button" variant="secondary" onClick={handleTest} disabled={testing}>{testing ? 'Testando...' : 'Testar conexão'}</Button>
      </div>
    </form>
  )
}
