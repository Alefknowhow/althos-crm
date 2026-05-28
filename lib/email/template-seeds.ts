/**
 * Pre-made email template seeds (Bloco 3 — Email Pro).
 * Each seed has a unique `key` so we can detect duplicates and offer
 * "atualizar com versão nova" later. Categories drive the picker UI.
 *
 * Templates use `{{lead.name}}`, `{{org.name}}`, `{{custom.X}}` placeholders
 * already supported by the renderer in lib/inngest/functions.ts.
 */

export type TemplateSeed = {
  key: string
  name: string
  category: string
  description: string
  subject: string
  body_html: string
}

export const TEMPLATE_CATEGORIES = [
  { id: 'boas_vindas', label: 'Boas-vindas' },
  { id: 'follow_up', label: 'Follow-up' },
  { id: 'agendamento', label: 'Agendamento' },
  { id: 'recuperacao', label: 'Recuperação' },
  { id: 'nps', label: 'Pós-venda / NPS' },
  { id: 'data_especial', label: 'Datas especiais' },
] as const

export const TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    key: 'welcome_simple',
    name: 'Boas-vindas — simples',
    category: 'boas_vindas',
    description: 'Mensagem rápida de boas-vindas após o primeiro contato.',
    subject: 'Bem-vindo(a) à {{org.name}}, {{lead.name}}!',
    body_html: `<h2>Olá, {{lead.name}}!</h2>
<p>Que bom ter você por aqui. Recebemos seu contato e queremos te dar as boas-vindas à <strong>{{org.name}}</strong>.</p>
<p>Em breve um(a) consultor(a) entra em contato para entender melhor o que você precisa.</p>
<p>Enquanto isso, se quiser conversar agora, é só responder este e-mail.</p>
<p>Um abraço,<br>Equipe {{org.name}}</p>`,
  },
  {
    key: 'welcome_form_thanks',
    name: 'Boas-vindas — formulário recebido',
    category: 'boas_vindas',
    description: 'Confirma o recebimento de um formulário e antecipa próximos passos.',
    subject: 'Recebemos seu cadastro, {{lead.name}} ✨',
    body_html: `<h2>Tudo certo por aqui, {{lead.name}}!</h2>
<p>Suas respostas chegaram. Aqui está o que vai acontecer:</p>
<ol>
  <li>Vamos analisar seus dados nas próximas horas.</li>
  <li>Um(a) consultor(a) entra em contato pelo WhatsApp ou e-mail que você cadastrou.</li>
  <li>A partir daí, é só conversar — sem compromisso.</li>
</ol>
<p>Se quiser adiantar o papo, é só responder este e-mail com sua disponibilidade.</p>
<p><em>Equipe {{org.name}}</em></p>`,
  },
  {
    key: 'follow_up_no_reply',
    name: 'Follow-up — sem resposta',
    category: 'follow_up',
    description: 'Reativação leve para leads que não responderam.',
    subject: '{{lead.name}}, conseguiu ver minha mensagem?',
    body_html: `<p>Oi {{lead.name}}, tudo bem?</p>
<p>Te mandei uma mensagem alguns dias atrás e queria garantir que você não perdeu.</p>
<p>Vou ser objetivo(a): tem alguma dúvida que eu possa esclarecer? Ou prefere que eu mande mais informações antes de conversarmos?</p>
<p>Pode me responder com um simples "sim" ou "não" — assim ajusto o próximo passo.</p>
<p>Obrigado(a)!<br>Equipe {{org.name}}</p>`,
  },
  {
    key: 'follow_up_value',
    name: 'Follow-up — entrega de valor',
    category: 'follow_up',
    description: 'Reativa o lead entregando algo útil (case, conteúdo, dica).',
    subject: 'Algo que pode te ajudar — {{org.name}}',
    body_html: `<p>Oi {{lead.name}},</p>
<p>Pensei em você quando vi este conteúdo e quis compartilhar antes mesmo de combinarmos um próximo passo:</p>
<blockquote>
  <p><strong>[Cole aqui um link, dica ou case rápido relevante para o lead]</strong></p>
</blockquote>
<p>Se quiser conversar sobre como aplicar isso na sua realidade, é só responder este e-mail ou marcar um horário comigo.</p>
<p>Abraço,<br>Equipe {{org.name}}</p>`,
  },
  {
    key: 'meeting_confirm',
    name: 'Agendamento confirmado',
    category: 'agendamento',
    description: 'Confirma horário de reunião/atendimento e reduz no-show.',
    subject: 'Confirmado: nossa conversa, {{lead.name}}',
    body_html: `<h2>Tudo confirmado!</h2>
<p>Olá {{lead.name}}, sua reunião com a {{org.name}} está marcada.</p>
<p><strong>📅 Data:</strong> [preencher data]<br>
<strong>🕐 Horário:</strong> [preencher horário]<br>
<strong>📍 Local / link:</strong> [preencher local ou link da chamada]</p>
<p>Se precisar remarcar, basta responder este e-mail. Para a conversa fluir, deixe à mão:</p>
<ul>
  <li>Suas dúvidas principais</li>
  <li>O contexto do problema que você quer resolver</li>
</ul>
<p>Até lá!<br>Equipe {{org.name}}</p>`,
  },
  {
    key: 'meeting_reminder_24h',
    name: 'Lembrete — 24h antes',
    category: 'agendamento',
    description: 'Lembrete um dia antes da reunião agendada.',
    subject: 'Amanhã nossa conversa, {{lead.name}} 👋',
    body_html: `<p>Oi {{lead.name}}, passando aqui só pra lembrar:</p>
<p><strong>Amanhã temos nossa conversa marcada</strong> — [horário] no [local/link].</p>
<p>Se algo mudou na sua agenda, me avisa por aqui que reagendamos sem problema.</p>
<p>Até lá!<br>Equipe {{org.name}}</p>`,
  },
  {
    key: 'recovery_lost',
    name: 'Recuperação — lead perdido',
    category: 'recuperacao',
    description: 'Última tentativa de reengajar antes de mover para frio.',
    subject: 'Devo encerrar nosso contato, {{lead.name}}?',
    body_html: `<p>Oi {{lead.name}},</p>
<p>Tentei te alcançar algumas vezes nas últimas semanas e não tive retorno. Imagino que o momento mudou — sem problema!</p>
<p>Antes de eu fechar nosso contato aqui, me responde só com uma das opções:</p>
<ol>
  <li><strong>1</strong> — Não é mais prioridade, podemos pausar.</li>
  <li><strong>2</strong> — Estou interessado(a), só preciso de mais tempo.</li>
  <li><strong>3</strong> — Preciso de mais informações antes de decidir.</li>
</ol>
<p>Sua resposta me ajuda a respeitar seu tempo. Obrigado(a)!</p>
<p>Equipe {{org.name}}</p>`,
  },
  {
    key: 'recovery_offer',
    name: 'Recuperação — oferta especial',
    category: 'recuperacao',
    description: 'Reengaja oferecendo condição especial.',
    subject: 'Uma condição especial pra você, {{lead.name}}',
    body_html: `<h2>{{lead.name}}, que tal recomeçar?</h2>
<p>Sei que a gente conversou há um tempo e o momento não foi ideal. Por isso, separei uma condição especial pra você reabrir esse papo:</p>
<blockquote>
  <p><strong>[Preencha aqui sua oferta — ex: 20% de desconto, 30 dias grátis, bônus na primeira compra]</strong></p>
</blockquote>
<p>Essa condição vale por <strong>[X dias]</strong>. Se quiser entender melhor, é só responder este e-mail.</p>
<p>Equipe {{org.name}}</p>`,
  },
  {
    key: 'nps_post_purchase',
    name: 'NPS — pós-compra',
    category: 'nps',
    description: 'Pesquisa rápida de satisfação após primeira venda.',
    subject: 'De 0 a 10, como foi sua experiência, {{lead.name}}?',
    body_html: `<p>Oi {{lead.name}},</p>
<p>Espero que sua experiência com a <strong>{{org.name}}</strong> tenha sido boa até aqui.</p>
<p>Tenho um pedido rápido (juro que leva menos de 30 segundos):</p>
<p><strong>Numa escala de 0 a 10, qual a chance de você nos recomendar a um amigo ou colega?</strong></p>
<p>Pode me responder este e-mail com a nota e, se quiser, um comentário curto sobre o porquê. Sua resposta nos ajuda a melhorar de verdade.</p>
<p>Obrigado(a)!<br>Equipe {{org.name}}</p>`,
  },
  {
    key: 'birthday',
    name: 'Aniversário do cliente',
    category: 'data_especial',
    description: 'Mensagem cordial de aniversário (use com automação por data).',
    subject: 'Feliz aniversário, {{lead.name}}! 🎉',
    body_html: `<h2>Parabéns, {{lead.name}}!</h2>
<p>Hoje é seu dia, e a equipe da <strong>{{org.name}}</strong> não podia deixar de te desejar um ano cheio de coisas boas, conquistas e tranquilidade.</p>
<p>Se quiser celebrar com a gente, deixei algo especial preparado pra você:</p>
<blockquote>
  <p><strong>[Preencha com seu mimo: cupom, brinde, condição especial]</strong></p>
</blockquote>
<p>Aproveite o seu dia! 🥳</p>
<p>Equipe {{org.name}}</p>`,
  },
]

export function getTemplateSeed(key: string): TemplateSeed | undefined {
  return TEMPLATE_SEEDS.find(t => t.key === key)
}
