import type { ModuleConfig } from './crud'

/**
 * Módulos dos nichos de seguros e agências de tráfego — ver crud.ts.
 * Nomes de módulo (`campanhas_trafego`, `criativos_trafego`) evitam
 * colidir com as tools bespoke get_campaigns/get_campaign_performance
 * (tools/campaigns.ts), que continuam existindo pra métrica agregada.
 */
export const SEGUROS_TRAFEGO_MODULES: ModuleConfig[] = [
  {
    key: 'apolices_seguro',
    table: 'insurance_policies',
    label: 'Apólice de seguro',
    permissionKey: 'seguros',
    selectColumns: 'id, policy_number, quote_id, contato_id, insurance_product_id, insurer_id, broker_user_id, premium_cents, start_date, end_date, payment_method, installments_count, commission_cents, status, notes, created_at',
    searchColumn: 'policy_number',
    orderBy: { column: 'created_at', ascending: false },
    writableFields: [
      'quote_id', 'contato_id', 'insurance_product_id', 'insurer_id', 'broker_user_id',
      'premium_cents', 'start_date', 'end_date', 'payment_method', 'installments_count',
      'commission_cents', 'notes', 'status',
    ],
    requiredCreateFields: ['contato_id', 'insurer_id'],
  },
  {
    key: 'sinistros_seguro',
    table: 'insurance_claims',
    label: 'Sinistro de seguro',
    permissionKey: 'seguros',
    selectColumns: 'id, policy_id, contato_id, claim_type, occurred_at, protocol_number, description, responsavel_user_id, status, notes, created_at',
    orderBy: { column: 'created_at', ascending: false },
    writableFields: ['policy_id', 'contato_id', 'claim_type', 'occurred_at', 'protocol_number', 'description', 'responsavel_user_id', 'notes', 'status'],
    requiredCreateFields: ['policy_id', 'contato_id'],
  },
  {
    key: 'seguradoras',
    table: 'insurers',
    label: 'Seguradora',
    permissionKey: 'seguros',
    selectColumns: 'id, name, cnpj, contact_name, contact_phone, contact_email, conditions, is_active, created_at',
    searchColumn: 'name',
    writableFields: ['name', 'cnpj', 'contact_name', 'contact_phone', 'contact_email', 'conditions', 'is_active'],
    requiredCreateFields: ['name'],
  },
  {
    key: 'campanhas_trafego',
    table: 'campaigns',
    label: 'Campanha de anúncio',
    permissionKey: 'trafego',
    selectColumns: 'id, ad_account_id, name, objective, status, utm_campaign, color, started_at, ended_at, external_id, created_at',
    searchColumn: 'name',
    orderBy: { column: 'started_at', ascending: false },
    writableFields: ['ad_account_id', 'name', 'objective', 'status', 'utm_campaign', 'color', 'started_at', 'ended_at', 'external_id'],
    requiredCreateFields: ['ad_account_id', 'name'],
  },
  {
    key: 'criativos_trafego',
    table: 'campaign_creatives',
    label: 'Criativo de campanha',
    permissionKey: 'trafego',
    selectColumns: 'id, contato_id, campaign_id, storage_key, media_type, title, description, status, client_comment, created_at',
    orderBy: { column: 'created_at', ascending: false },
    writableFields: ['contato_id', 'campaign_id', 'storage_key', 'media_type', 'title', 'description', 'status', 'client_comment'],
    requiredCreateFields: ['campaign_id', 'storage_key'],
  },
]
