'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import DocumentTemplatesView from './DocumentTemplatesView'
import GeneratedDocumentsView from './GeneratedDocumentsView'
import MedifView from './MedifView'
import type { DocumentTemplateRow } from '@/actions/document-templates'
import type { GeneratedDocumentRow } from '@/actions/generated-documents'
import type { MedifRecordRow } from '@/actions/medif'

export default function DocumentosTabs({
  orgSlug, templates, documents, medifRecords, medifTemplateInfo,
}: {
  orgSlug: string
  templates: DocumentTemplateRow[]
  documents: GeneratedDocumentRow[]
  medifRecords: MedifRecordRow[]
  medifTemplateInfo: { name: string } | null
}) {
  return (
    <Tabs defaultValue="gerados">
      <TabsList>
        <TabsTrigger value="gerados">Gerados</TabsTrigger>
        <TabsTrigger value="modelos">Modelos</TabsTrigger>
        <TabsTrigger value="medif">MEDIF</TabsTrigger>
      </TabsList>
      <TabsContent value="gerados">
        <GeneratedDocumentsView orgSlug={orgSlug} documents={documents} templates={templates} />
      </TabsContent>
      <TabsContent value="modelos">
        <DocumentTemplatesView orgSlug={orgSlug} templates={templates} />
      </TabsContent>
      <TabsContent value="medif">
        <MedifView orgSlug={orgSlug} records={medifRecords} templateInfo={medifTemplateInfo} />
      </TabsContent>
    </Tabs>
  )
}
