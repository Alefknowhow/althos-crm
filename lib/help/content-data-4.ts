import type { HelpCategory } from './content'

export const HELP_CATEGORIES_PART_4: HelpCategory[] = [
  {
    slug: 'marketing',
    title: 'Marketing e Captação',
    icon: 'Megaphone',
    description: 'Formulários, campanhas, e-mail e catálogo de vendas.',
    articles: [
      {
        slug: 'formularios',
        title: 'Formulários públicos',
        summary: 'Crie formulários para capturar leads no seu site ou redes.',
        keywords: ['form', 'captação', 'landing', 'lead form', 'anti-spam'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Com o construtor de formulários você monta formulários personalizados e os publica num link. Cada envio cria um lead automaticamente, já com a origem registrada.',
          },
          {
            type: 'list',
            items: [
              'Arraste campos (nome, e-mail, telefone, perguntas personalizadas).',
              'Configure a tela de sucesso — inclusive com um botão para agendar uma reunião.',
              'Proteções anti-spam (honeypot, tempo mínimo e captcha opcional) já vêm embutidas.',
            ],
          },
        ],
      },
      {
        slug: 'campanhas-email',
        title: 'Campanhas e E-mail',
        summary: 'Envie comunicações para grupos de leads.',
        keywords: ['email marketing', 'disparo', 'campanha', 'newsletter'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Use Campanhas e E-mail para se comunicar com grupos de leads de forma segmentada. Combine com automações para nutrir contatos ao longo do funil.',
          },
        ],
      },
      {
        slug: 'catalogo-vendas',
        title: 'Catálogo e Vendas',
        summary: 'Cadastre produtos/serviços e registre vendas.',
        keywords: ['produtos', 'serviços', 'preços', 'pedidos', 'faturamento'],
        blocks: [
          {
            type: 'paragraph',
            text: 'No Catálogo você cadastra seus produtos e serviços com preços. Eles podem ser associados a oportunidades e vendas, alimentando os relatórios de faturamento e previsão de receita.',
          },
        ],
      },
    ],
  },

  {
    slug: 'automacoes',
    title: 'Automações',
    icon: 'Zap',
    description: 'Faça o CRM trabalhar sozinho com regras de gatilho e ação.',
    articles: [
      {
        slug: 'como-funcionam',
        title: 'Como funcionam as automações',
        summary: 'Estrutura gatilho → ação e os tipos disponíveis.',
        keywords: ['workflow', 'regras', 'gatilho', 'trigger', 'ação', 'webhook'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Uma automação é uma regra do tipo "quando ACONTECER X, FAÇA Y". Você define um gatilho (evento) e uma ou mais ações que rodam automaticamente.',
          },
          {
            type: 'heading',
            text: 'Exemplos de gatilho',
          },
          {
            type: 'list',
            items: [
              'Lead criado ou movido de etapa.',
              'Lead parado (sem atividade) há X dias.',
              'Tarefa vencida.',
              'Agendamento marcado.',
            ],
          },
          {
            type: 'heading',
            text: 'Exemplos de ação',
          },
          {
            type: 'list',
            items: [
              'Criar uma tarefa de follow-up.',
              'Enviar mensagem (WhatsApp) ou e-mail.',
              'Enviar notificação push para a equipe.',
              'Chamar um webhook em outro sistema.',
            ],
          },
          {
            type: 'tip',
            text: 'Comece com 1 ou 2 automações simples (ex.: "lead parado há 3 dias → criar tarefa de follow-up") e vá expandindo conforme ganha confiança.',
          },
        ],
      },
    ],
  },

  {
    slug: 'analise-ia',
    title: 'Análise e Insights IA',
    icon: 'Sparkles',
    description: 'Dashboard de métricas e o analista de dados com IA.',
    articles: [
      {
        slug: 'dashboard',
        title: 'Dashboard',
        summary: 'Os principais indicadores do seu negócio numa tela.',
        keywords: ['kpi', 'métricas', 'gráficos', 'funil de conversão', 'previsão'],
        blocks: [
          {
            type: 'paragraph',
            text: 'O Dashboard reúne KPIs e gráficos: funil de conversão, leads em risco, tempo médio por etapa, previsão de receita, performance por origem e ranking de vendedores.',
          },
          {
            type: 'tip',
            text: 'A qualidade do Dashboard depende dos dados. Mantenha etapas atualizadas, origens preenchidas e valores nas oportunidades.',
          },
        ],
      },
      {
        slug: 'insights-ia',
        title: 'Insights IA',
        summary: 'Converse com um analista de IA sobre seus números.',
        keywords: ['análise', 'perguntas', 'relatórios', 'analista', 'dados'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Insights IA é um chat onde você faz perguntas em linguagem natural sobre o seu CRM ("qual minha taxa de conversão este mês?", "quais leads estão parados?"). A IA consulta seus dados reais e responde com texto, gráficos e tabelas.',
          },
          {
            type: 'list',
            items: [
              'Pergunte sobre KPIs, vendas, pipeline, agendamentos e marketing.',
              'A IA gera gráficos e tabelas automaticamente quando faz sentido.',
              'O histórico das conversas fica salvo por usuário.',
            ],
          },
        ],
      },
    ],
  },

  {
    slug: 'conta-config',
    title: 'Conta e Configurações',
    icon: 'Settings',
    description: 'Aparência, integrações, notificações e assinatura.',
    articles: [
      {
        slug: 'aparencia',
        title: 'Sua marca no CRM',
        summary: 'Faça upload da logo da sua organização.',
        keywords: ['logo', 'identidade', 'branding', 'marca'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Em Configurações → Geral → Sua Empresa você faz upload da logo da sua organização. Ela aparece nas propostas e cotações geradas para os seus clientes.',
          },
        ],
      },
      {
        slug: 'notificacoes',
        title: 'Notificações',
        summary: 'Receba avisos no navegador sobre eventos importantes.',
        keywords: ['push', 'alertas', 'navegador', 'pwa'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Ative as notificações push para receber avisos de tarefas vencidas e novas mensagens de WhatsApp, mesmo com o app em segundo plano. O Althos também pode ser instalado como aplicativo (PWA) no celular e no desktop.',
          },
        ],
      },
      {
        slug: 'assinatura',
        title: 'Assinatura e cobrança',
        summary: 'Plano, limites de uso e faturas.',
        keywords: ['plano', 'pagamento', 'fatura', 'cobrança', 'upgrade', 'trial'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Em Configurações → Assinatura você acompanha seu plano atual, os limites de uso e o histórico de cobrança. Durante o período de teste, um aviso mostra quantos dias restam.',
          },
          {
            type: 'warning',
            text: 'Só administradores podem alterar o plano ou os dados de pagamento.',
          },
        ],
      },
    ],
  },
]
