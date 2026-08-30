// Registry de módulos por nicho — ponto único de decisão sobre o que cada
// vertical vê no menu. Motor/rota de cada módulo continua Core (nunca há
// código duplicado por nicho); só a visibilidade varia daqui.
//
// Ao adicionar um nicho novo (Imobiliárias, Advocacia, Seguros — já
// cadastrados como opção em NICHE_OPTIONS, lib/niche.ts, mas sem módulos
// dedicados ainda), a extensão é: criar um isXNiche() em lib/niche.ts +
// uma lista XXX_ONLY aqui, sem tocar nos componentes que chamam
// isModuleEnabled().

import { isTravelNiche, isClinicNiche, isRealEstateNiche, isInsuranceNiche, isTrafficNiche } from './niche'

export type ModuleKey =
  // Módulos específicos da vertical de Viagens.
  | 'cotacoes' | 'roteirista' | 'ofertas' | 'embarques' | 'bloqueios' | 'reservas' | 'documentos_viagem'
  // Módulos específicos da vertical de Clínicas.
  | 'profissionais' | 'orcamentos_clinica' | 'atendimentos_clinica' | 'tratamentos_clinica' | 'lista_espera_clinica' | 'comissoes_clinica' | 'retornos_clinica' | 'prontuario_clinica' | 'estoque_clinica'
  // Módulos específicos da vertical de Imobiliárias.
  | 'imoveis'
  // Módulos específicos da vertical de Seguros.
  | 'seguros'
  // Módulos específicos da vertical de Agências de Tráfego.
  | 'trafego'
  // Módulos genéricos do CRM core, sem uso em Viagens (a agência não tem
  // uma necessidade de agenda de compromissos separada da operação de
  // venda/reserva, e Catálogo/Vendas já têm equivalente na vertical —
  // Ofertas e Reservas) — por isso ficam ocultos só pra esse nicho.
  | 'catalogo' | 'vendas' | 'agendamentos'

const TRAVEL_ONLY: ModuleKey[] = ['cotacoes', 'roteirista', 'ofertas', 'embarques', 'bloqueios', 'reservas', 'documentos_viagem']
const CLINIC_ONLY: ModuleKey[] = ['profissionais', 'orcamentos_clinica', 'atendimentos_clinica', 'tratamentos_clinica', 'lista_espera_clinica', 'comissoes_clinica', 'retornos_clinica', 'prontuario_clinica', 'estoque_clinica']
// Prontuário existe no banco/código mas fica com visibilidade travada em
// false até uma decisão de compliance — ver docs/audit/clinicas-lgpd.md.
// O log de acesso (clinic_data_access_log) já foi implementado (item 1 da
// recomendação da auditoria); os itens 2-5 (aviso de conteúdo, retenção,
// consentimento, revisão jurídica dos termos) ainda estão em aberto.
// Pra habilitar: trocar PRONTUARIO_ENABLED pra true depois de decidir
// isso — não precisa mexer em mais nada, o módulo já está pronto.
const PRONTUARIO_ENABLED = false
const REAL_ESTATE_ONLY: ModuleKey[] = ['imoveis']
const INSURANCE_ONLY: ModuleKey[] = ['seguros']
const TRAFFIC_ONLY: ModuleKey[] = ['trafego']
// "Não-travel" — visível pra qualquer nicho que não seja Viagens (inclui
// Clínicas, que usa agenda/catálogo igual qualquer negócio genérico).
const GENERIC_ONLY: ModuleKey[] = ['catalogo', 'vendas', 'agendamentos']
// Dentro de GENERIC_ONLY, nada faz sentido pra Imobiliária: vendas duplica
// Negociações (property_deals, Fase 3), agendamentos duplica Visitas
// (property_visits, Fase 2), e catálogo não tem equivalente na vertical —
// o CRM de imóveis não vende produtos de catálogo genérico.
const NOT_REAL_ESTATE: ModuleKey[] = ['vendas', 'agendamentos', 'catalogo']
// Clínicas mantém Agendamentos (é a agenda real do negócio), mas Vendas e
// Catálogo ficam ocultos: o procedimento com preço já vive em Tipos de
// Evento/clinic_service_context, e a "venda" é o próprio agendamento
// concluído (vira Atendimento + lançamento em Financeiro automaticamente) —
// manter os dois genéricos em paralelo só duplicava dado desconectado.
const NOT_CLINIC: ModuleKey[] = ['vendas', 'catalogo']

/** Todo módulo não listado em TRAVEL_ONLY/CLINIC_ONLY/REAL_ESTATE_ONLY/
 *  INSURANCE_ONLY/GENERIC_ONLY é Core puro/extensível — sempre visível,
 *  independente do nicho (ex.: Pipeline, Tarefas, Agendamentos — clínica
 *  usa agenda igual qualquer outro nicho genérico, por isso não está em
 *  nenhuma lista aqui). Seguros (Fase 1) ainda não exclui nada de
 *  GENERIC_ONLY — o CRM genérico continua em uso até cotações/apólices
 *  existirem nas próximas fases. */
export function isModuleEnabled(niche: string | null | undefined, key: ModuleKey): boolean {
  const travel = isTravelNiche(niche)
  const clinic = isClinicNiche(niche)
  const realEstate = isRealEstateNiche(niche)
  const insurance = isInsuranceNiche(niche)
  const traffic = isTrafficNiche(niche)
  if (key === 'prontuario_clinica') return clinic && PRONTUARIO_ENABLED
  if (TRAVEL_ONLY.includes(key)) return travel
  if (CLINIC_ONLY.includes(key)) return clinic
  if (REAL_ESTATE_ONLY.includes(key)) return realEstate
  if (INSURANCE_ONLY.includes(key)) return insurance
  if (TRAFFIC_ONLY.includes(key)) return traffic
  if (GENERIC_ONLY.includes(key)) {
    return !travel
      && !(realEstate && NOT_REAL_ESTATE.includes(key))
      && !(clinic && NOT_CLINIC.includes(key))
  }
  return true
}
