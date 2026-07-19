/**
 * Althos CRM — Manual do usuário (base de conhecimento).
 *
 * Fonte única de verdade usada por DOIS consumidores:
 *  1. A Central de Ajuda dinâmica (app/app/[orgSlug]/ajuda) — renderiza os
 *     blocos visualmente, com busca e navegação por categoria.
 *  2. O chat de suporte com IA (actions/support-chat) — usa `serializeHelpForAI`
 *     para transformar todo o conteúdo em texto plano e injetar como contexto
 *     (com prompt caching) para responder dúvidas do usuário.
 *
 * Módulo puro (sem 'use client' / 'use server') para ser importado nos dois lados.
 *
 * Ao adicionar/editar funcionalidades do produto, atualize este arquivo —
 * a ajuda e o suporte por IA ficam corretos automaticamente.
 */

// ── Tipos ───────────────────────────────────────────────────────────────────

export type HelpBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'steps'; items: string[] }
  | { type: 'list'; items: string[] }
  | { type: 'tip'; text: string }
  | { type: 'warning'; text: string }
  | { type: 'faq'; items: { q: string; a: string }[] }

export type HelpArticle = {
  slug: string
  title: string
  summary: string
  /** Termos extras para a busca (sinônimos, nomes de menu, etc). */
  keywords: string[]
  blocks: HelpBlock[]
}

export type HelpCategory = {
  slug: string
  title: string
  /** Nome do ícone em lucide-react. */
  icon: string
  description: string
  articles: HelpArticle[]
}

