'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import DocumentTemplatesView from './DocumentTemplatesView'
import GeneratedDocumentsView from './GeneratedDocumentsView'
import type { DocumentTemplateRow } from '@/actions/document-templates'
import type { GeneratedDocumentRow } from '@/actions/generated-documents'

export default function DocumentosTabs({
  orgSlug, templates, documents,
}: {
  orgSlug: string
  templates: DocumentTemplateRow[]
  documents: GeneratedDocumentRow[]
}) {
  return (
    <Tabs defaultValue="gerados">
      <TabsList>
        <TabsTrigger value="gerados">Gerados</TabsTrigger>
        <TabsTrigger value="modelos">Modelos</TabsTrigger>
      </TabsList>
      <TabsContent value="gerados">
        <GeneratedDocumentsView orgSlug={orgSlug} documents={documents} templates={templates} />
      </TabsContent>
      <TabsContent value="modelos">
        <DocumentTemplatesView orgSlug={orgSlug} templates={templates} />
      </TabsContent>
    </Tabs>
  )
}
