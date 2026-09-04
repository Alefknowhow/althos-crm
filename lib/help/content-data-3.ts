import type { HelpCategory } from './content'

export const HELP_CATEGORIES_PART_3: HelpCategory[] = [
  {
    slug: 'vendas-seguros',
    title: 'Gestão de Corretora de Seguros',
    icon: 'Shield',
    description:
      'Módulos exclusivos de corretoras: produtos, seguradoras, cotações comparativas, apólices e sinistros.',
    niches: ['seguros'],
    articles: [
      {
        slug: 'produtos-seguradoras',
        title: 'Produtos de Seguro e Seguradoras',
        summary: 'Cadastre os tipos de seguro que você vende e as seguradoras parceiras.',
        keywords: ['produto', 'seguradora', 'catálogo', 'apólice'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Cadastre livremente os tipos de seguro que sua corretora oferece (Auto, Residencial, Vida, etc.) e as seguradoras parceiras, com condições e dados de contato.',
          },
        ],
      },
      {
        slug: 'cotacoes-seguro',
        title: 'Cotações comparativas',
        summary: 'Compare prêmio, cobertura e franquia entre seguradoras lado a lado.',
        keywords: ['cotação', 'comparação', 'prêmio', 'franquia', 'cobertura'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Monte uma cotação pra um cliente comparando várias seguradoras ao mesmo tempo — cada uma com seu prêmio, cobertura, franquia e condições. O menor prêmio calculado aparece destacado na lista.',
          },
        ],
      },
      {
        slug: 'apolices',
        title: 'Apólices e comissão parcelada',
        summary: 'Emita a apólice a partir da cotação aprovada; a comissão entra parcelada no Financeiro.',
        keywords: ['apólice', 'emissão', 'comissão', 'parcelas', 'vigência'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Quando o cliente aprova uma cotação, emita a apólice: número gerado automaticamente, vigência e forma de pagamento. A comissão da venda é lançada no Financeiro já dividida nas parcelas certas, em vez de um valor único.',
          },
          {
            type: 'tip',
            text: 'Configure em Configurações com quantos dias de antecedência (ex.: 60/30/15) o CRM deve criar uma tarefa de renovação antes da apólice vencer.',
          },
        ],
      },
      {
        slug: 'sinistros',
        title: 'Sinistros',
        summary: 'Registre um sinistro aberto pelo cliente e acompanhe até a resolução.',
        keywords: ['sinistro', 'acionamento', 'documentos'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Abra um sinistro vinculado à apólice do cliente, anexe os documentos necessários e acompanhe o andamento. Abrir um sinistro cria automaticamente uma tarefa de acompanhamento.',
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
        title: 'Agente IA',
        summary:
          'Configure o agente de IA com persona, horário e base de conhecimento.',
        keywords: ['ia', 'bot', 'atendimento automático', 'faq', 'persona', 'handoff', 'agente'],
        blocks: [
          {
            type: 'paragraph',
            text: 'O Agente IA responde seus clientes automaticamente usando a personalidade, as regras e a base de conhecimento que você definir. Ele pode consultar disponibilidade de agenda e tipos de evento para ajudar a marcar reuniões.',
          },
          {
            type: 'heading',
            text: 'Configuração',
          },
          {
            type: 'steps',
            items: [
              'Em Configurações → Agente IA → Personalidade, defina o tom de voz, nome e como ele deve se comportar.',
              'Na aba Horários, configure o horário de atendimento e quando o agente deve assumir.',
              'Na aba Conhecimento, cadastre perguntas e respostas (FAQ).',
              'Na aba Transferência Humana, defina quando o agente deve passar a conversa pra um humano.',
            ],
          },
          {
            type: 'tip',
            text: 'Use a aba Testar Agente para conversar com ele e ajustar a persona antes de ativar com clientes reais.',
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

]
