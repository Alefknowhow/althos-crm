import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { listFooterProfiles, createFooterProfile, deleteFooterProfile, type FooterProfileRow } from '@/actions/quotations'

/**
 * Marcas salvas de rodapé/identidade (2ª agência) — evita redigitar os
 * mesmos dados toda vez que uma cotação usa uma marca diferente. Extraído
 * do hook principal de estado só pra reduzir o tamanho do arquivo, sem
 * mudança de comportamento.
 */
export function useQuotationFooterProfiles(orgSlug: string, setQ: (fn: (s: any) => any) => void, q: any) {
  const [footerProfiles, setFooterProfiles] = useState<FooterProfileRow[]>([])
  const [footerProfileBusy, setFooterProfileBusy] = useState(false)
  useEffect(() => { listFooterProfiles(orgSlug).then(setFooterProfiles) }, [orgSlug])

  function applyFooterProfile(p: FooterProfileRow) {
    setQ(s => ({
      ...s,
      footer_override: true,
      footer_legal_name: p.legal_name || '',
      footer_logo_url: p.logo_url,
      footer_address: p.address || '',
      footer_cnpj: p.cnpj || '',
      footer_cadastur: p.cadastur || '',
      footer_instagram_url: p.instagram_url || '',
      footer_site_url: p.site_url || '',
      footer_whatsapp_number: p.whatsapp_number || '',
      footer_phone: p.phone || '',
      footer_email: p.email || '',
    }))
  }

  async function saveFooterProfile() {
    const name = window.prompt('Nome para salvar esta marca (ex.: nome da outra agência):')?.trim()
    if (!name) return
    setFooterProfileBusy(true)
    const res = await createFooterProfile(orgSlug, {
      name,
      legal_name: q.footer_legal_name || null,
      logo_url: q.footer_logo_url,
      address: q.footer_address || null,
      cnpj: q.footer_cnpj || null,
      cadastur: q.footer_cadastur || null,
      instagram_url: q.footer_instagram_url || null,
      site_url: q.footer_site_url || null,
      whatsapp_number: q.footer_whatsapp_number || null,
      phone: q.footer_phone || null,
      email: q.footer_email || null,
    })
    setFooterProfileBusy(false)
    if (res.ok) { toast.success('Marca salva'); listFooterProfiles(orgSlug).then(setFooterProfiles) }
    else toast.error(res.error)
  }

  async function removeFooterProfile(id: string) {
    const res = await deleteFooterProfile(orgSlug, id)
    if (res.ok) setFooterProfiles(ps => ps.filter(p => p.id !== id))
    else toast.error(res.error)
  }

  return { footerProfiles, footerProfileBusy, applyFooterProfile, saveFooterProfile, removeFooterProfile }
}
