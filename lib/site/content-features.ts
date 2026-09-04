/**
 * Funcionalidades (página /funcionalidades — menu clicável estilo Bolten).
 * Split out of lib/site/content.ts.
 */

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
      'No Instagram, monte a automação num único fluxo, estilo construtor de chatbot: escolha o tipo (DM, comentário, comentário + DM, menção ou resposta a story), o gatilho e a resposta — fixa ou por IA — com botões de resposta rápida ou de link.',
    ],
    bullets: [
      'Conexão do WhatsApp em 1 clique',
      'Caixa de entrada unificada da equipe',
      'Automação de Instagram com botões de resposta rápida e link',
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
  {
    slug: 'financeiro',
    icon: 'Wallet',
    title: 'Financeiro completo',
    tagline: 'Receitas, despesas e fluxo de caixa sem planilha paralela.',
    body: [
      'Controle financeiro completo, transversal a qualquer nicho: lançamentos de receita e despesa, categorias e centros de custo configuráveis, importação de extrato bancário e anexos por lançamento.',
      'Despesas recorrentes (aluguel, assinaturas, folha) já geram os próximos 12 meses automaticamente — sem recadastrar todo mês. E quem trabalha com comissão de operadora/parceiro cadastra o dia de pagamento de cada uma: a receita da venda é lançada direto na data real do repasse, não no dia em que a venda foi fechada.',
      'Dashboard com fluxo de caixa diário, despesas por categoria, DRE simplificado e lista de vencimentos próximos.',
    ],
    bullets: [
      'Despesas recorrentes geradas automaticamente',
      'Receita lançada na data de pagamento de cada operadora/parceiro',
      'Dashboard com fluxo de caixa e DRE simplificado',
    ],
  },
  {
    slug: 'importacao-exportacao',
    icon: 'ArrowDownUp',
    title: 'Importação e exportação de dados',
    tagline: 'Traga sua base existente ou tire seus dados quando quiser.',
    body: [
      'Migre contatos e reservas/vendas de uma planilha em poucos cliques — o sistema reconhece o cabeçalho automaticamente e, ao importar vendas, já localiza (ou cria) o contato pelo telefone, e-mail ou nome.',
      'Exporte contatos e reservas/vendas em CSV a qualquer momento, e baixe um arquivo-modelo pronto pra preencher com o formato certo antes de importar.',
    ],
    bullets: [
      'Importação de contatos e reservas/vendas via CSV',
      'Arquivo-modelo com o formato correto pra download',
      'Exportação completa a qualquer momento — seus dados são seus',
    ],
  },
]
