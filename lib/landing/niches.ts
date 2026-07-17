/**
 * Conteúdo das páginas dedicadas por nicho (landing pages de SEO/conversão).
 * Cada entrada alimenta o componente <NicheLanding>. Os slugs viram rotas
 * públicas em app/(public)/<slug>/page.tsx e precisam estar liberados no
 * middleware (classifyRoute).
 */

export type NicheContent = {
  slug: string
  /** rótulo curto para navegação/listagens */
  nav: string
  metaTitle: string
  metaDescription: string
  eyebrow: string
  /** parte inicial do H1 (texto normal) */
  h1: string
  /** palavra/frase em destaque (gradiente) ao final do H1 */
  h1Accent: string
  sub: string
  heroChips: string[]
  /** dores do nicho — o "antes" */
  dores: { t: string; d: string }[]
  /** como a Althos resolve — passos */
  resolve: { n: string; t: string; d: string }[]
  /** recursos específicos para o nicho */
  recursos: { t: string; d: string }[]
  /** casos de uso práticos (bullets) */
  casos: string[]
  faq: { q: string; a: string }[]
  ctaTitle: string
  ctaSub: string
}

export const NICHES: Record<string, NicheContent> = {
  viagens: {
    slug: 'viagens',
    nav: 'Agências de viagens',
    metaTitle: 'CRM para Agências de Viagens — Althos CRM',
    metaDescription:
      'O CRM com IA feito para agências de viagens: atende cotações no WhatsApp 24h, envia roteiros, faz follow-up de orçamentos e fecha mais vendas sem perder o timing.',
    eyebrow: 'Para agências de viagens',
    h1: 'O vendedor que responde cada cotação de viagem',
    h1Accent: 'antes do concorrente',
    sub: 'Cliente de viagem decide no impulso e some rápido. A Althos atende a cotação na hora pelo WhatsApp, manda o roteiro, lembra do orçamento parado e não deixa a venda esfriar — mesmo de madrugada e no fim de semana.',
    heroChips: ['Cotações 24h no WhatsApp', 'Roteiros e orçamentos', 'Follow-up automático', 'Propostas compartilháveis'],
    dores: [
      { t: 'Cotação que demora, venda que evapora', d: 'O cliente pede preço para 5 agências. Quem responde primeiro fecha. Se a sua resposta vem horas depois, a viagem já foi vendida por outro.' },
      { t: 'Orçamento enviado e ninguém retoma', d: 'A proposta vai por WhatsApp e morre ali. Sem um follow-up organizado, dezenas de orçamentos quentes viram esquecimento.' },
      { t: 'Tudo na cabeça e no chat', d: 'Datas, destinos, preferências e valores espalhados em conversas. Na hora de retomar, ninguém lembra de quem é o quê.' },
      { t: 'Fim de semana e feriado sem atendimento', d: 'É justamente quando o cliente pesquisa viagem. Sem alguém de plantão, cada mensagem de domingo é uma venda perdida.' },
    ],
    resolve: [
      { n: '01', t: 'A IA atende a cotação na hora', d: 'Assim que o cliente pergunta "quanto custa?", a IA responde no WhatsApp, entende destino, datas e número de pessoas, e já qualifica a oportunidade — 24 horas por dia.' },
      { n: '02', t: 'Roteiro e proposta sem trabalho manual', d: 'Monte a proposta de viagem com fotos e valores e envie um link bonito e compartilhável. O cliente abre no celular e decide na hora.' },
      { n: '03', t: 'Follow-up que não deixa esfriar', d: 'Orçamento parado há 2 dias? A automação retoma sozinha com a mensagem certa, no tom da sua agência, até o cliente responder.' },
    ],
    recursos: [
      { t: 'Propostas de viagem compartilháveis', d: 'Crie roteiros com fotos, valores e condições num link público com a cara da sua agência.' },
      { t: 'Atendente de IA para cotações', d: 'Responde, qualifica e organiza cada pedido de orçamento direto no WhatsApp.' },
      { t: 'Funil de viagens visual', d: 'Veja cada cotação por etapa: novo contato, orçamento enviado, negociação, fechado.' },
      { t: 'Follow-up automático de orçamento', d: 'Sequências prontas para retomar propostas paradas no momento certo.' },
      { t: 'Geração de venda ao fechar', d: 'Moveu o lead para "Fechado"? A venda e as tarefas de pós-venda nascem sozinhas.' },
      { t: 'Lembrete de embarque e retorno', d: 'Automatize mensagens de pré-viagem e de "como foi?" para gerar recompra e indicação.' },
    ],
    casos: [
      'Cliente pede cotação de lua de mel às 23h — a IA responde, qualifica e agenda a ligação para o dia seguinte.',
      'Pacote enviado há 3 dias sem resposta — automação manda lembrete com condição de fechamento.',
      'Cliente fechou a viagem — sistema cria a venda, agenda o envio de voucher e a mensagem de pré-embarque.',
      'Pós-viagem — automação pede avaliação e oferece a próxima viagem com desconto de cliente.',
    ],
    faq: [
      { q: 'A Althos serve para agência de viagens pequena?', a: 'Sim. Você começa no plano Free, sem cartão, e ativa a IA e as automações quando quiser crescer. Não precisa de equipe de TI.' },
      { q: 'Consigo enviar roteiros e pacotes com fotos?', a: 'Sim. A Althos tem o módulo de Propostas de viagem: você monta o roteiro com imagens e valores e envia um link compartilhável que o cliente abre no celular.' },
      { q: 'A IA fala como a minha agência?', a: 'Você define o tom de voz, as informações e as regras de atendimento. A IA responde no WhatsApp com a identidade da sua agência.' },
      { q: 'Preciso trocar meu número de WhatsApp?', a: 'Não. A Althos conecta ao seu WhatsApp para atender e registrar tudo dentro do CRM.' },
      { q: 'Tem fidelidade?', a: 'Não. Você cancela quando quiser, direto pelo painel, sem multa.' },
    ],
    ctaTitle: 'Pare de perder cotação para quem responde antes',
    ctaSub: 'Coloque a IA da Althos para atender e dar follow-up nas suas viagens hoje mesmo.',
  },

  imobiliarias: {
    slug: 'imobiliarias',
    nav: 'Imobiliárias',
    metaTitle: 'CRM para Imobiliárias — Althos CRM',
    metaDescription:
      'CRM com IA para imobiliárias: capta leads de portais e anúncios, responde no WhatsApp 24h, agenda visitas automaticamente e acompanha cada cliente até a assinatura.',
    eyebrow: 'Para imobiliárias',
    h1: 'Cada lead de imóvel atendido na hora e',
    h1Accent: 'levado até a visita',
    sub: 'Lead de imóvel que espera resposta vira lead de outra imobiliária. A Althos responde no WhatsApp na hora, qualifica o que o cliente procura, agenda a visita e mantém o corretor focado em fechar.',
    heroChips: ['Captação de portais e anúncios', 'Resposta 24h no WhatsApp', 'Agendamento de visitas', 'Funil por corretor'],
    dores: [
      { t: 'Lead chega e ninguém responde rápido', d: 'Portais e anúncios geram contatos o dia todo. Sem resposta imediata, o interesse esfria e o cliente fala com o concorrente.' },
      { t: 'Corretor perdido em mil conversas', d: 'Cada corretor com dezenas de chats abertos, sem saber quem está quente e quem é curioso. Visita marcada que ninguém confirma.' },
      { t: 'Lead frio que poderia ser cliente', d: 'Quem não comprou agora some da lista. Sem nutrição, meses de captação viram contato morto na agenda do celular.' },
      { t: 'Sem visão de quem está vendendo', d: 'Difícil saber qual corretor converte, qual fonte traz lead bom e onde o funil trava.' },
    ],
    resolve: [
      { n: '01', t: 'IA responde e qualifica na hora', d: 'O lead chegou do portal ou do anúncio? A IA puxa a conversa no WhatsApp, descobre orçamento, região e tipo de imóvel e separa quem está pronto para visitar.' },
      { n: '02', t: 'Visita agendada sem ligação', d: 'A IA oferece horários e marca a visita direto na agenda do corretor, com confirmação automática para reduzir o "não compareceu".' },
      { n: '03', t: 'Acompanhamento até a assinatura', d: 'Cada lead com a próxima ação definida e follow-up automático — do primeiro contato à proposta e ao fechamento.' },
    ],
    recursos: [
      { t: 'Captação centralizada', d: 'Leads de portais, anúncios e formulários caindo direto no funil, sem planilha.' },
      { t: 'Atendente de IA 24h', d: 'Responde e qualifica cada contato de imóvel a qualquer hora, com o tom da imobiliária.' },
      { t: 'Agendamento online de visitas', d: 'O cliente escolhe o horário e o corretor recebe tudo organizado, com lembrete automático.' },
      { t: 'Funil por corretor', d: 'Acompanhe a carteira de cada corretor e distribua leads com justiça e visão de resultado.' },
      { t: 'Nutrição de lead frio', d: 'Automações que reaquecem quem não fechou com novos imóveis no perfil dele.' },
      { t: 'Relatórios de conversão', d: 'Veja qual fonte traz lead bom, qual corretor converte e onde o funil trava.' },
    ],
    casos: [
      'Lead do portal às 22h — a IA responde, descobre o perfil e agenda a visita para sábado.',
      'Cliente não compareceu à visita — automação reagenda e avisa o corretor.',
      'Lead pediu apartamento de 2 quartos e não fechou — automação avisa quando entra um novo no perfil.',
      'Fim do mês — relatório mostra qual corretor e qual fonte geraram mais fechamento.',
    ],
    faq: [
      { q: 'A Althos integra com portais imobiliários?', a: 'Você captura leads por formulários, anúncios e WhatsApp direto no funil. Para portais específicos, é possível direcionar os contatos para a Althos e centralizar o atendimento.' },
      { q: 'Cada corretor tem a própria carteira?', a: 'Sim. Você organiza o funil por corretor e controla a visibilidade dos leads de cada um.' },
      { q: 'A IA agenda visita sozinha?', a: 'Sim. A IA oferece horários disponíveis e marca a visita na agenda, com confirmação automática para o cliente.' },
      { q: 'Funciona para imobiliária pequena ou autônomo?', a: 'Funciona. Comece no Free, sem cartão, e cresça conforme a operação.' },
      { q: 'Tem fidelidade?', a: 'Não. Cancele quando quiser, direto pelo painel.' },
    ],
    ctaTitle: 'Nenhum lead de imóvel parado esperando resposta',
    ctaSub: 'Ative a IA da Althos para atender, qualificar e agendar visitas pela sua imobiliária.',
  },

  clinicas: {
    slug: 'clinicas',
    nav: 'Clínicas',
    metaTitle: 'CRM para Clínicas e Consultórios — Althos CRM',
    metaDescription:
      'CRM com IA para clínicas: responde agendamentos no WhatsApp 24h, confirma consultas, reduz faltas e traz pacientes de volta com lembretes de retorno automáticos.',
    eyebrow: 'Para clínicas e consultórios',
    h1: 'Agenda cheia e paciente atendido',
    h1Accent: 'sem fila no WhatsApp',
    sub: 'Secretária sobrecarregada e paciente esperando resposta custam caro. A Althos atende o pedido de agendamento na hora, confirma a consulta, reduz faltas e chama o paciente de volta na hora certa.',
    heroChips: ['Agendamento 24h no WhatsApp', 'Confirmação automática', 'Menos faltas (no-show)', 'Retorno de pacientes'],
    dores: [
      { t: 'Paciente espera e desiste', d: 'A mensagem chega fora do horário ou a secretária está ocupada. O paciente que queria marcar acaba indo para outra clínica.' },
      { t: 'Faltas que furam a agenda', d: 'Horário marcado e ninguém aparece. Sem confirmação organizada, cada falta é um buraco no faturamento do dia.' },
      { t: 'Paciente que some e não volta', d: 'Quem deveria retornar em 6 meses simplesmente esquece. Sem lembrete, a clínica perde a recorrência.' },
      { t: 'Secretária afogada no WhatsApp', d: 'Responder, confirmar, remarcar, repetir o mesmo preço dez vezes. Sobra pouco tempo para o atendimento humano que importa.' },
    ],
    resolve: [
      { n: '01', t: 'A IA marca a consulta na hora', d: 'O paciente pede horário pelo WhatsApp e a IA responde na hora, mostra a disponibilidade e agenda — mesmo fora do expediente.' },
      { n: '02', t: 'Confirmação que reduz faltas', d: 'Lembrete automático véspera e no dia, com opção de confirmar ou remarcar. Menos cadeira vazia, mais agenda aproveitada.' },
      { n: '03', t: 'Retorno no momento certo', d: 'A automação chama o paciente de volta quando é hora do retorno ou da nova avaliação, gerando recorrência sem esforço.' },
    ],
    recursos: [
      { t: 'Agendamento online 24h', d: 'O paciente marca pelo WhatsApp ou por um link, e a agenda da clínica se organiza sozinha.' },
      { t: 'Atendente de IA com seu tom', d: 'Responde dúvidas comuns, valores e convênios sem ocupar a secretária.' },
      { t: 'Confirmação e lembrete', d: 'Mensagens automáticas reduzem faltas e remarcações de última hora.' },
      { t: 'Lembrete de retorno', d: 'Traga o paciente de volta na hora certa — semestral, anual ou pós-procedimento.' },
      { t: 'Ficha do paciente organizada', d: 'Histórico, contatos e documentos de cada paciente num lugar só.' },
      { t: 'Aniversário e relacionamento', d: 'Mensagens automáticas de aniversário e campanhas que fortalecem o vínculo.' },
    ],
    casos: [
      'Paciente manda mensagem no domingo — a IA mostra horários e agenda para segunda.',
      'Consulta marcada para amanhã — confirmação automática reduz a chance de falta.',
      'Paciente fez avaliação há 6 meses — automação chama para o retorno.',
      'Aniversário do paciente — mensagem automática fortalece o relacionamento.',
    ],
    faq: [
      { q: 'Serve para clínica pequena ou consultório individual?', a: 'Sim. Você começa no Free, sem cartão, e ativa IA e automações conforme a necessidade.' },
      { q: 'A IA respeita o horário de funcionamento?', a: 'Sim. Você define horários, regras e quando transferir para um humano. A IA agenda dentro da disponibilidade real.' },
      { q: 'Consigo reduzir faltas de verdade?', a: 'Sim. As confirmações e lembretes automáticos na véspera e no dia reduzem significativamente o no-show.' },
      { q: 'É seguro para os dados dos pacientes?', a: 'Sim. A Althos usa hospedagem segura e está em conformidade com a LGPD. Os dados são da sua clínica.' },
      { q: 'Tem fidelidade?', a: 'Não. Cancele quando quiser, sem multa.' },
    ],
    ctaTitle: 'Agenda cheia, menos faltas e paciente que volta',
    ctaSub: 'Deixe a IA da Althos atender, confirmar e trazer seus pacientes de volta.',
  },

  veiculos: {
    slug: 'veiculos',
    nav: 'Lojas de veículos',
    metaTitle: 'CRM para Lojas de Veículos e Concessionárias — Althos CRM',
    metaDescription:
      'CRM com IA para lojas de veículos: responde interessados no WhatsApp 24h, qualifica o lead, agenda test-drive e acompanha do primeiro contato ao financiamento.',
    eyebrow: 'Para lojas de veículos',
    h1: 'Do primeiro "tá disponível?" ao',
    h1Accent: 'carro vendido',
    sub: 'Comprador de carro pesquisa em vários lugares ao mesmo tempo. A Althos responde na hora pelo WhatsApp, qualifica o interesse, agenda o test-drive e acompanha o lead até a proposta e o financiamento.',
    heroChips: ['Resposta 24h no WhatsApp', 'Qualificação de comprador', 'Agendamento de test-drive', 'Acompanha o financiamento'],
    dores: [
      { t: 'Interessado some sem resposta rápida', d: 'O anúncio gera "tá disponível?" o tempo todo. Quem responde primeiro vende. Resposta lenta é venda do concorrente.' },
      { t: 'Lead curioso misturado com comprador', d: 'Sem qualificar, o vendedor gasta tempo com quem só passeia e esfria quem está pronto para fechar.' },
      { t: 'Test-drive que não vira venda', d: 'O cliente testou e foi embora. Sem follow-up, a negociação morre e ninguém retoma a proposta.' },
      { t: 'Sem controle do funil de vendas', d: 'Difícil saber quantos leads viram test-drive, quantos viram proposta e onde a venda trava.' },
    ],
    resolve: [
      { n: '01', t: 'IA responde e qualifica o comprador', d: 'O interessado mandou mensagem? A IA responde na hora, descobre interesse, entrada e forma de pagamento e separa quem está pronto para negociar.' },
      { n: '02', t: 'Test-drive agendado sozinho', d: 'A IA oferece horários e marca o test-drive na agenda do vendedor, com lembrete para o cliente não esquecer.' },
      { n: '03', t: 'Acompanha até o financiamento', d: 'Follow-up automático em cada etapa — proposta, simulação de financiamento e fechamento — para nenhuma venda esfriar no meio.' },
    ],
    recursos: [
      { t: 'Atendente de IA 24h', d: 'Responde sobre disponibilidade, preço e condições a qualquer hora pelo WhatsApp.' },
      { t: 'Qualificação de lead', d: 'Score automático para o vendedor atacar primeiro quem está pronto para comprar.' },
      { t: 'Agendamento de test-drive', d: 'O cliente escolhe o horário e o vendedor recebe organizado, com lembrete automático.' },
      { t: 'Funil de vendas visual', d: 'Da primeira mensagem ao financiamento, cada negociação visível por etapa.' },
      { t: 'Follow-up de proposta', d: 'Sequências que retomam a negociação parada no momento certo.' },
      { t: 'Relatórios de conversão', d: 'Veja quantos leads viram test-drive, proposta e venda — e qual vendedor converte mais.' },
    ],
    casos: [
      'Interessado pergunta sobre um carro às 23h — a IA responde e agenda o test-drive.',
      'Cliente fez test-drive e foi embora — automação retoma com a simulação de financiamento.',
      'Proposta enviada há 2 dias — follow-up automático puxa a resposta.',
      'Fechou a venda — sistema registra e dispara o pós-venda e a pesquisa de satisfação.',
    ],
    faq: [
      { q: 'Serve para loja pequena de seminovos?', a: 'Sim. Comece no Free, sem cartão, e ative IA e automações quando quiser escalar.' },
      { q: 'A IA passa preço e condições?', a: 'Você define as informações e regras; a IA responde dentro do que você configurar e transfere para o vendedor quando necessário.' },
      { q: 'Consigo agendar test-drive automaticamente?', a: 'Sim. A IA oferece horários disponíveis e marca direto na agenda do vendedor, com lembrete para o cliente.' },
      { q: 'Dá para acompanhar a equipe de vendas?', a: 'Sim. O funil por vendedor e os relatórios mostram quem converte e onde a venda trava.' },
      { q: 'Tem fidelidade?', a: 'Não. Cancele quando quiser, sem multa.' },
    ],
    ctaTitle: 'Responda primeiro e venda mais carros',
    ctaSub: 'Coloque a IA da Althos para atender, qualificar e agendar test-drive na sua loja.',
  },

  trafego: {
    slug: 'trafego',
    nav: 'Agências de tráfego',
    metaTitle: 'CRM para Agências de Tráfego — Althos CRM',
    metaDescription:
      'CRM com IA para agências de tráfego: leads de Meta Ads e formulários direto no funil, atendimento 24h no WhatsApp e ROI por campanha para provar resultado ao cliente.',
    eyebrow: 'Para agências de tráfego',
    h1: 'Os leads que você gera,',
    h1Accent: 'atendidos e convertidos',
    sub: 'De nada adianta gerar lead barato se ele esfria sem atendimento. A Althos recebe os leads das suas campanhas, responde na hora pelo WhatsApp e mostra o ROI por campanha — resultado que segura o cliente.',
    heroChips: ['Leads de Meta Ads no funil', 'Atendimento 24h com IA', 'ROI por campanha', 'Relatório para o cliente'],
    dores: [
      { t: 'Lead bom que esfria sem atendimento', d: 'Você entrega lead barato, mas o cliente demora para responder. A campanha parece ruim — e a culpa cai na sua agência.' },
      { t: 'Cliente não enxerga o resultado', d: 'Sem conectar lead a venda, fica difícil provar o retorno. E cliente que não vê resultado cancela o contrato.' },
      { t: 'Leads perdidos entre planilhas', d: 'Formulário, Meta Ads, WhatsApp — leads espalhados que ninguém organiza nem acompanha até o fechamento.' },
      { t: 'Sem padrão de atendimento', d: 'Cada cliente atende do seu jeito, alguns nem atendem. O resultado da campanha fica refém do comercial do cliente.' },
    ],
    resolve: [
      { n: '01', t: 'Leads caem direto no funil', d: 'Conecte Meta Ads e formulários à Althos. Cada lead entra organizado, com a origem da campanha registrada.' },
      { n: '02', t: 'IA atende antes de esfriar', d: 'A IA responde o lead na hora pelo WhatsApp, qualifica e agenda — garantindo que o lead que você gerou seja aproveitado.' },
      { n: '03', t: 'ROI que prova o seu trabalho', d: 'Relatórios ligam lead a venda por campanha. Você mostra retorno real e renova o contrato com tranquilidade.' },
    ],
    recursos: [
      { t: 'Integração com Meta Ads', d: 'Leads de campanhas entram no funil com a origem registrada automaticamente.' },
      { t: 'Atendente de IA 24h', d: 'Garante que todo lead gerado seja respondido na hora, mesmo se o cliente demora.' },
      { t: 'ROI por campanha', d: 'Veja custo, leads e vendas por campanha para provar resultado ao cliente.' },
      { t: 'Multiempresas', d: 'Gerencie vários clientes em contas separadas dentro da mesma plataforma.' },
      { t: 'Relatórios white-label-friendly', d: 'Apresente conversão e desempenho de forma clara para cada cliente.' },
      { t: 'Automação de qualificação', d: 'Filtre o lead bom do curioso automaticamente antes de passar para o comercial.' },
    ],
    casos: [
      'Lead entra de uma campanha do Meta às 21h — a IA responde e qualifica na hora.',
      'Cliente questiona o resultado — você mostra o relatório de lead a venda por campanha.',
      'Vários clientes na mesma conta — cada um com seu funil e seus números.',
      'Lead curioso identificado — automação filtra antes de gastar tempo do comercial.',
    ],
    faq: [
      { q: 'Consigo gerenciar vários clientes?', a: 'Sim. A Althos é multiempresa: você administra vários clientes em contas separadas dentro da mesma plataforma.' },
      { q: 'Integra com Meta Ads?', a: 'Sim. Os leads das campanhas entram direto no funil, com a origem registrada para você medir o ROI.' },
      { q: 'Dá para provar o resultado ao cliente?', a: 'Sim. Os relatórios ligam lead a venda por campanha, deixando o retorno claro e defensável.' },
      { q: 'Posso oferecer a Althos como serviço aos meus clientes?', a: 'Pode. Muitas agências implantam a Althos no cliente como parte do serviço de tráfego para garantir o atendimento dos leads.' },
      { q: 'Tem fidelidade?', a: 'Não. Cancele quando quiser, sem multa.' },
    ],
    ctaTitle: 'Faça cada lead que você gera virar resultado',
    ctaSub: 'Use a IA da Althos para atender os leads das campanhas e provar o ROI ao cliente.',
  },

  'pequenas-empresas': {
    slug: 'pequenas-empresas',
    nav: 'Pequenas empresas',
    metaTitle: 'CRM para Pequenas Empresas — Althos CRM',
    metaDescription:
      'CRM simples e com IA para pequenas empresas: organize clientes e vendas num lugar só, atenda no WhatsApp 24h e automatize o follow-up — sem complicação e sem custo alto.',
    eyebrow: 'Para pequenas empresas',
    h1: 'Organize clientes e vendas',
    h1Accent: 'num lugar só',
    sub: 'Cliente no WhatsApp, venda no caderno, follow-up na memória. A Althos junta tudo num CRM simples, atende no WhatsApp por você e automatiza o que você sempre esquece de fazer — sem complicação nem custo alto.',
    heroChips: ['Tudo num lugar só', 'Atendimento 24h com IA', 'Follow-up automático', 'Comece grátis'],
    dores: [
      { t: 'Cliente espalhado em mil lugares', d: 'WhatsApp, agenda do celular, caderno e memória. Na hora de retomar uma venda, a informação some.' },
      { t: 'Follow-up que você esquece', d: 'O cliente disse "depois eu vejo" e você nunca mais retomou. Vendas que estavam perto de fechar simplesmente somem.' },
      { t: 'Sem tempo para responder todo mundo', d: 'Você faz tudo sozinho. Quando o WhatsApp lota, mensagens ficam sem resposta e clientes vão embora.' },
      { t: 'CRM caro e complicado demais', d: 'As ferramentas grandes são caras, em inglês e cheias de coisa que você nem usa. Você desiste antes de começar.' },
    ],
    resolve: [
      { n: '01', t: 'Tudo organizado sem esforço', d: 'Clientes, conversas e vendas num funil simples e visual. Você bate o olho e sabe exatamente o que fazer a seguir.' },
      { n: '02', t: 'A IA atende por você', d: 'Quando você não pode responder, a IA atende no WhatsApp, tira dúvidas e organiza o contato — 24 horas por dia.' },
      { n: '03', t: 'Nada de venda esquecida', d: 'As automações lembram do follow-up, do retorno e do pós-venda. O que você esquecia de fazer agora acontece sozinho.' },
    ],
    recursos: [
      { t: 'Funil de vendas simples', d: 'Arraste seus clientes entre etapas e nunca mais perca uma venda no caminho.' },
      { t: 'Atendente de IA 24h', d: 'Responde no WhatsApp quando você está ocupado ou fora do expediente.' },
      { t: 'Automação de follow-up', d: 'Sequências prontas que retomam o contato sem você precisar lembrar.' },
      { t: 'Cadastro de clientes', d: 'Histórico, contatos e anotações de cada cliente organizados num lugar só.' },
      { t: 'Plano gratuito de verdade', d: 'Comece sem pagar nada e cresça só quando fizer sentido para o seu negócio.' },
      { t: 'Fácil de usar', d: 'Em português, direto ao ponto, no ar em minutos — sem precisar de técnico.' },
    ],
    casos: [
      'Cliente manda mensagem enquanto você atende outro — a IA responde e organiza o contato.',
      'Orçamento enviado e esquecido — a automação retoma sozinha no dia certo.',
      'Cliente antigo sem comprar há meses — automação reaquece com uma oferta.',
      'Final do mês — você vê num relance quantas vendas fechou e quanto faturou.',
    ],
    faq: [
      { q: 'Preciso entender de tecnologia para usar?', a: 'Não. A Althos é em português, simples e fica pronta em minutos. Se você usa WhatsApp, consegue usar a Althos.' },
      { q: 'É caro?', a: 'Você começa no plano Free, grátis para sempre e sem cartão. Só paga quando decidir crescer.' },
      { q: 'Funciona para qualquer tipo de negócio?', a: 'Sim. Da loja ao prestador de serviço, qualquer negócio que vende e atende clientes no WhatsApp se beneficia.' },
      { q: 'A IA atende mesmo quando estou ocupado?', a: 'Sim. A IA responde no WhatsApp 24h, tira dúvidas e organiza os contatos para você fechar depois.' },
      { q: 'Tem fidelidade?', a: 'Não. Cancele quando quiser, sem multa.' },
    ],
    ctaTitle: 'Tire seu negócio do caos do WhatsApp',
    ctaSub: 'Organize clientes, atenda com IA e automatize o follow-up — começando de graça.',
  },
}

export const NICHE_SLUGS = Object.keys(NICHES)
