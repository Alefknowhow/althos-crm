import type { HelpCategory } from './content'

export const HELP_CATEGORIES_PART_2: HelpCategory[] = [
  {
    slug: 'vendas-trafego',
    title: 'Gestão de Clientes de Tráfego',
    icon: 'TrendingUp',
    description:
      'Módulos exclusivos de agências de tráfego pago: clientes, planos de assinatura, contrato e acompanhamento de campanhas.',
    niches: ['trafego'],
    articles: [
      {
        slug: 'clientes-trafego',
        title: 'Clientes de Tráfego',
        summary: 'Cada cliente reúne as contas de anúncio, campanhas e criativos dele.',
        keywords: ['ads', 'contas de anúncio', 'campanhas', 'meta ads', 'cliente'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Todo cliente da sua agência é um contato do CRM (a mesma tela de Leads/Clientes de sempre), só que com um painel extra: as contas de anúncio vinculadas, as campanhas ativas e os criativos em uso.',
          },
          {
            type: 'steps',
            items: [
              'Abra o cliente e vá na aba "Dados" para ver as contas de anúncio vinculadas.',
              'Na aba "Histórico" acompanhe campanhas e métricas sincronizadas.',
              'Na aba "Criativos" acompanhe as peças em aprovação — o cliente pode aprovar pelo link público, sem precisar de login.',
            ],
          },
        ],
      },
      {
        slug: 'planos-trafego',
        title: 'Planos (assinatura recorrente)',
        summary: 'O Catálogo vira uma vitrine de planos de gestão de tráfego.',
        keywords: ['catálogo', 'produto', 'assinatura', 'mensalidade', 'pacote'],
        blocks: [
          {
            type: 'paragraph',
            text: 'A tela de Catálogo se adapta pra sua agência: em vez de "produtos", você cadastra Planos — os pacotes de gestão de tráfego que você vende por assinatura mensal.',
          },
        ],
      },
      {
        slug: 'vendas-assinatura-trafego',
        title: 'Vendas e contrato de assinatura',
        summary: 'Fechar um plano gera um contrato próprio, com assinatura digital.',
        keywords: ['contrato', 'assinatura digital', 'autentique', 'venda', 'plano fechado'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Quando você fecha um Plano com um cliente, a venda vira uma assinatura recorrente com contrato próprio (não é o mesmo modelo de contrato usado em Reservas de viagem — é um contrato dedicado a planos de tráfego).',
          },
          {
            type: 'steps',
            items: [
              'Registre a venda do plano em Vendas, vinculada ao cliente.',
              'Gere o contrato de assinatura a partir da venda.',
              'Envie para assinatura digital — o cliente assina pelo link, sem precisar imprimir nada.',
            ],
          },
        ],
      },
      {
        slug: 'dashboard-trafego',
        title: 'Dashboard de Tráfego',
        summary: 'Métricas de clientes, planos ativos e campanhas numa aba dedicada.',
        keywords: ['métricas', 'kpi', 'aba tráfego'],
        blocks: [
          {
            type: 'paragraph',
            text: 'O Dashboard ganha uma aba "Tráfego" com os números da agência: clientes ativos, planos vendidos e o resumo de campanhas em andamento.',
          },
        ],
      },
    ],
  },

  {
    slug: 'vendas-clinicas',
    title: 'Gestão de Clínica',
    icon: 'Stethoscope',
    description:
      'Módulos exclusivos de clínicas: agendamentos com lembrete automático, orçamentos, atendimentos, tratamentos, pacotes, lista de espera e comissões.',
    niches: ['clinicas'],
    articles: [
      {
        slug: 'agendamentos-clinica',
        title: 'Agendamentos e lembrete automático',
        summary: 'A agenda da clínica avisa o paciente 24h antes, sozinha.',
        keywords: ['agenda', 'consulta', 'lembrete', 'confirmação', 'whatsapp'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Agendamentos funciona como em qualquer conta, mas ganha um card extra: configure um modelo de mensagem aprovado pela Meta e o CRM manda sozinho um lembrete por WhatsApp 24h antes da consulta, evitando falta.',
          },
          {
            type: 'steps',
            items: [
              'Em Agendamentos, configure o modelo de mensagem do lembrete e envie para aprovação da Meta.',
              'Depois de aprovado, todo agendamento futuro recebe o lembrete automaticamente — uma vez só, sem duplicar.',
            ],
          },
          {
            type: 'tip',
            text: 'Quando o paciente confirma a presença, isso pode disparar uma Automação (ex.: criar uma tarefa pra recepção) — configure em Automações.',
          },
        ],
      },
      {
        slug: 'orcamentos-clinica',
        title: 'Orçamentos',
        summary: 'Monte e acompanhe orçamentos de tratamento até a aprovação do paciente.',
        keywords: ['orçamento', 'proposta', 'tratamento', 'aprovação'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Monte o orçamento de um tratamento vinculado ao paciente. Quando ele é aprovado, isso pode disparar automação (ex.: notificar a equipe) e alimenta as comissões, se configurado.',
          },
        ],
      },
      {
        slug: 'atendimentos-tratamentos',
        title: 'Atendimentos, Tratamentos e Pacotes',
        summary: 'Registre o que foi feito na consulta e organize pacotes de sessões.',
        keywords: ['consulta', 'sessão', 'procedimento', 'pacote de sessões'],
        blocks: [
          {
            type: 'list',
            items: [
              'Atendimentos: registro do que foi feito em cada consulta, vinculado ao paciente.',
              'Tratamentos: catálogo dos procedimentos que a clínica oferece.',
              'Pacotes: agrupe várias sessões de um tratamento vendidas de uma vez (ex.: pacote de 10 sessões).',
            ],
          },
        ],
      },
      {
        slug: 'lista-espera-clinica',
        title: 'Lista de Espera',
        summary: 'Pacientes aguardando vaga entram numa fila organizada.',
        keywords: ['fila', 'vaga', 'encaixe'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Quando não há horário disponível, coloque o paciente na Lista de Espera em vez de perder o contato — assim que abrir vaga, você já sabe quem chamar primeiro.',
          },
        ],
      },
      {
        slug: 'comissoes-clinica',
        title: 'Comissões e Retornos',
        summary: 'Comissão do profissional lançada no Financeiro, e follow-up de retorno.',
        keywords: ['comissão', 'financeiro', 'retorno', 'follow-up'],
        blocks: [
          {
            type: 'paragraph',
            text: 'A comissão do profissional que atendeu pode ser lançada automaticamente no Financeiro a partir do orçamento aprovado. "Retornos" ajuda a não esquecer de agendar o follow-up de um paciente depois do tratamento.',
          },
        ],
      },
    ],
  },

  {
    slug: 'vendas-imoveis',
    title: 'Gestão Imobiliária',
    icon: 'Home',
    description:
      'Módulos exclusivos de imobiliárias: cadastro de imóveis, match com IA, visitas, propostas e pipeline dedicado.',
    niches: ['imoveis'],
    articles: [
      {
        slug: 'cadastro-imoveis',
        title: 'Cadastro de imóveis',
        summary: 'Cadastre o imóvel com fotos, características e status.',
        keywords: ['imóvel', 'anúncio', 'fotos', 'características'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Cadastre cada imóvel do seu portfólio: tipo, endereço, valor, características e fotos. O status do imóvel (disponível, vendido, alugado) atualiza sozinho conforme o negócio avança.',
          },
        ],
      },
      {
        slug: 'match-ia-imoveis',
        title: 'Match com IA e preferências do lead',
        summary: 'A IA sugere os imóveis mais compatíveis com o que o lead procura.',
        keywords: ['sugestão', 'inteligência artificial', 'compatibilidade', 'preferências'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Preencha as preferências do lead (tipo de imóvel, faixa de preço, região) na ficha do contato e peça pra IA sugerir os imóveis do seu portfólio mais compatíveis, com o motivo de cada sugestão.',
          },
          {
            type: 'tip',
            text: 'Cada sugestão consome créditos de IA da sua conta — use quando já tiver as preferências do lead bem definidas.',
          },
        ],
      },
      {
        slug: 'visitas-imoveis',
        title: 'Visitas',
        summary: 'Agende e acompanhe visitas de um lead a um imóvel.',
        keywords: ['visita', 'agendar', 'corretor'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Agende a visita de um lead a um imóvel específico. O status (agendada, confirmada, realizada, cancelada) pode avançar automaticamente a etapa do lead no Pipeline Imobiliário.',
          },
        ],
      },
      {
        slug: 'propostas-imoveis',
        title: 'Propostas e link público',
        summary: 'Monte uma proposta com vários imóveis e envie um link pro cliente.',
        keywords: ['proposta', 'link', 'multi-imóvel', 'negociação'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Uma proposta pode reunir mais de um imóvel, cada um com seu preço, e gera um link público pra o cliente avaliar sem precisar de login. Quando a proposta vira negócio fechado, isso encerra o imóvel como vendido/alugado.',
          },
        ],
      },
      {
        slug: 'pipeline-imobiliario',
        title: 'Pipeline Imobiliário',
        summary: 'Um funil dedicado, com etapas específicas do processo de imóvel.',
        keywords: ['funil', 'kanban imobiliário', 'etapas'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Além do Pipeline genérico, a Imobiliária tem um funil próprio (Captação de interesse → Visita agendada → Visita realizada → Proposta enviada → Em negociação → Fechado/Perdido). Ele avança sozinho conforme visitas e propostas acontecem — a entrada do lead no funil continua manual.',
          },
        ],
      },
    ],
  },

]
