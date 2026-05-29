import Link from 'next/link'
import { CheckCircle2, XCircle, Minus } from 'lucide-react'

// ── Metadata ──────────────────────────────────────────────────────────────────
export const metadata = {
  title: 'Planos e Preços · Althos CRM',
  description: 'Comece grátis por 7 dias. Planos Starter e Pro com Boleto, PIX ou Cartão de Crédito. Sem fidelidade.',
}

// ── Types ─────────────────────────────────────────────────────────────────────
type FeatureValue = true | false | string

interface Feature {
  label:   string
  trial:   FeatureValue
  starter: FeatureValue
  pro:     FeatureValue
  group?:  string
}

// ── Feature matrix ────────────────────────────────────────────────────────────
const FEATURES: Feature[] = [
  // Core
  { group: 'CRM',            label: 'Pipeline Kanban',         trial: true,      starter: true,      pro: true        },
  { label: 'Leads',          trial: 'Até 50',  starter: 'Até 500', pro: 'Ilimitados' },
  { label: 'Tarefas',        trial: true,      starter: true,      pro: true        },
  { label: 'Agendamentos',   trial: true,      starter: true,      pro: true        },
  { label: 'Formulários',    trial: true,      starter: true,      pro: true        },
  // Comunicação
  { group: 'Comunicação',    label: 'WhatsApp unificado',       trial: true,      starter: true,      pro: true        },
  { label: 'E-mail Marketing',trial: false,    starter: true,      pro: true        },
  { label: 'Meta Pixel + CAPI', trial: false,  starter: true,      pro: true        },
  // Automações
  { group: 'Automações',     label: 'Automações',               trial: false,     starter: true,      pro: true        },
  { label: 'Triggers avançados', trial: false, starter: false,     pro: true        },
  // IA
  { group: 'Inteligência Artificial', label: 'Score IA',        trial: false,     starter: false,     pro: true        },
  { label: 'Insights IA (chat)',       trial: false,     starter: false,     pro: true        },
  { label: 'Atendente IA (WhatsApp)',  trial: false,     starter: false,     pro: true        },
  // Suporte
  { group: 'Suporte',        label: 'Suporte por e-mail',       trial: false,     starter: true,      pro: true        },
  { label: 'Suporte prioritário',      trial: false,     starter: false,     pro: true        },
]

