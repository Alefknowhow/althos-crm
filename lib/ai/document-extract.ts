/**
 * Extração de dados de documentos de viagem (voucher de operadora, print de
 * reserva, etc.) via visão do Claude — sem lib de OCR separada. O SDK
 * suporta blocos de conteúdo `image` (base64 jpeg/png/gif/webp) e
 * `document` (base64 PDF) nativamente em `messages.create`.
 *
 * Mesmo padrão de `lib/ai/qualifier.ts`: tool_choice forçado garante saída
 * estruturada, sem parsing de markdown.
 */

import Anthropic from '@anthropic-ai/sdk'

export type ExtractedTravelDocument = {
  cliente: string | null
  destino: string | null
  hotel: string | null
  operadora: string | null
  localizador_pacote: string | null
  localizador_aereo: string | null
  data_ida: string | null
  data_volta: string | null
  voos: { companhia: string | null; data: string | null; origem: string | null; destino: string | null }[]
  traslado: boolean
  seguro: boolean
  valor_total_cents: number | null
  observacoes: string | null
}

const EXTRACT_TOOL: Anthropic.Messages.Tool = {
  name: 'extract_travel_document',
  description: 'Extrai os dados estruturados de um voucher, reserva ou orçamento de viagem.',
  input_schema: {
    type: 'object',
    properties: {
      cliente: { type: ['string', 'null'], description: 'Nome do cliente/passageiro principal, se identificável' },
      destino: { type: ['string', 'null'], description: 'Destino principal da viagem' },
      hotel: { type: ['string', 'null'], description: 'Nome do hotel/hospedagem' },
      operadora: { type: ['string', 'null'], description: 'Operadora/companhia responsável pelo pacote' },
      localizador_pacote: { type: ['string', 'null'], description: 'Código localizador do pacote/reserva' },
      localizador_aereo: { type: ['string', 'null'], description: 'Código localizador do voo (PNR)' },
      data_ida: { type: ['string', 'null'], description: 'Data de ida no formato YYYY-MM-DD' },
      data_volta: { type: ['string', 'null'], description: 'Data de volta no formato YYYY-MM-DD' },
      voos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            companhia: { type: ['string', 'null'] },
            data: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
            origem: { type: ['string', 'null'] },
            destino: { type: ['string', 'null'] },
          },
          required: ['companhia', 'data', 'origem', 'destino'],
        },
      },
      traslado: { type: 'boolean', description: 'true se o documento menciona traslado incluso' },
      seguro: { type: 'boolean', description: 'true se o documento menciona seguro viagem incluso' },
      valor_total_cents: { type: ['integer', 'null'], description: 'Valor total em centavos, se houver um valor monetário no documento' },
      observacoes: { type: ['string', 'null'], description: 'Outras informações relevantes não cobertas pelos campos acima, em 1-2 frases' },
    },
    required: ['cliente', 'destino', 'hotel', 'operadora', 'localizador_pacote', 'localizador_aereo', 'data_ida', 'data_volta', 'voos', 'traslado', 'seguro', 'valor_total_cents', 'observacoes'],
  },
}

export async function extractTravelDocumentFromFile(
  apiKey: string,
  base64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf',
): Promise<ExtractedTravelDocument> {
  const client = new Anthropic({ apiKey })

  const contentBlock: Anthropic.Messages.ContentBlockParam =
    mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: 'Você extrai dados estruturados de documentos de viagem (vouchers de operadora, reservas, orçamentos) em português do Brasil. Responda sempre com a ferramenta extract_travel_document. Quando um campo não estiver presente no documento, use null (ou array vazio para voos, ou false para traslado/seguro).',
    messages: [{
      role: 'user',
      content: [
        contentBlock,
        { type: 'text', text: 'Extraia os dados deste documento de viagem.' },
      ],
    }],
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'extract_travel_document' },
  })

  const toolBlock = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
  )
  if (!toolBlock) throw new Error('IA não retornou bloco de tool_use')

  const parsed = toolBlock.input as any
  return {
    cliente: typeof parsed.cliente === 'string' ? parsed.cliente.slice(0, 200) : null,
    destino: typeof parsed.destino === 'string' ? parsed.destino.slice(0, 200) : null,
    hotel: typeof parsed.hotel === 'string' ? parsed.hotel.slice(0, 200) : null,
    operadora: typeof parsed.operadora === 'string' ? parsed.operadora.slice(0, 160) : null,
    localizador_pacote: typeof parsed.localizador_pacote === 'string' ? parsed.localizador_pacote.slice(0, 80) : null,
    localizador_aereo: typeof parsed.localizador_aereo === 'string' ? parsed.localizador_aereo.slice(0, 80) : null,
    data_ida: /^\d{4}-\d{2}-\d{2}$/.test(parsed.data_ida) ? parsed.data_ida : null,
    data_volta: /^\d{4}-\d{2}-\d{2}$/.test(parsed.data_volta) ? parsed.data_volta : null,
    voos: Array.isArray(parsed.voos)
      ? parsed.voos.slice(0, 10).map((v: any) => ({
          companhia: typeof v?.companhia === 'string' ? v.companhia.slice(0, 120) : null,
          data: /^\d{4}-\d{2}-\d{2}$/.test(v?.data) ? v.data : null,
          origem: typeof v?.origem === 'string' ? v.origem.slice(0, 120) : null,
          destino: typeof v?.destino === 'string' ? v.destino.slice(0, 120) : null,
        }))
      : [],
    traslado: !!parsed.traslado,
    seguro: !!parsed.seguro,
    valor_total_cents: Number.isFinite(Number(parsed.valor_total_cents)) && parsed.valor_total_cents != null
      ? Math.round(Number(parsed.valor_total_cents))
      : null,
    observacoes: typeof parsed.observacoes === 'string' ? parsed.observacoes.slice(0, 600) : null,
  }
}
