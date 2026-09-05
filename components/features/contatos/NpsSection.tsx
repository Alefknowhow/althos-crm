'use client'

/**
 * NPS (Net Promoter Score) do cliente — card compacto na linha de resumo do
 * cabeçalho do contato (mesmo padrão do <Field> em ContatosViewDetailHelpers),
 * clicável pra abrir um popup de edição manual da nota. O disparo da pesquisa
 * por WhatsApp (template aprovado) vive só em Automações agora — aqui é
 * puramente leitura + edição manual da nota, sem botão de disparo.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { setNpsScore } from '@/actions/contatos'

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('pt-BR')
}

export function NpsCard({
  orgSlug, leadId, npsScore, npsUpdatedAt,
}: {
  orgSlug: string
  leadId: string
  npsScore: number | null
  npsUpdatedAt: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [scoreInput, setScoreInput] = useState(npsScore != null ? String(npsScore) : '')
  const [saving, setSaving] = useState(false)

  function handleOpen() {
    setScoreInput(npsScore != null ? String(npsScore) : '')
    setOpen(true)
  }

  async function handleSave() {
    const n = scoreInput.trim() === '' ? null : parseInt(scoreInput, 10)
    if (n != null && (Number.isNaN(n) || n < 0 || n > 10)) {
      toast.error('A nota precisa ser um número entre 0 e 10.')
      return
    }
    setSaving(true)
    const res = await setNpsScore(orgSlug, leadId, n)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(n != null ? 'Nota registrada' : 'Nota removida')
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-lg border bg-background p-2 space-y-1 text-left hover:bg-accent/40 transition-colors"
      >
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Smile className="w-3 h-3" />
          <span className="font-bold uppercase tracking-wider text-[9px]">NPS</span>
        </div>
        {npsScore != null ? (
          <div>
            <span className="text-base font-bold text-primary">{npsScore}</span>
            <span className="text-xs text-muted-foreground"> /10</span>
            {npsUpdatedAt && <div className="text-[9px] text-muted-foreground">{fmtDate(npsUpdatedAt)}</div>}
          </div>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">—</span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nota NPS</DialogTitle>
          </DialogHeader>
          <Input
            type="number" min={0} max={10}
            placeholder="Nota (0-10)"
            value={scoreInput}
            onChange={e => setScoreInput(e.target.value)}
            className="w-32"
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="button" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
