/**
 * Travel document extraction via Gemini Flash (native inline image/PDF
 * vision). Split out of lib/ai/document-extract.ts.
 */

import { GoogleGenAI, Type } from '@google/genai'
import type { ExtractedTravelDocument } from './document-extract-types'
import { TRAVELERS_PROMPT_HINT } from './document-extract-types'
import { normalizeExtractedDocument } from './document-extract-normalize'

const EXTRACT_SYSTEM_PROMPT = 'Você extrai dados estruturados de documentos de viagem (orçamentos, vouchers de operadora, reservas) em português do Brasil. Extraia TODOS os produtos presentes no documento (hospedagem, voo, cruzeiro, transfer, seguro, passeio/ingresso, locação de veículo) — um documento pode ter vários produtos do mesmo tipo. Quando um campo não estiver presente no documento, use null (ou array vazio quando aplicável). Para cada trecho aéreo (`voos`), NUNCA deixe a data de embarque (`data`) vazia se ela aparecer no documento em qualquer formato (ex.: "Dom. 06 de set. de 2026") — sempre converta pra YYYY-MM-DD. Cada trecho/conexão do voucher é um item separado em `voos`, marcado com o mesmo `sentido` (ida ou volta); quando houver conexão/escala entre dois trechos do mesmo sentido, preencha `escala_local` e `escala_duracao` no trecho que vem DEPOIS da escala. Sempre que o documento informar código de aeroporto (IATA), número de bilhete, código de web check-in, horário de chegada e franquia de bagagem, extraia esses campos também. ' + TRAVELERS_PROMPT_HINT

const arrayField = (props: Record<string, any>, required: string[]) => ({
  type: Type.ARRAY,
  items: { type: Type.OBJECT, properties: props, required },
})

