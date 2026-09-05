'use client'

import { useState, useTransition } from 'react'
import {
  deleteWaTemplate,
  submitWaTemplateToMeta, refreshWaTemplateStatus,
  type WaTemplate,
} from '@/actions/whatsapp-templates'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, Send, RefreshCw, Loader2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { categoryColor, statusColor, statusLabel } from './WaTemplatesShared'
import { TemplateDialog } from './WaTemplateDialog'
import { PreviewDialog } from './WaTemplatePreviewDialog'

// ── Main page ─────────────────────────────────────────────────────────────────

export function WaTemplatesClient({ orgSlug, initialTemplates }: {
  orgSlug: string
  initialTemplates: WaTemplate[]
}) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing]      = useState<WaTemplate | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [, startTransition]        = useTransition()
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<WaTemplate | null>(null)

  function handleSubmitToMeta(id: string) {
    setSubmittingId(id)
    startTransition(async () => {
      try {
        const updated = await submitWaTemplateToMeta(orgSlug, id)
        handleSaved(updated)
        toast.success('Template enviado para aprovação da Meta!')
      } catch (err: any) {
        toast.error(err.message)
      } finally {
        setSubmittingId(null)
      }
    })
  }

  function handleRefreshStatus(id: string) {
    setRefreshingId(id)
    startTransition(async () => {
      try {
        const updated = await refreshWaTemplateStatus(orgSlug, id)
        handleSaved(updated)
        if (updated.status === 'approved') toast.success('Template aprovado! ✅')
        else if (updated.status === 'rejected') toast.error('Template rejeitado pela Meta.')
        else toast('Ainda pendente de aprovação.')
      } catch (err: any) {
        toast.error(err.message)
      } finally {
        setRefreshingId(null)
      }
    })
  }

  function openNew()            { setEditing(null); setDialogOpen(true) }
  function openEdit(t: WaTemplate) { setEditing(t);   setDialogOpen(true) }
  function closeDialog()        { setDialogOpen(false); setEditing(null)  }

  function handleSaved(t: WaTemplate) {
    setTemplates(prev => {
      const idx = prev.findIndex(x => x.id === t.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = t; return n }
      return [t, ...prev]
    })
  }

  function handleDelete(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      try {
        await deleteWaTemplate(orgSlug, id)
        setTemplates(prev => prev.filter(t => t.id !== id))
        toast.success('Template removido')
      } catch (err: any) {
        toast.error(err.message)
      } finally {
        setDeletingId(null)
      }
    })
  }

  return (
    <div className="w-full lg:w-3/5 mx-auto space-y-6">

      {/* Header — título vai pra barra superior (getPageTitle em
          lib/route-titles.ts), igual todo outro módulo. */}
      <div className="flex items-center justify-end">
        <Button onClick={openNew} size="sm" className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" />
          Novo template
        </Button>
      </div>

      {/* Info callout */}
      <div className="rounded-none bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-300 flex gap-3">
        <span className="text-lg shrink-0">⚠️</span>
        <div>
          <strong>Templates precisam ser aprovados pela Meta antes de serem enviados.</strong>
          {' '}Crie o template aqui e clique em &quot;Enviar para aprovação&quot; — a análise da Meta costuma
          levar de minutos a algumas horas. Você também pode criar templates direto no{' '}
          <a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank"
            className="underline hover:text-amber-900">Meta Business Manager</a> e só registrar o
          nome aqui.
        </div>
      </div>

      {/* Template list */}
      {templates.length === 0 ? (
        <div className="rounded-none border border-dashed border-border p-16 text-center">
          <div className="text-4xl mb-4">💬</div>
          <h3 className="text-base font-semibold mb-1">Nenhum template cadastrado</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
            Cadastre seus templates HSM aprovados para usá-los nas automações.
          </p>
          <Button onClick={openNew} size="sm"><Plus className="w-4 h-4 mr-1.5" /> Criar primeiro template</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="rounded-md border border-border bg-card px-4 py-2.5 flex items-center gap-2 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{t.display_name}</p>
              <span className="text-xs font-mono text-muted-foreground truncate shrink-0">{t.name}</span>
              <Badge variant="outline" className={`text-[10px] font-semibold shrink-0 ${categoryColor(t.category)}`}>{t.category}</Badge>
              <Badge variant="outline" className={`text-[10px] font-semibold shrink-0 ${statusColor(t.status)}`}>{statusLabel(t.status)}</Badge>

              <div className="ml-auto flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setPreviewing(t)}>
                  <Eye className="w-3.5 h-3.5" /> Ver mensagem
                </Button>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-foreground"
                  onClick={() => openEdit(t)} disabled={t.status !== 'local'} title={t.status !== 'local' ? 'Templates já enviados não podem ser editados' : 'Editar'}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-destructive"
                  onClick={() => setTemplateToDelete(t.id)} disabled={deletingId === t.id}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                {(t.status === 'local' || t.status === 'rejected') && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={submittingId === t.id}
                    onClick={() => handleSubmitToMeta(t.id)}>
                    {submittingId === t.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                    {t.status === 'rejected' ? 'Reenviar' : 'Enviar para aprovação'}
                  </Button>
                )}
                {t.status === 'pending' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={refreshingId === t.id}
                    onClick={() => handleRefreshStatus(t.id)}>
                    {refreshingId === t.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                    Atualizar status
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateDialog
        orgSlug={orgSlug}
        open={dialogOpen}
        editing={editing}
        onClose={closeDialog}
        onSaved={handleSaved}
      />

      <PreviewDialog template={previewing} onClose={() => setPreviewing(null)} />

      <AlertDialog open={!!templateToDelete} onOpenChange={o => !o && setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover template?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(templateToDelete!); setTemplateToDelete(null) }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
