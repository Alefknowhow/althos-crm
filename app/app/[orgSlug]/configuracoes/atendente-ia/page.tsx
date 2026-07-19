import { redirect } from 'next/navigation'

export default function AtendenteIaRedirect({ params }: { params: { orgSlug: string } }) {
  redirect(`/app/${params.orgSlug}/configuracoes/agente-ia`)
}
