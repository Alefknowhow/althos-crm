'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import DocumentTemplatesView from './DocumentTemplatesView'
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
  return (
    <Tabs defaultValue="modelos" className="flex flex-col flex-1 min-h-0">
      <TabsList className="shrink-0">
        <TabsTrigger value="modelos">Modelos</TabsTrigger>
        <TabsTrigger value="medif">MEDIF</TabsTrigger>
        <TabsTrigger value="fremec">FREMEC</TabsTrigger>
      </TabsList>
      <TabsContent value="modelos" className="flex-1 min-h-0 flex flex-col">
        <DocumentTemplatesView orgSlug={orgSlug} templates={templates} />
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
