'use client'

import DocumentExtractDialog from '@/components/features/ai/DocumentExtractDialog'
import { uploadSaleVoucher } from '@/actions/upload'
import { toast } from 'sonner'

export default function VoucherAutofillDialog({
  orgSlug, open, onOpenChange, onApply,
}: {
  orgSlug: string
  open: boolean
  onOpenChange: (o: boolean) => void
  onApply: (patch: Record<string, any>, voucher: { url: string; name: string } | null) => void
}) {
  return (
    <DocumentExtractDialog
      orgSlug={orgSlug}
      open={open}
      onOpenChange={onOpenChange}
      title="Preencher com voucher"
      description="Envie o voucher da operadora (PDF ou imagem) — a IA lê o documento e preenche os campos da venda para você revisar antes de salvar."
      onApply={async (data, file) => {
        const patch: Record<string, any> = {}
        if (data.destino) patch.destination = data.destino
        if (data.hotel) patch.hotel_name = data.hotel
        if (data.operadora) patch.operator = data.operadora
        if (data.localizador_pacote) patch.package_locator = data.localizador_pacote
        if (data.localizador_aereo) patch.air_locator = data.localizador_aereo
        if (data.data_ida) patch.departure_date = data.data_ida
        if (data.data_volta) patch.return_date = data.data_volta
        if (data.voos[0]?.companhia) patch.airline = data.voos[0].companhia
        if (data.observacoes) patch.notes = data.observacoes

        const fd = new FormData()
        fd.append('file', file)
        const uploadRes = await uploadSaleVoucher(orgSlug, fd)
        if (uploadRes.ok) {
          onApply(patch, { url: uploadRes.url, name: uploadRes.name })
          toast.success('Dados preenchidos a partir do voucher. Revise e salve.')
        } else {
          onApply(patch, null)
          toast.error(`Dados preenchidos, mas falhou ao anexar o arquivo: ${uploadRes.error}`)
        }
      }}
    />
  )
}
