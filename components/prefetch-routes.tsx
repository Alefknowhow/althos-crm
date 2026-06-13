'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Pré-carrega (router.prefetch) as principais rotas do dashboard logo após o
 * login, para deixar a primeira navegação a cada aba mais fluida — o chunk JS
 * da rota passa a baixar em background, e não no clique.
 *
 * É montado uma única vez no layout autenticado. O setTimeout de ~2s evita
 * competir com o carregamento da página atual; o cleanup cancela o timeout se
 * o layout desmontar antes disso (logout/troca de org).
 *
 * Obs.: router.prefetch só tem efeito em produção (no dev o Next desabilita).
 */
export default function PrefetchRoutes({ orgSlug }: { orgSlug: string }) {
  const router = useRouter()

  useEffect(() => {
    const base = `/app/${orgSlug}`
    const routes = [
      `${base}/pipeline`,
      `${base}/contatos`,
      `${base}/cotacoes`,
      `${base}/embarques`,
      `${base}/tarefas`,
      `${base}/conversas`,
      `${base}/reservas`,
      `${base}/insights`,
      `${base}/automacoes`,
      `${base}/configuracoes`,
    ]

    const timer = setTimeout(() => {
      for (const route of routes) {
        router.prefetch(route)
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [router, orgSlug])

  return null
}
