'use client'

/**
 * "Documento" card (generate/view PDF, edit model link) for
 * PlanoContratoManagerDialog. Split out of PlanoContratoManagerDialog.tsx.
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, FileSignature, Download, Eye, FileText, Settings2 } from 'lucide-react'

export function PlanoContratoDocumentCard({
  orgSlug, saleId, generating, hasPdf, isSigned, onGenerate, onView,
}: {
  orgSlug: string
  saleId: string
  generating: boolean
  hasPdf: boolean
  isSigned: boolean
  onGenerate: () => void
  onView: (which: 'pdf' | 'signed') => void
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="w-4 h-4" /> Documento
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onGenerate} disabled={generating}>
          {generating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileSignature className="w-4 h-4 mr-1.5" />}
          {hasPdf ? 'Gerar novamente' : 'Gerar contrato (PDF)'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onView('pdf')} disabled={!hasPdf}>
          <Eye className="w-4 h-4 mr-1.5" /> Visualizar PDF
        </Button>
        <Button size="sm" variant="outline" onClick={() => onView('signed')} disabled={!isSigned}>
          <Download className="w-4 h-4 mr-1.5" /> Baixar assinado
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/app/${orgSlug}/vendas/${saleId}/contrato`} target="_blank">
            <Settings2 className="w-4 h-4 mr-1.5" /> Ver modelo
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
