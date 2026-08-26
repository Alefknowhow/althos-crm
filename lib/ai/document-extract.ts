/**
 * Extração de dados de documentos de viagem (voucher de operadora, print de
 * reserva, orçamento completo, etc.) via visão do Claude — sem lib de OCR
 * separada. O SDK suporta blocos de conteúdo `image` (base64 jpeg/png/gif/
 * webp) e `document` (base64 PDF) nativamente em `messages.create`.
 *
 * Cobre todos os tipos de produto do Construtor de Viagens (hospedagem,
 * aéreo, cruzeiro, transfer, seguro, passeio, locação de veículo) — o botão
 * "Autopreencher com IA" do editor de cotações lê um documento (orçamento
 * de fornecedor, voucher, etc.) e preenche todos os produtos identificados,
 * não só hotel/voo como na versão anterior.
 *
 * Mesmo padrão de `lib/ai/qualifier.ts`: tool_choice forçado garante saída
 * estruturada, sem parsing de markdown.
 */

import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI, Type } from '@google/genai'

export type ExtractedTravelDocument = {
  cliente: string | null
  destino: string | null
  /** Nome da primeira hospedagem extraída — usado pelas telas de Reservas/
   *  Financeiro, que só lidam com um hotel por vez (ver `hospedagens` pra
   *  a lista completa, usada pelo editor de Cotações). */
  hotel: string | null
  operadora: string | null
  localizador_pacote: string | null
  localizador_aereo: string | null
  data_ida: string | null
  data_volta: string | null
  voos: {
    companhia: string | null
    numero: string | null
    data: string | null
    origem: string | null
    destino: string | null
    horario: string | null
    sentido: 'ida' | 'volta' | null
    /** Código do web check-in / localizador deste trecho (pode variar por bilhete). */
    localizador_checkin: string | null
    /** Número do bilhete/ticket, quando informado. */
    bilhete: string | null
    /** Código IATA do aeroporto de origem, ex.: "FLN". */
    origem_codigo: string | null
    /** Código IATA do aeroporto de destino, ex.: "BSB". */
    destino_codigo: string | null
    /** Horário de embarque (partida), ex.: "11:40". */
    hora_embarque: string | null
    /** Data de chegada — pode diferir da data de embarque em voos noturnos. YYYY-MM-DD. */
    data_chegada: string | null
    /** Horário de chegada (desembarque), ex.: "13:55". */
    hora_chegada: string | null
    /** Duração do trecho, ex.: "2h 15". */
    duracao: string | null
    /** Franquia de bagagem deste trecho/bilhete, ex.: "1 bagagem de mão + 1 despachada 23kg". */
    bagagem: string | null
    /** Se este trecho vem depois de uma conexão, onde foi a espera. */
    escala_local: string | null
    /** Tempo de espera na conexão antes deste trecho, ex.: "1h 45". */
    escala_duracao: string | null
  }[]
  hospedagens: {
    nome: string | null
    check_in: string | null
    check_out: string | null
    categoria_quarto: string | null
    regime: string | null
  }[]
  cruzeiros: {
    companhia: string | null
    navio: string | null
    roteiro: string | null
    embarque_porto: string | null
    embarque_data: string | null
    desembarque_porto: string | null
    desembarque_data: string | null
    noites: number | null
    cabine: string | null
  }[]
  transfers: {
    origem: string | null
    destino: string | null
    data: string | null
    horario: string | null
    veiculo: string | null
    tipo: string | null
  }[]
  seguros: {
    seguradora: string | null
    plano: string | null
    destino: string | null
    cobertura: string | null
    data_inicio: string | null
    data_fim: string | null
  }[]
  passeios: {
    nome: string | null
    descricao: string | null
    data: string | null
    duracao: string | null
  }[]
  locacoes: {
    locadora: string | null
    categoria_veiculo: string | null
    retirada_local: string | null
    devolucao_local: string | null
    retirada_data: string | null
    devolucao_data: string | null
  }[]
  condicoes_pagamento: {
    forma: 'pix' | 'cartao' | 'boleto' | null
    condicao: string | null
  }[]
  /** Espelha `transfers.length > 0` — mantido pra compatibilidade com
   *  Reservas/Financeiro (ver `transfers` pra a lista completa). */
  traslado: boolean
  /** Espelha `seguros.length > 0` — ver nota de `traslado` acima. */
  seguro: boolean
  valor_total_cents: number | null
  observacoes: string | null
  informacoes_importantes: string | null
  informacoes_servico: string | null
  politica_cancelamento: string | null
  viajantes: {
    nome: string | null
    data_nascimento: string | null
    cpf: string | null
  }[]
}

