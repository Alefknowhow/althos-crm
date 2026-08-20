// Registry de módulos por nicho — ponto único de decisão sobre o que cada
// vertical vê no menu. Motor/rota de cada módulo continua Core (nunca há
// código duplicado por nicho); só a visibilidade varia daqui.
//
// Ao adicionar um nicho novo (Imobiliárias, Advocacia, Seguros — já
// cadastrados como opção em NICHE_OPTIONS, lib/niche.ts, mas sem módulos
// dedicados ainda), a extensão é: criar um isXNiche() em lib/niche.ts +
// uma lista XXX_ONLY aqui, sem tocar nos componentes que chamam
// isModuleEnabled().

import { isTravelNiche, isClinicNiche } from './niche'

export type ModuleKey =
  // Módulos específicos da vertical de Viagens.
  | 'cotacoes' | 'roteirista' | 'ofertas' | 'embarques' | 'bloqueios' | 'reservas' | 'documentos_viagem'
  // Módulos específicos da vertical de Clínicas.
  | 'profissionais' | 'orcamentos_clinica' | 'atendimentos_clinica' | 'tratamentos_clinica' | 'lista_espera_clinica' | 'comissoes_clinica' | 'retornos_clinica'
  // Módulos genéricos do CRM core, sem uso em Viagens (a agência não tem
  // uma necessidade de agenda de compromissos separada da operação de
  // venda/reserva, e Catálogo/Vendas já têm equivalente na vertical —
  // Ofertas e Reservas) — por isso ficam ocultos só pra esse nicho.
  | 'catalogo' | 'vendas' | 'agendamentos'

const TRAVEL_ONLY: ModuleKey[] = ['cotacoes', 'roteirista', 'ofertas', 'embarques', 'bloqueios', 'reservas', 'documentos_viagem']
const CLINIC_ONLY: ModuleKey[] = ['profissionais', 'orcamentos_clinica', 'atendimentos_clinica', 'tratamentos_clinica', 'lista_espera_clinica', 'comissoes_clinica', 'retornos_clinica']
// "Não-travel" — visível pra qualquer nicho que não seja Viagens (inclui
// Clínicas, que usa agenda/catálogo igual qualquer negócio genérico).
const GENERIC_ONLY: ModuleKey[] = ['catalogo', 'vendas', 'agendamentos']

/** Todo módulo não listado em TRAVEL_ONLY/CLINIC_ONLY/GENERIC_ONLY é Core
 *  puro/extensível — sempre visível, independente do nicho (ex.: Pipeline,
 *  Tarefas, Agendamentos — clínica usa agenda igual qualquer outro nicho
 *  genérico, por isso não está em nenhuma lista aqui). */
export function isModuleEnabled(niche: string | null | undefined, key: ModuleKey): boolean {
  const travel = isTravelNiche(niche)
  const clinic = isClinicNiche(niche)
  if (TRAVEL_ONLY.includes(key)) return travel
  if (CLINIC_ONLY.includes(key)) return clinic
  if (GENERIC_ONLY.includes(key)) return !travel
  return true
}
