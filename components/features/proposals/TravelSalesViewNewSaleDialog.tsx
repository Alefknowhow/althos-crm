'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import VoucherUploadWithOcr from '@/components/features/reservas/VoucherUploadWithOcr'
import type { ExtractedTravelDocument } from '@/lib/ai/document-extract'
import { Plus, Users } from 'lucide-react'
import { ContactCombobox, type ProposalOption, type LeadOption, type Voucher } from './TravelSalesViewShared'

export default function NewSaleDialog({
  orgSlug, open, onOpenChange, proposals, picked, setPicked, leads, pickedContato, setPickedContato,
  voucherResult, setVoucherResult, creating, onCreate,
}: {
  orgSlug: string
  open: boolean
  onOpenChange: (o: boolean) => void
  proposals: ProposalOption[]
  picked: string
  setPicked: (v: string) => void
  leads: LeadOption[]
  pickedContato: string
  setPickedContato: (v: string) => void
  voucherResult: { voucher: Voucher; extracted: ExtractedTravelDocument | null } | null
  setVoucherResult: (v: { voucher: Voucher; extracted: ExtractedTravelDocument | null } | null) => void
  creating: boolean
  onCreate: () => void
}) {
  const extracted = voucherResult?.extracted
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Nova venda de viagem</DialogTitle>
          <DialogDescription>
            Toda venda precisa estar ligada a um contato do CRM. Se o cliente ainda não foi cadastrado, cadastre-o em Contatos antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Cliente <span className="text-destructive">*</span></Label>
            <ContactCombobox leads={leads} value={pickedContato} onChange={setPickedContato} />
            {extracted?.cliente && (
              <p className="text-xs text-muted-foreground">
                O voucher indica o cliente <strong>{extracted.cliente}</strong> — procure e selecione-o acima.
              </p>
            )}
            {leads.length === 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Nenhum contato cadastrado ainda — cadastre o cliente em Contatos primeiro.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Importar de uma proposta <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Select value={picked} onValueChange={setPicked}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma proposta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem proposta — preencher manualmente</SelectItem>
                {proposals.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {(p.title || 'Proposta sem título')}{p.client_name ? ` · ${p.client_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Voucher <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            {voucherResult ? (
              <div className="rounded-md border p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate">📎 {voucherResult.voucher.name}</span>
                  <button type="button" className="text-xs text-muted-foreground hover:text-destructive shrink-0" onClick={() => setVoucherResult(null)}>
                    Remover
                  </button>
                </div>
                {extracted ? (
                  <p className="text-xs text-muted-foreground">
                    {[extracted.destino, extracted.operadora, extracted.localizador_pacote].filter(Boolean).join(' · ') || 'Lido, mas sem dados reconhecíveis.'}
                  </p>
                ) : (
                  <p className="text-xs text-amber-700">A leitura automática falhou — o voucher fica salvo mesmo assim, é só preencher os dados manualmente.</p>
                )}
              </div>
            ) : (
              <VoucherUploadWithOcr
                orgSlug={orgSlug}
                label="Enviar voucher (upload + leitura por IA)"
                onExtracted={setVoucherResult}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Envie o voucher da reserva pra preencher destino, datas, operadora, localizador, produtos,
              outros viajantes e observações automaticamente. Fica salvo na venda mesmo sem enviar aqui —
              dá pra adicionar depois pelo botão "Add voucher".
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={creating} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={creating || !pickedContato} onClick={onCreate}>
            {creating ? 'Criando…' : 'Criar venda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
