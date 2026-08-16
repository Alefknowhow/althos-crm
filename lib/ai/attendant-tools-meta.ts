/**
 * Metadados de exibição das tools do Agente IA (aba Ferramentas) — separado
 * de lib/ai/attendant-tools.ts porque aquele arquivo importa o SDK da
 * Anthropic e um SupabaseClient tipado, inadequado pra um componente
 * client. Mantido em sync manualmente com ATTENDANT_TOOLS.
 */
export const ATTENDANT_TOOLS_META: { name: string; label: string; description: string }[] = [
  {
    name: 'listar_tipos_evento',
    label: 'Listar tipos de atendimento',
    description: 'Consulta os serviços/consultas cadastrados (nome, duração) quando o cliente pergunta o que a empresa oferece.',
  },
  {
    name: 'consultar_disponibilidade',
    label: 'Consultar disponibilidade de horários',
    description: 'Verifica horários livres numa data antes de oferecer um agendamento — nunca inventa horário.',
  },
]
