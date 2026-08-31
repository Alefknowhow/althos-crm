/**
 * Mapeia o resultado da extração de voucher (`ExtractedTravelDocument`, ver
 * lib/ai/document-extract.ts) pros campos de `travel_sales` — usado tanto na
 * criação da venda (upload de voucher no "Nova venda") quanto no botão
 * "Add voucher" numa venda já existente. Fica num módulo puro (sem I/O) pra
 * não duplicar a regra nos dois pontos de entrada.
 */

import type { ExtractedTravelDocument } from '@/lib/ai/document-extract'

/** Chaves batendo com INCLUDED_ITEMS em TravelSalesView.tsx. */
export function deriveIncludedItems(extracted: ExtractedTravelDocument): string[] {
  const items: string[] = []
  if ((extracted.voos || []).length > 0) items.push('voos')
  if ((extracted.hospedagens || []).length > 0) items.push('hospedagem')
  if ((extracted.transfers || []).length > 0) items.push('transfer')
  if ((extracted.cruzeiros || []).length > 0) items.push('cruzeiros')
  if ((extracted.seguros || []).length > 0) items.push('seguro')
  if ((extracted.passeios || []).length > 0) items.push('passeios')
  if ((extracted.locacoes || []).length > 0) items.push('carros')
  return items
}

/** Compara o nome extraído com as operadoras já cadastradas (Configurações
 *  → Financeiro → Operadoras) — exata primeiro, depois "contém", sem
 *  distinguir maiúsculas/acentos exatos. Sem match, devolve o texto bruto
 *  (o campo de operadora aceita texto livre quando não está na lista). */
export function matchOperator(raw: string | null | undefined, options: string[]): string | null {
  const name = (raw || '').trim()
  if (!name) return null
  const norm = (s: string) => s.trim().toLowerCase()
  const exact = options.find(o => norm(o) === norm(name))
  if (exact) return exact
  const partial = options.find(o => norm(o).includes(norm(name)) || norm(name).includes(norm(o)))
  return partial || name
}

/** Viajantes extraídos, excluindo o titular (já é o cliente da venda). */
export function extractedTravelers(
  extracted: ExtractedTravelDocument,
  clientName?: string | null,
): { name: string; birth_date: string; cpf: string }[] {
  if (!Array.isArray(extracted.viajantes) || extracted.viajantes.length === 0) return []
  const titular = (clientName || extracted.cliente || '').trim().toLowerCase()
  return extracted.viajantes
    .filter(v => v.nome && v.nome.trim().toLowerCase() !== titular)
    .map(v => ({ name: v.nome || '', birth_date: v.data_nascimento || '', cpf: v.cpf || '' }))
}

/** Patch de campos escalares de `travel_sales` a partir do documento extraído. */
export function extractedToSaleFieldsPatch(
  extracted: ExtractedTravelDocument,
  opts: { operatorOptions: string[]; existingIncludedItems?: string[] },
): Record<string, any> {
  const patch: Record<string, any> = {}
  if (extracted.destino) patch.destination = extracted.destino
  if (extracted.data_ida) patch.departure_date = extracted.data_ida
  if (extracted.data_volta) patch.return_date = extracted.data_volta
  if (extracted.localizador_pacote) patch.package_locator = extracted.localizador_pacote
  if (extracted.localizador_aereo) patch.air_locator = extracted.localizador_aereo
  if (extracted.valor_total_cents) patch.total_cents = extracted.valor_total_cents
  if (extracted.observacoes) patch.notes = extracted.observacoes
  if (extracted.informacoes_importantes) patch.important_info = extracted.informacoes_importantes
  if (extracted.politica_cancelamento) patch.cancellation_policy = extracted.politica_cancelamento
  if (extracted.informacoes_servico) patch.service_info = extracted.informacoes_servico

  const operator = matchOperator(extracted.operadora, opts.operatorOptions)
  if (operator) patch.operator = operator

  const derived = deriveIncludedItems(extracted)
  if (derived.length > 0) {
    const existing = opts.existingIncludedItems || []
    patch.included_items = Array.from(new Set([...existing, ...derived]))
  }

  return patch
}
