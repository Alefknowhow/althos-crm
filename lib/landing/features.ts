/**
 * Conteúdo das páginas dedicadas por funcionalidade (landing pages de SEO
 * para termos como "atendimento com IA", "automação para Instagram" e "CRM
 * com WhatsApp" — funcionalidades reais do produto que ainda não tinham
 * página própria). Mesmo shape de lib/landing/niches.ts, mesmo componente
 * <NicheLanding>. Slugs viram rotas em app/(public)/<slug>/page.tsx e
 * precisam estar liberados no middleware (classifyRoute).
 */

import type { NicheContent } from './niches'

export const FEATURES: Record<string, NicheContent> = {
  'atendimento-ia': {
    slug: 'atendimento-ia',
    nav: 'Atendimento com IA',
    metaTitle: 'Atendimento com IA no WhatsApp — Althos CRM',
    metaDescription:
      'CRM com atendente de IA que responde no WhatsApp 24h, qualifica leads, tira dúvidas com a voz da sua empresa e passa para um humano na hora certa.',
    eyebrow: 'Atendimento com IA',
    h1: 'Um atendente de IA que responde',
    h1Accent: 'como a sua empresa responderia',
    sub: 'Cliente manda mensagem fora do horário, no fim de semana, na hora do almoço. A IA da Althos atende na hora com o tom da sua empresa, qualifica quem está pronto para comprar e transfere para um humano quando precisa — sem deixar ninguém esperando.',
    heroChips: ['Atende 24h no WhatsApp', 'Qualificação automática', 'Transferência para humano', 'Créditos por uso, sem surpresa'],
    dores: [
      { t: 'Cliente espera e desiste', d: 'Fora do horário comercial, no fim de semana, durante o almoço — cada janela sem resposta é uma chance de o cliente falar com o concorrente.' },
      { t: 'Time gasta tempo com pergunta repetida', d: '"Qual o valor?", "Como funciona?", "Vocês entregam nessa região?" — as mesmas perguntas, dezenas de vezes por dia, tirando o time do que realmente fecha venda.' },
      { t: 'Lead curioso ocupa a agenda do vendedor', d: 'Sem qualificar antes, o vendedor perde tempo com quem só está pesquisando e demora para falar com quem está pronto para comprar.' },
      { t: 'IA genérica que não conhece o seu negócio', d: 'Chatbot de script fixo trava na primeira pergunta fora do roteiro e frustra o cliente em vez de ajudar.' },
    ],
    resolve: [
      { n: '01', t: 'A IA responde com a identidade da sua empresa', d: 'Você define tom de voz, informações e regras. A IA conversa naturalmente no WhatsApp, sem parecer um robô de script fixo.' },
      { n: '02', t: 'Qualifica antes de passar para o time', d: 'A IA entende o que o cliente precisa, coleta as informações certas e já classifica a oportunidade — o vendedor entra na conversa já sabendo o contexto.' },
      { n: '03', t: 'Sabe a hora de chamar um humano', d: 'Pergunta complexa, reclamação ou pedido de negociação? A IA transfere a conversa para a sua equipe sem o cliente ter que repetir nada.' },
    ],
    recursos: [
      { t: 'Atendente de IA 24/7', d: 'Responde no WhatsApp a qualquer hora, todos os dias da semana, com a voz configurada da sua empresa.' },
      { t: 'Consultas em tempo real', d: 'A IA consulta pipeline, forecast e dados do seu negócio para responder perguntas com números reais, não só texto genérico.' },
      { t: 'Score e qualificação automática', d: 'Cada conversa gera uma classificação de intenção, ajudando o time a priorizar quem está mais perto de fechar.' },
      { t: 'Handoff para humano sem atrito', d: 'A transferência preserva todo o histórico — o vendedor assume a conversa exatamente de onde a IA parou.' },
      { t: 'Créditos previsíveis', d: 'Consumo de IA medido por créditos mensais inclusos no plano, sem cobrança surpresa por mensagem.' },
      { t: 'Copiloto para a equipe', d: 'Além de atender o cliente, a IA também responde perguntas do seu time sobre o funil, os números e o forecast direto no painel.' },
    ],
    casos: [
      'Cliente pergunta sobre preço às 23h — a IA responde, qualifica e agenda um retorno para o dia seguinte.',
      'Dúvida técnica complexa foge do escopo — a IA identifica e transfere para o especialista humano, com o histórico completo.',
      'Vendedor chega de manhã e já tem 5 conversas qualificadas da madrugada esperando follow-up.',
      'Gestor pergunta ao copiloto "qual meu forecast do mês?" e recebe a resposta com dados reais na hora.',
    ],
    faq: [
      { q: 'A IA substitui meu time de vendas?', a: 'Não. Ela atende, qualifica e organiza o primeiro contato para o seu time fechar a venda com mais contexto e menos tempo perdido em perguntas repetidas.' },
      { q: 'Consigo definir o que a IA pode e não pode responder?', a: 'Sim. Você configura o tom de voz, as informações que ela conhece e as regras de quando transferir para um humano.' },
      { q: 'Como funciona a cobrança do uso de IA?', a: 'Cada plano inclui uma quantidade de créditos de IA por mês. O consumo é medido por interação, sem surpresa na fatura.' },
      { q: 'Funciona só no WhatsApp?', a: 'O atendimento com IA está centrado no WhatsApp, o canal onde o cliente brasileiro mais conversa, com o copiloto disponível também dentro do painel para o seu time.' },
      { q: 'Tem fidelidade?', a: 'Não. Cancele quando quiser, direto pelo painel, sem multa.' },
    ],
    ctaTitle: 'Pare de perder cliente por falta de resposta',
    ctaSub: 'Ative o atendimento com IA da Althos e responda todo lead, a qualquer hora.',
  },

  'automacao-instagram': {
    slug: 'automacao-instagram',
    nav: 'Automação de Instagram',
    metaTitle: 'Automação para Instagram — DM, Stories e Comentários — Althos CRM',
    metaDescription:
      'Automatize a DM do Instagram: funis por resposta de story, comentário em post ou primeira mensagem, com IA ou passos fixos, direto do CRM.',
    eyebrow: 'Automação de Instagram',
    h1: 'Cada DM e comentário do Instagram',
    h1Accent: 'virando conversa organizada',
    sub: 'O Instagram gera interesse o dia todo — em comentário, resposta de story e DM direta. A Althos transforma cada um desses gatilhos em um funil automático que conversa, qualifica e organiza o contato no seu CRM, sem perder nada na correria do dia a dia.',
    heroChips: ['Funil por DM, story e comentário', 'Resposta com IA ou fixa', 'Sem trocar de número', 'Tudo no mesmo CRM'],
    dores: [
      { t: 'Comentário que vira DM e se perde', d: 'Alguém comenta no post, você responde na hora só se estiver de olho — passou uma hora, o interesse esfriou e a conversa nunca começou.' },
      { t: 'Resposta de story sem organização', d: 'Cliente reage ao seu story, manda uma pergunta e a conversa fica perdida entre dezenas de DMs sem contexto nem próximo passo.' },
      { t: 'Equipe alternando entre apps', d: 'Instagram num app, CRM em outro, WhatsApp em um terceiro — nada conversa entre si e o histórico do cliente fica espalhado.' },
      { t: 'Sem funil, sem repetição do que funciona', d: 'Cada atendente responde do seu jeito. O que converteu uma vez não vira processo, e o resultado depende de quem está atendendo naquele dia.' },
    ],
    resolve: [
      { n: '01', t: 'Gatilho automático por DM, story ou comentário', d: 'Configure um funil que dispara quando alguém manda DM, responde a um story específico ou comenta com uma palavra-chave no post.' },
      { n: '02', t: 'Passos com IA ou mensagem fixa', d: 'Cada etapa do funil pode ser uma resposta automática fixa ou uma resposta gerada por IA — você escolhe onde quer previsibilidade e onde quer naturalidade.' },
      { n: '03', t: 'Tudo organizado no mesmo CRM', d: 'Cada conversa vira um contato com histórico completo, junto com WhatsApp e o resto do seu funil de vendas — nada fica isolado no Instagram.' },
    ],
    recursos: [
      { t: 'Inbox de DM centralizada', d: 'Veja e responda toda mensagem direta do Instagram sem sair do painel, com histórico completo por contato.' },
      { t: 'Funil por resposta de story', d: 'Alguém reagiu ou respondeu ao seu story? O funil configurado para esse gatilho assume a conversa automaticamente.' },
      { t: 'Funil por comentário → DM', d: 'Um comentário com a palavra certa no seu post dispara uma resposta privada que abre a conversa direto na DM.' },
      { t: 'Passos com IA ou texto fixo', d: 'Monte sequências de 3, 4 ou mais passos misturando mensagem pronta e resposta gerada por IA, conforme a etapa pede.' },
      { t: 'Pausa automática ao assumir', d: 'Quando um atendente humano responde manualmente, a automação pausa naquela conversa — sem IA e humano se atropelando.' },
      { t: 'Sem trocar de número ou conta', d: 'A automação conecta direto à sua conta do Instagram — você continua publicando e interagindo normalmente.' },
    ],
    casos: [
      'Comentário "quero saber mais" num post — a automação responde na DM em segundos e inicia o funil de qualificação.',
      'Cliente reage a um story de novidade — o funil de resposta de story assume e já pergunta o que ele procura.',
      'Atendente entra numa conversa para negociar — a automação pausa e some sem o cliente perceber a troca.',
      'Fim de semana, DM chegando o dia todo — cada uma organizada como contato no CRM, pronta para retomada na segunda.',
    ],
    faq: [
      { q: 'Preciso trocar de conta do Instagram?', a: 'Não. Você conecta a conta que já usa para postar e a Althos passa a gerenciar DM, respostas de story e comentários dela.' },
      { q: 'A automação funciona junto com atendimento humano?', a: 'Sim. Quando alguém do seu time responde manualmente, a automação pausa naquela conversa até você decidir reativar.' },
      { q: 'Consigo criar mais de um funil, por gatilho diferente?', a: 'Sim. Você pode ter um funil para DM direta, outro para resposta de story e outro para comentário — cada um com sua própria sequência de passos.' },
      { q: 'As conversas do Instagram aparecem junto com o resto do CRM?', a: 'Sim. Cada contato do Instagram vira um lead no seu funil de vendas, com o mesmo histórico e as mesmas automações de follow-up do restante da base.' },
      { q: 'Tem fidelidade?', a: 'Não. Cancele quando quiser, direto pelo painel.' },
    ],
    ctaTitle: 'Nenhuma DM ou comentário do Instagram esquecido',
    ctaSub: 'Ative a automação de Instagram da Althos e transforme interesse em conversa organizada.',
  },

  'crm-whatsapp': {
    slug: 'crm-whatsapp',
    nav: 'CRM com WhatsApp',
    metaTitle: 'CRM com WhatsApp Integrado — Althos CRM',
    metaDescription:
      'CRM com WhatsApp centralizado: atenda em equipe pelo mesmo número, automatize follow-up, use templates aprovados e não perca nenhuma conversa em meio à correria.',
    eyebrow: 'CRM com WhatsApp',
    h1: 'O WhatsApp da sua empresa,',
    h1Accent: 'organizado como CRM de verdade',
    sub: 'O WhatsApp virou o principal canal de vendas — e o mais bagunçado. A Althos centraliza as conversas, distribui entre o time, automatiza follow-up e templates, e transforma cada mensagem em um contato com histórico, sem trocar de número.',
    heroChips: ['Atendimento em equipe', 'Follow-up automático', 'Templates aprovados', 'Histórico por cliente'],
    dores: [
      { t: 'Vendas espalhadas em conversas soltas', d: 'Cliente aqui, negociação ali, tudo no mesmo app pessoal ou em números diferentes — sem nenhum registro de quem é quem e em qual etapa está.' },
      { t: 'Time disputando o mesmo número', d: 'Vários atendentes, um WhatsApp só, sem saber quem já respondeu o quê — cliente recebendo mensagem duplicada ou nenhuma resposta.' },
      { t: 'Follow-up que fica na memória', d: 'Orçamento enviado, cliente que "vai pensar" — sem um sistema por trás, esse contato simplesmente some da fila.' },
      { t: 'Mensagem fora da janela de 24h', d: 'A regra da Meta bloqueia mensagem livre depois de 24h sem resposta — sem template aprovado configurado, a conversa trava.' },
    ],
    resolve: [
      { n: '01', t: 'Um número, o time inteiro atendendo', d: 'Centralize o WhatsApp da empresa no CRM: cada atendente vê as conversas atribuídas a ele, sem sobreposição nem mensagem perdida.' },
      { n: '02', t: 'Follow-up que roda sozinho', d: 'Configure sequências automáticas para retomar orçamento parado, lead frio ou pós-venda — no dia e hora certos, sem depender de lembrete manual.' },
      { n: '03', t: 'Templates aprovados prontos para usar', d: 'Envie mensagens fora da janela de 24h com templates já aprovados pela Meta, sem travar a conversa nem violar a política do WhatsApp.' },
    ],
    recursos: [
      { t: 'Conversas centralizadas por contato', d: 'Cada conversa do WhatsApp vira um histórico ligado ao contato no CRM — nunca mais perguntando "quem é esse cliente?".' },
      { t: 'Distribuição entre a equipe', d: 'Atribua conversas por vendedor ou fila, com visibilidade de quem está atendendo o quê em tempo real.' },
      { t: 'Automação de follow-up', d: 'Sequências prontas retomam orçamento parado, lead frio e pós-venda automaticamente, no momento certo.' },
      { t: 'Templates de mensagem aprovados', d: 'Biblioteca de templates aprovados pela Meta para reengajar contatos fora da janela de 24 horas sem risco de bloqueio.' },
      { t: 'Atendente de IA integrado', d: 'A mesma conversa de WhatsApp pode ser atendida pela IA fora do horário e passada para um humano quando necessário.' },
      { t: 'Funil de vendas conectado', d: 'Cada conversa de WhatsApp está ligada ao pipeline — avance a etapa sem sair do chat.' },
    ],
    casos: [
      'Três vendedores, um número — cada conversa atribuída, sem duas pessoas respondendo o mesmo cliente.',
      'Orçamento enviado sexta-feira, sem resposta — a automação retoma automaticamente na segunda de manhã.',
      'Cliente sumiu há mais de 24h — o time usa um template aprovado para reabrir a conversa sem infringir a política da Meta.',
      'Lead fechou a venda pelo WhatsApp — o pipeline atualiza sozinho e dispara o fluxo de pós-venda.',
    ],
    faq: [
      { q: 'Preciso trocar de número de WhatsApp?', a: 'Não. A Althos conecta ao número que sua empresa já usa — nada muda para o cliente.' },
      { q: 'Vários atendentes conseguem usar o mesmo WhatsApp ao mesmo tempo?', a: 'Sim. As conversas ficam centralizadas e distribuídas entre a equipe, com visibilidade de quem está respondendo cada uma.' },
      { q: 'O que é a janela de 24h e como a Althos ajuda?', a: 'É a regra da Meta que bloqueia mensagens livres depois de 24h sem o cliente responder. A Althos disponibiliza templates aprovados para reabrir a conversa dentro da política.' },
      { q: 'A automação de follow-up funciona sozinha?', a: 'Sim. Você configura a sequência uma vez e ela roda automaticamente sempre que um contato entra nas condições definidas.' },
      { q: 'Tem fidelidade?', a: 'Não. Cancele quando quiser, sem multa.' },
    ],
    ctaTitle: 'Tire o WhatsApp da bagunça e coloque no CRM',
    ctaSub: 'Centralize conversas, automatize follow-up e atenda em equipe pelo mesmo número.',
  },
}

export const FEATURE_SLUGS = Object.keys(FEATURES)
