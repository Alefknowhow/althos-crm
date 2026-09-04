/**
 * Nichos (página /para-quem-e — conecta com as dores de cada público).
 * Split out of lib/site/content.ts.
 */

export interface Niche {
  slug: string
  icon: string
  name: string
  audience: string       // "Para agências de viagens"
  pains: string[]        // dores específicas do público
  solution: string       // como o Althos resolve
  highlights: string[]   // recursos específicos do nicho
}

export const NICHES: Niche[] = [
  {
    slug: 'agencias-viagens',
    icon: 'Plane',
    name: 'Agências de viagens',
    audience: 'Para agências e agentes de viagens',
    pains: [
      'Propostas feitas no Word/PDF manualmente, sem padrão',
      'Perde o histórico do cliente entre uma viagem e outra',
      'Follow-up de orçamento esquecido',
    ],
    solution:
      'Monte propostas de viagem profissionais em minutos, gere um link ou PDF para o cliente e acompanhe cada viagem do orçamento ao pós-venda — tudo conectado ao funil.',
    highlights: [
      'Aba de Propostas com link público e PDF',
      'Cadastro e acompanhamento de viagens',
      'Automação de aniversário e pós-viagem',
    ],
  },
  {
    slug: 'imobiliarias',
    icon: 'Home',
    name: 'Imobiliárias',
    audience: 'Para imobiliárias e corretores',
    pains: [
      'Leads de portais e anúncios espalhados em vários lugares',
      'Demora no primeiro contato faz perder o cliente',
      'Difícil casar o imóvel certo com o cliente certo',
    ],
    solution:
      'Centralize todos os leads de captação, responda na hora com IA e organize o funil por estágio da negociação. A equipe vê tudo em um lugar só.',
    highlights: [
      'Atendimento imediato com IA 24h',
      'Funil por etapa de negociação',
      'Distribuição automática de leads para corretores',
    ],
  },
  {
    slug: 'clinicas',
    icon: 'Stethoscope',
    name: 'Clínicas e consultórios',
    audience: 'Para clínicas, consultórios e profissionais de saúde',
    pains: [
      'Recepção sobrecarregada respondendo o mesmo no WhatsApp',
      'Faltas e remarcações sem controle',
      'Pacientes que somem e não retornam',
    ],
    solution:
      'A IA responde dúvidas e agenda consultas 24h. Lembretes automáticos reduzem faltas, e automações reativam pacientes inativos.',
    highlights: [
      'Agendamento automático com IA',
      'Lembretes de consulta por WhatsApp',
      'Reativação de pacientes inativos',
    ],
  },
  {
    slug: 'veiculos',
    icon: 'Car',
    name: 'Lojas de veículos',
    audience: 'Para concessionárias e lojas de veículos',
    pains: [
      'Estoque de veículos desorganizado e desatualizado',
      'Leads de classificados sem acompanhamento',
      'Difícil saber qual vendedor fechou qual venda',
    ],
    solution:
      'Cadastre o estoque de veículos, conecte com o atendimento e registre vendas customizadas para revenda. Acompanhe cada lead até a assinatura.',
    highlights: [
      'Estoque de veículos integrado',
      'Registro de venda customizado para revenda',
      'Ranking de vendedores e comissões',
    ],
  },
  {
    slug: 'marketing',
    icon: 'Megaphone',
    name: 'Agências de marketing e tráfego',
    audience: 'Para agências de marketing e gestores de tráfego',
    pains: [
      'Cliente cobra resultado mas falta visibilidade do funil',
      'Leads gerados não viram venda por falta de processo',
      'Relatórios manuais consomem horas',
    ],
    solution:
      'Mostre ao cliente o caminho do lead até a venda, com origem por campanha (Meta/Google Ads) e relatórios automáticos. Prove o ROI do tráfego.',
    highlights: [
      'Origem de lead por campanha (Meta/Google)',
      'Relatórios automáticos de funil e ROI',
      'Gestão de múltiplas contas de clientes',
    ],
  },
  {
    slug: 'pequenas-empresas',
    icon: 'Store',
    name: 'Pequenas empresas',
    audience: 'Para pequenos negócios e prestadores de serviço',
    pains: [
      'Atendimento só no WhatsApp pessoal, sem organização',
      'Esquece de retornar orçamentos',
      'Não sabe de onde vêm os melhores clientes',
    ],
    solution:
      'Profissionalize o atendimento sem complicação: organize contatos, automatize o follow-up e tenha clareza de onde vêm suas vendas — pronto para usar em minutos.',
    highlights: [
      'Pronto para usar, sem curva de aprendizado',
      'Follow-up automático de orçamentos',
      'Visão clara de origem das vendas',
    ],
  },
]