// ── Conteúdo ────────────────────────────────────────────────────────────────

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    slug: 'primeiros-passos',
    title: 'Primeiros passos',
    icon: 'Rocket',
    description: 'Configure sua conta e entenda a estrutura do Althos CRM.',
    articles: [
      {
        slug: 'o-que-e-o-althos',
        title: 'O que é o Althos CRM',
        summary:
          'Visão geral da plataforma e do que você consegue fazer com ela.',
        keywords: ['introdução', 'overview', 'começar', 'visão geral'],
        blocks: [
          {
            type: 'paragraph',
            text: 'O Althos CRM é uma plataforma para organizar seus contatos (leads), acompanhar suas vendas em um funil visual, automatizar o atendimento no WhatsApp e Instagram, e tomar decisões com apoio de inteligência artificial. Tudo num só lugar, pensado para equipes que querem vender mais sem aumentar o trabalho manual.',
          },
          {
            type: 'heading',
            text: 'Os pilares do app',
          },
          {
            type: 'list',
            items: [
              'Pipeline (Funil): acompanhe cada oportunidade por etapa, do primeiro contato ao fechamento.',
              'Leads e Clientes: cadastro central de contatos, com histórico completo de interações.',
              'Comunicação: WhatsApp e Instagram conectados ao CRM, com atendente de IA opcional.',
              'Automações: regras que agem sozinhas (ex.: criar tarefa, enviar mensagem) quando algo acontece.',
              'IA: Atendente que responde clientes e Insights que analisam seus números.',
            ],
          },
          {
            type: 'tip',
            text: 'Use o atalho Cmd+K (ou Ctrl+K no Windows) em qualquer tela para buscar e navegar rapidamente.',
          },
        ],
      },
      {
        slug: 'estrutura-e-navegacao',
        title: 'Estrutura e navegação',
        summary: 'Como o menu lateral é organizado e onde encontrar cada coisa.',
        keywords: ['menu', 'sidebar', 'navegação', 'seções'],
        blocks: [
          {
            type: 'paragraph',
            text: 'O menu lateral agrupa as ferramentas por área de trabalho. Da esquerda você acessa tudo:',
          },
          {
            type: 'list',
            items: [
              'Vendas: Dashboard, Pipeline, Leads, Clientes, Tarefas, Agendamentos.',
              'Comunicação: Conversas (WhatsApp), Social DMs (Instagram), Atendente IA.',
              'Marketing: Campanhas, E-mail, Formulários, Catálogo/Vendas.',
              'Operações: Automações, Insights IA, Central de Ajuda.',
              'Configurações: Equipe, integrações, aparência, assinatura.',
            ],
          },
          {
            type: 'tip',
            text: 'Você pode recolher o menu no desktop para ganhar espaço — os ícones continuam visíveis.',
          },
        ],
      },
      {
        slug: 'convidar-equipe',
        title: 'Convidar sua equipe e permissões',
        summary: 'Adicione membros e controle o que cada um pode acessar.',
        keywords: ['usuários', 'membros', 'convite', 'papéis', 'roles', 'acesso'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Em Configurações → Equipe você convida pessoas por e-mail e define o papel de cada uma. O papel controla quais áreas a pessoa enxerga e o que pode editar.',
          },
          {
            type: 'steps',
            items: [
              'Abra Configurações → Equipe.',
              'Clique em "Convidar membro" e informe o e-mail.',
              'Escolha o papel (Administrador, Gestor, Vendedor, etc.).',
              'A pessoa recebe o convite e cria a senha ao aceitar.',
            ],
          },
          {
            type: 'warning',
            text: 'Apenas administradores podem alterar a assinatura, integrações sensíveis e remover membros.',
          },
        ],
      },
    ],
  },

  {
    slug: 'pipeline-leads',
    title: 'Pipeline e Leads',
    icon: 'Kanban',
    description: 'Organize oportunidades no funil e gerencie seus contatos.',
    articles: [
      {
        slug: 'usar-o-pipeline',
        title: 'Usando o Pipeline (funil de vendas)',
        summary: 'Mova oportunidades entre etapas e acompanhe o progresso.',
        keywords: ['funil', 'kanban', 'etapas', 'estágios', 'negócios', 'oportunidades'],
        blocks: [
          {
            type: 'paragraph',
            text: 'O Pipeline é um quadro visual onde cada coluna é uma etapa do processo de vendas (ex.: Novo, Contato feito, Proposta, Fechado). Cada card é uma oportunidade ligada a um lead.',
          },
          {
            type: 'steps',
            items: [
              'Crie etapas que reflitam seu processo real em Configurações ou no topo do Pipeline.',
              'Arraste os cards entre colunas conforme a negociação avança.',
              'Clique num card para ver o histórico, registrar atividades e atualizar o valor.',
            ],
          },
          {
            type: 'tip',
            text: 'Mantenha poucas etapas e nomes claros. Funis enxutos são mais fáceis de manter atualizados — e a IA de Insights consegue analisá-los melhor.',
          },
        ],
      },
      {
        slug: 'cadastrar-leads',
        title: 'Cadastrando e gerenciando leads',
        summary: 'Como criar, importar e qualificar contatos.',
        keywords: ['contatos', 'importar', 'qualificação', 'origem', 'fonte'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Leads são seus contatos/potenciais clientes. Eles podem entrar manualmente, por formulários públicos, por integrações (WhatsApp, Instagram) ou por importação em massa.',
          },
          {
            type: 'list',
            items: [
              'Manual: botão "Novo lead" na página Leads.',
              'Formulários: cada envio de um formulário público vira um lead automaticamente.',
              'Conversas: uma mensagem nova de WhatsApp/Instagram pode criar o lead.',
              'Importação: suba uma planilha CSV para cadastrar vários de uma vez.',
            ],
          },
          {
            type: 'tip',
            text: 'Preencha a "origem" do lead sempre que possível. É o que alimenta os relatórios de performance por canal.',
          },
        ],
      },
      {
        slug: 'clientes',
        title: 'Clientes (pós-venda)',
        summary: 'Diferença entre lead e cliente, e a ficha do cliente.',
        keywords: ['pós-venda', 'ficha', 'documentos', 'perfil do cliente'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Quando um lead fecha negócio ele pode ser marcado como Cliente. A área Clientes guarda uma ficha mais completa: dados de perfil, documentos anexados e o histórico de tudo que aconteceu.',
          },
          {
            type: 'steps',
            items: [
              'Abra o lead e marque a opção "É cliente".',
              'Ele passa a aparecer também na lista de Clientes.',
              'Na ficha, anexe documentos e complete o perfil para o pós-venda.',
            ],
          },
        ],
      },
    ],
  },

  {
    slug: 'comunicacao',
    title: 'Comunicação',
    icon: 'MessageSquare',
    description: 'WhatsApp, Instagram e o atendimento com IA.',
    articles: [
      {
        slug: 'conversas-whatsapp',
        title: 'Conversas (WhatsApp)',
        summary: 'Centralize o atendimento de WhatsApp dentro do CRM.',
        keywords: ['whatsapp', 'chat', 'mensagens', 'inbox', 'atendimento'],
        blocks: [
          {
            type: 'paragraph',
            text: 'A área Conversas reúne os diálogos de WhatsApp ligados à sua conta. Cada conversa fica vinculada a um lead, então o histórico de mensagens vive junto com o resto das informações do contato.',
          },
          {
            type: 'list',
            items: [
              'Responda manualmente pela própria tela de Conversas.',
              'Veja o lead vinculado e atualize a etapa do funil sem sair do chat.',
              'Ative o Atendente IA para responder automaticamente quando você não estiver disponível.',
            ],
          },
          {
            type: 'tip',
            text: 'Conecte o WhatsApp em Configurações → Integrações. O número fica disponível para envio nas automações e no Atendente IA.',
          },
        ],
      },
      {
        slug: 'social-dms-instagram',
        title: 'Social DMs (Instagram)',
        summary:
          'Responda automaticamente DMs e comentários do Instagram com palavras-chave e IA.',
        keywords: ['instagram', 'dm', 'direct', 'comentários', 'automação social'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Em Social DMs você cria automações que respondem sozinhas a mensagens diretas (DMs) e comentários do Instagram. É ideal para campanhas do tipo "comente PREÇO que eu te mando no direct".',
          },
          {
            type: 'heading',
            text: 'Conectar o Instagram',
          },
          {
            type: 'steps',
            items: [
              'Vá em Configurações → Social e clique para conectar o Instagram.',
              'Faça login com a conta Instagram Profissional (vinculada a uma Página do Facebook).',
              'Autorize as permissões solicitadas. A conta aparece como "ativa" no CRM.',
            ],
          },
          {
            type: 'heading',
            text: 'Criar uma automação',
          },
          {
            type: 'steps',
            items: [
              'Em Social DMs, clique em "Nova automação".',
              'Escolha o gatilho: DM, comentário, ou ambos.',
              'Defina palavras-chave (ex.: "quero", "preço") que ativam a resposta — ou deixe em branco para responder a tudo.',
              'Escolha o tipo de resposta: fixa (texto pronto) ou IA (gerada na hora com instruções suas).',
              'Opcional: ative "criar lead" para registrar quem interagiu, e "enviar DM após comentário".',
              'Salve e mantenha a automação ativa.',
            ],
          },
          {
            type: 'warning',
            text: 'Para receber as mensagens em tempo real, o app de integração do Instagram precisa estar publicado/ativo. Se as respostas não dispararem, verifique a conexão em Configurações → Social.',
          },
          {
            type: 'paragraph',
            text: 'Cada interação tratada fica registrada no histórico da página Social DMs, mostrando a mensagem recebida, a resposta enviada e se um lead foi criado.',
          },
        ],
      },
      {
        slug: 'atendente-ia',
        title: 'Atendente IA',
        summary:
          'Configure um atendente de IA com persona, horário e base de conhecimento.',
        keywords: ['ia', 'bot', 'atendimento automático', 'faq', 'persona', 'handoff'],
        blocks: [
          {
            type: 'paragraph',
            text: 'O Atendente IA responde seus clientes automaticamente usando a personalidade, as regras e a base de conhecimento que você definir. Ele pode consultar disponibilidade de agenda e tipos de evento para ajudar a marcar reuniões.',
          },
          {
            type: 'heading',
            text: 'Configuração',
          },
          {
            type: 'steps',
            items: [
              'Em Configurações → Atendente IA, defina a persona (tom de voz, nome, como deve se comportar).',
              'Configure o horário de atendimento e quando a IA deve assumir.',
              'Cadastre perguntas e respostas na base de conhecimento (FAQ).',
              'Defina o handoff: quando a IA deve transferir para um humano.',
            ],
          },
          {
            type: 'tip',
            text: 'Use a página de teste (sandbox) do Atendente IA para conversar com ele e ajustar a persona antes de ativar com clientes reais.',
          },
        ],
      },
    ],
  },

  {
    slug: 'agenda-tarefas',
    title: 'Agenda e Tarefas',
    icon: 'Calendar',
    description: 'Organize compromissos, agendamentos online e tarefas da equipe.',
    articles: [
      {
        slug: 'tarefas',
        title: 'Tarefas',
        summary: 'Crie lembretes e atividades vinculadas a leads.',
        keywords: ['to-do', 'lembretes', 'follow-up', 'atividades', 'pendências'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Tarefas são atividades com prazo, normalmente ligadas a um lead (ex.: "ligar para o João amanhã"). Elas aparecem na sua lista de pendências e geram notificações quando vencem.',
          },
          {
            type: 'tip',
            text: 'Tarefas vencidas disparam notificação push (se você ativou as notificações do navegador). Mantenha os prazos realistas.',
          },
        ],
      },
      {
        slug: 'agendamentos',
        title: 'Agendamentos online',
        summary: 'Deixe clientes marcarem horário sozinhos por um link público.',
        keywords: ['booking', 'agenda', 'calendário', 'reunião', 'horários', 'eventos'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Você cria tipos de evento (ex.: "Reunião de 30 min") com horários disponíveis, e compartilha um link público. O cliente escolhe um horário livre e o agendamento entra na sua agenda — gerando também um lead, se ainda não existir.',
          },
          {
            type: 'steps',
            items: [
              'Crie um tipo de evento com duração e disponibilidade.',
              'Compartilhe o link público de agendamento.',
              'Os horários marcados aparecem em Agendamentos e podem disparar automações.',
            ],
          },
        ],
      },
    ],
  },

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

