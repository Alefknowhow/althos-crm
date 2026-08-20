/**
 * Extração de dados de documentos financeiros (nota fiscal, boleto,
 * recibo, comprovante) via visão do Claude/Gemini — mesmo padrão de
 * lib/ai/document-extract.ts (extração de documentos de viagem):
 * tool_choice forçado (Claude) / responseSchema (Gemini), sem lib de OCR
 * separada.
 */

import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI, Type } from '@google/genai'

export type ExtractedFinancialDocument = {
  tipo: 'receita' | 'despesa' | null
  descricao: string | null
  emissor: string | null
  cpf_cnpj: string | null
  valor_cents: number | null
  data_emissao: string | null
  vencimento: string | null
  numero_documento: string | null
  categoria_sugerida: string | null
  observacoes: string | null
}

const EXTRACT_TOOL: Anthropic.Messages.Tool = {
  name: 'extract_financial_document',
  description: 'Extrai os dados estruturados de um documento financeiro (nota fiscal, boleto, recibo, comprovante de pagamento).',
  input_schema: {
    type: 'object',
    properties: {
      tipo: { type: ['string', 'null'], enum: ['receita', 'despesa', null], description: 'receita se o documento representa um valor a receber (nota fiscal emitida, fatura enviada); despesa se é uma conta/boleto/nota de compra a pagar. null se não for possível inferir.' },
      descricao: { type: ['string', 'null'], description: 'Descrição curta do que o documento representa, ex.: "Nota fiscal — serviços de consultoria"' },
      emissor: { type: ['string', 'null'], description: 'Nome de quem emitiu o documento (empresa/pessoa)' },
      cpf_cnpj: { type: ['string', 'null'], description: 'CPF ou CNPJ do emissor, somente dígitos' },
      valor_cents: { type: ['integer', 'null'], description: 'Valor total em centavos' },
      data_emissao: { type: ['string', 'null'], description: 'Data de emissão do documento, formato YYYY-MM-DD' },
      vencimento: { type: ['string', 'null'], description: 'Data de vencimento/pagamento, formato YYYY-MM-DD, se houver' },
      numero_documento: { type: ['string', 'null'], description: 'Número da nota fiscal, boleto ou documento' },
      categoria_sugerida: { type: ['string', 'null'], description: 'Categoria financeira sugerida com base no conteúdo, em 1-3 palavras (ex.: "Aluguel", "Software", "Consultoria")' },
      observacoes: { type: ['string', 'null'], description: 'Outras informações relevantes não cobertas pelos campos acima, em 1-2 frases' },
    },
    required: ['tipo', 'descricao', 'emissor', 'cpf_cnpj', 'valor_cents', 'data_emissao', 'vencimento', 'numero_documento', 'categoria_sugerida', 'observacoes'],
  },
}

const SYSTEM_PROMPT = 'Você extrai dados estruturados de documentos financeiros (nota fiscal, boleto, recibo, comprovante) em português do Brasil. Quando um campo não estiver presente no documento, use null.'

export async function extractFinancialDocumentFromFile(
  apiKey: string,
  base64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf',
): Promise<ExtractedFinancialDocument> {
  const client = new Anthropic({ apiKey })

  const contentBlock: Anthropic.Messages.ContentBlockParam =
    mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        contentBlock,
        { type: 'text', text: 'Extraia os dados financeiros deste documento.' },
      ],
    }],
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'extract_financial_document' },
  })

  const toolBlock = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
  )
  if (!toolBlock) throw new Error('IA não retornou bloco de tool_use')

  return normalizeExtracted(toolBlock.input)
}

const GEMINI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    tipo: { type: Type.STRING, nullable: true, enum: ['receita', 'despesa'] },
    descricao: { type: Type.STRING, nullable: true },
    emissor: { type: Type.STRING, nullable: true },
    cpf_cnpj: { type: Type.STRING, nullable: true },
    valor_cents: { type: Type.INTEGER, nullable: true },
    data_emissao: { type: Type.STRING, nullable: true },
    vencimento: { type: Type.STRING, nullable: true },
    numero_documento: { type: Type.STRING, nullable: true },
    categoria_sugerida: { type: Type.STRING, nullable: true },
    observacoes: { type: Type.STRING, nullable: true },
  },
  required: ['tipo', 'descricao', 'emissor', 'cpf_cnpj', 'valor_cents', 'data_emissao', 'vencimento', 'numero_documento', 'categoria_sugerida', 'observacoes'],
}

export async function extractFinancialDocumentFromFileGemini(
  apiKey: string,
  base64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf',
): Promise<ExtractedFinancialDocument> {
  const ai = new GoogleGenAI({ apiKey })

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: mediaType, data: base64 } },
        { text: 'Extraia os dados financeiros deste documento.' },
      ],
    }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  })

  const text = response.text
  if (!text) throw new Error('IA não retornou dados extraídos')

  return normalizeExtracted(JSON.parse(text))
}

function normalizeExtracted(parsed: any): ExtractedFinancialDocument {
  return {
    tipo: parsed.tipo === 'receita' || parsed.tipo === 'despesa' ? parsed.tipo : null,
    descricao: typeof parsed.descricao === 'string' ? parsed.descricao.slice(0, 300) : null,
    emissor: typeof parsed.emissor === 'string' ? parsed.emissor.slice(0, 200) : null,
    cpf_cnpj: typeof parsed.cpf_cnpj === 'string' ? parsed.cpf_cnpj.replace(/\D/g, '').slice(0, 14) : null,
    valor_cents: Number.isFinite(Number(parsed.valor_cents)) && parsed.valor_cents != null
      ? Math.round(Number(parsed.valor_cents))
      : null,
    data_emissao: /^\d{4}-\d{2}-\d{2}$/.test(parsed.data_emissao) ? parsed.data_emissao : null,
    vencimento: /^\d{4}-\d{2}-\d{2}$/.test(parsed.vencimento) ? parsed.vencimento : null,
    numero_documento: typeof parsed.numero_documento === 'string' ? parsed.numero_documento.slice(0, 80) : null,
    categoria_sugerida: typeof parsed.categoria_sugerida === 'string' ? parsed.categoria_sugerida.slice(0, 80) : null,
    observacoes: typeof parsed.observacoes === 'string' ? parsed.observacoes.slice(0, 400) : null,
  }
}
