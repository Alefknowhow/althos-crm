'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, CheckCircle2, Copy, Check } from 'lucide-react'
import { saveOrgAutentiqueConfig } from '@/actions/contracts'

const WEBHOOK_URL = 'https://www.althoscrm.com.br/api/webhooks/autentique'

type Props = {
  orgSlug: string
  initial: { has_api_key: boolean }
}

export default function AutentiqueConfigForm({ orgSlug, initial }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopyWebhook() {
    navigator.clipboard.writeText(WEBHOOK_URL)
    setCopied(true)
    toast.success('URL copiada.')
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSave() {
    if (!apiKey.trim()) {
      toast.error('Informe a chave de API.')
      return
    }
    setSaving(true)
    const res = await saveOrgAutentiqueConfig(orgSlug, apiKey.trim())
    setSaving(false)
    if (res.ok) {
      toast.success('Chave da Autentique salva!')
      setApiKey('')
    } else {
      toast.error(res.error || 'Erro ao salvar')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chave de API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {initial.has_api_key && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              Chave configurada. Cole uma nova abaixo para atualizar.
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{initial.has_api_key ? 'Nova chave (deixe vazio para manter)' : 'Chave de API (token)'}</Label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="••••••••••••••••••••••••••••"
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Gere o token em <strong>autentique.com.br → Configurações → API</strong>. Cada conta
              usa a própria chave e consome os próprios créditos de assinatura — o token fica
              somente no servidor, nunca é exposto ao navegador.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar chave'}
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook — status de assinatura em tempo real</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cadastre esse endereço em <strong>autentique.com.br → Configurações de Desenvolvedor →
            Webhooks → Adicionar endpoint</strong>, marcando o evento{' '}
            <code className="bg-muted px-1 rounded text-xs">signature.accepted</code>. Sem isso, o
            contrato só atualiza pra &ldquo;Assinado&rdquo; quando você clicar em
            &ldquo;Atualizar status&rdquo; manualmente no painel do contrato.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-md border bg-muted px-3 py-2 text-xs font-mono">
              {WEBHOOK_URL}
            </code>
            <Button size="icon" variant="outline" onClick={handleCopyWebhook} title="Copiar URL" className="shrink-0">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
