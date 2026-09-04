/**
 * AI Analyst tools -- travel vertical deep-dives (reserva completa,
 * histórico de viagens do cliente, cotação completa, bloqueios).
 * Split out of insights-tools.ts.
 */

import type { AnalyticsContext, AnalyticsResult } from './insights-tools-definitions'
import { fmtCurrency } from './insights-tools-helpers'
import { labelStatus, QUOTE_STATUS_LABEL } from './insights-tools-travel-summary'

function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null
  const b = new Date(birthDate)
  if (Number.isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

const PRODUCT_KIND_LABEL: Record<string, string> = {
  aereo: 'Aéreo', hospedagem: 'Hospedagem', transfer: 'Transfer', passeio: 'Passeio',
  cruzeiro: 'Cruzeiro', seguro: 'Seguro', ingresso: 'Ingresso', veiculo: 'Veículo', outro: 'Outro',
}

/**
 * Rótulos de campo por tipo de produto — espelha KIND_FIELDS em
 * components/features/reservas/SaleProductsTab.tsx (fonte de verdade da UI
 * de edição). Mantido em sincronia manual: se um campo novo for adicionado
 * lá, adicionar aqui também pra IA conseguir ler.
 */
const PRODUCT_FIELD_LABELS: Record<string, Record<string, string>> = {
  aereo: {
    companhia: 'Companhia', numero_voo: 'Nº do voo', sentido: 'Sentido', localizador: 'Localizador (check-in)',
    bilhete: 'Nº do bilhete', origem: 'Origem', destino: 'Destino', data: 'Data de embarque',
    hora_embarque: 'Hora de embarque', data_chegada: 'Data de chegada', hora_chegada: 'Hora de chegada',
    horario: 'Horário', passageiros: 'Passageiros', bagagem: 'Franquia de bagagem',
  },
  hospedagem: {
    hotel: 'Hotel', localizador: 'Localizador', titular: 'Titular', check_in: 'Check-in', hora_checkin: 'Horário do check-in',
    check_out: 'Check-out', hora_checkout: 'Horário do check-out', tipo_quarto: 'Tipo de quarto', regime: 'Regime',
    endereco: 'Endereço', email: 'E-mail do hotel', telefone: 'Telefone do hotel',
    informacoes_adicionais: 'Informações adicionais', politica_cancelamento: 'Política de cancelamento', condicoes: 'Condições',
  },
  transfer: {
    titular: 'Titular', codigo_reserva: 'Código da reserva', data: 'Data', horario: 'Horário', origem: 'Local de partida',
    destino: 'Destino', tipo_servico: 'Tipo de serviço', fornecedor: 'Empresa/motorista', contato: 'Contato', observacoes: 'Detalhes',
  },
  cruzeiro: {
    titular: 'Titular', localizador: 'Localizador', companhia: 'Companhia marítima', navio: 'Navio', roteiro: 'Roteiro',
    embarque_porto: 'Porto de embarque', embarque_data: 'Data de embarque', desembarque_porto: 'Porto de desembarque',
    desembarque_data: 'Data de desembarque', cabine: 'Cabine', categoria: 'Categoria da cabine', deck: 'Deck',
    localizacao: 'Localização', vista: 'Vista', regime: 'Plano de alimentação', observacoes: 'Detalhes',
  },
  passeio: { nome: 'Nome', data: 'Data', fornecedor: 'Fornecedor', localizador: 'Localizador', observacoes: 'Observações' },
  seguro: { nome: 'Seguradora/plano', data: 'Vigência a partir de', fornecedor: 'Fornecedor', localizador: 'Apólice', observacoes: 'Observações' },
  ingresso: {
    atracao: 'Atração', titular: 'Titular', data: 'Data', codigo_reserva: 'Código da reserva',
    fornecedor: 'Prestador de serviço', contato: 'Contato', observacoes: 'Detalhes',
  },
  veiculo: { nome: 'Veículo', data: 'Retirada', fornecedor: 'Locadora', localizador: 'Localizador', observacoes: 'Observações' },
  outro: { nome: 'Nome', data: 'Data', fornecedor: 'Fornecedor', localizador: 'Localizador', observacoes: 'Observações' },
}

/** Resume o jsonb solto de um sale_product num texto legível — passa por
 *  TODOS os campos conhecidos daquele `kind` (não só um subconjunto), pra
 *  não esconder dado que já está cadastrado (horário, bagagem, escala,
 *  etc.). Voo com múltiplos trechos (`data.legs[]`) lista escala/bagagem
 *  por trecho também. */
function formatProductData(kind: string, data: Record<string, any>): string {
  const d = data || {}
  const labels = PRODUCT_FIELD_LABELS[kind] || {}
  const fields = Object.entries(labels)
    .filter(([key]) => d[key] !== undefined && d[key] !== null && d[key] !== '')
    .map(([key, label]) => `${label}: ${d[key]}`)

  if (Array.isArray(d.legs) && d.legs.length > 0) {
    const legsText = d.legs.map((l: any, i: number) => {
      const legParts = [
        l.origem && l.destino ? `${l.origem} → ${l.destino}` : null,
        l.data, l.horario, l.duracao && `duração ${l.duracao}`,
        l.bagagem && `bagagem ${l.bagagem}`,
        l.escala_local && `escala em ${l.escala_local}${l.escala_duracao ? ` (${l.escala_duracao})` : ''}`,
      ].filter(Boolean)
      return `trecho ${i + 1}: ${legParts.join(', ')}`
    }).join(' | ')
    fields.push(`Trechos: ${legsText}`)
  }

  if (fields.length === 0) {
    // Kind não mapeado ou sem nenhum campo conhecido preenchido — dump genérico.
    const generic = Object.entries(d).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ')
    return generic || '—'
  }
  return fields.join(', ')
}

/**
 * Mergulho completo numa reserva: dados da venda + produtos (aba Produtos) +
 * vouchers (com link direto) + tarefas vinculadas + viajantes (com idade) +
 * parentes do cliente principal — tudo que hoje só dava pra ver abrindo a
 * reserva manualmente no CRM, aba por aba.
 */
export async function queryFullReservation(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const busca = String(input.busca || '').trim()
  if (!busca) return { summary: 'Informe o nome do cliente, número da reserva ou localizador pra buscar.', view: { type: 'none' } }

  let q = ctx.supabase
    .from('travel_sales')
    .select('id, sale_number, contato_id, client_name, destination, departure_date, return_date, total_cents, status, operator, package_locator, air_locator, hotel_locator, travelers, vouchers, notes')
    .eq('organization_id', ctx.orgId)
    .or(`client_name.ilike.%${busca}%,sale_number.ilike.%${busca}%,package_locator.ilike.%${busca}%,air_locator.ilike.%${busca}%,hotel_locator.ilike.%${busca}%`)
    .order('created_at', { ascending: false })
    .limit(5)

  if (input.data) {
    q = ctx.supabase
      .from('travel_sales')
      .select('id, sale_number, contato_id, client_name, destination, departure_date, return_date, total_cents, status, operator, package_locator, air_locator, hotel_locator, travelers, vouchers, notes')
      .eq('organization_id', ctx.orgId)
      .or(`client_name.ilike.%${busca}%,sale_number.ilike.%${busca}%`)
      .eq('departure_date', input.data)
      .order('created_at', { ascending: false })
      .limit(5)
  }

  const { data: matches } = await q
  if (!matches || matches.length === 0) {
    return { summary: `Nenhuma reserva encontrada para "${busca}"${input.data ? ` na data ${input.data}` : ''}.`, view: { type: 'none' } }
  }

  const sale = matches[0] as any
  const otherMatches = matches.slice(1)

  const [{ data: products }, { data: tasks }, { data: contato }] = await Promise.all([
    ctx.supabase.from('sale_products').select('kind, status, data').eq('sale_id', sale.id).order('sort_order'),
    ctx.supabase.from('tasks').select('title, status, due_date').eq('sale_id', sale.id),
    sale.contato_id
      ? ctx.supabase.from('contatos').select('name, phone, email').eq('id', sale.contato_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const relationships = sale.contato_id
    ? (await ctx.supabase.from('contato_relationships').select('kind, note, related_contato_id, related_name, related_cpf, related_birth_date').eq('contato_id', sale.contato_id)).data
    : null

  const voucherLink = `/voucher-print/${ctx.orgSlug}/${sale.id}`
  const uploadedVouchers = (sale.vouchers as any[]) || []
  const travelers = (sale.travelers as any[]) || []

  const parts: string[] = []
  parts.push(`Reserva ${sale.package_locator || sale.sale_number || sale.id.slice(0, 8)} — ${sale.client_name || contato?.name || 'sem cliente'}, destino ${sale.destination || '—'}, ${sale.departure_date ? new Date(`${sale.departure_date}T00:00:00`).toLocaleDateString('pt-BR') : '—'} a ${sale.return_date ? new Date(`${sale.return_date}T00:00:00`).toLocaleDateString('pt-BR') : '—'}, valor ${fmtCurrency(sale.total_cents || 0)}, status ${sale.status}. Operadora: ${sale.operator || '—'}. Localizadores — pacote: ${sale.package_locator || '—'}, aéreo: ${sale.air_locator || '—'}, hotel: ${sale.hotel_locator || '—'}.`)

  if (products && products.length > 0) {
    parts.push(`Produtos cadastrados: ${products.map((p: any) => `${PRODUCT_KIND_LABEL[p.kind] || p.kind} (${formatProductData(p.kind, p.data)})`).join('; ')}.`)
  } else {
    parts.push('Nenhum produto cadastrado na aba Produtos dessa reserva.')
  }

  parts.push(`Voucher do sistema (documento oficial pra visualizar/imprimir): [Abrir voucher completo](${voucherLink})`)
  if (uploadedVouchers.length > 0) {
    // Link em formato [rótulo](url) — o chat renderiza como texto clicável
    // com o nome do arquivo, nunca a URL crua (mais legível, e evita link
    // gigante do Storage aparecendo por extenso na conversa).
    parts.push(`Arquivos de voucher anexados: ${uploadedVouchers.map((v, i) => `[${v.name || `voucher ${i + 1}`}](${v.url})`).join(', ')}.`)
  }

  if (travelers.length > 0) {
    parts.push(`Viajantes: ${travelers.map(t => `${t.name || 'sem nome'}${t.birth_date ? ` (${calcAge(t.birth_date)} anos)` : ''}`).join(', ')}.`)
  } else {
    parts.push('Nenhum viajante cadastrado além do cliente principal.')
  }

  if (relationships && relationships.length > 0) {
    parts.push(`Parentes cadastrados de ${sale.client_name || contato?.name}: ${relationships.map((r: any) => `${r.related_name || '—'} (${r.kind})`).join(', ')}.`)
  }

  if (tasks && tasks.length > 0) {
    parts.push(`Tarefas vinculadas: ${tasks.map((t: any) => `${t.title} [${t.status}]${t.due_date ? ` até ${new Date(t.due_date).toLocaleDateString('pt-BR')}` : ''}`).join('; ')}.`)
  }

  if (otherMatches.length > 0) {
    parts.push(`Encontrei outras ${otherMatches.length} reserva(s) parecida(s) pra "${busca}" — se não era essa, me diga o número da reserva ou a data pra eu buscar a certa.`)
  }

  return {
    summary: parts.join(' '),
    view: {
      type: 'table',
      columns: ['Tipo', 'Detalhe'],
      rows: (products || []).map((p: any) => [PRODUCT_KIND_LABEL[p.kind] || p.kind, formatProductData(p.kind, p.data)]),
    },
  }
}

/** Histórico completo de viagens de um cliente — todas as travel_sales
 *  vinculadas ao contato, não só a mais recente (isso é o que
 *  consultar_reservas/consultar_clientes_inativos não cobrem). */
export async function queryClientTravelHistory(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const cliente = String(input.cliente || '').trim()
  if (!cliente) return { summary: 'Informe o nome do cliente.', view: { type: 'none' } }

  const { data: contatos } = await ctx.supabase
    .from('contatos')
    .select('id, name')
    .eq('organization_id', ctx.orgId)
    .ilike('name', `%${cliente}%`)
    .limit(5)

  if (!contatos || contatos.length === 0) {
    return { summary: `Nenhum cliente encontrado com o nome "${cliente}".`, view: { type: 'none' } }
  }

  const contatoIds = contatos.map(c => c.id)
  const { data: sales } = await ctx.supabase
    .from('travel_sales')
    .select('sale_number, client_name, destination, departure_date, return_date, total_cents, status, contato_id')
    .eq('organization_id', ctx.orgId)
    .in('contato_id', contatoIds)
    .order('departure_date', { ascending: false })

  const rows = (sales as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhuma viagem/reserva encontrada pra "${cliente}".`, view: { type: 'none' } }
  }

  const totalValue = rows.reduce((a, r) => a + (r.total_cents || 0), 0)
  const name = contatos[0].name

  return {
    summary: `${rows.length} viagem(ns) encontrada(s) pra ${name}${contatos.length > 1 ? ` (e ${contatos.length - 1} outro(s) contato(s) com nome parecido)` : ''}, somando ${fmtCurrency(totalValue)}.`,
    view: {
      type: 'table',
      columns: ['Destino', 'Ida', 'Volta', 'Valor', 'Status'],
      rows: rows.map(r => [
        r.destination || '—',
        r.departure_date ? new Date(`${r.departure_date}T00:00:00`).toLocaleDateString('pt-BR') : '—',
        r.return_date ? new Date(`${r.return_date}T00:00:00`).toLocaleDateString('pt-BR') : '—',
        fmtCurrency(r.total_cents || 0),
        r.status || '—',
      ]),
    },
  }
}

/**
 * Mergulho completo numa cotação/proposta: status, período, destinos,
 * voos/hotéis propostos, valor e o link público de compartilhamento
 * (/p/{public_token}, mesmo link usado em ProposalsList.tsx) — mascarado
 * como [rótulo](link), nunca a URL crua. Não gera um public_token novo se
 * não existir (isso é uma ação de "compartilhar" feita na tela de Cotações,
 * uma tool de consulta não deve ter esse efeito colateral).
 */
export async function queryFullQuotation(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const busca = String(input.busca || '').trim()
  if (!busca) return { summary: 'Informe o nome do cliente ou o título da cotação pra buscar.', view: { type: 'none' } }

  const { data: matches } = await ctx.supabase
    .from('travel_proposals')
    .select('id, title, status, client_name, start_date, end_date, total_cents, public_token, destinations, flights, hotels')
    .eq('organization_id', ctx.orgId)
    .or(`client_name.ilike.%${busca}%,title.ilike.%${busca}%`)
    .order('created_at', { ascending: false })
    .limit(5)

  if (!matches || matches.length === 0) {
    return { summary: `Nenhuma cotação encontrada para "${busca}".`, view: { type: 'none' } }
  }

  const q = matches[0] as any
  const otherMatches = matches.slice(1)

  const destinations = (q.destinations as any[]) || []
  const flights = (q.flights as any[]) || []
  const hotels = (q.hotels as any[]) || []

  const parts: string[] = []
  parts.push(`Cotação "${q.title || 'sem título'}" para ${q.client_name || 'cliente não informado'} — status ${labelStatus(QUOTE_STATUS_LABEL, q.status)}, período ${q.start_date ? new Date(`${q.start_date}T00:00:00`).toLocaleDateString('pt-BR') : '—'} a ${q.end_date ? new Date(`${q.end_date}T00:00:00`).toLocaleDateString('pt-BR') : '—'}, valor ${fmtCurrency(q.total_cents || 0)}.`)

  if (destinations.length > 0) parts.push(`Destinos: ${destinations.map((d: any) => d.name || d).join(', ')}.`)
  if (flights.length > 0) parts.push(`Voos propostos: ${flights.map((f: any) => [f.companhia, f.origem && f.destino ? `${f.origem}→${f.destino}` : null].filter(Boolean).join(' ')).join('; ')}.`)
  if (hotels.length > 0) parts.push(`Hotéis propostos: ${hotels.map((h: any) => h.nome || h.name).filter(Boolean).join(', ')}.`)

  if (q.public_token) {
    parts.push(`Link público da cotação: [Ver cotação completa](/p/${q.public_token})`)
  } else {
    parts.push('Essa cotação ainda não tem um link público gerado — gere o link direto na tela de Cotações (botão de compartilhar).')
  }

  if (otherMatches.length > 0) {
    parts.push(`Encontrei outras ${otherMatches.length} cotação(ões) parecida(s) pra "${busca}" — me diga o título exato se não era essa.`)
  }

  return {
    summary: parts.join(' '),
    view: { type: 'none' },
  }
}

export async function queryBlocks(_input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const { data } = await ctx.supabase
    .from('travel_blocks')
    .select('origem, destino, assentos_total, assentos_disponiveis, prazo')
    .eq('organization_id', ctx.orgId)
    .order('prazo', { ascending: true })

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: 'Nenhum bloqueio cadastrado.', view: { type: 'none' } }
  }

  const totalSeats = rows.reduce((a, r) => a + (r.assentos_total || 0), 0)
  const availableSeats = rows.reduce((a, r) => a + (r.assentos_disponiveis || 0), 0)
  const soldSeats = totalSeats - availableSeats
  const today = new Date()
  const expiringSoon = rows.filter(r => r.prazo && new Date(r.prazo) >= today && (new Date(r.prazo).getTime() - today.getTime()) / 86_400_000 <= 15).length

  return {
    summary: `${rows.length} bloqueios ativos, ${soldSeats} de ${totalSeats} vagas vendidas (${availableSeats} disponíveis). ${expiringSoon} bloqueios com prazo vencendo em 15 dias.`,
    view: {
      type: 'table',
      columns: ['Origem', 'Destino', 'Total', 'Disponíveis'],
      rows: rows.map(r => [r.origem || '—', r.destino || '—', String(r.assentos_total || 0), String(r.assentos_disponiveis || 0)]),
    },
  }
}
