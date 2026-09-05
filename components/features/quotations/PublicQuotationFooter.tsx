'use client'

import { IcGlobe, IcIg, LazyImg } from './PublicQuotationHelpers'
import { urlHref, igHref } from './PublicQuotationStyles'
import type { QuotationOrg } from './PublicQuotationTypes'

/** Rodapé da proposta pública — puro código movido de PublicQuotationView.tsx. */
export default function PublicQuotationFooter({ org }: { org: QuotationOrg }) {
  return (
    <footer>
      <div className="foot">
        {(org.instagram_url || org.site_url) && (
          <div className="social">
            {org.instagram_url && <>Confira também nosso Instagram
              <a href={igHref(org.instagram_url)} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><IcIg /></a></>}
            {org.site_url && (
              <a href={urlHref(org.site_url)} target="_blank" rel="noopener noreferrer" aria-label="Site"><IcGlobe className="" /></a>
            )}
          </div>
        )}
        <div className="foot-sep" />
        {org.brand_logo_url
          ? <LazyImg src={org.brand_logo_url} alt={org.legal_name || ''} className="foot-logo-img" />
          : <div className="logo">{org.legal_name}</div>}
        <div className="legal">
          {(org.terms_url || org.privacy_url) && (
            <>
              {org.terms_url && <a href={org.terms_url} target="_blank" rel="noopener noreferrer">Termos de serviço</a>}
              {org.terms_url && org.privacy_url && ' · '}
              {org.privacy_url && <a href={org.privacy_url} target="_blank" rel="noopener noreferrer">Política de privacidade</a>}
              <br />
            </>
          )}
          {[
            org.city_state ? `Estamos em ${org.city_state}` : null,
            org.cnpj ? `CNPJ ${org.cnpj}` : null,
            org.cadastur ? `CADASTUR ${org.cadastur}` : null,
            org.phone || null,
            org.email || null,
          ].filter(Boolean).join(' · ')}
        </div>
        <div className="rights">© {new Date().getFullYear()} {org.legal_name} · Todos os direitos reservados.</div>
      </div>
    </footer>
  )
}
