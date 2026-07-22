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
    metaTitle: 'Sistema completo para Agências de Viagens — Althos CRM',
    metaDescription:
      'Da cotação no WhatsApp ao contrato assinado, financeiro e documentos de embarque: a Althos é o sistema operacional completo para agências de viagens, com IA em cada etapa.',
    eyebrow: 'Para agências de viagens',
    h1: 'Da cotação no WhatsApp ao',
    h1Accent: 'contrato, financeiro e embarque',
    sub: 'Sua agência não perde só pela demora na resposta — perde tempo com contrato manual, planilha de financeiro e checklist de embarque na cabeça. A Althos atende a cotação com IA, fecha a venda, gera contrato e voucher, controla o financeiro e organiza cada reserva até o pós-venda.',
    heroChips: ['Cotação com IA 24h', 'Contrato inteligente', 'Financeiro completo', 'Créditos de viagem'],
    dores: [
      { t: 'Cotação que demora, venda que evapora', d: 'O cliente pede preço para 5 agências. Quem responde primeiro fecha. Se a sua resposta vem horas depois, a viagem já foi vendida por outro.' },
      { t: 'Contrato e checklist na mão', d: 'Word editado manualmente, assinatura por e-mail avulso, e ninguém sabe se o voucher já foi entregue ou se falta documentação — cada reserva vira uma via diferente de conferir.' },
      { t: 'Financeiro espalhado em planilha', d: 'Comissão, repasse de operadora e despesa fixa cada um numa aba diferente. Na hora de saber se o mês fechou no azul, ninguém tem certeza.' },
      { t: 'Cliente cancelou e o crédito se perde', d: 'Viagem cancelada gera crédito para usar depois — mas sem controle, esse valor fica esquecido ou é renegociado do zero a cada nova venda.' },
    ],
    resolve: [
      { n: '01', t: 'A IA atende e qualifica a cotação', d: 'Assim que o cliente pergunta "quanto custa?", a IA responde no WhatsApp, entende destino, datas e número de pessoas — inclusive lendo um print de orçamento ou voucher que o cliente mandar.' },
      { n: '02', t: 'Venda, contrato e voucher em minutos', d: 'Ao fechar, a reserva vira contrato editável (com as suas cláusulas) pronto pra assinatura, voucher com a cara da agência, e um checklist mostra o que falta: contrato assinado, voucher entregue, embarque, pós-venda.' },
      { n: '03', t: 'Financeiro e créditos sob controle', d: 'Receitas, despesas, comissões e repasses organizados por categoria e centro de custo, com fluxo de caixa e vencimentos automáticos. Cancelamento gera crédito de viagem rastreado, pronto pra usar na próxima venda.' },
    ],
    recursos: [
      { t: 'Cotação e orçamento com IA', d: 'A IA atende no WhatsApp e também lê prints/PDFs de voucher ou orçamento de operadora, extraindo os dados automaticamente.' },
      { t: 'Contrato inteligente e editável', d: 'Monte o contrato padrão da sua agência com suas cláusulas — preenchido automaticamente com os dados da venda, pronto pra assinatura.' },
      { t: 'Financeiro completo', d: 'Receitas, despesas, categorias, contas bancárias e operadoras cadastradas, dashboard com fluxo de caixa, DRE simplificado e próximos vencimentos.' },
      { t: 'Créditos de viagem', d: 'Cancelamentos geram crédito vinculado ao cliente, pronto para abater numa venda futura sem negociação manual.' },
      { t: 'Checklist da reserva', d: 'Contrato gerado, assinado, voucher entregue, embarque e pós-venda — cada etapa da venda visível e marcável em um clique.' },
      { t: 'Documentos de embarque (MEDIF/FREMEC)', d: 'Modelos oficiais pra download, com as regras explicadas, prontos pra quando o passageiro precisar de assistência especial.' },
    ],
    casos: [
      'Cliente manda um print de orçamento de outra agência às 23h — a IA lê o documento e já monta a venda com os dados extraídos.',
      'Venda fechada — o contrato sai pronto com as cláusulas da sua agência, e o checklist mostra o que falta até o embarque.',
      'Cliente cancelou a viagem em março — o crédito fica registrado e é usado automaticamente numa reserva nova em julho.',
      'Fim do mês — o dashboard financeiro mostra receita, despesa por categoria e quais lançamentos estão vencidos, sem abrir planilha nenhuma.',
    ],
    faq: [
      { q: 'A Althos serve para agência de viagens pequena?', a: 'Sim. Você começa no plano Free, sem cartão, e ativa a IA e os módulos de contrato/financeiro quando quiser crescer. Não precisa de equipe de TI.' },
      { q: 'Consigo montar o meu próprio modelo de contrato?', a: 'Sim. Você edita o contrato padrão da sua agência com suas cláusulas, e ele é preenchido automaticamente com os dados de cada venda na hora de gerar.' },
      { q: 'O financeiro substitui minha planilha?', a: 'Substitui. Você cadastra categorias, contas bancárias e centros de custo uma vez, registra receitas e despesas (ou importa um CSV de extrato) e acompanha tudo em um dashboard com fluxo de caixa e vencimentos.' },
      { q: 'Como funciona o crédito de viagem?', a: 'Quando uma venda é cancelada, a Althos registra o valor como crédito vinculado ao cliente, pronto para ser usado como abatimento numa venda futura, sem controle manual.' },
      { q: 'A IA consegue ler um voucher ou orçamento em PDF?', a: 'Sim. Você envia o arquivo (PDF ou imagem) e a IA extrai destino, datas, hotel e valores automaticamente para preencher a venda ou o orçamento.' },
      { q: 'Tem fidelidade?', a: 'Não. Você cancela quando quiser, direto pelo painel, sem multa.' },
    ],
    ctaTitle: 'O sistema que acompanha a venda da cotação ao pós-venda',
    ctaSub: 'Atendimento com IA, contrato, financeiro e checklist de reserva — tudo numa agência só.',
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

  advocacia: {
    slug: 'advocacia',
    nav: 'Escritórios de advocacia',
    metaTitle: 'Sistema para Escritórios de Advocacia — Althos CRM',
    metaDescription:
      'Sistema para escritórios de advocacia: agenda de prazos com alerta, gestão de processos, honorários e propostas — tudo organizado num só lugar.',
    eyebrow: 'Para escritórios de advocacia',
    h1: 'Nenhum prazo perdido,',
    h1Accent: 'nenhum processo esquecido',
    sub: 'Escritório pequeno/médio vive de prazo e organização — perder um prazo fatal é o maior risco do negócio. O Althos centraliza processo, prazo, cliente e financeiro num só lugar, com alertas antes que seja tarde.',
    heroChips: ['Agenda de prazos com alerta', 'Processos organizados', 'Honorários e parcelamento', 'Propostas de honorários'],
    dores: [
      { t: 'Prazo perdido por falta de controle', d: 'Planilha ou agenda de papel não avisa a tempo; um prazo fatal perdido vira erro grave e responsabilidade civil.' },
      { t: 'Cliente sem retorno', d: 'Sem sistema, o advogado esquece de atualizar o cliente sobre o andamento, e a relação de confiança se desgasta.' },
      { t: 'Honorário sem controle', d: 'Parcelas, êxito e custas processuais soltos em anotações, sem visão de quanto tem a receber por processo.' },
      { t: 'Captação de cliente sem processo', d: 'Consulta inicial e proposta de honorários feitas por WhatsApp solto, sem padrão nem follow-up.' },
    ],
    resolve: [
      { n: '01', t: 'Agenda de prazos com alerta escalonado', d: 'Cada prazo do processo entra no sistema com contagem em dias úteis e aviso automático antes do vencimento.' },
      { n: '02', t: 'Processo com checklist e cliente sempre informado', d: 'Cada fase do processo é visível, e follow-ups automáticos avisam o cliente sem trabalho manual.' },
      { n: '03', t: 'Honorários e proposta organizados', d: 'Dos honorários por processo à proposta que vira contrato com um clique.' },
    ],
    recursos: [
      { t: 'Agenda de prazos com alerta', d: 'Contagem em dias úteis e aviso escalonado antes de cada prazo vencer.' },
      { t: 'Gestão de processos com checklist', d: 'Cada fase do processo visível, do protocolo ao trânsito em julgado.' },
      { t: 'Modelos de petição/procuração/contrato', d: 'Documentos gerados a partir de modelo, com os dados do processo preenchidos automaticamente.' },
      { t: 'Honorários (fixo/hora/êxito)', d: 'Parcelamento e vencimentos organizados, com visão de quanto falta receber.' },
      { t: 'Propostas de honorários com link público', d: 'Envie uma proposta formal em vez de negociar por mensagem solta.' },
      { t: 'Funil de captação de novos clientes', d: 'Da primeira consulta ao contrato de honorários assinado.' },
    ],
    casos: [
      'Prazo de contestação vence em 3 dias — o sistema já avisou o advogado responsável há uma semana.',
      'Cliente pergunta "como está meu processo?" — a resposta está pronta, sem precisar abrir a pasta física.',
      'Fim do mês — relatório mostra quanto ainda falta receber de honorários, por processo e por cliente.',
      'Consulta inicial vira proposta de honorários formal, enviada por link, sem digitar tudo nas mensagens do WhatsApp.',
    ],
    faq: [
      { q: 'Serve pra escritório pequeno ou individual?', a: 'Sim. Você começa no plano de entrada e cresce conforme o escritório aumenta a equipe.' },
      { q: 'Consigo controlar prazo de vários processos ao mesmo tempo?', a: 'Sim. Cada processo tem sua própria agenda de prazos, com alerta antes de cada vencimento.' },
      { q: 'Dá pra gerar petição automaticamente?', a: 'Você monta o modelo com as cláusulas do seu escritório, e os dados do processo/cliente são preenchidos automaticamente ao gerar.' },
      { q: 'O sistema calcula prazo em dias úteis considerando feriado forense?', a: 'Sim, essa é a lógica por trás do alerta de prazo — considerando dias úteis e feriados.' },
      { q: 'Tem fidelidade?', a: 'Não. Cancele quando quiser, sem multa.' },
    ],
    ctaTitle: 'Pare de arriscar um prazo perdido',
    ctaSub: 'Organize processos, prazos e honorários num só lugar.',
  },

  seguros: {
    slug: 'seguros',
    nav: 'Corretoras de seguros',
    metaTitle: 'Sistema para Corretoras de Seguros — Althos CRM',
    metaDescription:
      'Sistema para corretoras de seguros: painel de renovações, controle de apólices e comissões, acompanhamento de sinistro e cotação comparativa num só lugar.',
    eyebrow: 'Para corretoras de seguros',
    h1: 'Nenhuma renovação perdida,',
    h1Accent: 'nenhuma comissão esquecida',
    sub: 'O maior risco de uma corretora não é vender a primeira apólice — é perder a renovação pra outra corretora por falta de acompanhamento. O Althos avisa antes, com cliente e apólice organizados num só lugar.',
    heroChips: ['Painel de renovações', 'Controle de comissões', 'Sinistro acompanhado', 'Cotação comparativa'],
    dores: [
      { t: 'Renovação perdida por falta de aviso', d: 'Sem controle de vencimento, o cliente é abordado por outra corretora antes e a receita recorrente vai embora.' },
      { t: 'Comissão não conferida', d: 'Sem conciliar o que a seguradora paga com o que deveria pagar, a corretora perde receita sem perceber.' },
      { t: 'Sinistro sem acompanhamento', d: 'Cliente ansioso, sem retorno claro sobre o andamento junto à seguradora — o pior momento pra ficar sem resposta.' },
      { t: 'Cotação feita no improviso', d: 'Comparar seguradoras manualmente, sem registro organizado pra apresentar ao cliente.' },
    ],
    resolve: [
      { n: '01', t: 'Painel de renovações com antecedência', d: 'Apólices a vencer em 30/60/90 dias aparecem antes que o cliente esqueça — ou seja abordado por outra corretora.' },
      { n: '02', t: 'Comissão conciliada automaticamente', d: 'O esperado por apólice é comparado ao pago pela seguradora, expondo divergência na hora.' },
      { n: '03', t: 'Sinistro com status visível', d: 'O cliente sabe em que pé está o sinistro sem precisar ligar toda semana.' },
    ],
    recursos: [
      { t: 'Painel de próximas renovações', d: 'Visão antecipada de 30/60/90 dias antes do vencimento da apólice.' },
      { t: 'Cadastro completo de apólices e endossos', d: 'Seguradora, vigência, prêmio e histórico de alterações num só lugar.' },
      { t: 'Acompanhamento de sinistro com checklist', d: 'Do aviso à seguradora até o pagamento ou negativa, com status visível ao cliente.' },
      { t: 'Conciliação de comissões por seguradora', d: 'Compara o esperado com o pago e aponta divergência automaticamente.' },
      { t: 'Cotação comparativa entre seguradoras', d: 'Registro organizado pra apresentar ao cliente com transparência.' },
      { t: 'Proposta em PDF com a marca da corretora', d: 'Profissionaliza a apresentação da cotação ao cliente.' },
    ],
    casos: [
      'Apólice vence em 45 dias — o corretor já recebe o alerta e liga antes do cliente pensar em trocar.',
      'Comissão paga veio menor que o esperado — o sistema aponta a divergência pra correr atrás com a seguradora.',
      'Cliente sofre um sinistro — o status muda em tempo real e ele acompanha sem precisar perguntar.',
      'Cliente pede cotação de seguro de carro — a corretora compara 3 seguradoras e manda a proposta em PDF em minutos.',
    ],
    faq: [
      { q: 'Funciona pra corretora individual ou pequena equipe?', a: 'Sim. Você começa pequeno e escala conforme a carteira de clientes cresce.' },
      { q: 'Consigo controlar comissão de mais de uma seguradora?', a: 'Sim. A conciliação funciona por seguradora, comparando o esperado com o efetivamente pago.' },
      { q: 'O sistema avisa a renovação automaticamente?', a: 'Sim. O painel de renovações mostra as apólices a vencer com antecedência configurável.' },
      { q: 'Dá pra acompanhar sinistro de dentro do sistema?', a: 'Sim. Cada sinistro tem checklist e status visível, com notificação ao cliente a cada mudança.' },
      { q: 'Tem fidelidade?', a: 'Não. Cancele quando quiser, sem multa.' },
    ],
    ctaTitle: 'Não deixe nenhuma renovação passar batido',
    ctaSub: 'Organize apólices, comissões e sinistros num só lugar.',
  },
}

export const NICHE_SLUGS = Object.keys(NICHES)
