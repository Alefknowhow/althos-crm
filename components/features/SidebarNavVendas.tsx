import { Badge } from '@/components/ui/badge'
import SidebarNavLink from './SidebarNavLink'
import type { Permissions, MemberRole } from '@/lib/permissions'
import { canAccess } from '@/lib/permissions'
import { isModuleEnabled } from '@/lib/niche-modules'
import { isTrafficNiche } from '@/lib/niche'
import { TRAVEL_PLANNER_ENABLED } from '@/lib/ai/roteirista'
import {
  Kanban, Users, CheckSquare, Package, ShoppingCart, Calendar,
  FileSignature, PlaneTakeoff, Store, CalendarClock, FileStack, Armchair, Sparkles,
  Stethoscope, ClipboardList, ListChecks, Hourglass, Percent, CalendarCheck2,
  HeartPulse, Home, Handshake, Boxes,
} from 'lucide-react'

/** "Vendas" section nav items — a big flat list gated by permission +
 * niche-module flags. Split out of Sidebar.tsx. */
export function SidebarNavVendas({
  base, niche, userRole, userPermissions, overdueCount,
}: {
  base: string
  niche: string | null
  userRole: MemberRole
  userPermissions: Permissions
  overdueCount: number | null
}) {
  function can(key: Parameters<typeof canAccess>[2]) {
    return canAccess(userRole, userPermissions, key)
  }

  return (
    <>
      {can('pipeline') && (
        <SidebarNavLink
          href={isModuleEnabled(niche, 'imoveis') ? `${base}/pipeline-imoveis` : `${base}/pipeline`}
          dataTour="pipeline"
        >
          <span className="flex items-center gap-2.5">
            <Kanban className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Pipeline</span>
          </span>
        </SidebarNavLink>
      )}

      {(can('leads') || can('clients')) && (
        <SidebarNavLink href={`${base}/contatos`} dataTour="leads">
          <span className="flex items-center gap-2.5">
            <Users className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Contatos</span>
          </span>
        </SidebarNavLink>
      )}

      {can('tasks') && (
        <SidebarNavLink href={`${base}/tarefas`}>
          <span className="flex items-center gap-2.5">
            <CheckSquare className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Tarefas</span>
            {!!overdueCount && overdueCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1.5 py-0 leading-none">
                {overdueCount}
              </Badge>
            )}
          </span>
        </SidebarNavLink>
      )}

      {can('ofertas') && isModuleEnabled(niche, 'ofertas') && (
        <div className="hidden md:block">
          <SidebarNavLink href={`${base}/ofertas`}>
            <span className="flex items-center gap-2.5">
              <Store className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Ofertas</span>
            </span>
          </SidebarNavLink>
        </div>
      )}

      {can('bloqueios') && isModuleEnabled(niche, 'bloqueios') && (
        <SidebarNavLink href={`${base}/bloqueios`}>
          <span className="flex items-center gap-2.5">
            <Armchair className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Bloqueios</span>
          </span>
        </SidebarNavLink>
      )}

      {can('documentos') && isModuleEnabled(niche, 'documentos_viagem') && (
        <div className="hidden md:block">
          <SidebarNavLink href={`${base}/documentos`}>
            <span className="flex items-center gap-2.5">
              <FileStack className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Documentos</span>
            </span>
          </SidebarNavLink>
        </div>
      )}

      {can('cotacoes') && isModuleEnabled(niche, 'cotacoes') && (
        <SidebarNavLink href={`${base}/cotacoes`}>
          <span className="flex items-center gap-2.5">
            <FileSignature className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Cotações</span>
          </span>
        </SidebarNavLink>
      )}

      {/* Ocultos no mobile: ferramentas de construção/configuração, sem
          uso real "na rua" — continuam disponíveis no desktop. */}
      {TRAVEL_PLANNER_ENABLED && can('roteirista') && isModuleEnabled(niche, 'roteirista') && (
        <div className="hidden md:block">
          <SidebarNavLink href={`${base}/roteirista`}>
            <span className="flex items-center gap-2.5">
              <Sparkles className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Travel Planner</span>
            </span>
          </SidebarNavLink>
        </div>
      )}

      {can('reservas') && isModuleEnabled(niche, 'reservas') && (
        <SidebarNavLink href={`${base}/reservas`}>
          <span className="flex items-center gap-2.5">
            <PlaneTakeoff className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Reservas</span>
          </span>
        </SidebarNavLink>
      )}

      {can('embarques') && isModuleEnabled(niche, 'embarques') && (
        <SidebarNavLink href={`${base}/embarques`}>
          <span className="flex items-center gap-2.5">
            <CalendarClock className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Embarques</span>
          </span>
        </SidebarNavLink>
      )}

      {can('catalog') && isModuleEnabled(niche, 'catalogo') && (
        <div className="hidden md:block">
          <SidebarNavLink href={`${base}/catalogo`}>
            <span className="flex items-center gap-2.5">
              <Package className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>{isTrafficNiche(niche) ? 'Planos' : 'Catálogo'}</span>
            </span>
          </SidebarNavLink>
        </div>
      )}

      {can('sales') && isModuleEnabled(niche, 'vendas') && (
        <SidebarNavLink href={`${base}/vendas`}>
          <span className="flex items-center gap-2.5">
            <ShoppingCart className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Vendas</span>
          </span>
        </SidebarNavLink>
      )}

      {can('calendar') && isModuleEnabled(niche, 'agendamentos') && (
        <SidebarNavLink href={`${base}/agendamentos`} dataTour="agendamentos">
          <span className="flex items-center gap-2.5">
            <Calendar className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Agendamentos</span>
          </span>
        </SidebarNavLink>
      )}

      {can('profissionais') && isModuleEnabled(niche, 'profissionais') && (
        <SidebarNavLink href={`${base}/profissionais`}>
          <span className="flex items-center gap-2.5">
            <Stethoscope className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Profissionais</span>
          </span>
        </SidebarNavLink>
      )}

      {can('orcamentos_clinica') && isModuleEnabled(niche, 'orcamentos_clinica') && (
        <SidebarNavLink href={`${base}/orcamentos`}>
          <span className="flex items-center gap-2.5">
            <FileSignature className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Orçamentos</span>
          </span>
        </SidebarNavLink>
      )}

      {can('atendimentos_clinica') && isModuleEnabled(niche, 'atendimentos_clinica') && (
        <SidebarNavLink href={`${base}/atendimentos`}>
          <span className="flex items-center gap-2.5">
            <ClipboardList className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Atendimentos</span>
          </span>
        </SidebarNavLink>
      )}

      {can('atendimentos_clinica') && isModuleEnabled(niche, 'retornos_clinica') && (
        <SidebarNavLink href={`${base}/retornos`}>
          <span className="flex items-center gap-2.5">
            <CalendarCheck2 className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Retornos</span>
          </span>
        </SidebarNavLink>
      )}

      {can('prontuario_clinica') && isModuleEnabled(niche, 'prontuario_clinica') && (
        <SidebarNavLink href={`${base}/prontuario`}>
          <span className="flex items-center gap-2.5">
            <HeartPulse className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Prontuário</span>
          </span>
        </SidebarNavLink>
      )}

      {can('estoque_clinica') && isModuleEnabled(niche, 'estoque_clinica') && (
        <SidebarNavLink href={`${base}/estoque`}>
          <span className="flex items-center gap-2.5">
            <Boxes className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Estoque</span>
          </span>
        </SidebarNavLink>
      )}

      {can('tratamentos_clinica') && isModuleEnabled(niche, 'tratamentos_clinica') && (
        <SidebarNavLink href={`${base}/tratamentos`}>
          <span className="flex items-center gap-2.5">
            <ListChecks className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Tratamentos</span>
          </span>
        </SidebarNavLink>
      )}

      {can('lista_espera_clinica') && isModuleEnabled(niche, 'lista_espera_clinica') && (
        <SidebarNavLink href={`${base}/lista-espera`}>
          <span className="flex items-center gap-2.5">
            <Hourglass className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Lista de Espera</span>
          </span>
        </SidebarNavLink>
      )}

      {can('comissoes_clinica') && isModuleEnabled(niche, 'comissoes_clinica') && (
        <SidebarNavLink href={`${base}/comissoes`}>
          <span className="flex items-center gap-2.5">
            <Percent className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Comissões</span>
          </span>
        </SidebarNavLink>
      )}

      {can('imoveis') && isModuleEnabled(niche, 'imoveis') && (
        <SidebarNavLink href={`${base}/imoveis`}>
          <span className="flex items-center gap-2.5">
            <Home className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Imóveis</span>
          </span>
        </SidebarNavLink>
      )}

      {can('imoveis') && isModuleEnabled(niche, 'imoveis') && (
        <SidebarNavLink href={`${base}/visitas`}>
          <span className="flex items-center gap-2.5">
            <CalendarClock className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Visitas</span>
          </span>
        </SidebarNavLink>
      )}

      {can('imoveis') && isModuleEnabled(niche, 'imoveis') && (
        <SidebarNavLink href={`${base}/propostas`}>
          <span className="flex items-center gap-2.5">
            <FileSignature className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Propostas</span>
          </span>
        </SidebarNavLink>
      )}

      {can('imoveis') && isModuleEnabled(niche, 'imoveis') && (
        <SidebarNavLink href={`${base}/negociacoes`}>
          <span className="flex items-center gap-2.5">
            <Handshake className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Negociações</span>
          </span>
        </SidebarNavLink>
      )}
    </>
  )
}