function FeatCell({ value }: { value: FeatureValue }) {
  if (value === true)  return <CheckCircle2 className="mx-auto w-4 h-4 text-blue-500" />
  if (value === false) return <Minus className="mx-auto w-4 h-4 text-black/20" />
  return <span className="text-xs font-medium text-[#1D1D1F]">{value}</span>
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-black/8 py-5">
      <summary className="flex cursor-pointer items-center justify-between gap-4 text-[17px] font-medium text-[#1D1D1F] list-none">
        {q}
        <svg className="w-5 h-5 shrink-0 text-[#6E6E73] transition-transform group-open:rotate-45"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </summary>
      <p className="mt-3 text-[15px] text-[#6E6E73] leading-relaxed pr-8">{a}</p>
    </details>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PricingPage() {
  return (
    <div
      className="min-h-screen bg-white text-[#1D1D1F] antialiased"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", sans-serif' }}
    >

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-base font-semibold tracking-tight text-[#1D1D1F]">
            Althos CRM
          </Link>
          <div className="flex items-center gap-3">
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
      <section className="relative overflow-hidden pb-20 pt-20 text-center bg-gradient-to-b from-white to-[#F5F5F7]">
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <div className="h-[400px] w-[800px] rounded-full bg-gradient-to-br from-blue-100/50 via-violet-100/30 to-transparent blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-2xl px-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-[#1D1D1F] mb-6">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
            Trial grátis por 7 dias · sem cartão de crédito
          </div>
          <h1 className="text-5xl font-bold tracking-tight leading-tight mb-4">
            Planos simples.<br />
            <span className="bg-gradient-to-br from-blue-600 via-violet-500 to-blue-400 bg-clip-text text-transparent">
              Sem surpresas.
            </span>
          </h1>
          <p className="text-xl text-[#6E6E73] leading-relaxed">
            Comece grátis. Cancele quando quiser.<br />
            Boleto, PIX ou Cartão de Crédito.
          </p>
        </div>
      </section>

      {/* ── Plan cards ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-20 -mt-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">

          {/* Trial */}
          <div className="rounded-3xl bg-[#F5F5F7] p-8 flex flex-col gap-6">
            <div>
              <p className="text-sm font-medium text-[#6E6E73] mb-1">Trial</p>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-4xl font-bold tracking-tight">Grátis</span>
              </div>
              <p className="text-sm text-[#6E6E73]">7 dias para explorar tudo, sem compromisso.</p>
            </div>
            <ul className="flex flex-col gap-2.5 flex-1 text-sm">
              {['Até 50 leads', 'Pipeline Kanban', 'Formulários', 'WhatsApp', 'Tarefas e agendamentos'].map(f => (
                <li key={f} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                  <span className="text-[#3D3D3F]">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="rounded-full border border-black/15 py-3 text-center text-sm font-semibold text-[#1D1D1F] hover:bg-black/5 transition-colors"
            >
              Começar grátis
            </Link>
          </div>

          {/* Starter — highlight */}
          <div className="relative rounded-3xl bg-[#1D1D1F] text-white p-8 flex flex-col gap-6 shadow-2xl shadow-black/20">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-1 text-xs font-semibold text-white whitespace-nowrap">
              Mais popular
            </span>
            <div>
              <p className="text-sm font-medium text-white/60 mb-1">Starter</p>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-4xl font-bold tracking-tight">R$ 197</span>
                <span className="text-white/60 mb-1.5 text-sm">/mês</span>
              </div>
              <p className="text-sm text-white/70">Para times em crescimento que querem organizar vendas.</p>
            </div>
            <ul className="flex flex-col gap-2.5 flex-1 text-sm">
              {['Até 500 leads', 'Tudo do Trial', 'Automações', 'Meta Pixel + CAPI', 'E-mail Marketing', 'Suporte por e-mail'].map(f => (
                <li key={f} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
                  <span className="text-white/80">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="rounded-full bg-white py-3 text-center text-sm font-semibold text-[#1D1D1F] hover:bg-white/90 transition-colors"
            >
              Assinar Starter
            </Link>
          </div>

          {/* Pro */}
          <div className="rounded-3xl bg-[#F5F5F7] p-8 flex flex-col gap-6">
            <div>
              <p className="text-sm font-medium text-[#6E6E73] mb-1">Pro</p>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-4xl font-bold tracking-tight">R$ 397</span>
                <span className="text-[#6E6E73] mb-1.5 text-sm">/mês</span>
              </div>
              <p className="text-sm text-[#6E6E73]">Para escalar com IA, automações avançadas e leads ilimitados.</p>
            </div>
            <ul className="flex flex-col gap-2.5 flex-1 text-sm">
              {['Leads ilimitados', 'Tudo do Starter', 'Score IA (0–100)', 'Insights IA (chat)', 'Atendente IA (WhatsApp)', 'Automações avançadas', 'Suporte prioritário'].map(f => (
                <li key={f} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                  <span className="text-[#3D3D3F]">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="rounded-full bg-[#1D1D1F] py-3 text-center text-sm font-semibold text-white hover:bg-[#3D3D3F] transition-colors"
            >
              Assinar Pro
            </Link>
          </div>

        </div>

        {/* Payment methods note */}
        <p className="text-center text-sm text-[#6E6E73] mt-8">
          Pagamento via <strong className="text-[#1D1D1F]">Boleto Bancário</strong>,{' '}
          <strong className="text-[#1D1D1F]">PIX</strong> ou{' '}
          <strong className="text-[#1D1D1F]">Cartão de Crédito</strong> · Renovação mensal · Sem fidelidade
        </p>
      </section>

      {/* ── Feature comparison table ─────────────────────────────────────────── */}
      <section className="bg-[#F5F5F7] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">
            Comparativo completo
          </h2>

          <div className="rounded-2xl border border-black/8 overflow-hidden bg-white">

            {/* Header row */}
            <div className="grid grid-cols-4 border-b border-black/5 bg-[#F5F5F7]/50 px-6 py-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#6E6E73]">Recurso</span>
              <span className="text-center text-xs font-semibold uppercase tracking-wide text-[#6E6E73]">Trial</span>
              <span className="text-center text-xs font-semibold uppercase tracking-wide text-[#6E6E73]">Starter</span>
              <span className="text-center text-xs font-semibold uppercase tracking-wide text-[#1D1D1F]">Pro</span>
            </div>

            {FEATURES.map((feat, i) => (
              <>
                {feat.group && (
                  <div
                    key={`group-${feat.group}`}
                    className="col-span-4 px-6 py-2 bg-[#F5F5F7]/80 border-t border-black/5"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73]">
                      {feat.group}
                    </span>
                  </div>
                )}
                <div
                  key={feat.label}
                  className={`grid grid-cols-4 items-center px-6 py-3 border-t border-black/5 text-sm ${
                    i % 2 === 0 ? '' : 'bg-[#F5F5F7]/30'
                  }`}
                >
                  <span className="font-medium text-[#1D1D1F]">{feat.label}</span>
                  <div className="text-center"><FeatCell value={feat.trial} /></div>
                  <div className="text-center"><FeatCell value={feat.starter} /></div>
                  <div className="text-center"><FeatCell value={feat.pro} /></div>
                </div>
              </>
            ))}

          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 py-24">
        <h2 className="text-3xl font-bold tracking-tight text-center mb-12">
          Dúvidas frequentes
        </h2>
        <div>
          <FaqItem
            q="Preciso de cartão de crédito para o trial?"
            a="Não. O trial de 7 dias é completamente gratuito e não exige nenhuma forma de pagamento. Basta criar uma conta com e-mail e senha."
          />
          <FaqItem
            q="Quais formas de pagamento são aceitas?"
            a="Aceitamos Boleto Bancário, PIX e Cartão de Crédito. O Boleto vence em 1 dia útil e compensa em até 3 dias. O PIX tem aprovação instantânea. O cartão é cobrado automaticamente todo mês."
          />
          <FaqItem
            q="O que acontece quando o trial acaba?"
            a="Após 7 dias seu acesso fica bloqueado até você escolher um plano. Seus dados (leads, pipeline, histórico) ficam preservados por 30 dias. Basta assinar para recuperar tudo imediatamente."
          />
          <FaqItem
            q="Posso cancelar a qualquer momento?"
            a="Sim. Sem fidelidade. O cancelamento é feito em um clique na página de assinatura e vale para o próximo ciclo — você mantém acesso até o fim do período já pago."
          />
          <FaqItem
            q="Posso mudar de plano depois?"
            a="Sim. Você pode fazer upgrade de Starter para Pro (ou downgrade) a qualquer momento. A diferença de valor é calculada proporcionalmente."
          />
          <FaqItem
            q="Existe plano para agências?"
            a="Sim. Temos um plano Agency exclusivo para clientes da Althos Performance, com onboarding dedicado e acesso completo a todas as funcionalidades. Entre em contato pelo suporte@althos.io para saber mais."
          />
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-3xl bg-gradient-to-br from-[#1D1D1F] via-[#2D2D2F] to-[#1D1D1F] p-16 text-center text-white relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[350px] w-[600px] rounded-full bg-gradient-to-br from-blue-500/20 via-violet-500/10 to-transparent blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              Pronto para começar?
            </h2>
            <p className="text-lg text-white/60 mb-8 max-w-md mx-auto">
              7 dias grátis. Sem cartão. Configure em minutos.
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
                Já tenho conta
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-black/5 bg-[#F5F5F7] py-10">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-base font-semibold text-[#1D1D1F]">Althos CRM</Link>
          <div className="flex items-center gap-6 text-sm text-[#6E6E73]">
            <Link href="/" className="hover:text-[#1D1D1F] transition-colors">Início</Link>
            <Link href="/#funcionalidades" className="hover:text-[#1D1D1F] transition-colors">Funcionalidades</Link>
            <Link href="/login" className="hover:text-[#1D1D1F] transition-colors">Login</Link>
            <a href="mailto:suporte@althos.io" className="hover:text-[#1D1D1F] transition-colors">Suporte</a>
          </div>
          <p className="text-xs text-[#6E6E73]">© {new Date().getFullYear()} Althos Performance</p>
        </div>
      </footer>

    </div>
  )
}
