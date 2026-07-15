import type { Metadata } from 'next'
import DataDeletionRequestForm from '@/components/legal/DataDeletionRequestForm'

export const metadata: Metadata = {
  title: 'Solicitar exclusão de dados — Althos CRM',
  description:
    'Solicite a exclusão dos seus dados coletados via Instagram por empresas que usam a Althos CRM, conforme a LGPD e as políticas da Meta.',
}

export default function DataDeletionPage() {
  return (
    <div className="light min-h-screen bg-white">
      <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed text-slate-700">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Solicitar exclusão de dados</h1>
        <p className="mt-2 text-slate-500">Última atualização: julho de 2026</p>

        <div className="mt-6 space-y-3">
          <p>
            Se você trocou mensagens com uma empresa que usa a Althos CRM através do Instagram, seus dados
            (mensagens, nome de usuário e informações de contato que você forneceu) podem ter sido armazenados
            para que a empresa consiga te atender.
          </p>
          <p>
            Você pode solicitar a exclusão desses dados a qualquer momento preenchendo o formulário abaixo.
            Identificamos automaticamente a empresa pelo @ do Instagram informado e encaminhamos o pedido para
            que ela exclua seus dados. Esse processo está de acordo com a LGPD e com as políticas de exclusão de
            dados da Meta.
          </p>
        </div>

        <DataDeletionRequestForm />

        <p className="mt-6 text-xs text-slate-400">
          Dúvidas? Entre em contato pelo e-mail{' '}
          <a href="mailto:suporte@althoscrm.com.br" className="underline">suporte@althoscrm.com.br</a>.
        </p>
      </main>
    </div>
  )
}
