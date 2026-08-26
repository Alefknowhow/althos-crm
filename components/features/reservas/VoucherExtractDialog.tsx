'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, Plus, Check, CheckCircle2, AlertTriangle } from 'lucide-react'
import { extractTravelDocument } from '@/actions/document-extract'
import { createSaleProduct, type SaleProductKind } from '@/actions/sale-products'
import type { ExtractedTravelDocument } from '@/lib/ai/document-extract'

export type ExtractSource = { base64: string; mediaType: string }

type Section = {
  key: string
  icon: string
  label: string
  title: string
  sub: string
  kind: SaleProductKind
  data: Record<string, any>
}

function buildSections(data: ExtractedTravelDocument): Section[] {
  const sections: Section[] = []

  const voos = data.voos || []
  const idaLegs = voos.filter(v => v.sentido !== 'volta')
  const voltaLegs = voos.filter(v => v.sentido === 'volta')
  for (const [sentido, legs] of [['ida', idaLegs], ['volta', voltaLegs]] as const) {
    if (legs.length === 0) continue
    const first = legs[0]
    const last = legs[legs.length - 1]
    const stops = [first.origem_codigo || first.origem, ...legs.map(l => l.destino_codigo || l.destino)].filter(Boolean)
    sections.push({
      key: `voo-${sentido}`,
      icon: '✈️',
      label: `Voo (${sentido})`,
      title: `${first.companhia || 'Aéreo'} · ${stops.join(' → ')}`,
      sub: `${legs.length > 1 ? `${legs.length - 1} conexão${legs.length > 2 ? 'ões' : ''} · ` : ''}${first.data || ''}`,
      kind: 'aereo',
      data: {
        companhia: first.companhia || null, numero_voo: first.numero || null, data: first.data || null,
        origem: first.origem_codigo || first.origem || null, destino: last.destino_codigo || last.destino || null,
        horario: first.horario || null, sentido,
        localizador: first.localizador_checkin || data.localizador_aereo || null,
        bilhete: first.bilhete || null,
        hora_embarque: first.hora_embarque || null,
        data_chegada: last.data_chegada || null,
        hora_chegada: last.hora_chegada || null,
        bagagem: first.bagagem || null,
        legs: legs.map(l => ({
          companhia: l.companhia || null, numero: l.numero || null, data: l.data || null,
          origem: l.origem_codigo || l.origem || null, destino: l.destino_codigo || l.destino || null,
          horario: l.horario || null,
          localizador_checkin: l.localizador_checkin || null, bilhete: l.bilhete || null,
          hora_embarque: l.hora_embarque || null, data_chegada: l.data_chegada || null, hora_chegada: l.hora_chegada || null,
          duracao: l.duracao || null, bagagem: l.bagagem || null,
          escala_local: l.escala_local || null, escala_duracao: l.escala_duracao || null,
        })),
      },
    })
  }

  ;(data.hospedagens || []).forEach((h, i) => {
    sections.push({
      key: `hospedagem-${i}`, icon: '🏨', label: 'Hospedagem', title: h.nome || 'Hospedagem',
      sub: h.check_in && h.check_out ? `${h.check_in} → ${h.check_out}` : '',
      kind: 'hospedagem',
      data: { hotel: h.nome || null, check_in: h.check_in || null, check_out: h.check_out || null, tipo_quarto: h.categoria_quarto || null, regime: h.regime || null },
    })
  })

  ;(data.cruzeiros || []).forEach((c, i) => {
    sections.push({
      key: `cruzeiro-${i}`, icon: '🚢', label: 'Cruzeiro', title: c.navio || c.companhia || 'Cruzeiro', sub: c.roteiro || '',
      kind: 'cruzeiro',
      data: {
        companhia: c.companhia || null, navio: c.navio || null, roteiro: c.roteiro || null,
        embarque_porto: c.embarque_porto || null, embarque_data: c.embarque_data || null,
        desembarque_porto: c.desembarque_porto || null, desembarque_data: c.desembarque_data || null,
        cabine: c.cabine || null,
      },
    })
  })

  ;(data.transfers || []).forEach((t, i) => {
    sections.push({
      key: `transfer-${i}`, icon: '🚐', label: 'Transfer', title: t.tipo || 'Transfer',
      sub: [t.origem, t.destino].filter(Boolean).join(' → '),
      kind: 'transfer',
      data: { origem: t.origem || null, destino: t.destino || null, data: t.data || null, horario: t.horario || null, tipo_servico: t.tipo || null },
    })
  })

  ;(data.seguros || []).forEach((s, i) => {
    sections.push({
      key: `seguro-${i}`, icon: '🛡️', label: 'Seguro', title: s.seguradora || 'Seguro', sub: s.plano || '',
      kind: 'seguro',
      data: { nome: [s.seguradora, s.plano].filter(Boolean).join(' — ') || null, fornecedor: s.seguradora || null, data: s.data_inicio || null, observacoes: s.cobertura || null },
    })
  })

  ;(data.passeios || []).forEach((p, i) => {
    sections.push({
      key: `passeio-${i}`, icon: '🎟️', label: 'Ingresso/Passeio', title: p.nome || 'Passeio', sub: p.data || '',
      kind: 'passeio',
      data: { nome: p.nome || null, data: p.data || null, observacoes: p.descricao || null },
    })
  })

  ;(data.locacoes || []).forEach((l, i) => {
    sections.push({
      key: `veiculo-${i}`, icon: '🚗', label: 'Locação de veículo', title: l.locadora || 'Locação', sub: l.retirada_local || '',
      kind: 'veiculo',
      data: { nome: l.categoria_veiculo || null, fornecedor: l.locadora || null, data: l.retirada_data || null, observacoes: l.retirada_local && l.devolucao_local ? `${l.retirada_local} → ${l.devolucao_local}` : null },
    })
  })

  return sections
}

