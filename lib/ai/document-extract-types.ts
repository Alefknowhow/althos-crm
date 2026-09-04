/**
 * Shared type + prompt hint for travel document extraction.
 * Split out of lib/ai/document-extract.ts.
 */

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
    /** Código localizador da reserva do hotel, ex.: "RES12345". */
    localizador: string | null
    hora_checkin: string | null
    hora_checkout: string | null
    endereco: string | null
    email: string | null
    telefone: string | null
    /** Nome do titular da reserva, quando informado (senão assume o cliente). */
    titular: string | null
    informacoes_adicionais: string | null
    /** Política de cancelamento específica desta hospedagem (distinta da política geral do documento). */
    politica_cancelamento: string | null
    condicoes: string | null
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

/** Reforço de prompt pra viajantes/datas de nascimento — em documentos com
 *  vários produtos (ex.: hotel + voo no mesmo voucher), o modelo às vezes só
 *  captura o campo `cliente`/titular e ignora a lista completa de nome +
 *  data de nascimento + CPF que aparece repetida em cada apartamento/quarto
 *  ou na lista de passageiros do voo — mesmo quando ambas as seções trazem
 *  a mesma pessoa com o dado completo. */
export const TRAVELERS_PROMPT_HINT =
  'Preste atenção especial ao campo `viajantes`: procure em TODAS as seções do documento (lista de hóspedes de cada apartamento/quarto, lista de passageiros do voo — "PAX", "Dados do(s) passageiro(s)", etc.) por blocos repetidos de Nome + Data de nascimento + CPF, um por pessoa, e inclua CADA pessoa encontrada em `viajantes` com esses três campos preenchidos sempre que aparecerem no documento (mesmo que a mesma pessoa apareça em mais de uma seção — nesse caso, uma linha só, sem duplicar). Nunca deixe `data_nascimento`/`cpf` vazios só porque a pessoa também aparece no campo `cliente` — são dados independentes. O campo `cliente` é APENAS quem contratou/pagou a viagem (titular/comprador) e pode ser uma pessoa que nem está na lista de viajantes.'
