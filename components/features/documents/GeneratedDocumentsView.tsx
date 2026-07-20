'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/ui/empty-state'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import GenerateDocumentDialog from './GenerateDocumentDialog'
import { deleteGeneratedDocument, type GeneratedDocumentRow } from '@/actions/generated-documents'
import type { DocumentTemplateRow } from '@/actions/document-templates'
import { toast } from 'sonner'
import { FileStack, Plus, Printer, Trash2 } from 'lucide-react'

function fmtDate(d: string) {
  return new Date(d).toLocaleString('pt-BR')
}

export default function GeneratedDocumentsView({
  orgSlug, documents, templates,
}: {
  orgSlug: string
  documents: GeneratedDocumentRow[]
  templates: DocumentTemplateRow[]
}) {
  const router = useRouter()
  const [generateOpen, setGenerateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    const res = await deleteGeneratedDocument(orgSlug, id)
    if (res.ok) { toast.success('Documento excluído'); router.refresh() }
    else toast.error(res.error)
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        icon={FileStack}
        title="Crie um modelo primeiro"
        description="Vá na aba Modelos e crie um modelo de documento antes de gerar."
      />
    )
  }

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <Button onClick={() => setGenerateOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Novo documento
        </Button>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="Nenhum documento gerado ainda"
          description="Clique em 'Novo documento' e escolha um modelo pra começar."
        />
      ) : (
        <div className="rounded-none border bg-card divide-y">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{doc.title}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(doc.created_at)}</p>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                <a href={`/app/${orgSlug}/documentos/${doc.id}/print`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm"><Printer className="w-3.5 h-3.5 mr-1.5" /> Imprimir</Button>
                </a>
                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(doc.id)} aria-label="Excluir">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <GenerateDocumentDialog
        orgSlug={orgSlug}
        templates={templates}
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onGenerated={() => router.refresh()}
      />

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(deleteId!); setDeleteId(null) }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