const EXTRACT_TOOL: Anthropic.Messages.Tool = {
  name: 'extract_travel_document',
  description: 'Extrai os dados estruturados de um orçamento, voucher ou reserva de viagem — todos os produtos presentes (hospedagem, voo, cruzeiro, transfer, seguro, passeio, locação de veículo), valores e políticas.',
  input_schema: {
    type: 'object',
    properties: {
      cliente: { type: ['string', 'null'], description: 'Nome do cliente/passageiro principal, se identificável' },
      destino: { type: ['string', 'null'], description: 'Destino principal da viagem' },
      hotel: { type: ['string', 'null'], description: 'Nome da primeira/principal hospedagem (também detalhada em `hospedagens`)' },
      operadora: { type: ['string', 'null'], description: 'Operadora/companhia responsável pelo pacote' },
      localizador_pacote: { type: ['string', 'null'], description: 'Código localizador do pacote/reserva' },
      localizador_aereo: { type: ['string', 'null'], description: 'Código localizador do voo (PNR)' },
      data_ida: { type: ['string', 'null'], description: 'Data de ida no formato YYYY-MM-DD' },
      data_volta: { type: ['string', 'null'], description: 'Data de volta no formato YYYY-MM-DD' },
      voos: {
        type: 'array',
        description: 'Todos os trechos aéreos do documento',
        items: {
          type: 'object',
          properties: {
            companhia: { type: ['string', 'null'] },
            numero: { type: ['string', 'null'], description: 'Número do voo, ex.: "AD 4657" ou "4185/2932"' },
            data: { type: ['string', 'null'], description: 'Data de embarque, YYYY-MM-DD' },
            origem: { type: ['string', 'null'], description: 'Cidade/aeroporto de origem' },
            destino: { type: ['string', 'null'], description: 'Cidade/aeroporto de destino' },
            horario: { type: ['string', 'null'], description: 'Horário de partida-chegada do trecho, ex.: "05:45 - 07:00"' },
            sentido: { type: ['string', 'null'], enum: ['ida', 'volta', null], description: 'Se o trecho é da ida ou da volta' },
            localizador_checkin: { type: ['string', 'null'], description: 'Código do web check-in / localizador deste trecho ou bilhete' },
            bilhete: { type: ['string', 'null'], description: 'Número do bilhete/ticket, se houver' },
            origem_codigo: { type: ['string', 'null'], description: 'Código IATA do aeroporto de origem, ex.: "FLN"' },
            destino_codigo: { type: ['string', 'null'], description: 'Código IATA do aeroporto de destino, ex.: "BSB"' },
            hora_embarque: { type: ['string', 'null'], description: 'Horário de embarque, ex.: "11:40"' },
            data_chegada: { type: ['string', 'null'], description: 'Data de chegada (pode diferir da data de embarque), YYYY-MM-DD' },
            hora_chegada: { type: ['string', 'null'], description: 'Horário de chegada, ex.: "13:55"' },
            duracao: { type: ['string', 'null'], description: 'Duração do trecho, ex.: "2h 15"' },
            bagagem: { type: ['string', 'null'], description: 'Franquia de bagagem deste trecho/bilhete' },
            escala_local: { type: ['string', 'null'], description: 'Local da conexão/escala antes deste trecho, se houver (ex.: "BSB - Brasília")' },
            escala_duracao: { type: ['string', 'null'], description: 'Tempo de espera na conexão antes deste trecho, ex.: "1h 45"' },
          },
          required: [
            'companhia', 'numero', 'data', 'origem', 'destino', 'horario', 'sentido',
            'localizador_checkin', 'bilhete', 'origem_codigo', 'destino_codigo',
            'hora_embarque', 'data_chegada', 'hora_chegada', 'duracao', 'bagagem',
            'escala_local', 'escala_duracao',
          ],
        },
      },
      hospedagens: {
        type: 'array',
        description: 'Todas as hospedagens/hotéis do documento (pode ser mais de um, ex.: roteiro com 2 cidades)',
        items: {
          type: 'object',
          properties: {
            nome: { type: ['string', 'null'] },
            check_in: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
            check_out: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
            categoria_quarto: { type: ['string', 'null'], description: 'Ex.: "Standard", "Suíte vista mar"' },
            regime: { type: ['string', 'null'], description: 'Ex.: "Café da manhã", "All inclusive"' },
          },
          required: ['nome', 'check_in', 'check_out', 'categoria_quarto', 'regime'],
        },
      },
      cruzeiros: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            companhia: { type: ['string', 'null'] },
            navio: { type: ['string', 'null'] },
            roteiro: { type: ['string', 'null'] },
            embarque_porto: { type: ['string', 'null'] },
            embarque_data: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
            desembarque_porto: { type: ['string', 'null'] },
            desembarque_data: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
            noites: { type: ['integer', 'null'] },
            cabine: { type: ['string', 'null'], description: 'Categoria da cabine, ex.: "Varanda"' },
          },
          required: ['companhia', 'navio', 'roteiro', 'embarque_porto', 'embarque_data', 'desembarque_porto', 'desembarque_data', 'noites', 'cabine'],
        },
      },
      transfers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            origem: { type: ['string', 'null'] },
            destino: { type: ['string', 'null'] },
            data: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
            horario: { type: ['string', 'null'] },
            veiculo: { type: ['string', 'null'] },
            tipo: { type: ['string', 'null'], description: 'Ex.: "Privativo", "Compartilhado"' },
          },
          required: ['origem', 'destino', 'data', 'horario', 'veiculo', 'tipo'],
        },
      },
      seguros: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            seguradora: { type: ['string', 'null'] },
            plano: { type: ['string', 'null'] },
            destino: { type: ['string', 'null'] },
            cobertura: { type: ['string', 'null'], description: 'Resumo das principais coberturas' },
            data_inicio: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
            data_fim: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
          },
          required: ['seguradora', 'plano', 'destino', 'cobertura', 'data_inicio', 'data_fim'],
        },
      },
      passeios: {
        type: 'array',
        description: 'Passeios, ingressos e atrações mencionados',
        items: {
          type: 'object',
          properties: {
            nome: { type: ['string', 'null'] },
            descricao: { type: ['string', 'null'] },
            data: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
            duracao: { type: ['string', 'null'], description: 'Ex.: "4 horas"' },
          },
          required: ['nome', 'descricao', 'data', 'duracao'],
        },
      },
      locacoes: {
        type: 'array',
        description: 'Locação de veículo/carro',
        items: {
          type: 'object',
          properties: {
            locadora: { type: ['string', 'null'] },
            categoria_veiculo: { type: ['string', 'null'] },
            retirada_local: { type: ['string', 'null'] },
            devolucao_local: { type: ['string', 'null'] },
            retirada_data: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
            devolucao_data: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
          },
          required: ['locadora', 'categoria_veiculo', 'retirada_local', 'devolucao_local', 'retirada_data', 'devolucao_data'],
        },
      },
      condicoes_pagamento: {
        type: 'array',
        description: 'Formas de pagamento e condições mencionadas (Pix, cartão, boleto)',
        items: {
          type: 'object',
          properties: {
            forma: { type: ['string', 'null'], enum: ['pix', 'cartao', 'boleto', null] },
            condicao: { type: ['string', 'null'], description: 'Ex.: "à vista", "em até 10x sem juros"' },
          },
          required: ['forma', 'condicao'],
        },
      },
      traslado: { type: 'boolean', description: 'true se o documento menciona traslado incluso' },
      seguro: { type: 'boolean', description: 'true se o documento menciona seguro viagem incluso' },
      valor_total_cents: { type: ['integer', 'null'], description: 'Valor total em centavos, se houver um valor monetário no documento' },
      observacoes: { type: ['string', 'null'], description: 'Outras informações relevantes não cobertas pelos campos acima, em 1-2 frases' },
      informacoes_importantes: { type: ['string', 'null'], description: 'Informações importantes do documento — documentação exigida, vacinas, contatos de emergência, o que o cliente precisa saber antes de fechar' },
      informacoes_servico: { type: ['string', 'null'], description: 'Informações sobre os serviços contratados — o que está incluso, horários, condições de uso, etc.' },
      politica_cancelamento: { type: ['string', 'null'], description: 'Texto da política/regras de cancelamento, alteração e multas, se houver' },
      viajantes: {
        type: 'array',
        description: 'Lista de viajantes/passageiros mencionados no documento (nome, data de nascimento, CPF), sem duplicar a mesma pessoa',
        items: {
          type: 'object',
          properties: {
            nome: { type: ['string', 'null'] },
            data_nascimento: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
            cpf: { type: ['string', 'null'], description: 'Somente dígitos' },
          },
          required: ['nome', 'data_nascimento', 'cpf'],
        },
      },
    },
    required: ['cliente', 'destino', 'hotel', 'operadora', 'localizador_pacote', 'localizador_aereo', 'data_ida', 'data_volta', 'voos', 'hospedagens', 'cruzeiros', 'transfers', 'seguros', 'passeios', 'locacoes', 'condicoes_pagamento', 'traslado', 'seguro', 'valor_total_cents', 'observacoes', 'informacoes_importantes', 'informacoes_servico', 'politica_cancelamento', 'viajantes'],
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
    max_tokens: 2400,
    system: 'Você extrai dados estruturados de documentos de viagem (orçamentos, vouchers de operadora, reservas) em português do Brasil. Extraia TODOS os produtos presentes no documento (hospedagem, voo, cruzeiro, transfer, seguro, passeio/ingresso, locação de veículo) — um documento pode ter vários produtos do mesmo tipo. Responda sempre com a ferramenta extract_travel_document. Quando um campo não estiver presente no documento, use null (ou array vazio quando aplicável).',
    messages: [{
      role: 'user',
      content: [
        contentBlock,
        { type: 'text', text: 'Extraia os dados deste documento de viagem — todos os produtos, valores e políticas.' },
      ],
    }],
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'extract_travel_document' },
  })

  const toolBlock = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
  )
  if (!toolBlock) throw new Error('IA não retornou bloco de tool_use')

  return normalizeExtractedDocument(toolBlock.input)
}

