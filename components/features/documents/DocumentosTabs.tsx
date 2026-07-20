'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import DocumentTemplatesView from './DocumentTemplatesView'
import GeneratedDocumentsView from './GeneratedDocumentsView'
import AttachmentTemplateView from './AttachmentTemplateView'
import MedifInfo from './MedifInfo'
import FremecInfo from './FremecInfo'
import type { DocumentTemplateRow } from '@/actions/document-templates'
import type { GeneratedDocumentRow } from '@/actions/generated-documents'

export default function DocumentosTabs({
  orgSlug, templates, documents, medifTemplateInfo, fremecTemplateInfo,
}: {
  orgSlug: string
  templates: DocumentTemplateRow[]
  documents: GeneratedDocumentRow[]
  medifTemplateInfo: { name: string } | null
  fremecTemplateInfo: { name: string } | null
}) {
  return (
    <Tabs defaultValue="gerados">
      <TabsList>
        <TabsTrigger value="gerados">Gerados</TabsTrigger>
        <TabsTrigger value="modelos">Modelos</TabsTrigger>
        <TabsTrigger value="medif">MEDIF</TabsTrigger>
        <TabsTrigger value="fremec">FREMEC</TabsTrigger>
      </TabsList>
      <TabsContent value="gerados">
        <GeneratedDocumentsView orgSlug={orgSlug} documents={documents} templates={templates} />
      </TabsContent>
      <TabsContent value="modelos">
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
