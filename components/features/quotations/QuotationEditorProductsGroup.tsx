'use client'

/**
 * Grupo "Produtos" do editor de cotação — Aéreo, Hospedagens, Cruzeiro,
 * Transfers, Seguros, Passeios/Ingressos e Locação de veículo.
 *
 * Extraído de QuotationEditor.tsx (pura movimentação de JSX, sem mudança de
 * comportamento) — recebe o estado relevante e os setters via props. Cada
 * produto agora vive no seu próprio arquivo sibling (QuotationEditorFlightsBlock,
 * QuotationEditorLodgingsBlock, QuotationEditorCruiseBlock,
 * QuotationEditorMiscBlocks) pra manter este arquivo abaixo do limite de linhas.
 */

import { GroupSection, type GroupId } from './QuotationEditorFields'
import type {
  Lodging, Flight, Cruise, Transfer, Insurance, Tour, Rental, QuotationTopState,
} from './QuotationEditorTypes'
import QuotationEditorFlightsBlock from './QuotationEditorFlightsBlock'
import QuotationEditorLodgingsBlock from './QuotationEditorLodgingsBlock'
import QuotationEditorCruiseBlock from './QuotationEditorCruiseBlock'
import {
  QuotationEditorTransfersBlock, QuotationEditorInsuranceBlock, QuotationEditorToursBlock, QuotationEditorRentalsBlock,
} from './QuotationEditorMiscBlocks'

export default function QuotationEditorProductsGroup({
  orgSlug, activeGroup, q, setQ,
  flights, setFlights, setFlightOcrOpen, flightsTextOpen, setFlightsTextOpen,
  lodgings, setLodgings, taBusy, taLookup,
  cruises, setCruises, setCruiseOcrOpen,
  transfers, setTransfers,
  insurances, setInsurances,
  tours, setTours,
  rentals, setRentals,
}: {
  orgSlug: string
  activeGroup: GroupId
  q: QuotationTopState
  setQ: React.Dispatch<React.SetStateAction<QuotationTopState>>
  flights: Flight[]; setFlights: React.Dispatch<React.SetStateAction<Flight[]>>
  setFlightOcrOpen: (v: boolean) => void
  flightsTextOpen: boolean; setFlightsTextOpen: (v: boolean) => void
  lodgings: Lodging[]; setLodgings: React.Dispatch<React.SetStateAction<Lodging[]>>
  taBusy: string | null; taLookup: (l: Lodging) => void
  cruises: Cruise[]; setCruises: React.Dispatch<React.SetStateAction<Cruise[]>>
  setCruiseOcrOpen: (v: boolean) => void
  transfers: Transfer[]; setTransfers: React.Dispatch<React.SetStateAction<Transfer[]>>
  insurances: Insurance[]; setInsurances: React.Dispatch<React.SetStateAction<Insurance[]>>
  tours: Tour[]; setTours: React.Dispatch<React.SetStateAction<Tour[]>>
  rentals: Rental[]; setRentals: React.Dispatch<React.SetStateAction<Rental[]>>
}) {
  return (
    <GroupSection id="produtos" active={activeGroup}>
      <QuotationEditorFlightsBlock
        orgSlug={orgSlug} q={q} setQ={setQ} flights={flights} setFlights={setFlights}
        setFlightOcrOpen={setFlightOcrOpen} flightsTextOpen={flightsTextOpen} setFlightsTextOpen={setFlightsTextOpen}
      />

      <QuotationEditorLodgingsBlock
        orgSlug={orgSlug} q={q} lodgings={lodgings} setLodgings={setLodgings} taBusy={taBusy} taLookup={taLookup}
      />

      {/* CRUZEIRO — primeiro tipo de produto novo do Construtor de Viagens.
          Mesma infra de add/editar/ordenar/excluir (SortableList) que
          Hospedagens/Aéreo já usam; só os campos mudam. */}
      <QuotationEditorCruiseBlock
        q={q} cruises={cruises} setCruises={setCruises} setCruiseOcrOpen={setCruiseOcrOpen}
      />

      <QuotationEditorTransfersBlock q={q} transfers={transfers} setTransfers={setTransfers} />

      <QuotationEditorInsuranceBlock q={q} insurances={insurances} setInsurances={setInsurances} />

      <QuotationEditorToursBlock q={q} tours={tours} setTours={setTours} />

      <QuotationEditorRentalsBlock q={q} rentals={rentals} setRentals={setRentals} />
    </GroupSection>
  )
}
