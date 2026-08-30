/**
 * Parser de NF-e (Nota Fiscal Eletrônica brasileira) em XML — usado pela
 * importação de NF do módulo Estoque (Clínicas). Cobre o layout padrão
 * (<nfeProc>/<NFe>/<infNFe>, versões 3.10/4.00) de forma tolerante: extrai
 * só os campos usados pela tela de revisão (não valida o schema completo,
 * não calcula impostos). Sem dependências externas — regex sobre o texto do
 * XML é suficiente para os poucos campos que precisamos e evita adicionar
 * um parser de XML só para isso.
 */

export type ParsedNfeItem = {
  description_raw: string
  quantity: number
  unit_cost_cents: number | null
  total_cost_cents: number | null
}

export type ParsedNfe = {
  nf_number: string | null
  supplier_name: string | null
  issued_at: string | null // YYYY-MM-DD
  total_cents: number | null
  items: ParsedNfeItem[]
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`, 'i'))
  return m ? m[1].trim() : null
}

function toCents(value: string | null): number | null {
  if (!value) return null
  const n = Number(value)
  if (Number.isNaN(n)) return null
  return Math.round(n * 100)
}

export function parseNfeXml(xml: string): ParsedNfe {
  const nNF = tag(xml, 'nNF')
  const dhEmi = tag(xml, 'dhEmi') || tag(xml, 'dEmi')
  const issued_at = dhEmi ? dhEmi.slice(0, 10) : null

  const emitBlock = xml.match(/<emit>([\s\S]*?)<\/emit>/i)?.[1] || ''
  const supplier_name = tag(emitBlock, 'xFant') || tag(emitBlock, 'xNome')

  const totalBlock = xml.match(/<ICMSTot>([\s\S]*?)<\/ICMSTot>/i)?.[1] || xml.match(/<total>([\s\S]*?)<\/total>/i)?.[1] || ''
  const total_cents = toCents(tag(totalBlock, 'vNF'))

  const items: ParsedNfeItem[] = []
  const detMatches = Array.from(xml.matchAll(/<det[^>]*>([\s\S]*?)<\/det>/gi))
  for (const det of detMatches) {
    const block = det[1]
    const prodBlock = block.match(/<prod>([\s\S]*?)<\/prod>/i)?.[1] || block
    const description_raw = tag(prodBlock, 'xProd') || 'Item sem descrição'
    const qtyRaw = tag(prodBlock, 'qCom') || tag(prodBlock, 'qTrib')
    const unitRaw = tag(prodBlock, 'vUnCom') || tag(prodBlock, 'vUnTrib')
    const totalRaw = tag(prodBlock, 'vProd')
    const quantity = qtyRaw ? Number(qtyRaw) : 0
    items.push({
      description_raw,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unit_cost_cents: toCents(unitRaw),
      total_cost_cents: toCents(totalRaw),
    })
  }

  return { nf_number: nNF, supplier_name, issued_at, total_cents, items }
}
