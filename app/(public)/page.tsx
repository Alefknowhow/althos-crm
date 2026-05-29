import Link from 'next/link'

// ── Helpers ───────────────────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-[#1D1D1F]">
      {children}
    </span>
  )
}

function FeatureCard({
  icon, title, desc,
}: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-3xl bg-[#F5F5F7] p-8 flex flex-col gap-4">
      <div className="text-3xl">{icon}</div>
      <div>
        <h3 className="text-[17px] font-semibold text-[#1D1D1F] mb-1">{title}</h3>
        <p className="text-[15px] text-[#6E6E73] leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function PlanCard({
  name, price, desc, features, cta, highlight,
}: {
  name: string
  price: string
  desc: string
  features: string[]
  cta: string
  highlight?: boolean
}) {
  return (
    <div className={`relative rounded-3xl p-8 flex flex-col gap-6 ${
      highlight
        ? 'bg-[#1D1D1F] text-white'
        : 'bg-[#F5F5F7] text-[#1D1D1F]'
    }`}>
      {highlight && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-1 text-xs font-semibold text-white">
          Mais popular
        </span>
      )}
      <div>
        <p className={`text-sm font-medium mb-1 ${highlight ? 'text-white/60' : 'text-[#6E6E73]'}`}>{name}</p>
        <div className="flex items-end gap-1 mb-2">
          <span className="text-4xl font-bold tracking-tight">{price}</span>
          {price !== 'Grátis' && <span className={`mb-1.5 text-sm ${highlight ? 'text-white/60' : 'text-[#6E6E73]'}`}>/mês</span>}
        </div>
        <p className={`text-sm ${highlight ? 'text-white/70' : 'text-[#6E6E73]'}`}>{desc}</p>
      </div>
      <ul className="flex flex-col gap-2.5 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2.5 text-sm">
            <svg className={`w-4 h-4 mt-0.5 shrink-0 ${highlight ? 'text-blue-400' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className={highlight ? 'text-white/80' : 'text-[#3D3D3F]'}>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/signup"
        className={`mt-2 rounded-full py-3 text-center text-sm font-semibold transition-opacity hover:opacity-80 ${
          highlight
            ? 'bg-white text-[#1D1D1F]'
            : 'bg-[#1D1D1F] text-white'
        }`}
      >
        {cta}
      </Link>
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-black/8 py-5">
      <summary className="flex cursor-pointer items-center justify-between gap-4 text-[17px] font-medium text-[#1D1D1F] list-none">
        {q}
        <svg
          className="w-5 h-5 shrink-0 text-[#6E6E73] transition-transform group-open:rotate-45"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </summary>
      <p className="mt-3 text-[15px] text-[#6E6E73] leading-relaxed pr-8">{a}</p>
    </details>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#1D1D1F] antialiased" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", sans-serif' }}>

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <span className="text-base font-semibold tracking-tight text-[#1D1D1F]">Althos CRM</span>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-sm font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors hidden sm:inline">
              Preços
            </Link>
            <Link href="/login" className="text-sm font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">
              Entrar
            </Link>
            <Link href="/signup" className="rounded-full bg-[#1D1D1F] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#3D3D3F] transition-colors">
              Teste grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-white to-[#F5F5F7] pb-32 pt-24 text-center">
        {/* subtle radial glow */}
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <div className="h-[600px] w-[900px] rounded-full bg-gradient-to-br from-blue-100/60 via-violet-100/40 to-transparent blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl px-6">
          <Chip>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
            Trial grátis por 7 dias · sem cartão
          </Chip>

          <h1 className="mt-8 text-5xl font-bold leading-tight tracking-tight sm:text-6xl md:text-7xl">
            O CRM que trabalha{' '}
            <span className="bg-gradient-to-br from-blue-600 via-violet-500 to-blue-400 bg-clip-text text-transparent">
              enquanto você vende.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-xl text-[#6E6E73] leading-relaxed">
            Pipeline visual, Score IA, formulários de captação integrados com Meta Ads
            e WhatsApp unificado. Tudo que seu time comercial precisa, num só lugar.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-full bg-[#1D1D1F] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-black/20 hover:bg-[#3D3D3F] transition-colors"
            >
              Começar gratuitamente
            </Link>
            <Link
              href="#funcionalidades"
              className="rounded-full border border-black/15 px-8 py-3.5 text-base font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors"
            >
              Ver funcionalidades ↓
            </Link>
          </div>

          {/* Mock dashboard UI */}
          <div className="mt-20 mx-auto max-w-5xl">
            <div className="rounded-2xl border border-black/8 bg-white shadow-2xl shadow-black/10 overflow-hidden">
              {/* fake browser chrome */}
              <div className="flex items-center gap-2 border-b border-black/5 bg-[#F5F5F7] px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="rounded-md bg-white border border-black/8 px-3 py-1 text-xs text-[#6E6E73] text-center">
                    app.althos.io/pipeline
                  </div>
                </div>
              </div>
              {/* kanban mockup */}
              <div className="grid grid-cols-4 gap-3 p-6 bg-[#F5F5F7]/50">
                {[
                  { stage: 'Novo', count: 8, color: 'bg-blue-500', leads: ['João Silva', 'Maria Costa', 'Pedro Alves'] },
                  { stage: 'Em contato', count: 5, color: 'bg-amber-500', leads: ['Ana Lima', 'Carlos Souza', 'Julia Ramos'] },
                  { stage: 'Proposta', count: 3, color: 'bg-violet-500', leads: ['Bruno Oliveira', 'Fernanda Torres'] },
                  { stage: 'Ganho', count: 2, color: 'bg-emerald-500', leads: ['Rafael Melo', 'Camila Nunes'] },
                ].map(col => (
                  <div key={col.stage} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${col.color}`} />
                      <span className="text-xs font-semibold text-[#1D1D1F]">{col.stage}</span>
                      <span className="ml-auto text-xs text-[#6E6E73]">{col.count}</span>
                    </div>
                    {col.leads.map(name => (
                      <div key={name} className="rounded-xl bg-white border border-black/6 p-3 shadow-sm">
                        <div className="text-xs font-medium text-[#1D1D1F] mb-1.5">{name}</div>
                        <div className="flex items-center gap-1.5">
                          <div className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">HOT</div>
                          <div className="text-[9px] text-[#6E6E73]">Score 87</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof strip ───────────────────────────────────────────────── */}
      <section className="border-y border-black/5 bg-[#F5F5F7] py-6">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="text-sm text-[#6E6E73]">
            Desenvolvido para times que fazem{' '}
            <strong className="text-[#1D1D1F]">tráfego pago</strong>,{' '}
            <strong className="text-[#1D1D1F]">vendas consultivas</strong> e{' '}
            <strong className="text-[#1D1D1F]">gestão de clientes</strong>
          </p>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section id="funcionalidades" className="mx-auto max-w-6xl px-6 py-32">
        <div className="text-center mb-16">
          <Chip>Funcionalidades</Chip>
          <h2 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            Tudo em um lugar só.
          </h2>
          <p className="mt-4 text-xl text-[#6E6E73]">
            Sem integrações quebradas. Sem ferramentas separadas.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon="📊"
            title="Pipeline Kanban"
            desc="Visualize seu funil inteiro num quadro de arrastar e soltar. Mova leads entre etapas e acompanhe o valor de cada negócio em tempo real."
          />
          <FeatureCard
            icon="🤖"
            title="Score IA"
            desc="A IA analisa as respostas dos formulários, dados do lead e histórico, e devolve uma nota de 0 a 100 com classificação Quente, Morno ou Frio."
          />
          <FeatureCard
            icon="📋"
            title="Formulários de captação"
            desc="Crie formulários estilo Typeform diretamente no CRM. Cada envio cria um lead automaticamente com as respostas salvas para a IA analisar."
          />
          <FeatureCard
            icon="💬"
            title="WhatsApp unificado"
            desc="Todas as conversas do WhatsApp Business num inbox centralizado. Responda sem sair do CRM e veja o histórico completo de cada lead."
          />
          <FeatureCard
            icon="⚡"
            title="Automações"
            desc="Crie fluxos que disparam quando um lead muda de estágio, recebe uma tag ou preenche um formulário. Tudo sem código."
          />
          <FeatureCard
            icon="📅"
            title="Agendamentos"
            desc="Deixe leads agendarem reuniões diretamente pelo link público. Integrado com o CRM, cada agendamento vira uma atividade no lead."
          />
        </div>
      </section>

      {/* ── AI Section ───────────────────────────────────────────────────────── */}
      <section className="bg-[#1D1D1F] py-32 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <Chip>
              <span className="text-[#6E6E73]">Inteligência Artificial</span>
            </Chip>
            <h2 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl text-white">
              IA que entende seu negócio.
            </h2>
            <p className="mt-4 text-xl text-white/60">
              Três camadas de IA trabalhando juntas para você vender mais.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                emoji: '🎯',
                title: 'Score IA',
                plan: 'Pro',
                desc: 'Qualifica automaticamente cada lead com uma nota e tier. A IA lê as respostas do formulário, histórico e comportamento para priorizar seu tempo.',
                badge: 'Pontuação 0–100',
              },
              {
                emoji: '💡',
                title: 'Insights IA',
                plan: 'Pro',
                desc: 'Converse com sua base de dados em linguagem natural. "Quais leads esquentaram essa semana?" — a IA responde com gráficos e dados reais.',
                badge: 'Chat com seus dados',
              },
              {
                emoji: '🤝',
                title: 'Atendente IA',
                plan: 'Pro',
                desc: 'Configure um atendente virtual que responde automaticamente no WhatsApp, qualifica leads e agenda reuniões fora do horário comercial.',
                badge: 'Funciona 24/7',
              },
            ].map(item => (
              <div key={item.title} className="rounded-3xl bg-white/5 border border-white/10 p-8 flex flex-col gap-4">
                <div className="text-3xl">{item.emoji}</div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-400 uppercase">
                      {item.plan}
                    </span>
                  </div>
                  <p className="text-[15px] text-white/60 leading-relaxed">{item.desc}</p>
                </div>
                <div className="mt-auto">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/40">
                    ✦ {item.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Meta Pixel section ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-32">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 items-center">
          <div>
            <Chip>Tráfego pago</Chip>
            <h2 className="mt-5 text-4xl font-bold tracking-tight leading-tight">
              Feito para quem investe em Meta Ads.
            </h2>
            <p className="mt-4 text-lg text-[#6E6E73] leading-relaxed">
              O Althos CRM se integra nativamente com o Meta Pixel e a Conversions API.
              Cada lead que converte dispara automaticamente os eventos certos para otimizar suas campanhas.
            </p>
            <ul className="mt-8 flex flex-col gap-4">
              {[
                { icon: '📍', text: 'Evento Lead disparado via Pixel e CAPI ao enviar o formulário' },
                { icon: '💰', text: 'Evento Purchase enviado quando o lead chega no estágio Ganho' },
                { icon: '❌', text: 'Evento NotQualified enviado quando a IA classifica o lead como Frio' },
                { icon: '🔗', text: 'UTM source e campaign capturados automaticamente nos formulários' },
              ].map(item => (
                <li key={item.text} className="flex items-start gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-[15px] text-[#3D3D3F] leading-relaxed">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-[#F5F5F7] p-8 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">Fluxo de eventos</p>
            {[
              { event: 'PageView', when: 'Visitante abre o formulário', color: 'bg-blue-100 text-blue-700' },
              { event: 'Lead', when: 'Formulário enviado', color: 'bg-violet-100 text-violet-700' },
              { event: 'Purchase', when: 'Lead marcado como Ganho', color: 'bg-emerald-100 text-emerald-700' },
              { event: 'NotQualified', when: 'Score IA → tier Frio', color: 'bg-red-100 text-red-700' },
            ].map(ev => (
              <div key={ev.event} className="flex items-center gap-3 rounded-2xl bg-white border border-black/5 p-4">
                <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold font-mono ${ev.color}`}>
                  {ev.event}
                </span>
                <span className="text-sm text-[#6E6E73]">{ev.when}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <section id="planos" className="bg-[#F5F5F7] py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <Chip>Planos</Chip>
            <h2 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
              Simples. Sem surpresas.
            </h2>
            <p className="mt-4 text-xl text-[#6E6E73]">
              Comece grátis. Faça upgrade quando precisar.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            <PlanCard
              name="Trial"
              price="Grátis"
              desc="7 dias para explorar tudo."
              features={[
                'Até 50 leads',
                'Pipeline Kanban',
                'Formulários de captação',
                'WhatsApp unificado',
                'Tarefas e agendamentos',
              ]}
              cta="Começar grátis"
            />
            <PlanCard
              name="Starter"
              price="R$ 197"
              desc="Para times em crescimento."
              features={[
                'Até 500 leads',
                'Tudo do Trial',
                'Automações básicas',
                'Meta Pixel + CAPI',
                'Suporte por e-mail',
              ]}
              cta="Assinar Starter"
              highlight
            />
            <PlanCard
              name="Pro"
              price="R$ 397"
              desc="Para escalar com IA."
              features={[
                'Leads ilimitados',
                'Tudo do Starter',
                'Score IA',
                'Insights IA (chat)',
                'Atendente IA (WhatsApp)',
                'Automações avançadas',
              ]}
              cta="Assinar Pro"
            />
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 py-32">
        <div className="text-center mb-16">
          <Chip>Dúvidas</Chip>
          <h2 className="mt-5 text-4xl font-bold tracking-tight">
            Perguntas frequentes.
          </h2>
        </div>

        <div className="divide-y divide-black/5">
          <FaqItem
            q="Preciso de cartão de crédito para testar?"
            a="Não. O trial de 7 dias é totalmente gratuito e não exige nenhuma forma de pagamento. Você só precisa criar uma conta com e-mail e senha."
          />
          <FaqItem
            q="O que acontece quando o trial termina?"
            a="Após 7 dias você escolhe um plano para continuar. Seus dados ficam salvos por até 30 dias caso decida retornar. Nenhum lead ou histórico é apagado automaticamente durante esse período."
          />
          <FaqItem
            q="Posso cancelar quando quiser?"
            a="Sim. Não há fidelidade mínima. O cancelamento é feito em um clique e vale para o próximo ciclo de cobrança — você continua com acesso até o fim do mês pago."
          />
          <FaqItem
            q="Como funciona a integração com o WhatsApp?"
            a="O Althos CRM se conecta ao WhatsApp Business API. Você recebe e responde mensagens diretamente no painel, com histórico vinculado ao lead. A configuração é feita em Configurações → WhatsApp."
          />
          <FaqItem
            q="A IA funciona para qualquer nicho?"
            a="Sim. Você configura o contexto do seu negócio nas configurações de IA e ela se adapta ao seu processo comercial. Quanto mais respostas de formulário você capturar, melhor a qualidade do Score."
          />
          <FaqItem
            q="Tem suporte para clientes de agência?"
            a="Sim. Temos um plano Agency exclusivo para clientes da Althos Performance, com onboarding dedicado e acesso completo a todas as funcionalidades. Entre em contato para saber mais."
          />
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-32">
        <div className="rounded-3xl bg-gradient-to-br from-[#1D1D1F] via-[#2D2D2F] to-[#1D1D1F] p-16 text-center text-white relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[400px] w-[700px] rounded-full bg-gradient-to-br from-blue-500/20 via-violet-500/10 to-transparent blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
              Pronto para organizar suas vendas?
            </h2>
            <p className="text-xl text-white/60 mb-10 max-w-xl mx-auto">
              Comece hoje. Sem cartão. Sem compromisso. 7 dias para ver o Althos CRM em ação.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/signup"
                className="rounded-full bg-white px-8 py-3.5 text-base font-semibold text-[#1D1D1F] hover:bg-white/90 transition-colors shadow-lg shadow-black/20"
              >
                Criar conta grátis
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/20 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/5 transition-colors"
              >
                Já tenho uma conta
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-black/5 bg-[#F5F5F7] py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="text-base font-semibold text-[#1D1D1F]">Althos CRM</span>
              <p className="mt-1 text-sm text-[#6E6E73] max-w-xs">
                CRM com IA para times comerciais brasileiros.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 text-sm">
              <div>
                <p className="font-semibold text-[#1D1D1F] mb-3">Produto</p>
                <ul className="space-y-2 text-[#6E6E73]">
                  <li><Link href="#funcionalidades" className="hover:text-[#1D1D1F] transition-colors">Funcionalidades</Link></li>
                  <li><Link href="/pricing" className="hover:text-[#1D1D1F] transition-colors">Preços</Link></li>
                  <li><Link href="/signup" className="hover:text-[#1D1D1F] transition-colors">Começar grátis</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-[#1D1D1F] mb-3">Conta</p>
                <ul className="space-y-2 text-[#6E6E73]">
                  <li><Link href="/login" className="hover:text-[#1D1D1F] transition-colors">Login</Link></li>
                  <li><Link href="/signup" className="hover:text-[#1D1D1F] transition-colors">Cadastro</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-[#1D1D1F] mb-3">Suporte</p>
                <ul className="space-y-2 text-[#6E6E73]">
                  <li><a href="mailto:suporte@althos.io" className="hover:text-[#1D1D1F] transition-colors">suporte@althos.io</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-12 border-t border-black/5 pt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#6E6E73]">© {new Date().getFullYear()} Althos Performance. Todos os direitos reservados.</p>
            <p className="text-xs text-[#6E6E73]">Feito no Brasil 🇧🇷</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
