import { redirect } from 'next/navigation'

// Rota antiga — Tarefas agora vive dentro do módulo Agenda (issue #14).
// Mantida só como compatibilidade para links/favoritos existentes.
export default function TarefasRedirectPage({ params }: { params: { orgSlug: string } }) {
  redirect(`/app/${params.orgSlug}/agenda/tarefas`)
}
