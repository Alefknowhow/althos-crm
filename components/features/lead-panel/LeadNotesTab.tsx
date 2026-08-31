'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { addLeadNote, listContatoNotes } from '@/actions/contatos'

type Note = { id: string; payload: any; created_at: string; created_by: string | null }

export default function LeadNotesTab({ orgSlug, leadId }: { orgSlug: string; leadId: string }) {
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  async function reload() {
    const data = await listContatoNotes(orgSlug, leadId)
    setNotes(data as Note[])
  }

  useEffect(() => {
    setNotes(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, leadId])

  async function handleAdd() {
    const v = text.trim()
    if (!v) return
    setSaving(true)
    const fd = new FormData()
    fd.set('text', v)
    const res = await addLeadNote(orgSlug, leadId, fd)
    setSaving(false)
    if ((res as any)?.ok === false) { toast.error('Não foi possível salvar a nota', { description: (res as any).error }); return }
    setText('')
    toast.success('Nota adicionada')
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Escreva uma anotação sobre este lead..."
          rows={3}
          className="text-sm"
        />
        <Button type="button" size="sm" onClick={handleAdd} disabled={saving || !text.trim()} className="w-full">
          {saving ? 'Salvando...' : 'Adicionar nota'}
        </Button>
      </div>

      {notes === null ? (
        <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : notes.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma anotação ainda.</p>
      ) : (
        <div className="space-y-2">
          {notes.map(n => (
            <div key={n.id} className="rounded-lg border p-3 text-sm space-y-1">
              <p className="whitespace-pre-wrap">{n.payload?.text}</p>
              <p className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString('pt-BR')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
