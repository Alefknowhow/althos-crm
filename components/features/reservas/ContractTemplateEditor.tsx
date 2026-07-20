'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import TiptapEmailEditor from '@/components/features/email/TiptapEmailEditor'
import { saveOrgContractTemplate } from '@/actions/document-templates'
import { toast } from 'sonner'
import { Save, Info } from 'lucide-react'

export default function ContractTemplateEditor({
  orgSlug, initialBody,
}: {
  orgSlug: string
  initialBody: string
}) {
  const router = useRouter()
  const [body, setBody] = useState(initialBody)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await saveOrgContractTemplate(orgSlug, body)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Contrato padrão salvo')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 text-xs text-muted-foreground flex items-start gap-2">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
        <div>
          Este é o texto usado ao clicar em "Gerar contrato" numa venda. Campos entre chaves são
          preenchidos automaticamente com os dados da venda: <code className="px-1 rounded bg-muted">{'{{sale.cliente}}'}</code>{' '}
          <code className="px-1 rounded bg-muted">{'{{sale.destino}}'}</code>{' '}
          <code className="px-1 rounded bg-muted">{'{{sale.hotel}}'}</code>{' '}
          <code className="px-1 rounded bg-muted">{'{{sale.data_ida}}'}</code>{' '}
          <code className="px-1 rounded bg-muted">{'{{sale.data_volta}}'}</code>{' '}
          <code className="px-1 rounded bg-muted">{'{{sale.valor_total}}'}</code>{' '}
          <code className="px-1 rounded bg-muted">{'{{sale.forma_pagamento}}'}</code>{' '}
          <code className="px-1 rounded bg-muted">{'{{sale.operadora}}'}</code>{' '}
          <code className="px-1 rounded bg-muted">{'{{sale.companhia_aerea}}'}</code>{' '}
          <code className="px-1 rounded bg-muted">{'{{sale.localizador_pacote}}'}</code>{' '}
          <code className="px-1 rounded bg-muted">{'{{sale.localizador_aereo}}'}</code>{' '}
          <code className="px-1 rounded bg-muted">{'{{sale.politica_cancelamento}}'}</code>{' '}
          <code className="px-1 rounded bg-muted">{'{{sale.informacoes_importantes}}'}</code>{' '}
          <code className="px-1 rounded bg-muted">{'{{sale.informacoes_servico}}'}</code>{' '}
          <code className="px-1 rounded bg-muted">{'{{org.nome}}'}</code>{' '}
          <code className="px-1 rounded bg-muted">{'{{org.cnpj}}'}</code>{' '}
          <code className="px-1 rounded bg-muted">{'{{org.cadastur}}'}</code>. Se um campo não estiver preenchido na venda, o texto some vazio.
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Contrato padrão</CardTitle>
          <Button size="sm" disabled={saving} onClick={handleSave}>
            <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </CardHeader>
        <CardContent>
          <TiptapEmailEditor orgSlug={orgSlug} value={body} onChange={setBody} placeholder="Escreva o contrato padrão aqui…" />
        </CardContent>
      </Card>
    </div>
  )
}
