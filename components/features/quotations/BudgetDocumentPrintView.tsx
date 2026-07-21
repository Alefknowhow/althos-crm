'use client'

import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, Check, X } from 'lucide-react'
import type { BudgetDocumentRow } from '@/actions/budget-documents'

type OrgBranding = {
  name: string
  logo_url: string | null
  primary_color: string | null
  cnpj: string | null
  cadastur: string | null
  contact_phone: string | null
  contact_email: string | null
  website: string | null
}

type ExtractedVoo = {
  companhia?: string | null
  numero?: string | null
  data?: string | null
  origem?: string | null
  destino?: string | null
  horario?: string | null
  sentido?: 'ida' | 'volta' | null
}

function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
}
function fmtCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

/** Thin horizontal rule used between quotation sections (operator style). */
function SectionRule() {
  return <div className="border-t border-gray-300 my-4" />
}

export default function BudgetDocumentPrintView({ doc, org }: { doc: BudgetDocumentRow; org: OrgBranding }) {
  const accent = org.primary_color || '#0f62fe'
  const validUntil = new Date(new Date(doc.created_at).getTime() + doc.validity_days * 86400000)

  const extracted = (doc.extracted_data || {}) as Record<string, any>
  const voos: ExtractedVoo[] = Array.isArray(extracted.voos) ? extracted.voos : []
  // Split legs by direction when the extraction identified it; otherwise show all under "Trechos".
  const idas = voos.filter(v => v.sentido === 'ida')
  const voltas = voos.filter(v => v.sentido === 'volta')
  const semSentido = voos.filter(v => !v.sentido)
  const hasTraslado = !!extracted.traslado || doc.included.some(i => /traslado|transfer/i.test(i))
  const hasSeguro = !!extracted.seguro || doc.included.some(i => /seguro|assist/i.test(i))

  const pacoteLabel = [
    voos.length > 0 || doc.included.some(i => /a[eé]reo|voo/i.test(i)) ? 'Voo' : null,
    doc.hotel_name ? 'Hotel' : null,
  ].filter(Boolean).join(' + ') || 'Pacote'

  const paxLine = `Adulto(s): ${doc.pax_adults ?? 0} | Criança(s): ${doc.pax_children ?? 0}`

  return (
    <div className="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
      <div className="max-w-[210mm] mx-auto print:hidden mb-4 px-4 flex items-center justify-between">
        <a href={`/app`} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" onClick={e => { e.preventDefault(); window.close() }}>
          <ArrowLeft className="w-3 h-3" /> Fechar
        </a>
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1.5" /> Imprimir / Salvar PDF
        </Button>
      </div>

      <div className="max-w-[210mm] mx-auto bg-white text-black shadow-sm print:shadow-none p-10 print:p-8 min-h-[297mm] text-sm">
        {/* Cabeçalho: logo + linha de contatos (estilo operadora) */}
        <div className="pb-4">
          <div className="flex items-center gap-3">
            {org.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt={org.name} className="h-14 w-auto object-contain" />
            )}
            <p className="text-2xl font-bold" style={{ color: accent }}>{org.name}</p>
          </div>
        </div>
        <div className="border-t-2 pt-2 pb-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500" style={{ borderColor: accent }}>
          {org.cnpj && <span>CNPJ {org.cnpj}</span>}
          {org.cadastur && <span>CADASTUR {org.cadastur}</span>}
          {org.contact_phone && <span>{org.contact_phone}</span>}
          {org.contact_email && <span>{org.contact_email}</span>}
          {org.website && <span>{org.website}</span>}
        </div>

        {/* Aviso de cotação (box verde, como no modelo da operadora) */}
        <div className="border-2 border-green-600 p-4 mb-6">
          <p className="font-bold text-red-600 mb-1">Atenção!!</p>
          <p className="text-[13px] leading-relaxed">
            Esta é uma simples cotação. Nenhum dos componentes selecionados está confirmado até que
            seja efetivada a reserva. Os valores podem sofrer alterações em virtude de
            disponibilidade e câmbio.
          </p>
        </div>

        {/* Código da cotação */}
        <p className="text-lg mb-6" style={{ color: accent }}>
          Código da Cotação: <span className="font-bold text-black">#{doc.id.slice(0, 8).toUpperCase()}</span>
        </p>

        {/* Agência emissora × total da compra */}
        <div className="border-2 p-4 mb-8" style={{ borderColor: accent }}>
          <div className="flex items-center justify-between text-gray-400 text-[12px] border-b pb-2 mb-3">
            <span>Agência Emissora</span>
            <span>Total da compra</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-600 uppercase">{org.name}</span>
            <span className="font-bold text-gray-600 text-lg tabular-nums">{fmtCurrency(doc.total_cents)}</span>
          </div>
        </div>

        {/* Dados da cotação */}
        <p className="text-[13px] mb-1" style={{ color: accent }}>Dados da Cotação:</p>
        <SectionRule />

        <p className="text-xl mb-2" style={{ color: accent }}>
          Pacote: {pacoteLabel} {doc.start_date ? `${fmtDate(doc.start_date)} - ${fmtDate(doc.end_date)}` : ''}
        </p>
        <SectionRule />

        {/* Hotel */}
        {doc.hotel_name && (
          <>
            <p className="font-bold text-[13px] mb-2">Hotel: {doc.hotel_name}</p>
            <p className="text-[13px]">Check-in: {fmtDate(doc.start_date)} | Check-out: {fmtDate(doc.end_date)}</p>
            <p className="text-[13px]">{paxLine}</p>
            {doc.destination && <p className="text-[13px]">Destino: {doc.destination}</p>}
            <SectionRule />
          </>
        )}

        {/* Traslado */}
        {hasTraslado && (
          <>
            <p className="font-bold text-[13px] mb-2">Traslado: incluso no pacote</p>
            <p className="text-[13px]"><span className="font-bold">Origem:</span> {fmtDate(doc.start_date)} | <span className="font-bold">Volta:</span> {fmtDate(doc.end_date)}</p>
            <p className="text-[13px]">{paxLine}</p>
            <SectionRule />
          </>
        )}

        {/* Seguro / assistência */}
        {hasSeguro && (
          <>
            <p className="font-bold text-[13px] mb-2">Seguro viagem / assistência: incluso no pacote</p>
            <p className="text-[13px]"><span className="font-bold">Origem:</span> {fmtDate(doc.start_date)} | <span className="font-bold">Volta:</span> {fmtDate(doc.end_date)}</p>
            <p className="text-[13px]">{paxLine}</p>
            <SectionRule />
          </>
        )}

        {/* Voos */}
        {voos.length > 0 && (
          <>
            <p className="font-bold text-[13px] mb-2">
              Voo{doc.start_date ? ` (${fmtDate(doc.start_date)} - ${fmtDate(doc.end_date)})` : ''}
            </p>
            <p className="text-[13px] mb-3">{paxLine}</p>

            {[{ label: 'Ida', legs: idas }, { label: 'Volta', legs: voltas }, { label: 'Trecho', legs: semSentido }]
              .filter(g => g.legs.length > 0)
              .map(group => (
                <div key={group.label} className="mb-3">
                  {group.legs.map((v, i) => (
                    <div key={i} className="mb-2.5">
                      <p className="font-bold text-[13px]">{group.label}</p>
                      <p className="text-[13px]">{[v.origem, v.destino].filter(Boolean).join(' - ') || '—'}</p>
                      {(v.companhia || v.numero) && (
                        <p className="text-[13px]">{[v.companhia, v.numero].filter(Boolean).join(' ')}</p>
                      )}
                      <p className="text-[13px]">
                        <span className="font-bold">Data:</span> {fmtDate(v.data)}{v.horario ? ` ${v.horario}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            <SectionRule />
          </>
        )}

        {/* Incluso / não incluso */}
        {(doc.included.length > 0 || doc.not_included.length > 0) && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div>
                <p className="font-bold text-[13px] mb-1.5">Incluso</p>
                {doc.included.length === 0 ? <p className="text-xs text-gray-400">—</p> : (
                  <ul className="space-y-1">
                    {doc.included.map((item, i) => (
                      <li key={i} className="text-[13px] flex items-center gap-1.5"><Check className="w-3 h-3 text-green-600 shrink-0" /> {item}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="font-bold text-[13px] mb-1.5">Não incluso</p>
                {doc.not_included.length === 0 ? <p className="text-xs text-gray-400">—</p> : (
                  <ul className="space-y-1">
                    {doc.not_included.map((item, i) => (
                      <li key={i} className="text-[13px] flex items-center gap-1.5"><X className="w-3 h-3 text-gray-400 shrink-0" /> {item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <SectionRule />
          </>
        )}

        {/* Valores por pessoa + condições */}
        {(doc.price_per_person_cents != null && doc.price_per_person_cents > 0) && (
          <p className="text-[13px] mb-2"><span className="font-bold">Valor por pessoa:</span> <span className="tabular-nums">{fmtCurrency(doc.price_per_person_cents)}</span></p>
        )}
        {doc.payment_conditions.length > 0 && (
          <div className="mb-4">
            <p className="font-bold text-[13px] mb-1.5">Condições de pagamento</p>
            <ul className="space-y-1">
              {doc.payment_conditions.map((p, i) => (
                <li key={i} className="text-[13px]">• {p.label}</li>
              ))}
            </ul>
          </div>
        )}

        {doc.observacoes && (
          <div className="mb-4">
            <p className="font-bold text-[13px] mb-1">Observações</p>
            <p className="text-[13px] whitespace-pre-wrap">{doc.observacoes}</p>
          </div>
        )}

        <div className="border-2 p-3 text-center text-[13px] font-medium mb-8" style={{ borderColor: accent, color: accent }}>
          Orçamento válido até {validUntil.toLocaleDateString('pt-BR')} ({doc.validity_days} dias a partir da emissão)
        </div>

        {/* Rodapé de contato (estilo operadora) */}
        <div className="text-[12px] text-gray-500 space-y-2 text-center">
          {(org.contact_email || org.contact_phone) && (
            <p>
              Em caso de dúvidas entre em contato
              {org.contact_email ? ` pelo email ${org.contact_email}` : ''}
              {org.contact_email && org.contact_phone ? ' ou' : ''}
              {org.contact_phone ? ` pelo telefone ${org.contact_phone}` : ''}.
            </p>
          )}
          {org.website && (
            <p>Acesse <span style={{ color: accent }}>{org.website}</span> ou consulte seu agente de viagens</p>
          )}
          <p className="pt-2 text-[10px] text-gray-400">
            {org.name}{org.cnpj ? ` — CNPJ ${org.cnpj}` : ''}{org.cadastur ? ` — CADASTUR ${org.cadastur}` : ''}
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}
