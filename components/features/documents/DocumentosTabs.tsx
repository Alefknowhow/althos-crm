'use client'

import { useRef, useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import DocumentTemplatesView, { type DocumentTemplatesViewHandle } from './DocumentTemplatesView'
import AttachmentTemplateView from './AttachmentTemplateView'
import MedifInfo from './MedifInfo'
import FremecInfo from './FremecInfo'
import type { DocumentTemplateRow } from '@/actions/document-templates'

export default function DocumentosTabs({
  orgSlug, templates, medifTemplateInfo, fremecTemplateInfo,
}: {
  orgSlug: string
  templates: DocumentTemplateRow[]
  medifTemplateInfo: { name: string } | null
  fremecTemplateInfo: { name: string } | null
}) {
  const [tab, setTab] = useState('modelos')
  const templatesRef = useRef<DocumentTemplatesViewHandle>(null)

  return (
    <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <TabsList>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
          <TabsTrigger value="medif">MEDIF</TabsTrigger>
          <TabsTrigger value="fremec">FREMEC</TabsTrigger>
        </TabsList>
        {tab === 'modelos' && (
          <Button onClick={() => templatesRef.current?.openNew()}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo modelo
          </Button>
        )}
      </div>
      <TabsContent value="modelos" className="flex-1 min-h-0 flex flex-col">
        <DocumentTemplatesView ref={templatesRef} orgSlug={orgSlug} templates={templates} />
      </TabsContent>
      <TabsContent value="medif">
        <AttachmentTemplateView orgSlug={orgSlug} documentType="medif" templateInfo={medifTemplateInfo}>
          <MedifInfo />
        </AttachmentTemplateView>
      </TabsContent>
      <TabsContent value="fremec">
        <AttachmentTemplateView orgSlug={orgSlug} documentType="fremec" templateInfo={fremecTemplateInfo}>
          <FremecInfo />
        </AttachmentTemplateView>
      </TabsContent>
    </Tabs>
  )
}
