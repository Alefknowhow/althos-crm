'use client'

import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown, Settings } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface OrgOption {
  id: string
  name: string
  slug: string
}

/**
 * Seletor de organização no TOPO da sidebar (issue #10) — substitui a marca
 * "Althos CRM" que ficava ali; a marca vira assinatura discreta no rodapé
 * (ver SidebarBrandSignature). Orientado pelo contrato de organização ativa
 * da #30 (logo/iniciais, nome, id) — troca de org é navegação de URL, sem
 * estado próprio (mesmo mecanismo do OrganizationSwitcher que existia no
 * header, cf. auditoria da #30/#10: não há cookie/preferência de "última
 * org").
 */
export function SidebarOrgSwitcher({
  currentSlug,
  currentName,
  currentInitials,
  currentLogoUrl,
  organizations,
  canManage,
}: {
  currentSlug: string
  currentName: string
  currentInitials: string
  currentLogoUrl: string | null
  organizations: OrgOption[]
  canManage: boolean
}) {
  const router = useRouter()

  const brandMark = (
    <span className="w-7 h-7 shrink-0 rounded-md bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center text-[11px] font-semibold overflow-hidden">
      {currentLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo de cliente vindo do R2, sem domínio fixo pra next/image
        <img src={currentLogoUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        currentInitials
      )}
    </span>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-orgswitcher
          className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-sidebar-accent transition-colors"
          aria-label={`Organização ativa: ${currentName}. Trocar organização.`}
        >
          {brandMark}
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-sidebar-foreground truncate">
              {currentName}
            </span>
          </span>
          <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 text-sidebar-foreground/50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizações</DropdownMenuLabel>
        {organizations.map(org => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => router.push(`/app/${org.slug}/pipeline`)}
            className="justify-between gap-2"
          >
            <span className="truncate">{org.name}</span>
            {org.slug === currentSlug && <Check className="w-4 h-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
        {canManage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push(`/app/${currentSlug}/configuracoes/organizacoes`)}>
              <Settings className="w-4 h-4 mr-2" />
              Gerenciar organizações
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
