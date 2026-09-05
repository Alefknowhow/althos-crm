'use client'

/**
 * Editor da Cotação — formulário em largura total (1:1 com a entrega).
 * Use o botão "Abrir" pra ver a proposta pública real em nova aba.
 *
 * Autosave com debounce (~800ms). Repeaters reordenáveis via dnd-kit.
 * Imagens: upload/colar/arrastar com compressão client-side.
 */

import { Sparkles } from 'lucide-react'
import DocumentExtractDialog from '@/components/features/ai/DocumentExtractDialog'
import FlightOcrDialog from './FlightOcrDialog'
import CruiseOcrDialog from './CruiseOcrDialog'
import { ToggleRichField, EditBlock, GroupNavSidebar, GroupSection } from './QuotationEditorFields'
import type { QuotationFull } from '@/actions/quotations'
import QuotationEditorProductsGroup from './QuotationEditorProductsGroup'
import QuotationEditorInvestimentoGroup from './QuotationEditorInvestimentoGroup'
import QuotationEditorFechamentoGroup from './QuotationEditorFechamentoGroup'
import QuotationEditorConteudoGroup from './QuotationEditorConteudoGroup'
import QuotationEditorResumoGroup from './QuotationEditorResumoGroup'
import QuotationEditorToolbar from './QuotationEditorToolbar'
import { useQuotationEditorState } from './useQuotationEditorState'

export default function QuotationEditor({ orgSlug, initial, leads = [], isOffer = false }: {
  orgSlug: string; initial: QuotationFull; leads?: { id: string; name: string; phone?: string | null }[]; isOffer?: boolean
}) {
  const s = useQuotationEditorState({ orgSlug, initial, isOffer })
  const {
    q0, q, setQ,
    lodgings, setLodgings, flights, setFlights, pins, setPins,
    cruises, setCruises, transfers, setTransfers, insurances, setInsurances,
    tours, setTours, rentals, setRentals,
    publicToken, saveState, taBusy, geoBusy, saleBusy,
    extractOpen, setExtractOpen, flightOcrOpen, setFlightOcrOpen,
    activeGroup, setActiveGroup, flightsTextOpen, setFlightsTextOpen, cruiseOcrOpen, setCruiseOcrOpen,
    footerProfiles, footerProfileBusy, applyFooterProfile, saveFooterProfile, removeFooterProfile,
    handleCruiseExtracted, handleFlightLegsExtracted, handleExtracted,
    paxTotal, completeness, missingLabels, productBreakdown,
    onGenerateLink, onConvertToQuotation, taLookup, pinGeocode, publicUrl,
  } = s

  /* ═════════════ render ═════════════ */
  const form = (
    <div className="space-y-4 pb-24">
      <QuotationEditorResumoGroup
        orgSlug={orgSlug} activeGroup={activeGroup} q={q} setQ={setQ}
        isOffer={isOffer} leads={leads} completeness={completeness} missingLabels={missingLabels}
      />

      <GroupSection id="conteudo" active={activeGroup}>
      {/* INTRODUÇÃO */}
      <EditBlock id="blk-intro" icon={Sparkles} title="Introdução">
        <ToggleRichField orgSlug={orgSlug} value={q.intro_html} onChange={html => setQ(s => ({ ...s, intro_html: html }))} />
      </EditBlock>

      </GroupSection>

      <QuotationEditorProductsGroup
        orgSlug={orgSlug} activeGroup={activeGroup} q={q} setQ={setQ}
        flights={flights} setFlights={setFlights} setFlightOcrOpen={setFlightOcrOpen}
        flightsTextOpen={flightsTextOpen} setFlightsTextOpen={setFlightsTextOpen}
        lodgings={lodgings} setLodgings={setLodgings} taBusy={taBusy} taLookup={taLookup}
        cruises={cruises} setCruises={setCruises} setCruiseOcrOpen={setCruiseOcrOpen}
        transfers={transfers} setTransfers={setTransfers}
        insurances={insurances} setInsurances={setInsurances}
        tours={tours} setTours={setTours}
        rentals={rentals} setRentals={setRentals}
      />

      <QuotationEditorConteudoGroup
        orgSlug={orgSlug} activeGroup={activeGroup} q={q} setQ={setQ}
        pins={pins} setPins={setPins} geoBusy={geoBusy} pinGeocode={pinGeocode}
      />

      <QuotationEditorInvestimentoGroup
        activeGroup={activeGroup} q={q} setQ={setQ} paxTotal={paxTotal}
        lodgings={lodgings} setLodgings={setLodgings}
        productBreakdown={productBreakdown}
      />

      <QuotationEditorFechamentoGroup
        orgSlug={orgSlug} activeGroup={activeGroup} q={q} setQ={setQ}
        whatsappNumber={initial.org_settings?.whatsapp_number}
        footerProfiles={footerProfiles} footerProfileBusy={footerProfileBusy}
        applyFooterProfile={applyFooterProfile} saveFooterProfile={saveFooterProfile}
        removeFooterProfile={removeFooterProfile}
      />
    </div>
  )

  return (
    <div className="pt-3 pb-8">
      {/* Toolbar + navegação entre blocos — um único bloco sticky, sem espaço entre as duas linhas */}
      <QuotationEditorToolbar
        orgSlug={orgSlug} quotationId={q0.id} title={q.title} isOffer={isOffer}
        saveState={saveState} publicUrl={publicUrl} publicToken={publicToken}
        activeGroup={activeGroup} setActiveGroup={setActiveGroup} completeness={completeness}
        onOpenExtract={() => setExtractOpen(true)}
        onGenerateLink={onGenerateLink}
        onConvertToQuotation={onConvertToQuotation}
        saleBusy={saleBusy}
      />

      <div className="mt-[3px] flex gap-4 items-start">
        <GroupNavSidebar active={activeGroup} onChange={setActiveGroup} completeness={completeness} />
        <div className="flex-1 min-w-0 flex justify-center">
          <div className="w-full max-w-4xl">{form}</div>
        </div>
        {/* Espaçador simétrico à sidebar — sem isso o conteúdo fica
            centralizado só no espaço restante (que já começa deslocado pra
            direita pela largura da sidebar), não na tela inteira. */}
        <div className="hidden md:block w-44 shrink-0" aria-hidden />
      </div>

      <DocumentExtractDialog
        orgSlug={orgSlug}
        open={extractOpen}
        onOpenChange={setExtractOpen}
        title="Autopreencher com IA"
        description="Envie o voucher/orçamento (PDF ou imagem) — a IA lê o documento e preenche cliente, destino, datas, hospedagem, voos e valor. Revise antes de salvar."
        onApply={data => handleExtracted(data)}
      />

      <FlightOcrDialog
        orgSlug={orgSlug}
        open={flightOcrOpen}
        onOpenChange={setFlightOcrOpen}
        onApply={legs => handleFlightLegsExtracted(legs)}
      />

      <CruiseOcrDialog
        orgSlug={orgSlug}
        open={cruiseOcrOpen}
        onOpenChange={setCruiseOcrOpen}
        onApply={data => handleCruiseExtracted(data)}
      />
    </div>
  )
}
