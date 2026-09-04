'use client'

/**
 * "Conteúdo deste contrato" editor card for PlanoContratoManagerDialog —
 * lets the operator override the plan's default clause text for a single
 * sale. Split out of PlanoContratoManagerDialog.tsx.
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, FileText, Settings2 } from 'lucide-react'
import TiptapEmailEditor from '@/components/features/email/TiptapEmailEditor'

export function PlanoContratoBodyCard({
  orgSlug, isSent, isSigned, editingBody, bodyLoading, bodyHtml, setBodyHtml, savingBody,
  onOpenEditor, onSave, onCancel,
}: {
  orgSlug: string
  isSent: boolean
  isSigned: boolean
  editingBody: boolean
  bodyLoading: boolean
  bodyHtml: string
  setBodyHtml: (v: string) => void
  savingBody: boolean
  onOpenEditor: () => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="w-4 h-4" /> Conteúdo deste contrato
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Ajuste cláusulas específicas desta venda sem alterar o modelo padrão do Plano — vale só pra este contrato.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isSent || isSigned ? (
          <p className="text-xs text-muted-foreground">
            Este contrato já foi {isSigned ? 'assinado' : 'enviado pra assinatura'} — o conteúdo não pode mais ser editado.
          </p>
        ) : !editingBody ? (
          <Button size="sm" variant="outline" onClick={onOpenEditor} disabled={bodyLoading}>
            {bodyLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Settings2 className="w-4 h-4 mr-1.5" />}
            Editar conteúdo deste contrato
          </Button>
        ) : (
          <>
            <TiptapEmailEditor orgSlug={orgSlug} value={bodyHtml} onChange={setBodyHtml} placeholder="Texto do contrato…" />
            <div className="flex gap-2">
              <Button size="sm" onClick={onSave} disabled={savingBody}>
                {savingBody ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                Salvar conteúdo
              </Button>
              <Button size="sm" variant="outline" onClick={onCancel} disabled={savingBody}>
                Cancelar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Salve aqui antes de gerar o PDF pra usar este texto em vez do modelo padrão.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
