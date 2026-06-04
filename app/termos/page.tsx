import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termos de Serviço — Althos CRM',
  description:
    'Termos e condições de uso da plataforma Althos CRM: cadastro, planos, pagamentos, uso aceitável, integrações e responsabilidades.',
}

const UPDATED = '4 de junho de 2026'
const CONTACT = 'suporte@althoscrm.com.br'

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed text-slate-700">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Termos de Serviço</h1>
      <p className="mt-2 text-slate-500">Última atualização: {UPDATED}</p>

      <Section title="1. Aceitação dos termos">
        Ao criar uma conta ou utilizar o Althos CRM (&quot;Althos&quot;, &quot;plataforma&quot;,
        &quot;serviço&quot;, &quot;nós&quot;), você concorda com estes Termos de Serviço e com a
        nossa{' '}
        <a className="text-indigo-600 underline" href="/privacidade">
          Política de Privacidade
        </a>
        . Se você utiliza o serviço em nome de uma empresa, declara ter autoridade para vincular essa
        empresa a estes termos. Caso não concorde, não utilize a plataforma.
      </Section>

      <Section title="2. Descrição do serviço">
        O Althos é uma plataforma de gestão de relacionamento com clientes (CRM) que oferece funil de
        vendas, gestão de leads, tarefas, agendamentos, automações, integrações com canais de
        mensagem (como WhatsApp e Instagram) e recursos de inteligência artificial. Os recursos
        disponíveis variam conforme o plano contratado.
      </Section>

      <Section title="3. Cadastro e conta">
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Você deve fornecer informações verdadeiras, completas e atualizadas no cadastro.</li>
          <li>
            Você é responsável por manter a confidencialidade das suas credenciais e por toda
            atividade realizada em sua conta.
          </li>
          <li>Você deve ter pelo menos 18 anos ou a maioridade legal aplicável.</li>
          <li>
            Notifique-nos imediatamente em caso de uso não autorizado da sua conta pelo e-mail{' '}
            <a className="text-indigo-600 underline" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            .
          </li>
        </ul>
      </Section>

      <Section title="4. Planos, pagamentos e teste">
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <b>Plano Free:</b> gratuito por tempo indeterminado, sem necessidade de cartão de
            crédito, sujeito aos limites de uso descritos na página de planos.
          </li>
          <li>
            <b>Planos pagos (Starter, Pro e Business):</b> cobrados de forma recorrente (mensal,
            semestral ou anual) conforme o ciclo escolhido. Os preços vigentes são exibidos na
            página de planos.
          </li>
          <li>
            <b>Período de teste e reembolso:</b> ao contratar um plano pago, você tem 7 (sete) dias
            para solicitar o cancelamento com reembolso integral do primeiro pagamento. Após esse
            prazo, as cobranças seguem o ciclo contratado.
          </li>
          <li>
            <b>Renovação e cancelamento:</b> a assinatura é renovada automaticamente até que seja
            cancelada. Você pode cancelar a qualquer momento; o acesso aos recursos pagos permanece
            até o fim do período já pago, sem reembolso proporcional após o prazo de 7 dias.
          </li>
          <li>
            Impostos aplicáveis podem ser adicionados ao valor do plano conforme a legislação.
          </li>
        </ul>
      </Section>

      <Section title="5. Uso aceitável">
        Você concorda em não utilizar o Althos para:
        <ul className="ml-5 mt-2 list-disc space-y-1.5">
          <li>Enviar spam, mensagens não solicitadas ou conteúdo ilegal, fraudulento ou abusivo.</li>
          <li>
            Violar leis aplicáveis, incluindo a Lei Geral de Proteção de Dados (LGPD) e as políticas
            das plataformas integradas (como Meta/WhatsApp).
          </li>
          <li>
            Tentar acessar indevidamente sistemas, contas de terceiros ou comprometer a segurança da
            plataforma.
          </li>
          <li>Revender ou sublicenciar o serviço sem autorização expressa.</li>
        </ul>
        <p className="mt-3">
          Podemos suspender ou encerrar contas que violem estas regras, sem aviso prévio em casos de
          risco à segurança ou de violação grave.
        </p>
      </Section>

      <Section title="6. Dados do cliente e privacidade">
        Você mantém a titularidade dos dados que inserir na plataforma (leads, contatos, mensagens e
        demais conteúdos). Você é responsável por ter base legal para tratar os dados de terceiros que
        adicionar ao Althos. O tratamento que realizamos é descrito na nossa{' '}
        <a className="text-indigo-600 underline" href="/privacidade">
          Política de Privacidade
        </a>
        , que integra estes termos.
      </Section>

      <Section title="7. Integrações de terceiros">
        O Althos pode se integrar a serviços de terceiros (por exemplo, WhatsApp Cloud API,
        Instagram/Meta, provedores de pagamento e de IA). O uso dessas integrações está sujeito aos
        termos dos respectivos provedores. Não nos responsabilizamos por indisponibilidades,
        alterações ou descontinuações desses serviços externos.
      </Section>

      <Section title="8. Inteligência artificial">
        Recursos de IA são fornecidos como apoio e podem gerar resultados imprecisos. Você é
        responsável por revisar e validar qualquer conteúdo gerado por IA antes de utilizá-lo,
        especialmente em comunicações com clientes.
      </Section>

      <Section title="9. Disponibilidade e suporte">
        Empenhamo-nos para manter o serviço disponível, mas não garantimos operação ininterrupta ou
        livre de erros. Podemos realizar manutenções, atualizações e melhorias que afetem
        temporariamente o acesso. O suporte é prestado pelos canais indicados na plataforma.
      </Section>

      <Section title="10. Propriedade intelectual">
        O software, a marca, o design e os conteúdos do Althos são de nossa propriedade ou de nossos
        licenciadores. Estes termos não transferem nenhum direito de propriedade intelectual sobre a
        plataforma a você, exceto a licença de uso limitada e revogável para utilizar o serviço.
      </Section>

      <Section title="11. Limitação de responsabilidade">
        Na máxima extensão permitida pela lei, o Althos não se responsabiliza por danos indiretos,
        lucros cessantes ou perda de dados decorrentes do uso ou da impossibilidade de uso do serviço.
        Nossa responsabilidade total, em qualquer hipótese, limita-se ao valor pago por você nos 12
        meses anteriores ao evento que originou a reclamação.
      </Section>

      <Section title="12. Encerramento">
        Você pode encerrar sua conta a qualquer momento. Podemos encerrar ou suspender o acesso em
        caso de violação destes termos ou de inadimplência. Após o encerramento, os dados podem ser
        excluídos conforme descrito na Política de Privacidade.
      </Section>

      <Section title="13. Alterações nos termos">
        Podemos atualizar estes termos periodicamente. Alterações relevantes serão comunicadas pelos
        canais da plataforma. O uso continuado após a vigência das alterações representa concordância
        com a nova versão.
      </Section>

      <Section title="14. Lei aplicável e foro">
        Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro do
        domicílio do usuário consumidor para dirimir eventuais controvérsias, quando aplicável.
      </Section>

      <Section title="15. Contato">
        Dúvidas sobre estes termos?{' '}
        <a className="text-indigo-600 underline" href={`mailto:${CONTACT}`}>
          {CONTACT}
        </a>
        .
      </Section>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  )
}