const EXTRACT_SYSTEM_PROMPT = 'Você extrai dados estruturados de documentos de viagem (orçamentos, vouchers de operadora, reservas) em português do Brasil. Extraia TODOS os produtos presentes no documento (hospedagem, voo, cruzeiro, transfer, seguro, passeio/ingresso, locação de veículo) — um documento pode ter vários produtos do mesmo tipo. Quando um campo não estiver presente no documento, use null (ou array vazio quando aplicável). Para cada trecho aéreo (`voos`), NUNCA deixe a data de embarque (`data`) vazia se ela aparecer no documento em qualquer formato (ex.: "Dom. 06 de set. de 2026") — sempre converta pra YYYY-MM-DD. Cada trecho/conexão do voucher é um item separado em `voos`, marcado com o mesmo `sentido` (ida ou volta); quando houver conexão/escala entre dois trechos do mesmo sentido, preencha `escala_local` e `escala_duracao` no trecho que vem DEPOIS da escala. Sempre que o documento informar código de aeroporto (IATA), número de bilhete, código de web check-in, horário de chegada e franquia de bagagem, extraia esses campos também.'

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

function str(v: any, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.slice(0, max) : null
}
function date(v: any): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}
function int(v: any): number | null {
  return v != null && Number.isFinite(Number(v)) ? Math.round(Number(v)) : null
}

