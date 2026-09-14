import type { ModuleConfig } from './crud'

/**
 * Módulos dos nichos de clínicas e imobiliárias — ver crud.ts.
 * `clinic_medical_records` (prontuário) fica DE FORA de propósito: é dado
 * clínico sensível (PHI), com log de acesso e permissão dedicada
 * (requireProntuarioAccess) no app — não entra no CRUD genérico do agente.
 */
export const CLINICAS_IMOVEIS_MODULES: ModuleConfig[] = [
  {
    key: 'atendimentos_clinica',
    table: 'clinic_attendances',
    label: 'Atendimento clínico',
    permissionKey: 'atendimentos_clinica',
    selectColumns: 'id, patient_contato_id, professional_id, event_type_id, attended_at, notes, recommendations, next_return_date, total_cents, discount_cents, payment_method, installments, created_at',
    orderBy: { column: 'attended_at', ascending: false },
    writableFields: [
      'patient_contato_id', 'professional_id', 'event_type_id', 'attended_at', 'notes',
      'recommendations', 'next_return_date', 'total_cents', 'discount_cents', 'payment_method', 'installments',
    ],
    requiredCreateFields: ['patient_contato_id', 'attended_at'],
  },
  {
    key: 'profissionais_clinica',
    table: 'clinic_professionals',
    label: 'Profissional (clínica)',
    permissionKey: 'profissionais',
    selectColumns: 'id, contato_id, name, specialty_id, registration_no, commission_pct, active, phone, email, created_at',
    searchColumn: 'name',
    writableFields: ['contato_id', 'specialty_id', 'registration_no', 'commission_pct', 'active'],
    requiredCreateFields: ['contato_id'],
  },
  {
    key: 'tratamentos_clinica',
    table: 'clinic_treatments',
    label: 'Tratamento/pacote clínico',
    permissionKey: 'tratamentos_clinica',
    selectColumns: 'id, patient_contato_id, professional_id, event_type_id, name, total_sessions, sessions_done, status, notes, created_at',
    orderBy: { column: 'created_at', ascending: false },
    writableFields: ['patient_contato_id', 'professional_id', 'event_type_id', 'name', 'total_sessions', 'sessions_done', 'status', 'notes'],
    requiredCreateFields: ['patient_contato_id', 'name'],
  },
  {
    key: 'lista_espera_clinica',
    table: 'clinic_waitlist',
    label: 'Lista de espera clínica',
    permissionKey: 'lista_espera_clinica',
    selectColumns: 'id, patient_contato_id, professional_id, event_type_id, preferred_from, preferred_until, preferred_time, notes, status, created_at',
    orderBy: { column: 'created_at' },
    writableFields: ['patient_contato_id', 'professional_id', 'event_type_id', 'preferred_from', 'preferred_until', 'preferred_time', 'notes', 'status'],
    requiredCreateFields: ['patient_contato_id'],
  },
  {
    key: 'orcamentos_clinica',
    table: 'clinic_quotes',
    label: 'Orçamento clínico',
    permissionKey: 'orcamentos_clinica',
    selectColumns: 'id, patient_contato_id, professional_id, valid_until, discount_cents, notes, status, created_at',
    orderBy: { column: 'created_at', ascending: false },
    writableFields: ['patient_contato_id', 'professional_id', 'valid_until', 'discount_cents', 'notes', 'status'],
    requiredCreateFields: ['patient_contato_id'],
  },
  {
    key: 'imoveis',
    table: 'properties',
    label: 'Imóvel',
    permissionKey: 'imoveis',
    selectColumns: 'id, code, title, property_type, purpose, status, price_cents, condo_fee_cents, iptu_cents, neighborhood, city, state, bedrooms, bathrooms, parking_spots, area_total, owner_contato_id, broker_user_id, is_exclusive, commission_percent, created_at',
    searchColumn: 'title',
    orderBy: { column: 'created_at', ascending: false },
    writableFields: [
      'code', 'title', 'property_type', 'purpose', 'status', 'price_cents', 'condo_fee_cents', 'iptu_cents',
      'address_street', 'address_number', 'address_complement', 'neighborhood', 'city', 'state', 'zip',
      'bedrooms', 'suites', 'bathrooms', 'parking_spots', 'area_built', 'area_total', 'area_useful', 'floor',
      'rooms_count', 'features', 'description_html', 'owner_contato_id', 'broker_user_id', 'capture_source',
      'is_exclusive', 'exclusivity_until', 'commission_percent',
    ],
    requiredCreateFields: ['title'],
  },
  {
    key: 'negociacoes_imoveis',
    table: 'property_deals',
    label: 'Negociação de imóvel',
    permissionKey: 'imoveis',
    selectColumns: 'id, property_id, proposal_id, contato_id, owner_contato_id, broker_user_id, deal_type, final_price_cents, commission_cents, monthly_rent_cents, lease_start_date, lease_end_date, status, closed_at, notes, created_at',
    orderBy: { column: 'created_at', ascending: false },
    // Fluxo real só expõe transição de status (fechar/cancelar/reabrir) —
    // sem update genérico de campo pra não conflitar com essas regras.
    writableFields: ['status', 'notes'],
  },
  {
    key: 'visitas_imoveis',
    table: 'property_visits',
    label: 'Visita a imóvel',
    permissionKey: 'imoveis',
    selectColumns: 'id, property_id, contato_id, broker_user_id, scheduled_at, status, notes, canceled_reason, created_at',
    orderBy: { column: 'scheduled_at' },
    writableFields: ['property_id', 'contato_id', 'broker_user_id', 'scheduled_at', 'notes', 'status', 'canceled_reason'],
    requiredCreateFields: ['property_id', 'contato_id', 'scheduled_at'],
  },
]
