import type { HelpCategory } from './content'

export const HELP_CATEGORIES_PART_1: HelpCategory[] = [
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
              'Para agências de viagem: módulos extras de Cotações, Ofertas, Reservas, Embarques, Bloqueios, Documentos e Financeiro (veja a categoria "Vendas de Viagem").',
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
              'Vendas de Viagem (só em contas de agência de viagem): Cotações, Ofertas, Reservas, Embarques, Bloqueios, Documentos, Financeiro.',
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
    slug: 'vendas-viagem',
    title: 'Vendas de Viagem',
    icon: 'Plane',
    description:
      'Módulos exclusivos de agências de viagem: cotações, ofertas, reservas, embarques, bloqueios, documentos e financeiro.',
    niches: ['viagens'],
    articles: [
      {
        slug: 'cotacoes',
        title: 'Cotações',
        summary: 'Monte propostas de viagem para enviar ao cliente.',
        keywords: ['proposta', 'orçamento', 'roteiro', 'pdf', 'link público', 'preço'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Em Cotações você monta uma proposta de viagem completa — capa, roteiro dia a dia, hospedagem (com fotos e nota do TripAdvisor), voos, condições de pagamento e investimento — num editor com preview ao vivo.',
          },
          {
            type: 'steps',
            items: [
              'Crie a cotação vinculada a um lead/contato.',
              'Preencha as seções (Viagem, Hospedagem, Aéreo, Investimento).',
              'Gere o link público para o cliente ver a proposta com a marca da sua agência.',
              'Baixe o PDF whitelabel se preferir enviar por WhatsApp/e-mail.',
            ],
          },
          {
            type: 'tip',
            text: 'Depois que o cliente fecha, use o botão "Gerar venda" na própria cotação para criar a reserva já preenchida — sem digitar tudo de novo.',
          },
        ],
      },
      {
        slug: 'ofertas',
        title: 'Ofertas',
        summary: 'Pacotes prontos publicados numa vitrine pública.',
        keywords: ['vitrine', 'pacote', 'promoção', 'catálogo de viagens'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Ofertas são pacotes de viagem prontos (sem cliente vinculado) que aparecem numa vitrine pública da sua agência — útil para divulgar promoções nas redes sociais.',
          },
          {
            type: 'list',
            items: [
              'É montada com o mesmo editor de Cotações, só que sem dados de cliente.',
              'Publique para liberar o link da vitrine; despublique para tirar de circulação sem perder o conteúdo.',
              'Copie o link da vitrine para divulgar em bio do Instagram, WhatsApp Status, etc.',
            ],
          },
        ],
      },
      {
        slug: 'reservas',
        title: 'Reservas',
        summary: 'Gerencie a venda fechada: viajantes, checklist, contrato e voucher.',
        keywords: ['venda', 'viagem vendida', 'contrato', 'voucher', 'viajantes', 'checklist'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Reservas é a tela de operação da viagem já vendida: dados do cliente e destino, datas, hotel, companhia aérea, operadora, viajantes (com CPF/data de nascimento) e um checklist do que falta providenciar.',
          },
          {
            type: 'list',
            items: [
              'Preencha manualmente, ou importe os dados de um voucher/PDF da operadora com "Preencher com IA".',
              'Gere o contrato (usa o template padrão da sua agência, se configurado) e o voucher para o cliente.',
              'Ao salvar, o CRM pode gerar automaticamente as tarefas operacionais da viagem (documentação, pagamento, envio de voucher).',
            ],
          },
          {
            type: 'tip',
            text: 'Uma venda criada aqui também pode nascer automaticamente quando você move um lead com cotação vinculada para a etapa de "Ganho" no Pipeline.',
          },
        ],
      },
      {
        slug: 'embarques',
        title: 'Embarques',
        summary: 'Linha do tempo visual das viagens vendidas por data de partida.',
        keywords: ['linha do tempo', 'gantt', 'partida', 'retorno', 'programação'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Embarques mostra, num gráfico de linha do tempo (estilo Gantt) e numa lista, todas as reservas com data de partida definida — para você enxergar de relance o que vem por aí.',
          },
          {
            type: 'list',
            items: [
              'Filtre por Todas, Próximas, Em andamento ou Concluídas.',
              'Filtre também por responsável pela venda.',
              'Clique num embarque para ver as tarefas ligadas e abrir o WhatsApp do cliente direto.',
            ],
          },
        ],
      },
      {
        slug: 'bloqueios',
        title: 'Bloqueios',
        summary: 'Controle lotes de assentos/vagas garantidos com a operadora.',
        keywords: ['assentos', 'vagas', 'lote', 'operadora', 'garantido'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Bloqueios cadastra os lotes de assentos ou vagas que sua agência garantiu com uma operadora para um trecho/data — útil para acompanhar quanto ainda resta vender de cada bloqueio.',
          },
          {
            type: 'tip',
            text: 'Você pode importar de uma vez a planilha (CSV/XLSM) do mapa de assentos da operadora em vez de cadastrar linha por linha.',
          },
        ],
      },
      {
        slug: 'documentos',
        title: 'Documentos',
        summary: 'Modelos de documento reutilizáveis, MEDIF e FREMEC.',
        keywords: ['modelo', 'template', 'contrato padrão', 'medif', 'fremec', 'autorização'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Em Documentos você cria modelos reutilizáveis (contrato padrão, autorização de menor viajando, declarações) com campos entre {{chaves}} que viram campos de preenchimento na hora de gerar o documento pra um cliente.',
          },
          {
            type: 'list',
            items: [
              'Aba Modelos: crie e edite os modelos de texto da sua agência.',
              'Aba MEDIF: informações de assistência médica para embarque de passageiros com necessidades especiais.',
              'Aba FREMEC: informações de equipamento/cadeira de rodas para companhias aéreas.',
            ],
          },
        ],
      },
      {
        slug: 'financeiro',
        title: 'Financeiro',
        summary: 'Lançamentos de receita/despesa, comissões e fluxo de caixa.',
        keywords: ['receita', 'despesa', 'comissão', 'fluxo de caixa', 'dre', 'vencimento', 'operadora'],
        blocks: [
          {
            type: 'paragraph',
            text: 'O Financeiro registra receitas e despesas da agência, com categorias, contas e formas de pagamento configuráveis. Quando uma reserva é salva, a comissão da venda pode ser lançada automaticamente na data de pagamento configurada para a operadora.',
          },
          {
            type: 'list',
            items: [
              'Aba Lançamentos: lista e edita receitas/despesas, inclusive recorrentes (repetem todo mês).',
              'Aba Dashboard: fluxo de caixa, DRE simplificado e próximos vencimentos.',
              'Aba Configurações: cadastre categorias, centros de custo, contas bancárias e operadoras (com o dia do mês em que cada uma paga comissão).',
            ],
          },
          {
            type: 'tip',
            text: 'Cadastre o nome da operadora em Financeiro exatamente como aparece em Reservas — é esse nome que o CRM usa para saber quando a comissão daquela venda deve ser paga.',
          },
        ],
      },
    ],
  },

]
