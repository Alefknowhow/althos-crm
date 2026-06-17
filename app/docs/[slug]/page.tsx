export default function DocPage({ params }: { params: { slug: string } }) {
  const docs: Record<string, any> = {
    'primeiro-form': {
      title: 'Como criar seu primeiro formulário',
      content: `
        Para capturar leads automaticamente, você precisa criar um formulário:
        1. Vá em 'Formulários' no menu lateral.
        2. Clique em 'Novo Formulário'.
        3. Adicione os campos desejados (Nome, Email, etc).
        4. No 'Design', personalize as cores.
        5. Clique em 'Publicar' e copie o link ou o código de incorporação.
      `
    },
    'whatsapp': {
      title: 'Configurando o WhatsApp Cloud API',
      content: `
        O Althos CRM integra-se oficialmente com a Meta:
        1. Crie uma conta de desenvolvedor no Meta for Developers.
        2. Adicione o produto 'WhatsApp'.
        3. Obtenha o seu 'Phone Number ID' e 'System User Access Token'.
        4. Insira estas credenciais em Configurações > WhatsApp no Althos.
        5. Verifique a conexão e comece a enviar mensagens.
      `
    },
    'automacao': {
      title: 'Criando automações inteligentes',
      content: `
        Automatize tarefas repetitivas:
        1. Vá em 'Automações'.
        2. Escolha um gatilho (Ex: Novo lead via formulário).
        3. Adicione passos (Ex: Esperar 5 minutos, enviar WhatsApp, criar tarefa).
        4. Ative o fluxo.
        Todos os leads que entrarem pelo formulário agora seguirão este fluxo automaticamente.
      `
    },
    'faq': {
      title: 'Perguntas Frequentes',
      content: `
        - O CRM é gratuito? Sim — o plano Free é gratuito para sempre, sem cartão. Nos planos pagos você assina e tem 7 dias para testar o app, com reembolso total em caso de insatisfação dentro desse prazo.
        - Posso importar leads? Sim, via arquivo CSV em Leads > Importar.
        - Como falar com o suporte? Clique no botão de interrogação no cabeçalho ou envie um email para suporte@althoscrm.com.br.
      `
    }
  }

  const doc = docs[params.slug] || docs['primeiro-form']

  return (
    <article className="prose dark:prose-invert max-w-none">
      <h1 className="text-3xl font-bold mb-6">{doc.title}</h1>
      <div className="whitespace-pre-line text-muted-foreground leading-relaxed">
        {doc.content}
      </div>
    </article>
  )
}
