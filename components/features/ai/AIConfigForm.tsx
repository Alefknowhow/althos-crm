'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, ChevronRight } from 'lucide-react'
import { updateOrgAI } from '@/actions/organization'

type Initial = {
  ocr_provider: 'claude' | 'gemini'
}

const OCR_PROVIDER_OPTIONS: { id: 'claude' | 'gemini'; label: string }[] = [
  { id: 'claude', label: 'Claude (Anthropic) — padrão' },
  { id: 'gemini', label: 'Gemini 3.5 Flash-Lite (Google)' },
]

/**
 * As configurações de IA de atendimento (persona, contexto do negócio,
 * modelo, horários) e de qualificação de leads viviam aqui antes — foram
 * unificadas em Configurações → Agente IA pra não ter dois lugares
 * editando o mesmo campo (era exatamente esse o bug que gerava
 * desincronização). Esta tela ficou só com o que é genuinamente separado:
 * o motor de OCR usado em Reservas/Cotações.
 */
export default function AIConfigForm({ orgSlug, initial }: { orgSlug: string; initial: Initial }) {
  const router = useRouter()
  const [ocrProvider, setOcrProvider] = useState<'claude' | 'gemini'>(initial.ocr_provider)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const res = await updateOrgAI(orgSlug, { ocr_provider: ocrProvider })
    setSaving(false)
    if (res.ok) {
      toast.success('Configuração salva')
      router.refresh()
    } else {
      toast.error(res.error || 'Erro ao salvar')
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/app/${orgSlug}/configuracoes/agente-ia`}
        className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm hover:bg-muted/40 transition-colors"
      >
        <Sparkles className="w-4 h-4 shrink-0 text-primary" />
        <span className="flex-1">
          Atendimento por IA (WhatsApp) e qualificação automática de leads agora ficam em <span className="font-medium">Agente IA</span>.
        </span>
        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Motor de IA — leitura de documentos (OCR)</CardTitle>
          <CardDescription>
            Escolha qual motor de IA processa a extração de dados de vouchers, orçamentos e reservas
            (PDF/imagem) em Reservas e Cotações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={ocrProvider}
            onChange={e => setOcrProvider(e.target.value as 'claude' | 'gemini')}
          >
            {OCR_PROVIDER_OPTIONS.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? 'Salvando...' : 'Salvar configuração'}
        </Button>
      </div>
    </div>
  )
}
