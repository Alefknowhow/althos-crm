import { redirect } from 'next/navigation'

/**
 * A "página completa" foi incorporada no painel de detalhe da lista de
 * Contatos (components/features/contatos/ContatosView.tsx) — não existe
 * mais uma tela separada. Links antigos continuam funcionando via redirect.
 */
export default function ContatoDetailRedirect({
  params,
}: {
  params: { orgSlug: string; id: string }
}) {
  redirect(`/app/${params.orgSlug}/contatos?sel=${params.id}`)
}
