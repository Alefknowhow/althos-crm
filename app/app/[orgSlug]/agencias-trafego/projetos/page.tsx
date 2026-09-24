import { redirect } from 'next/navigation'

// Rota antiga — Projetos deixou de ser exclusivo de Agências de Tráfego e
// agora vive em Agenda → Projetos (issue #14). Mantida só como
// compatibilidade para links/favoritos existentes.
export default function ProjetosRedirectPage({ params }: { params: { orgSlug: string } }) {
  redirect(`/app/${params.orgSlug}/agenda/projetos`)
}
