import { redirect } from 'next/navigation'

export default function AtendenteIaFaqRedirect({ params }: { params: { orgSlug: string } }) {
  redirect(`/app/${params.orgSlug}/configuracoes/agente-ia?tab=conhecimento`)
}
