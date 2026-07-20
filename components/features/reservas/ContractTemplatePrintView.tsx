'use client'

import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft } from 'lucide-react'
import AttachSignedContractButton from './AttachSignedContractButton'

type OrgBranding = {
  name: string
  logo_url: string | null
  primary_color: string | null
  cnpj: string | null
  cadastur: string | null
}

export default function ContractTemplatePrintView({
  saleId, orgSlug, bodyHtml, org,
}: {
  saleId: string
  orgSlug: string
  bodyHtml: string
  org: OrgBranding
}) {
  const accent = org.primary_color || '#0f62fe'

  return (
    <div className="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
      <div className="max-w-[210mm] mx-auto print:hidden mb-4 px-4 flex items-center justify-between gap-2">
        <a href={`/app`} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0" onClick={e => { e.preventDefault(); window.close() }}>
          <ArrowLeft className="w-3 h-3" /> Fechar
        </a>
        <div className="flex items-center gap-2">
          <AttachSignedContractButton orgSlug={orgSlug} saleId={saleId} />
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5" /> Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      <div className="max-w-[210mm] mx-auto bg-white text-black shadow-sm print:shadow-none p-10 print:p-8 min-h-[297mm] text-sm leading-relaxed">
        <div className="flex items-center gap-3 border-b-2 pb-4 mb-6" style={{ borderColor: accent }}>
          {org.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url} alt={org.name} className="h-12 w-auto object-contain" />
          )}
          <div>
            <p className="text-base font-bold">{org.name}</p>
            <p className="text-[11px] text-gray-500">
              {org.cnpj && <>CNPJ {org.cnpj}</>}
              {org.cnpj && org.cadastur && ' · '}
              {org.cadastur && <>CADASTUR {org.cadastur}</>}
            </p>
          </div>
        </div>

        {/* Conteúdo autoral da própria agência (editado no Tiptap em "Contrato padrão"). */}
        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: bodyHtml }} />

        <div className="grid grid-cols-2 gap-8 mt-16">
          <div className="text-center">
            <div className="border-t border-black pt-2">
              <p className="font-semibold">{org.name}</p>
              <p className="text-xs text-gray-500">Contratada</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black pt-2">
              <p className="font-semibold">&nbsp;</p>
              <p className="text-xs text-gray-500">Contratante</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}
