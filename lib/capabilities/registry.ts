import type { CapabilityKey, CapabilityRule } from './types'

/**
 * Fonte única das regras de cada capability (issue #31). Pura — sem I/O —
 * pra ser testável e importável tanto client quanto server (o enforcement
 * de verdade acontece em lib/capabilities/resolve.server.ts, que é o único
 * lugar que efetivamente CONSULTA banco/RPC; este arquivo só descreve QUAIS
 * regras existem).
 *
 * Capabilities sem nenhuma regra (objeto vazio) são intencionalmente
 * "sempre permitidas a qualquer membro" — hoje é o caso de Dashboards,
 * Reviews e Contracts, que a auditoria #31 confirmou não terem gate
 * dedicado nenhum sistema existente. Registrá-las mesmo assim (em vez de
 * omitir) é o que torna o registry "fonte central": todo capability key
 * usado em algum lugar do app aparece aqui, mesmo que hoje não bloqueie
 * ninguém — fica explícito, revisável, e pronto pra ganhar uma regra real
 * sem precisar caçar quem consome.
 */
export const CAPABILITY_REGISTRY: Record<CapabilityKey, CapabilityRule> = {
  // ── Core ──────────────────────────────────────────────────────────────
  'core.contacts':      { permission: 'leads' },
  'core.pipeline':       { permission: 'pipeline' },
  'core.sales':          { permission: 'sales' },
  'core.agenda':         { permission: 'calendar', module: 'agendamentos' },
  'core.forms':          { permission: 'forms' },
  'core.automations':    { permission: 'automations' },
  'core.conversations':  { permission: 'conversations', feature: 'whatsapp' },
  'core.ads':            { permission: 'campaigns', feature: 'meta_ads_panel' },
  'core.sales_coach':    { permission: 'sales_coach', feature: 'sales_coach' },
  'core.voice':          { permission: 'voice', feature: 'voice' },
  'core.campaigns':      { permission: 'marketing', feature: 'bulk_campaigns' },
  'core.dashboards':     {},
  'core.reports':        { feature: 'export_reports' },
  'core.reviews':        {},
  'core.contracts':      {},

  // ── Vertical: Viagens ─────────────────────────────────────────────────
  'vertical.travel':               { requiresNiche: 'viagens' },
  'vertical.travel.cotacoes':      { permission: 'cotacoes', module: 'cotacoes' },
  'vertical.travel.roteirista':    { permission: 'roteirista', module: 'roteirista' },
  'vertical.travel.ofertas':       { permission: 'ofertas', module: 'ofertas' },
  'vertical.travel.embarques':     { permission: 'embarques', module: 'embarques' },
  'vertical.travel.bloqueios':     { permission: 'bloqueios', module: 'bloqueios' },
  'vertical.travel.reservas':      { permission: 'reservas', module: 'reservas' },
  'vertical.travel.documentos':    { permission: 'documentos', module: 'documentos_viagem' },

  // ── Vertical: Clínicas ────────────────────────────────────────────────
  'vertical.clinic':                { requiresNiche: 'clinicas' },
  'vertical.clinic.profissionais':  { permission: 'profissionais', module: 'profissionais' },
  'vertical.clinic.orcamentos':     { permission: 'orcamentos_clinica', module: 'orcamentos_clinica' },
  'vertical.clinic.atendimentos':   { permission: 'atendimentos_clinica', module: 'atendimentos_clinica' },
  'vertical.clinic.tratamentos':    { permission: 'tratamentos_clinica', module: 'tratamentos_clinica' },
  'vertical.clinic.lista_espera':   { permission: 'lista_espera_clinica', module: 'lista_espera_clinica' },
  'vertical.clinic.comissoes':      { permission: 'comissoes_clinica', module: 'comissoes_clinica' },
  // Sem PermissionKey dedicada hoje (auditoria #31) — só o módulo/kill-switch gateiam.
  'vertical.clinic.retornos':       { module: 'retornos_clinica' },
  'vertical.clinic.prontuario':     { permission: 'prontuario_clinica', module: 'prontuario_clinica' },
  'vertical.clinic.estoque':        { permission: 'estoque_clinica', module: 'estoque_clinica' },

  // ── Verticais com granularidade única ──────────────────────────────────
  'vertical.real_estate': { permission: 'imoveis', module: 'imoveis' },
  'vertical.insurance':   { permission: 'seguros', module: 'seguros' },
  'vertical.traffic':     { permission: 'trafego', module: 'trafego' },
}