// ── Utilidades ──────────────────────────────────────────────────────────────

/** Lista achatada de todos os artigos com referência à categoria. */
export function allArticles(): Array<HelpArticle & { category: HelpCategory }> {
  return HELP_CATEGORIES.flatMap((category) =>
    category.articles.map((article) => ({ ...article, category })),
  )
}

/** Busca um artigo por slug de categoria + slug de artigo. */
export function findArticle(
  categorySlug: string,
  articleSlug: string,
): { category: HelpCategory; article: HelpArticle } | null {
  const category = HELP_CATEGORIES.find((c) => c.slug === categorySlug)
  if (!category) return null
  const article = category.articles.find((a) => a.slug === articleSlug)
  if (!article) return null
  return { category, article }
}

/** Converte um bloco em texto plano (para busca e para a IA). */
function blockToText(block: HelpBlock): string {
  switch (block.type) {
    case 'paragraph':
    case 'tip':
    case 'warning':
    case 'heading':
      return block.text
    case 'steps':
    case 'list':
      return block.items.map((i, idx) => `${idx + 1}. ${i}`).join('\n')
    case 'faq':
      return block.items.map((i) => `P: ${i.q}\nR: ${i.a}`).join('\n')
    default:
      return ''
  }
}

/** Texto plano de um artigo (título + resumo + corpo). */
export function articleToText(article: HelpArticle): string {
  const body = article.blocks.map(blockToText).join('\n')
  return `${article.title}\n${article.summary}\n${body}`
}

/**
 * Serializa TODO o manual em texto plano, pronto para ser injetado como
 * contexto do chat de suporte com IA (com prompt caching). Inclui marcadores
 * de categoria/artigo para a IA conseguir citar a seção certa.
 */
export function serializeHelpForAI(): string {
  const parts: string[] = [
    'MANUAL DO USUÁRIO — ALTHOS CRM',
    'Use exclusivamente as informações abaixo para responder dúvidas sobre o produto.',
    '',
  ]
  for (const category of HELP_CATEGORIES) {
    parts.push(`## CATEGORIA: ${category.title}`)
    parts.push(category.description)
    for (const article of category.articles) {
      parts.push('')
      parts.push(`### ${article.title}`)
      parts.push(article.summary)
      for (const block of article.blocks) {
        if (block.type === 'heading') {
          parts.push(`**${block.text}**`)
        } else if (block.type === 'tip') {
          parts.push(`Dica: ${block.text}`)
        } else if (block.type === 'warning') {
          parts.push(`Atenção: ${block.text}`)
        } else {
          parts.push(blockToText(block))
        }
      }
    }
    parts.push('')
  }
  return parts.join('\n')
}
