/**
 * Travel document extraction via Claude vision (image/document content
 * blocks, forced tool_choice). Split out of lib/ai/document-extract.ts.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ExtractedTravelDocument } from './document-extract-types'
import { TRAVELERS_PROMPT_HINT } from './document-extract-types'
import { normalizeExtractedDocument } from './document-extract-normalize'

const EXTRACT_TOOL: Anthropic.Messages.Tool = {
  name: 'extract_travel_document',
  description: 'Extrai os dados estruturados de um orçamento, voucher ou reserva de viagem — todos os produtos presentes (hospedagem, voo, cruzeiro, transfer, seguro, passeio, locação de veículo), valores e políticas.',
  input_schema: {
    type: 'object',
    properties: {
      cliente: { type: ['string', 'null'], description: 'Nome de quem contratou/pagou a viagem (titular da reserva, "nome do titular" no voucher) — NÃO é necessariamente um dos viajantes; extraia separado da lista de viajantes' },
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
            localizador: { type: ['string', 'null'], description: 'Código localizador da reserva do hotel, ex.: "RES12345"' },
            hora_checkin: { type: ['string', 'null'], description: 'Horário de check-in, ex.: "14:00"' },
            hora_checkout: { type: ['string', 'null'], description: 'Horário de check-out, ex.: "12:00"' },
            endereco: { type: ['string', 'null'], description: 'Endereço completo do hotel' },
            email: { type: ['string', 'null'], description: 'E-mail de contato do hotel' },
            telefone: { type: ['string', 'null'], description: 'Telefone de contato do hotel' },
            titular: { type: ['string', 'null'], description: 'Nome do titular/hóspede principal da reserva, se informado' },
            informacoes_adicionais: { type: ['string', 'null'] },
            politica_cancelamento: { type: ['string', 'null'], description: 'Política de cancelamento específica desta hospedagem' },
            condicoes: { type: ['string', 'null'], description: 'Condições da reserva (ex.: pagamento no local, garantia de cartão, etc.)' },
          },
          required: [
            'nome', 'check_in', 'check_out', 'categoria_quarto', 'regime', 'localizador',
            'hora_checkin', 'hora_checkout', 'endereco', 'email', 'telefone', 'titular',
            'informacoes_adicionais', 'politica_cancelamento', 'condicoes',
          ],
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
    system: 'Você extrai dados estruturados de documentos de viagem (orçamentos, vouchers de operadora, reservas) em português do Brasil. Extraia TODOS os produtos presentes no documento (hospedagem, voo, cruzeiro, transfer, seguro, passeio/ingresso, locação de veículo) — um documento pode ter vários produtos do mesmo tipo. Responda sempre com a ferramenta extract_travel_document. Quando um campo não estiver presente no documento, use null (ou array vazio quando aplicável). ' + TRAVELERS_PROMPT_HINT,
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
