import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Althos CRM',
  description:
    'Como o Althos CRM coleta, usa, armazena e protege os dados, incluindo dados obtidos via integrações com Meta (Instagram e Facebook).',
}

const UPDATED = '31 de maio de 2026'
const CONTACT = 'suporte@althoscrm.com.br'

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed text-slate-700">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Política de Privacidade</h1>
      <p className="mt-2 text-slate-500">Última atualização: {UPDATED}</p>

      <Section title="1. Quem somos">
        O Althos CRM (&quot;Althos&quot;, &quot;nós&quot;) é uma plataforma de gestão de
        relacionamento com clientes (CRM) que ajuda empresas a organizar leads, atendimentos,
        agendamentos e automações de comunicação. Esta política descreve como tratamos os dados
        pessoais de usuários da plataforma e de pessoas que interagem com nossos clientes por meio
        dela.
      </Section>

      <Section title="2. Dados que coletamos">
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <b>Dados de cadastro:</b> nome, e-mail e dados da organização do usuário da plataforma.
          </li>
          <li>
            <b>Dados de contatos/leads:</b> nome, telefone, e-mail e mensagens trocadas, fornecidos
            pelo próprio contato ou pelo cliente que utiliza o Althos.
          </li>
          <li>
            <b>Dados de integrações Meta (Instagram/Facebook):</b> quando um cliente conecta uma
            conta profissional do Instagram, recebemos o identificador da conta, o nome da Página do
            Facebook vinculada, o nome de usuário do Instagram, um token de acesso e o conteúdo de
            mensagens diretas (DMs) e comentários necessários para automatizar respostas.
          </li>
          <li>
            <b>Dados técnicos:</b> registros de acesso, endereço IP e informações do dispositivo,
            usados para segurança e funcionamento do serviço.
          </li>
        </ul>
      </Section>

      <Section title="3. Como usamos os dados">
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Operar o CRM: organizar leads, atendimentos, tarefas e agendamentos.</li>
          <li>
            Automatizar respostas a DMs e comentários do Instagram em nome do cliente que conectou a
            conta, inclusive com auxílio de inteligência artificial.
          </li>
          <li>Criar e atualizar registros de leads a partir dessas interações.</li>
          <li>Garantir segurança, prevenir abuso e cumprir obrigações legais.</li>
        </ul>
        <p className="mt-3">
          Não vendemos dados pessoais. Os dados obtidos via plataformas da Meta são usados
          exclusivamente para prestar a funcionalidade contratada pelo cliente e em conformidade com
          as Políticas da Plataforma da Meta.
        </p>
      </Section>

      <Section title="4. Compartilhamento">
        Compartilhamos dados apenas com provedores que viabilizam o serviço (por exemplo,
        hospedagem, banco de dados e provedores de IA), sob obrigações de confidencialidade e
        tratamento limitado à finalidade. Também podemos compartilhar dados quando exigido por lei.
      </Section>

      <Section title="5. Armazenamento e segurança">
        Os dados são armazenados em provedores de nuvem com criptografia em trânsito e controles de
        acesso. Tokens de acesso de integrações são guardados de forma restrita e usados somente para
        as operações autorizadas pelo cliente.
      </Section>

      <Section title="6. Retenção">
        Mantemos os dados enquanto a conta estiver ativa ou conforme necessário para as finalidades
        descritas. O cliente pode desconectar uma integração a qualquer momento, o que interrompe a
        coleta de novas interações daquela conta.
      </Section>

      <Section title="7. Seus direitos e exclusão de dados">
        <p>
          Você pode solicitar acesso, correção ou exclusão dos seus dados pessoais. Para exercer
          esses direitos — ou para solicitar a exclusão de dados obtidos via Instagram/Facebook —
          entre em contato pelo e-mail{' '}
          <a className="text-indigo-600 underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          . Atenderemos as solicitações nos prazos exigidos pela legislação aplicável.
        </p>
        <p className="mt-3" id="exclusao-de-dados">
          <b>Instruções de exclusão de dados:</b> para remover os dados associados à sua conta do
          Instagram/Facebook do Althos CRM, desconecte a conta em Configurações → Instagram, ou
          envie um pedido para{' '}
          <a className="text-indigo-600 underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>{' '}
          com o assunto &quot;Exclusão de dados&quot;. Removeremos os dados vinculados em até 30 dias.
        </p>
      </Section>

      <Section title="8. Alterações">
        Podemos atualizar esta política periodicamente. A data de &quot;última atualização&quot; no
        topo indica a versão vigente.
      </Section>

      <Section title="9. Contato">
        Dúvidas sobre privacidade?{' '}
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
