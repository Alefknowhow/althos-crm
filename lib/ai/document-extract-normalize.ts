/**
 * Normalizes the raw tool-call/JSON output (from Claude or Gemini) into
 * ExtractedTravelDocument. Split out of lib/ai/document-extract.ts.
 */

import type { ExtractedTravelDocument } from './document-extract-types'

function str(v: any, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.slice(0, max) : null
}
/** Normaliza pra YYYY-MM-DD. O prompt pede esse formato, mas o modelo às
 *  vezes devolve a data como está no documento original (ex.: "01/01/1990",
 *  formato comum em vouchers brasileiros) — em vez de descartar, converte
 *  DD/MM/YYYY também, pra não perder um dado que na prática foi encontrado. */
function date(v: any): string | null {
  if (typeof v !== 'string') return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return null
}
function int(v: any): number | null {
  return v != null && Number.isFinite(Number(v)) ? Math.round(Number(v)) : null
}

export function normalizeExtractedDocument(parsed: any): ExtractedTravelDocument {
  const hospedagens = Array.isArray(parsed.hospedagens)
    ? parsed.hospedagens.slice(0, 10).map((h: any) => ({
        nome: str(h?.nome, 200),
        check_in: date(h?.check_in),
        check_out: date(h?.check_out),
        categoria_quarto: str(h?.categoria_quarto, 120),
        regime: str(h?.regime, 80),
        localizador: str(h?.localizador, 60),
        hora_checkin: str(h?.hora_checkin, 20),
        hora_checkout: str(h?.hora_checkout, 20),
        endereco: str(h?.endereco, 300),
        email: str(h?.email, 120),
        telefone: str(h?.telefone, 60),
        titular: str(h?.titular, 200),
        informacoes_adicionais: str(h?.informacoes_adicionais, 800),
        politica_cancelamento: str(h?.politica_cancelamento, 800),
        condicoes: str(h?.condicoes, 800),
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