const GEMINI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    cliente: { type: Type.STRING, nullable: true },
    destino: { type: Type.STRING, nullable: true },
    hotel: { type: Type.STRING, nullable: true },
    operadora: { type: Type.STRING, nullable: true },
    localizador_pacote: { type: Type.STRING, nullable: true },
    localizador_aereo: { type: Type.STRING, nullable: true },
    data_ida: { type: Type.STRING, nullable: true },
    data_volta: { type: Type.STRING, nullable: true },
    voos: arrayField({
      companhia: { type: Type.STRING, nullable: true },
      numero: { type: Type.STRING, nullable: true },
      data: { type: Type.STRING, nullable: true },
      origem: { type: Type.STRING, nullable: true },
      destino: { type: Type.STRING, nullable: true },
      horario: { type: Type.STRING, nullable: true },
      sentido: { type: Type.STRING, nullable: true, enum: ['ida', 'volta'] },
      localizador_checkin: { type: Type.STRING, nullable: true },
      bilhete: { type: Type.STRING, nullable: true },
      origem_codigo: { type: Type.STRING, nullable: true },
      destino_codigo: { type: Type.STRING, nullable: true },
      hora_embarque: { type: Type.STRING, nullable: true },
      data_chegada: { type: Type.STRING, nullable: true },
      hora_chegada: { type: Type.STRING, nullable: true },
      duracao: { type: Type.STRING, nullable: true },
      bagagem: { type: Type.STRING, nullable: true },
      escala_local: { type: Type.STRING, nullable: true },
      escala_duracao: { type: Type.STRING, nullable: true },
    }, []),
    hospedagens: arrayField({
      nome: { type: Type.STRING, nullable: true },
      check_in: { type: Type.STRING, nullable: true },
      check_out: { type: Type.STRING, nullable: true },
      categoria_quarto: { type: Type.STRING, nullable: true },
      regime: { type: Type.STRING, nullable: true },
      localizador: { type: Type.STRING, nullable: true },
      hora_checkin: { type: Type.STRING, nullable: true },
      hora_checkout: { type: Type.STRING, nullable: true },
      endereco: { type: Type.STRING, nullable: true },
      email: { type: Type.STRING, nullable: true },
      telefone: { type: Type.STRING, nullable: true },
      titular: { type: Type.STRING, nullable: true },
      informacoes_adicionais: { type: Type.STRING, nullable: true },
      politica_cancelamento: { type: Type.STRING, nullable: true },
      condicoes: { type: Type.STRING, nullable: true },
    }, []),
    cruzeiros: arrayField({
      companhia: { type: Type.STRING, nullable: true },
      navio: { type: Type.STRING, nullable: true },
      roteiro: { type: Type.STRING, nullable: true },
      embarque_porto: { type: Type.STRING, nullable: true },
      embarque_data: { type: Type.STRING, nullable: true },
      desembarque_porto: { type: Type.STRING, nullable: true },
      desembarque_data: { type: Type.STRING, nullable: true },
      noites: { type: Type.INTEGER, nullable: true },
      cabine: { type: Type.STRING, nullable: true },
    }, []),
    transfers: arrayField({
      origem: { type: Type.STRING, nullable: true },
      destino: { type: Type.STRING, nullable: true },
      data: { type: Type.STRING, nullable: true },
      horario: { type: Type.STRING, nullable: true },
      veiculo: { type: Type.STRING, nullable: true },
      tipo: { type: Type.STRING, nullable: true },
    }, []),
    seguros: arrayField({
      seguradora: { type: Type.STRING, nullable: true },
      plano: { type: Type.STRING, nullable: true },
      destino: { type: Type.STRING, nullable: true },
      cobertura: { type: Type.STRING, nullable: true },
      data_inicio: { type: Type.STRING, nullable: true },
      data_fim: { type: Type.STRING, nullable: true },
    }, []),
    passeios: arrayField({
      nome: { type: Type.STRING, nullable: true },
      descricao: { type: Type.STRING, nullable: true },
      data: { type: Type.STRING, nullable: true },
      duracao: { type: Type.STRING, nullable: true },
    }, []),
    locacoes: arrayField({
      locadora: { type: Type.STRING, nullable: true },
      categoria_veiculo: { type: Type.STRING, nullable: true },
      retirada_local: { type: Type.STRING, nullable: true },
      devolucao_local: { type: Type.STRING, nullable: true },
      retirada_data: { type: Type.STRING, nullable: true },
      devolucao_data: { type: Type.STRING, nullable: true },
    }, []),
    condicoes_pagamento: arrayField({
      forma: { type: Type.STRING, nullable: true, enum: ['pix', 'cartao', 'boleto'] },
      condicao: { type: Type.STRING, nullable: true },
    }, []),
    traslado: { type: Type.BOOLEAN },
    seguro: { type: Type.BOOLEAN },
    valor_total_cents: { type: Type.INTEGER, nullable: true },
    observacoes: { type: Type.STRING, nullable: true },
    informacoes_importantes: { type: Type.STRING, nullable: true },
    informacoes_servico: { type: Type.STRING, nullable: true },
    politica_cancelamento: { type: Type.STRING, nullable: true },
    viajantes: arrayField({
      nome: { type: Type.STRING, nullable: true },
      data_nascimento: { type: Type.STRING, nullable: true },
      cpf: { type: Type.STRING, nullable: true },
    }, []),
  },
  required: ['cliente', 'destino', 'hotel', 'operadora', 'localizador_pacote', 'localizador_aereo', 'data_ida', 'data_volta', 'voos', 'hospedagens', 'cruzeiros', 'transfers', 'seguros', 'passeios', 'locacoes', 'condicoes_pagamento', 'traslado', 'seguro', 'valor_total_cents', 'observacoes', 'informacoes_importantes', 'informacoes_servico', 'politica_cancelamento', 'viajantes'],
}

/** Mesma extração, via Gemini Flash (visão nativa a imagem/PDF inline). */
export async function extractTravelDocumentFromFileGemini(
  apiKey: string,
  base64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf',
): Promise<ExtractedTravelDocument> {
  const ai = new GoogleGenAI({ apiKey })

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: mediaType, data: base64 } },
        { text: 'Extraia os dados deste documento de viagem — todos os produtos, valores e políticas.' },
      ],
    }],
    config: {
      systemInstruction: EXTRACT_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  })

  const text = response.text
  if (!text) throw new Error('IA não retornou dados extraídos')

  return normalizeExtractedDocument(JSON.parse(text))
}
