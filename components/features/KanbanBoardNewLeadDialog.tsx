'use client'

/**
 * "Novo Lead" dialog for KanbanBoard. Prop-driven, split out of
 * KanbanBoard.tsx.
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import CurrencyInput from './pipeline/CurrencyInput'
import { createLead } from '@/actions/contatos'
import { toast } from 'sonner'
import { traduzirErro } from '@/lib/utils/error-translator'

export function KanbanBoardNewLeadDialog({
  orgSlug, createStageId, setCreateStageId, newLeadSource, setNewLeadSource, loading, setLoading,
}: {
  orgSlug: string
  createStageId: string | null
  setCreateStageId: (id: string | null) => void
  newLeadSource: string
  setNewLeadSource: (v: string) => void
  loading: boolean
  setLoading: (v: boolean) => void
}) {
  return (
    <Dialog
      open={!!createStageId}
      onOpenChange={(op: boolean) => { if (!op) { setCreateStageId(null); setNewLeadSource('manual') } }}
    >
      <DialogContent>
        <DialogHeader><DialogTitle>Novo Lead</DialogTitle></DialogHeader>
        <form onSubmit={async e => {
          e.preventDefault()
          setLoading(true)
          const res = await createLead(orgSlug, new FormData(e.currentTarget))
          setLoading(false)
          if (res.ok) {
            setCreateStageId(null)
            setNewLeadSource('manual')
            toast.success('Lead criado')
          } else {
            toast.error(traduzirErro(res.error))
          }
        }}>
          <input type="hidden" name="stage_id" value={createStageId || ''} />
          <input type="hidden" name="source" value={newLeadSource} />
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input name="name" required autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input name="email" type="email" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input name="phone" placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor</Label>
                <CurrencyInput name="value_cents" />
              </div>
              <div className="space-y-2">
                <Label>Origem</Label>
                <Select value={newLeadSource} onValueChange={setNewLeadSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Cadastro manual</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="form">Formulário</SelectItem>
                    <SelectItem value="meta_ads">Meta Ads</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tags (separadas por vírgula)</Label>
              <Input name="tags" placeholder="urgente, indicação" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>{loading ? 'Salvando…' : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