function normalizeExtractedDocument(parsed: any): ExtractedTravelDocument {
  const hospedagens = Array.isArray(parsed.hospedagens)
    ? parsed.hospedagens.slice(0, 10).map((h: any) => ({
        nome: str(h?.nome, 200),
        check_in: date(h?.check_in),
        check_out: date(h?.check_out),
        categoria_quarto: str(h?.categoria_quarto, 120),
        regime: str(h?.regime, 80),
      })).filter((h: any) => h.nome)
    : []
  const transfers = Array.isArray(parsed.transfers)
    ? parsed.transfers.slice(0, 10).map((t: any) => ({
        origem: str(t?.origem, 120),
        destino: str(t?.destino, 120),
        data: date(t?.data),
        horario: str(t?.horario, 40),
        veiculo: str(t?.veiculo, 120),
        tipo: str(t?.tipo, 80),
      })).filter((t: any) => t.origem || t.destino)
    : []
  const seguros = Array.isArray(parsed.seguros)
    ? parsed.seguros.slice(0, 5).map((s: any) => ({
        seguradora: str(s?.seguradora, 120),
        plano: str(s?.plano, 120),
        destino: str(s?.destino, 120),
        cobertura: str(s?.cobertura, 600),
        data_inicio: date(s?.data_inicio),
        data_fim: date(s?.data_fim),
      })).filter((s: any) => s.seguradora || s.plano)
    : []
  return {
    cliente: str(parsed.cliente, 200),
    destino: str(parsed.destino, 200),
    hotel: str(parsed.hotel, 200) || hospedagens[0]?.nome || null,
    operadora: str(parsed.operadora, 160),
    localizador_pacote: str(parsed.localizador_pacote, 80),
    localizador_aereo: str(parsed.localizador_aereo, 80),
    data_ida: date(parsed.data_ida),
    data_volta: date(parsed.data_volta),
    voos: Array.isArray(parsed.voos)
      ? parsed.voos.slice(0, 10).map((v: any) => ({
          companhia: str(v?.companhia, 120),
          numero: str(v?.numero, 40),
          data: date(v?.data),
          origem: str(v?.origem, 120),
          destino: str(v?.destino, 120),
          horario: str(v?.horario, 40),
          sentido: v?.sentido === 'ida' || v?.sentido === 'volta' ? v.sentido : null,
          localizador_checkin: str(v?.localizador_checkin, 60),
          bilhete: str(v?.bilhete, 60),
          origem_codigo: str(v?.origem_codigo, 8),
          destino_codigo: str(v?.destino_codigo, 8),
          hora_embarque: str(v?.hora_embarque, 20),
          data_chegada: date(v?.data_chegada),
          hora_chegada: str(v?.hora_chegada, 20),
          duracao: str(v?.duracao, 40),
          bagagem: str(v?.bagagem, 200),
          escala_local: str(v?.escala_local, 120),
          escala_duracao: str(v?.escala_duracao, 40),
        }))
      : [],
    hospedagens,
    cruzeiros: Array.isArray(parsed.cruzeiros)
      ? parsed.cruzeiros.slice(0, 5).map((c: any) => ({
          companhia: str(c?.companhia, 120),
          navio: str(c?.navio, 120),
          roteiro: str(c?.roteiro, 160),
          embarque_porto: str(c?.embarque_porto, 120),
          embarque_data: date(c?.embarque_data),
          desembarque_porto: str(c?.desembarque_porto, 120),
          desembarque_data: date(c?.desembarque_data),
          noites: int(c?.noites),
          cabine: str(c?.cabine, 80),
        })).filter((c: any) => c.navio || c.companhia)
      : [],
    transfers,
    seguros,
    passeios: Array.isArray(parsed.passeios)
      ? parsed.passeios.slice(0, 15).map((p: any) => ({
          nome: str(p?.nome, 200),
          descricao: str(p?.descricao, 600),
          data: date(p?.data),
          duracao: str(p?.duracao, 40),
        })).filter((p: any) => p.nome)
      : [],
    locacoes: Array.isArray(parsed.locacoes)
      ? parsed.locacoes.slice(0, 5).map((l: any) => ({
          locadora: str(l?.locadora, 120),
          categoria_veiculo: str(l?.categoria_veiculo, 120),
          retirada_local: str(l?.retirada_local, 160),
          devolucao_local: str(l?.devolucao_local, 160),
          retirada_data: date(l?.retirada_data),
          devolucao_data: date(l?.devolucao_data),
        })).filter((l: any) => l.locadora || l.retirada_local)
      : [],
    condicoes_pagamento: Array.isArray(parsed.condicoes_pagamento)
      ? parsed.condicoes_pagamento.slice(0, 5).map((c: any) => ({
          forma: c?.forma === 'pix' || c?.forma === 'cartao' || c?.forma === 'boleto' ? c.forma : null,
          condicao: str(c?.condicao, 200),
        })).filter((c: any) => c.forma)
      : [],
    traslado: !!parsed.traslado || transfers.length > 0,
    seguro: !!parsed.seguro || seguros.length > 0,
    valor_total_cents: int(parsed.valor_total_cents),
    observacoes: str(parsed.observacoes, 600),
    informacoes_importantes: str(parsed.informacoes_importantes, 1000),
    informacoes_servico: str(parsed.informacoes_servico, 1000),
    politica_cancelamento: str(parsed.politica_cancelamento, 1000),
    viajantes: Array.isArray(parsed.viajantes)
      ? parsed.viajantes.slice(0, 20).map((v: any) => ({
          nome: str(v?.nome, 200),
          data_nascimento: date(v?.data_nascimento),
          cpf: typeof v?.cpf === 'string' ? v.cpf.replace(/\D/g, '').slice(0, 14) : null,
        })).filter((v: any) => v.nome || v.cpf || v.data_nascimento)
      : [],
  }
}
