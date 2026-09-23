import { Logo } from '@/components/brand/Logo'

/**
 * Assinatura discreta "Althos CRM" no rodapé da sidebar (issue #10) — a
 * marca do CRM não compete mais com a identidade da agência/cliente, que
 * agora ocupa o topo via SidebarOrgSwitcher. Opacidade reduzida, mas
 * legível (não interativa, então não precisa de foco/contraste de botão).
 * Estado collapsed é resolvido via CSS (.sidebar-collapsed), mesmo padrão
 * do resto da sidebar (ver globals.css) — sem prop/estado próprio.
 */
export function SidebarBrandSignature() {
  return (
    <div data-brand-signature className="px-3 py-2 opacity-40">
      <Logo v2 showText textClassName="text-[11px] text-sidebar-foreground" className="scale-90 origin-left" />
    </div>
  )
}
