'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'

/**
 * Dados complementares da reserva pro painel de detalhe de Embarques —
 * separado de travel-schedule.ts (que já cobre o necessário pra lista/gantt)
 * pra não estourar o limite de linhas do arquivo.
 */

export type TripTraveler = {
  name?: string
  birth_date?: string
  cpf?: string
  /** Nº Passaporte / Vencimento do passaporte — preservados da versão
   *  anterior desta issue (issue #9 § 5), preenchidos em Reservas ›
   *  Viajantes (getContatoTravelerInfo ou digitação manual). */
  passport_number?: string
  passport_expiry?: string
}
export type TripVoucher = { url: string; name: string }

export type TripDetailExtra = {
  sale_number: string | null
  travelers: TripTraveler[]
  vouchers: TripVoucher[]
}

type TravelSaleExtraRow = { sale_number: string | null; travelers: unknown; vouchers: unknown }

/** Viajantes e vouchers da reserva — carregados só quando o painel lateral
 *  de detalhe é aberto (Gestão de Viagens › ver viagem). */
export async function getTripDetailExtra(orgSlug: string, saleId: string): Promise<TripDetailExtra | null> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('travel_sales')
    .select('sale_number, travelers, vouchers')
    .eq('organization_id', org.id)
    .eq('id', saleId)
    .maybeSingle()
  const row = data as TravelSaleExtraRow | null
  if (!row) return null
  return {
    sale_number: row.sale_number ?? null,
    travelers: Array.isArray(row.travelers) ? row.travelers as TripTraveler[] : [],
    vouchers: Array.isArray(row.vouchers) ? row.vouchers as TripVoucher[] : [],
  }
}
