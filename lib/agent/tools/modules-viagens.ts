import type { ModuleConfig } from './crud'

/** Módulos do nicho de viagens — ver crud.ts. */
export const VIAGENS_MODULES: ModuleConfig[] = [
  {
    key: 'cotacoes',
    table: 'travel_proposals',
    label: 'Cotação de viagem',
    permissionKey: 'cotacoes',
    capabilityKey: 'vertical.travel.cotacoes',
    selectColumns: 'id, title, status, contato_id, client_name, start_date, end_date, destinations, total_cents, pax_count, price_per_person_cents, public_token, created_at',
    searchColumn: 'client_name',
    orderBy: { column: 'created_at', ascending: false },
    writableFields: [
      'title', 'status', 'contato_id', 'start_date', 'end_date', 'client_name', 'travelers',
      'travelers_note', 'destinations', 'flights', 'hotels', 'services', 'included', 'not_included',
      'checklist', 'total_cents', 'pax_count', 'price_per_person_cents', 'payment', 'itinerary', 'notes',
    ],
    requiredCreateFields: ['title'],
  },
  {
    key: 'reservas',
    table: 'travel_sales',
    label: 'Reserva de viagem',
    permissionKey: 'reservas',
    capabilityKey: 'vertical.travel.reservas',
    selectColumns: 'id, sale_number, status, contato_id, proposal_id, client_name, destination, departure_date, return_date, total_cents, hotel_name, airline, operator, package_locator, air_locator, created_at',
    searchColumn: 'client_name',
    orderBy: { column: 'departure_date', ascending: false },
    writableFields: [
      'status', 'client_name', 'destination', 'departure_date', 'return_date', 'negotiation_days',
      'total_cents', 'hotel_name', 'airline', 'operator', 'included_items', 'travelers', 'travelers_note',
      'payment_method', 'package_locator', 'air_locator', 'hotel_locator', 'airline_checkin_url',
      'commission_cents', 'retained_commission_cents', 'notes', 'cancellation_policy', 'important_info',
      'service_info', 'flights', 'contato_id', 'proposal_id',
    ],
    requiredCreateFields: ['client_name'],
  },
  {
    key: 'produtos_reserva',
    table: 'sale_products',
    label: 'Produto de reserva (voo/hotel/transfer/etc.)',
    permissionKey: 'reservas',
    capabilityKey: 'vertical.travel.reservas',
    selectColumns: 'id, sale_id, kind, status, sort_order, data, created_at',
    orderBy: { column: 'sort_order' },
    writableFields: ['sale_id', 'kind', 'status', 'data'],
    requiredCreateFields: ['sale_id', 'kind'],
  },
  {
    key: 'bloqueios',
    table: 'travel_blocks',
    label: 'Bloqueio de voo',
    permissionKey: 'bloqueios',
    capabilityKey: 'vertical.travel.bloqueios',
    selectColumns: 'id, origem, destino, data_ida, data_volta, voo_ida, horario_ida, voo_volta, horario_volta, assentos_total, assentos_disponiveis, prazo, observacoes, created_at',
    orderBy: { column: 'data_ida' },
    writableFields: [
      'origem', 'destino', 'data_ida', 'data_volta', 'voo_ida', 'horario_ida', 'voo_volta',
      'horario_volta', 'assentos_total', 'assentos_disponiveis', 'prazo', 'observacoes',
    ],
    requiredCreateFields: ['origem', 'destino', 'data_ida'],
  },
]
