'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { saveOrgMetaConfig } from '@/actions/organization'

type Props = {
  orgSlug: string
  initial: { meta_pixel_id: string; has_access_token: boolean }
}

export default function MetaConfigForm({ orgSlug, initial }: Props) {
  const [pixelId,      setPixelId]      = useState(initial.meta_pixel_id)
  const [accessToken,  setAccessToken]  = useState('')
  const [showToken,    setShowToken]    = useState(false)
  const [saving,       setSaving]       = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await saveOrgMetaConfig(orgSlug, {
      meta_pixel_id:     pixelId.trim(),
      meta_access_token: accessToken.trim() || undefined,
    })
    setSaving(false)
    if (res.ok) {
      toast.success('Configurações Meta salvas!')
      setAccessToken('') // clear after saving — it's never returned from the server
    } else {
      toast.error(res.error || 'Erro ao salvar')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pixel ID</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Facebook Pixel ID</Label>
            <Input
              value={pixelId}
              onChange={e => setPixelId(e.target.value)}
              placeholder="Ex: 123456789012345"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Encontre em <strong>Gerenciador de Eventos → Fontes de dados → seu Pixel → Configurações</strong>.
              Esse ID é inserido no código da página pública do formulário.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Access Token (CAPI)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {initial.has_access_token && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              Token configurado. Cole um novo abaixo para atualizar.
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{initial.has_access_token ? 'Novo token (deixe vazio para manter)' : 'Access Token'}</Label>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                value={accessToken}
                onChange={e => setAccessToken(e.target.value)}
                placeholder={initial.has_access_token ? '••••••••••••••' : 'EAAxxxxx...'}
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowToken(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Gere um <strong>System User Access Token</strong> com permissão{' '}
              <code className="bg-muted px-1 rounded text-[10px]">ads_management</code> no Gerenciador
              de Negócios. Esse token fica <strong>somente no servidor</strong> — nunca é exposto ao
              browser.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-muted">
        <CardContent className="pt-5 space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Como funciona</p>
          <ul className="space-y-1 list-disc list-inside text-xs">
            <li><strong>PageView</strong> — disparado quando o visitante abre o formulário (Pixel cliente)</li>
            <li><strong>Lead</strong> — disparado quando o formulário é enviado com sucesso, tanto pelo Pixel (cliente) quanto pela CAPI (servidor), com deduplication via event_id</li>
            <li>Os dados de e-mail/telefone são hashados com SHA-256 antes de serem enviados</li>
          </ul>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar configurações'}
      </Button>
    </div>
  )
}
