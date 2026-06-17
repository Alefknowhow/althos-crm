/**
 * Conteúdo do site institucional (marketing).
 * Fonte única reutilizada por /funcionalidades, /para-quem-e, /como-funciona,
 * /faq e a home. Mantém o copy fora dos componentes para facilitar edição e SEO.
 */

export interface NavItem {
  label: string
  href: string
}

/** Links de navegação do site multi-página. */
export const SITE_NAV: NavItem[] = [
  { label: 'Funcionalidades', href: '/funcionalidades' },
  { label: 'Para quem é',     href: '/para-quem-e' },
  { label: 'Por que nós?',    href: '/por-que-nos' },
  { label: 'Como funciona',   href: '/como-funciona' },
  { label: 'Planos',          href: '/planos' },
  { label: 'FAQ',             href: '/faq' },
  { label: 'Blog',            href: '/blog' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Funcionalidades (página /funcionalidades — menu clicável estilo Bolten)
// ─────────────────────────────────────────────────────────────────────────────

export interface Feature {
  slug: string
  icon: string          // lucide icon name
  title: string
  tagline: string       // 1 linha no menu
  body: string[]        // parágrafos exibidos ao clicar
  bullets: string[]     // pontos-chave
}

export const FEATURES: Feature[] = [
  {
    slug: 'funil-vendas',
    icon: 'KanbanSquare',
    title: 'Funil de vendas visual',
    tagline: 'Arraste leads entre etapas e veja o pipeline em tempo real.',
    body: [
      'Visualize todo o seu processo comercial em um quadro Kanban intuitivo. Cada lead é um card que você arrasta de uma etapa para a outra conforme a negociação avança.',
      'Configure etapas do seu jeito, defina automações ao mover cards e acompanhe gargalos com indicadores de tempo em cada fase.',
    ],
    bullets: [
      'Etapas personalizáveis por equipe ou produto',
      'Indicadores de tempo parado e leads em risco',
      'Automações disparadas ao mudar de etapa',
    ],
  },
  {
    slug: 'atendimento-ia',
    icon: 'Bot',
    title: 'Atendimento 24h com IA',
    tagline: 'Um atendente de IA responde, qualifica e agenda sozinho.',
    body: [
      'Configure um atendente de IA com a personalidade da sua empresa, horário de funcionamento e base de conhecimento. Ele responde no WhatsApp e Instagram, qualifica o lead e agenda reuniões automaticamente.',
      'Quando o cliente precisa de um humano, a IA faz o handoff para o vendedor certo, sem perder o contexto da conversa.',
    ],
    bullets: [
      'Responde no WhatsApp e Instagram 24/7',
      'Qualifica e agenda sem intervenção humana',
      'Handoff inteligente para o time de vendas',
    ],
  },
  {
    slug: 'automacoes',
    icon: 'Workflow',
    title: 'Automações de tarefas',
    tagline: 'Crie fluxos que trabalham por você, sem código.',
    body: [
      'Monte automações visuais conectando gatilhos (novo lead, mudança de etapa, aniversário, lead parado) a ações (enviar WhatsApp, criar tarefa, notificar, chamar webhook).',
      'Pare de depender da memória da equipe: o sistema cuida do follow-up no momento certo.',
    ],
    bullets: [
      'Editor visual de fluxos (sem programar)',
      'Gatilhos por evento, data ou inatividade',
      'Ações de WhatsApp, tarefas, push e webhooks',
    ],
  },
  {
    slug: 'whatsapp-instagram',
    icon: 'MessageCircle',
    title: 'WhatsApp e Instagram nativos',
    tagline: 'Centralize todas as conversas em um só lugar.',
    body: [
      'Conecte o WhatsApp (Cloud API oficial) e o Instagram direto no CRM. Toda mensagem vira um lead com histórico, e a equipe atende sem trocar de aplicativo.',
      'Conexão do WhatsApp em 1 clique pelo Embedded Signup da Meta — sem copiar tokens ou IDs.',
    ],
    bullets: [
      'Conexão do WhatsApp em 1 clique',
      'Caixa de entrada unificada da equipe',
      'Cada conversa vira um lead rastreável',
    ],
  },
  {
    slug: 'relatorios',
    icon: 'BarChart3',
    title: 'Relatórios e Insights com IA',
    tagline: 'Pergunte em português e receba o gráfico pronto.',
    body: [
      'Dashboards de vendas, funil, origem de leads e desempenho por vendedor. Além disso, um analista de IA responde perguntas em linguagem natural e gera os gráficos para você.',
      'Tome decisões com dados reais: previsão de receita, performance de campanhas e ranking de vendedores.',
    ],
    bullets: [
      'Dashboards de funil, vendas e origem',
      'Insights por IA em linguagem natural',
      'Previsão de receita e ranking de equipe',
    ],
  },
  {
    slug: 'agendamentos',
    icon: 'CalendarClock',
    title: 'Agendamentos e reuniões',
    tagline: 'Página de agendamento própria, integrada ao funil.',
    body: [
      'Disponibilize uma página pública de agendamento. O cliente escolhe o horário, vira lead automaticamente e a reunião entra na agenda da equipe.',
      'Lembretes automáticos por WhatsApp reduzem o no-show.',
    ],
    bullets: [
      'Página de agendamento personalizável',
      'Lembretes automáticos por WhatsApp',
      'Reunião conectada ao lead e ao funil',
    ],
  },
  {
    slug: 'multi-equipe',
    icon: 'Users',
    title: 'Gestão de equipe',
    tagline: 'Papéis, permissões e produtividade do time.',
    body: [
      'Convide a equipe com papéis e permissões. Acompanhe quem está atendendo, distribua leads e veja a produtividade de cada vendedor.',
      'Ideal para gestores que precisam de visão e controle sem microgerenciar.',
    ],
    bullets: [
      'Papéis e permissões por usuário',
      'Distribuição e rodízio de leads',
      'Ranking e produtividade por vendedor',
    ],
  },
  {
    slug: 'formularios',
    icon: 'FileInput',
    title: 'Formulários e captação',
    tagline: 'Construa formulários e capte leads de qualquer canal.',
    body: [
      'Crie formulários personalizados, incorpore no seu site ou compartilhe o link. Cada envio entra direto no funil com a origem identificada.',
      'Proteções anti-spam (honeypot, rate limit e Turnstile opcional) mantêm sua base limpa.',
    ],
    bullets: [
      'Formulários personalizáveis sem código',
      'Origem do lead identificada automaticamente',
      'Proteção anti-spam embutida',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Nichos (página /para-quem-e — conecta com as dores de cada público)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Como funciona (página /como-funciona)
// ─────────────────────────────────────────────────────────────────────────────

export interface Step {
  number: string
  title: string
  body: string
}

export const HOW_IT_WORKS: Step[] = [
  {
    number: '01',
    title: 'Conecte seus canais',
    body: 'Ligue WhatsApp e Instagram em poucos cliques. Toda mensagem vira um lead organizado no seu funil.',
  },
  {
    number: '02',
    title: 'Configure a IA e as automações',
    body: 'Defina a personalidade do atendente de IA e crie fluxos que respondem, qualificam e fazem follow-up por você.',
  },
  {
    number: '03',
    title: 'Acompanhe o funil',
    body: 'Arraste leads pelas etapas, veja gargalos e nunca mais perca uma oportunidade por falta de retorno.',
  },
  {
    number: '04',
    title: 'Decida com dados',
    body: 'Use dashboards e Insights com IA para entender o que funciona, prever receita e escalar com confiança.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Por que nós (página /por-que-nos)
// ─────────────────────────────────────────────────────────────────────────────

export interface Differentiator {
  icon: string
  title: string
  body: string
}

export const DIFFERENTIATORS: Differentiator[] = [
  {
    icon: 'Sparkles',
    title: 'IA de verdade, não só promessa',
    body: 'Atendente que responde e agenda sozinho, e um analista de IA que gera relatórios em linguagem natural. A IA trabalha no seu dia a dia, não só no marketing.',
  },
  {
    icon: 'Rocket',
    title: 'Pronto em minutos',
    body: 'Nada de implantação de meses. Conecte os canais, configure e comece a vender. Pensado para quem não tem tempo a perder.',
  },
  {
    icon: 'Puzzle',
    title: 'Adapta-se ao seu negócio',
    body: 'Viagens, imóveis, clínicas, veículos, marketing ou serviços — o Althos se molda ao seu nicho, com recursos específicos para cada um.',
  },
  {
    icon: 'HeartHandshake',
    title: 'Suporte que fala a sua língua',
    body: 'Suporte humano em português, dentro da plataforma. Quando precisar de gente, você fala com gente.',
  },
  {
    icon: 'ShieldCheck',
    title: 'Seguro e confiável',
    body: 'Seus dados protegidos com isolamento por organização, controles de acesso e integrações oficiais (WhatsApp Cloud API).',
  },
  {
    icon: 'Wallet',
    title: 'Preço honesto',
    body: 'Planos transparentes, sem pegadinha. Comece no plano Free, sem cartão. Pague mensal ou economize 18% no anual quando quiser evoluir.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// FAQ (página /faq)
// ─────────────────────────────────────────────────────────────────────────────

export interface FaqItem {
  category: string
  question: string
  answer: string
}

export const FAQ: FaqItem[] = [
  {
    category: 'Começando',
    question: 'Preciso de cartão de crédito para começar?',
    answer: 'Não. O plano Free é gratuito para sempre e não pede cartão. Nos planos pagos, você assina com uma forma de pagamento (cartão ou Pix) e tem 7 dias para testar o app por completo — se não ficar satisfeito, é só pedir o reembolso total dentro desse prazo.',
  },
  {
    category: 'Começando',
    question: 'Quanto tempo leva para começar a usar?',
    answer: 'Minutos. Você cria a conta, conecta WhatsApp e Instagram e já começa a receber leads organizados. Não há implantação demorada.',
  },
  {
    category: 'WhatsApp',
    question: 'Como conecto o WhatsApp?',
    answer: 'Usamos a Cloud API oficial da Meta. A conexão é em 1 clique pelo Embedded Signup: você autoriza no Facebook e escolhe o número, sem copiar tokens.',
  },
  {
    category: 'WhatsApp',
    question: 'É seguro? Tem risco de bloqueio?',
    answer: 'Usamos apenas a API oficial da Meta, sem métodos não oficiais. Isso significa estabilidade e zero risco de banimento por uso indevido.',
  },
  {
    category: 'IA',
    question: 'A IA responde meus clientes sozinha?',
    answer: 'Sim. Você configura a personalidade, o horário e a base de conhecimento. A IA responde, qualifica e agenda — e passa para um humano quando necessário.',
  },
  {
    category: 'Planos',
    question: 'Qual a diferença entre os planos?',
    answer: 'O Free organiza seus leads e o pipeline, grátis. O Starter adiciona catálogo e WhatsApp. O Pro traz IA, agendamentos, Meta Ads e mais usuários. O Business libera tudo: insights com IA, white-label, API e usuários ilimitados.',
  },
  {
    category: 'Planos',
    question: 'Como funciona o desconto anual?',
    answer: 'No plano anual você economiza 18% em relação a pagar 12 mensalidades. Pode pagar à vista no Pix ou parcelar no cartão.',
  },
  {
    category: 'Planos',
    question: 'Posso cancelar quando quiser?',
    answer: 'Sim. Não há fidelidade no plano mensal. Você cancela direto pela plataforma quando quiser.',
  },
  {
    category: 'Segurança',
    question: 'Meus dados ficam seguros?',
    answer: 'Sim. Cada empresa tem seus dados isolados, com controles de acesso por usuário e integrações oficiais. Sua base é só sua.',
  },
]

/** Categorias do FAQ na ordem de exibição. */
export const FAQ_CATEGORIES = ['Começando', 'WhatsApp', 'IA', 'Planos', 'Segurança'] as const
