// Registry de módulos por nicho — ponto único de decisão sobre o que cada
// vertical vê no menu. Motor/rota de cada módulo continua Core (nunca há
// código duplicado por nicho); só a visibilidade varia daqui.
//
// Ao adicionar um nicho novo (Clínicas, Imobiliárias, Advocacia, Seguros —
// já cadastrados como opção em NICHE_OPTIONS, lib/niche.ts, mas sem módulos
// dedicados ainda), a extensão é: criar as chaves TRAVEL_ONLY-like pra esse
// nicho aqui, sem tocar nos componentes que chamam isModuleEnabled().

import { isTravelNiche } from './niche'

export type ModuleKey =
  // Módulos específicos da vertical de Viagens.
  | 'cotacoes' | 'roteirista' | 'ofertas' | 'embarques' | 'bloqueios' | 'reservas' | 'documentos_viagem'
  // Módulos genéricos do CRM core, substituídos por um equivalente de
  // Viagens (Ofertas no lugar de Catálogo, Reservas no lugar de Vendas) —
  // por isso ficam ocultos só pra esse nicho, não pra todos os outros.
  | 'catalogo' | 'vendas'

const TRAVEL_ONLY: ModuleKey[] = ['cotacoes', 'roteirista', 'ofertas', 'embarques', 'bloqueios', 'reservas', 'documentos_viagem']
const GENERIC_ONLY: ModuleKey[] = ['catalogo', 'vendas']

/** Todo módulo não listado em TRAVEL_ONLY/GENERIC_ONLY é Core puro/extensível
 *  — sempre visível, independente do nicho (ex.: Agendamentos, Pipeline). */
export function isModuleEnabled(niche: string | null | undefined, key: ModuleKey): boolean {
  const travel = isTravelNiche(niche)
  if (TRAVEL_ONLY.includes(key)) return travel
  if (GENERIC_ONLY.includes(key)) return !travel
  return true
}