export default function VoucherExtractDialog({
  orgSlug, saleId, source, open, onOpenChange, onScalarFieldsExtracted, onProductCreated,
}: {
  orgSlug: string
  saleId: string
  source: ExtractSource | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onScalarFieldsExtracted: (patch: Record<string, any>) => void
  onProductCreated: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedTravelDocument | null>(null)
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set())
  const [addingKey, setAddingKey] = useState<string | null>(null)
  const appliedScalar = useRef(false)

  useEffect(() => {
    if (!open || !source) return
    setExtracted(null)
    setAddedKeys(new Set())
    appliedScalar.current = false
    setLoading(true)
    extractTravelDocument(orgSlug, source)
      .then(res => {
        if (!res.ok) { toast.error(res.error); return }
        setExtracted(res.data)
      })
      .catch((err: any) => toast.error(err?.message || 'Falha ao ler o documento.'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source])

  useEffect(() => {
    if (!extracted || appliedScalar.current) return
    appliedScalar.current = true
    const patch: Record<string, any> = {}
    if (extracted.destino) patch.destination = extracted.destino
    if (extracted.operadora) patch.operator = extracted.operadora
    if (extracted.localizador_pacote) patch.package_locator = extracted.localizador_pacote
    if (extracted.localizador_aereo) patch.air_locator = extracted.localizador_aereo
    if (extracted.data_ida) patch.departure_date = extracted.data_ida
    if (extracted.data_volta) patch.return_date = extracted.data_volta
    if (extracted.politica_cancelamento) patch.cancellation_policy = extracted.politica_cancelamento
    if (extracted.informacoes_importantes) patch.important_info = extracted.informacoes_importantes
    if (extracted.informacoes_servico) patch.service_info = extracted.informacoes_servico
    if (Object.keys(patch).length > 0) onScalarFieldsExtracted(patch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extracted])

  const sections = extracted ? buildSections(extracted) : []

  async function handleAdd(section: Section) {
    setAddingKey(section.key)
    const res = await createSaleProduct(orgSlug, saleId, { kind: section.kind, data: section.data })
    setAddingKey(null)
    if (!res.ok) { toast.error(res.error); return }
    setAddedKeys(prev => new Set(prev).add(section.key))
    toast.success(`${section.label} adicionado(a) aos Produtos.`)
    onProductCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Dados extraídos do voucher</DialogTitle>
          <DialogDescription>Revise e adicione cada item aos Produtos da reserva.</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-8 flex flex-col items-center gap-2 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Lendo voucher, identificando produtos…</p>
          </div>
        )}

        {!loading && extracted && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {extracted.cliente && <Badge variant="secondary" className="text-[11px]">Cliente: {extracted.cliente}</Badge>}
              {extracted.destino && <Badge variant="secondary" className="text-[11px]">Destino: {extracted.destino}</Badge>}
              {extracted.operadora && <Badge variant="secondary" className="text-[11px]">Operadora: {extracted.operadora}</Badge>}
              {sections.length === 0 && (
                <Badge variant="outline" className="text-[11px] text-amber-600 border-amber-300 gap-1"><AlertTriangle className="w-3 h-3" /> Nenhum produto identificado</Badge>
              )}
            </div>

            {sections.map(section => {
              const added = addedKeys.has(section.key)
              const adding = addingKey === section.key
              return (
                <div key={section.key} className="flex items-center gap-2.5 rounded-lg border px-3 py-2">
                  <span className="text-lg shrink-0">{section.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{section.label}</div>
                    <div className="text-sm font-medium truncate">{section.title}</div>
                    {section.sub && <div className="text-xs text-muted-foreground truncate">{section.sub}</div>}
                  </div>
                  <Button
                    type="button" size="sm" variant={added ? 'secondary' : 'outline'} className="shrink-0"
                    disabled={added || adding}
                    onClick={() => handleAdd(section)}
                  >
                    {adding ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      : added ? <Check className="w-3.5 h-3.5 mr-1.5" />
                      : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                    {added ? 'Adicionado' : `Adicionar ${section.label.split(' ')[0].toLowerCase()}`}
                  </Button>
                </div>
              )
            })}

            {extracted.localizador_pacote && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Dados gerais da venda (cliente/destino/datas/operadora/localizador) já foram aplicados à reserva.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
