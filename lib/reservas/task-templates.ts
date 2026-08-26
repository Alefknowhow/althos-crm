import type { SaleProduct } from '@/actions/sale-products'

export type TaskTemplateSuggestion = {
  title: string
  description: string
  due_date: string
  priority: 'low' | 'normal' | 'high'
  source_product_id: string
  kind: string
}

// Tarefas geradas a partir de uma reserva são sempre "dia inteiro" — sem
// horário —, então o due_date fica ancorado em T00:00:00.000Z (mesma
// convenção usada quando o usuário cria uma tarefa manual sem escolher
// horário, ver combineDueDate em TasksBoard.tsx). Um horário de meio-dia
// aqui faria a lista de tarefas mostrar "12:00" como se fosse um horário
// real definido pelo usuário.
function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + deltaDays)
  return `${d.toISOString().slice(0, 10)}T00:00:00.000Z`
}

/**
 * Gera as tarefas sugeridas para um produto de venda, relativas às datas do
 * próprio produto (não mais só departure_date/return_date da venda toda).
 */
export function suggestTasksForProduct(p: SaleProduct, clientName: string): TaskTemplateSuggestion[] {
  const d = p.data || {}
  const out: TaskTemplateSuggestion[] = []

  switch (p.kind) {
    case 'aereo': {
      const label = d.sentido === 'volta' ? 'volta' : 'ida'
      if (d.data) {
        out.push({
          title: `✈️ Conferir emissão do aéreo (${label}) — ${clientName}`,
          description: [d.companhia ? `Cia: ${d.companhia}` : null, d.localizador ? `Localizador: ${d.localizador}` : null].filter(Boolean).join('\n') || 'Conferir emissão do bilhete.',
          due_date: shiftDate(d.data, 0),
          priority: 'normal',
          source_product_id: p.id,
          kind: p.kind,
        })
        out.push({
          title: `✈️ Check-in do voo (${label}) — ${clientName}`,
          description: d.numero_voo ? `Voo ${d.numero_voo}` : 'Realizar check-in.',
          due_date: shiftDate(d.data, -1),
          priority: 'high',
          source_product_id: p.id,
          kind: p.kind,
        })
      }
      break
    }
    case 'hospedagem': {
      if (d.check_in) {
        out.push({
          title: `🏨 Confirmar hospedagem — ${d.hotel || clientName}`,
          description: d.localizador ? `Localizador: ${d.localizador}` : 'Confirmar reserva com o hotel.',
          due_date: shiftDate(d.check_in, -5),
          priority: 'normal',
          source_product_id: p.id,
          kind: p.kind,
        })
        out.push({
          title: `🏨 Enviar voucher do hotel — ${d.hotel || clientName}`,
          description: 'Enviar voucher/confirmação de hospedagem ao cliente.',
          due_date: shiftDate(d.check_in, -3),
          priority: 'normal',
          source_product_id: p.id,
          kind: p.kind,
        })
      }
      break
    }
    case 'transfer': {
      if (d.data) {
        out.push({
          title: `🚐 Confirmar transfer — ${clientName}`,
          description: [d.fornecedor ? `Fornecedor: ${d.fornecedor}` : null, d.origem && d.destino ? `${d.origem} → ${d.destino}` : null].filter(Boolean).join('\n') || 'Confirmar serviço de transfer.',
          due_date: shiftDate(d.data, -2),
          priority: 'normal',
          source_product_id: p.id,
          kind: p.kind,
        })
      }
      break
    }
    case 'cruzeiro': {
      if (d.embarque_data) {
        out.push({
          title: `🚢 Conferir documentação do cruzeiro — ${clientName}`,
          description: [d.navio ? `Navio: ${d.navio}` : null, d.cabine ? `Cabine: ${d.cabine}` : null].filter(Boolean).join('\n') || 'Conferir documentação de embarque.',
          due_date: shiftDate(d.embarque_data, -7),
          priority: 'normal',
          source_product_id: p.id,
          kind: p.kind,
        })
      }
      break
    }
    default: {
      if (d.data) {
        out.push({
          title: `Conferir ${p.kind} — ${clientName}`,
          description: d.fornecedor ? `Fornecedor: ${d.fornecedor}` : 'Conferir serviço contratado.',
          due_date: shiftDate(d.data, -2),
          priority: 'normal',
          source_product_id: p.id,
          kind: p.kind,
        })
      }
    }
  }

  return out
}

export function suggestTasksForProducts(products: SaleProduct[], clientName: string): TaskTemplateSuggestion[] {
  return products.flatMap(p => suggestTasksForProduct(p, clientName))
}
