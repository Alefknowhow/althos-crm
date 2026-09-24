import { redirect } from 'next/navigation'

// Rota antiga — ver app/app/[orgSlug]/agencias-trafego/projetos/page.tsx.
export default function ProjetoDetailRedirectPage({ params }: { params: { orgSlug: string; id: string } }) {
  redirect(`/app/${params.orgSlug}/agenda/projetos/${params.id}`)
}
