'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getLeadFormResponses, type LeadFormResponse } from '@/actions/form_submissions'
import { ClipboardList, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Small icon button for a pipeline card that opens a floating window with the
 * questions & answers the lead filled in the form(s).
 */
export default function LeadFormResponsesButton({
  orgSlug,
  leadId,
}: {
  orgSlug: string
  leadId: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [responses, setResponses] = useState<LeadFormResponse[] | null>(null)

  function stop(e: React.MouseEvent | React.PointerEvent) {
    e.stopPropagation()
  }

  async function load() {
    setLoading(true)
    try {
      const data = await getLeadFormResponses(orgSlug, leadId)
      setResponses(data)
    } finally {
      setLoading(false)
    }
  }

  function openDialog(e: React.MouseEvent) {
    stop(e)
    setOpen(true)
    if (!responses) load()
  }

  return (
    <>
      <button
        type="button"
        onPointerDown={stop}
        onClick={openDialog}
        title="Ver respostas do formulário"
        className="flex h-6 w-6 items-center justify-center rounded-md text-violet-600 hover:bg-violet-50"
      >
        <ClipboardList className="h-3.5 w-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" onPointerDown={stop} onClick={stop}>
          <DialogHeader>
            <DialogTitle>Respostas do formulário</DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          )}

          {!loading && responses && responses.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Este lead não preencheu nenhum formulário.
            </div>
          )}

          {!loading && responses && responses.length > 0 && (
            <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
              {responses.map(r => (
                <div key={r.submissionId} className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <span className="text-sm font-semibold">{r.formName}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(r.createdAt), "d 'de' MMM yyyy · HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {r.qa.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem campos preenchidos.</p>
                  ) : (
                    <dl className="space-y-2.5">
                      {r.qa.map((item, i) => (
                        <div key={i} className="grid grid-cols-[40%_60%] gap-2">
                          <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
                          <dd className="text-xs text-foreground whitespace-pre-wrap break-words">
                            {item.value || <span className="text-muted-foreground/50">—</span>}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
