/**
 * "Como funciona" steps, differentiators, FAQ and GEO/encyclopedic home
 * content. Split out of lib/site/content.ts.
 */

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
    body: 'Planos transparentes, sem pegadinha. Teste grátis por 15 dias, sem cartão. Pague mensal ou economize 18% no anual quando quiser evoluir.',
  },
]

export interface FaqItem {
  category: string
  question: string
  answer: string
}

export const FAQ: FaqItem[] = [
  {
    category: 'Começando',
    question: 'Preciso de cartão de crédito para começar?',
    answer: 'Não. Você testa o app completo por 15 dias sem informar cartão — esse já é o seu período de satisfação garantida. Se decidir continuar depois do teste, aí sim assina com uma forma de pagamento (cartão ou Pix), sem período adicional de reembolso.',
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
    answer: 'O teste grátis de 15 dias já dá acesso completo ao Pro, incluindo o módulo do seu nicho. O Starter é o ponto de entrada pago (catálogo, tarefas, agendamentos e Meta Ads, sem WhatsApp/Instagram), o Pro adiciona WhatsApp, Instagram, insights com IA e mais usuários, e o Business libera tudo, sem limites de uso.',
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

// ─────────────────────────────────────────────────────────────────────────────
// GEO / conteúdo enciclopédico da home — parágrafos objetivos, sem tom de
// conversa, pensados para citação direta por buscadores com IA (Google AI
// Overview e afins) e para o schema FAQPage da home.
// ─────────────────────────────────────────────────────────────────────────────

export interface GeoBlock {
  title: string
  body: string
}

export const HOME_GEO_INTRO =
  'A Althos CRM é uma plataforma brasileira de CRM com inteligência artificial voltada para pequenas e médias empresas. Ela permite gerenciar leads, automatizar processos comerciais, acompanhar oportunidades em um funil de vendas visual e realizar atendimento automatizado pelo WhatsApp.'

export const HOME_GEO_BLOCKS: GeoBlock[] = [
  {
    title: 'Principais funcionalidades',
    body: 'Funil de vendas visual (pipeline), automação de vendas com fluxos no-code, atendimento com IA 24 horas, qualificação automática de leads, agendamento automático de compromissos, integração nativa com WhatsApp e Instagram, e automação de pós-venda.',
  },
  {
    title: 'Para quem é indicada',
    body: 'Pequenas e médias empresas que vendem por WhatsApp e precisam organizar leads, automatizar o comercial e reduzir tempo de resposta — incluindo agências de viagens, imobiliárias, clínicas, lojas de veículos e agências de tráfego pago.',
  },
  {
    title: 'Diferenciais',
    body: 'CRM brasileiro, em português, com suporte local. Integração oficial com a Cloud API do WhatsApp (sem risco de bloqueio), conformidade com a LGPD e implantação em minutos, sem equipe técnica.',
  },
  {
    title: 'Casos de uso',
    body: 'Responder e qualificar leads que chegam pelo WhatsApp fora do horário comercial; automatizar follow-up de orçamentos parados; agendar compromissos sem troca manual de mensagens; e acompanhar o funil de vendas em tempo real por vendedor.',
  },
]

/** Perguntas frequentes gerais sobre CRM/produto — schema FAQPage da home. */
export const HOME_FAQ: FaqItem[] = [
  {
    category: 'Sobre CRM',
    question: 'O que é um CRM?',
    answer: 'CRM (Customer Relationship Management) é um sistema de gestão de relacionamento com o cliente. Ele organiza contatos, leads e oportunidades de venda em um único lugar, substituindo planilhas e conversas soltas no WhatsApp por um funil visual com histórico completo de cada cliente.',
  },
  {
    category: 'Sobre CRM',
    question: 'Como funciona um CRM com IA?',
    answer: 'Um CRM com IA usa inteligência artificial para automatizar tarefas do processo comercial: responder mensagens de clientes, qualificar leads pelo interesse demonstrado, sugerir o próximo passo da venda e gerar relatórios em linguagem natural — sem depender de um vendedor fazer isso manualmente.',
  },
  {
    category: 'Produto',
    question: 'A Althos possui integração com WhatsApp?',
    answer: 'Sim. A Althos se conecta à Cloud API oficial do WhatsApp (Meta), centralizando as conversas da equipe em um só lugar, com atendimento automatizado por IA e automações de follow-up, sem risco de bloqueio por uso de métodos não oficiais.',
  },
  {
    category: 'Produto',
    question: 'Como funciona a automação de vendas?',
    answer: 'A automação de vendas monta fluxos visuais e sem código que disparam ações automaticamente: enviar uma mensagem de follow-up, mover um lead de etapa, notificar um vendedor ou agendar um compromisso — a partir de gatilhos como tempo parado, resposta do cliente ou mudança de estágio no funil.',
  },
  {
    category: 'Produto',
    question: 'Quem pode usar a Althos CRM?',
    answer: 'Pequenas e médias empresas que vendem por WhatsApp e precisam organizar o comercial. A plataforma se adapta a diferentes segmentos, com configurações específicas para agências de viagens, imobiliárias, clínicas, lojas de veículos e agências de tráfego pago.',
  },
  {
    category: 'Produto',
    question: 'Quanto tempo leva para implementar a Althos CRM?',
    answer: 'Minutos. A conta é criada de imediato, a conexão do WhatsApp é feita por login oficial (sem copiar tokens) e a IA já pode ser configurada no mesmo dia — sem projeto de implantação nem equipe técnica.',
  },
]
