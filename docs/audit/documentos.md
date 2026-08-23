# Auditoria — Módulo Documentos

> Gerado em 2026-07-29. Faz parte da auditoria completa do app. Ver também os demais docs em `docs/audit/`.

## 1. Rotas

| Rota | Arquivo | Função |
|---|---|---|
| `/app/[orgSlug]/documentos` | `app/app/[orgSlug]/documentos/page.tsx` | `requireAuth` + redirect se `!isTravelNiche`. Busca `listDocumentTemplates`, `getAttachmentTemplateInfo` (medif), `getAttachmentTemplateInfo` (fremec) em paralelo. Renderiza `DocumentosTabs`. |
| `/app/[orgSlug]/documentos/[id]/print` | `.../[id]/print/page.tsx` | Imprime um documento gerado. `getGeneratedDocument`, 404 se não achar. Renderiza `DocumentPrintView`. |

**Não existe mais rota de lista de documentos gerados** — `GeneratedDocumentsView.tsx` não existe na árvore, e nada importa `listGeneratedDocuments`/`deleteGeneratedDocument` — código morto.

**Não existe mais `MedifView.tsx`/`MedifForm.tsx`/`actions/medif.ts`** — a feature de registro estruturado de MEDIF (`medif_records`) foi deliberadamente removida. A migração `0096_reservas_checklist_contrato.sql` faz `DROP TABLE medif_records` e substitui por uma tabela genérica `attachment_templates` compartilhada entre MEDIF e FREMEC. O que resta hoje é só "upload/download de um PDF em branco + texto informativo estático" — sem formulário de preenchimento de dados.

## 2. Componentes

| Componente | Papel | Problemas encontrados |
|---|---|---|
| `DocumentosTabs.tsx` | Router de abas (Modelos/MEDIF/FREMEC). | `TabsList` sem `overflow-x-auto`/`flex-wrap` — ok com 3 labels curtos, mas não escala se crescer. Só a aba "Modelos" recebe `flex-1 min-h-0` (preenche altura); MEDIF/FREMEC ficam em fluxo normal de documento dentro de um pai de altura fixa — inconsistência visual entre abas. |
| `DocumentTemplatesView.tsx` | CRUD + lista/detalhe de templates + gatilho de impressão/geração. | Grid `md:grid-cols-[380px_1fr]` sem `grid-cols-1` explícito pro mobile — funciona pelo auto-colapso implícito do grid, mas é frágil/implícito em vez de declarado. Coluna de lista fixa em 380px não escala pra tablet. Linha de lista com nome truncado + botão "Imprimir" sempre visível (não vira ícone-só em telas estreitas) — aperta em larguras médias. Header sticky do editor sem verificação de `backdrop-blur` contra conteúdo longo (`bg-card/90` pode deixar transparecer texto ao rolar rápido). Caixa de dica `{{merge}}` é um parágrafo longo com `<code>` embutidos que pode quebrar mal em telas ≤360px. |
| `AttachmentTemplateView.tsx` | Upload/download/remoção do PDF em branco (MEDIF/FREMEC). | Linha de ação com 4 itens inline (ícone, nome truncado, botão "Baixar", botão remover) sem `flex-wrap` nem stack em telas muito estreitas — nenhuma variante `sm:` definida no arquivo. |
| `MedifInfo.tsx` / `FremecInfo.tsx` | Conteúdo informativo estático (sem props/estado). | Texto legal/regulatório **hardcoded no componente** — qualquer atualização de norma (resolução ANAC, política de operadora) exige deploy de código, ao contrário do resto do módulo que é totalmente editável pelo tenant. |
| `DocumentPrintView.tsx` | Preview + impressão de um documento gerado. | Sem variantes responsivas — `max-w-[210mm]` sempre renderiza em largura de papel A4 (~794px) mesmo no celular, exigindo zoom/scroll horizontal; desenhado como "abra no desktop ou imprima", não como leitura mobile. |

## 3. Server Actions

### `actions/document-templates.ts`

| Action | Propósito | Tabela |
|---|---|---|
| `listDocumentTemplates`/`getDocumentTemplate` | Listar/buscar templates | `document_templates` |
| `createDocumentTemplate`/`updateDocumentTemplate`/`deleteDocumentTemplate` | CRUD (permissão `documentos`; delete bloqueado sob impersonação) | `document_templates` |
| `getOrgContractTemplate`/`saveOrgContractTemplate` | Template de "Contrato padrão" da org, vinculado via `organizations.contract_template_id` | `document_templates`, `organizations` |
| `getDefaultContractBody` | Retorna HTML de contrato fallback hardcoded | nenhuma (constante) |

### `actions/generated-documents.ts`

| Action | Propósito | Status |
|---|---|---|
| `listGeneratedDocuments` | Lista documentos gerados | **Código morto** — zero importadores |
| `getGeneratedDocument` | Busca um documento gerado | Usado pela rota `[id]/print` |
| `generateDocument` | Resolve `body_html` do template contra `fieldValues` digitados manualmente, insere como documento imutável | Vivo (permissão `documentos`) |
| `deleteGeneratedDocument` | Exclui documento gerado | **Código morto** — zero importadores |

### `actions/attachment-templates.ts`
- `getAttachmentTemplateInfo`, `getAttachmentTemplateUrl` (URL assinada de 5 min), `uploadAttachmentTemplate` (PDF, ≤15MB), `removeAttachmentTemplate` — CRUD do PDF em branco de MEDIF/FREMEC, bucket `medif-templates`, permissão `documentos`.

`actions/medif.ts` **não existe mais** — removido junto com `medif_records`.

## 4. Permissões

Chave: **`documentos`**, módulo `TRAVEL_ONLY_KEYS`, padrão `false`. Toda action **mutante** checa `checkMemberPermission`. **Gap**: as actions de leitura (`listDocumentTemplates`, `getDocumentTemplate`, `getAttachmentTemplateInfo`, `getGeneratedDocument`, `getOrgContractTemplate`) **não** checam permissão — dependem só de RLS/membership. Destrutivas (`deleteDocumentTemplate`, `deleteGeneratedDocument`) também checam impersonação.

## 5. Conexões com outros módulos

- **Reservas (contrato)**: `/reservas/contrato-padrao` importa `getOrgContractTemplate`/`getDefaultContractBody` pra editar o contrato padrão via `ContractTemplateEditor`, reaproveitando `saveOrgContractTemplate` (mesmo CRUD de `document_templates`). `/reservas/[saleId]/contrato` importa `getOrgContractTemplate` + `renderTemplate` (de `lib/inngest/functions.ts`) pra imprimir o contrato de uma venda, resolvendo `{{sale.*}}`/`{{org.*}}` direto das colunas de `travel_sales`/`organizations`. Também chama `markContractGenerated` (`actions/travel-sales.ts`), que seta `travel_sales.contrato_gerado_at`.
- **Motor de merge compartilhado**: `renderTemplate()` (regex simples de `{{path.to.value}}`) é reusado identicamente por `generateDocument` (Documentos, `fieldValues` manuais) e pela impressão de contrato de Reservas (auto-preenchido de `travel_sales`/`organizations`) — mesma sintaxe, duas fontes de dados diferentes.
- **`document_templates` tem dupla função**: o registro "Contrato padrão" é só uma linha de `document_templates` marcada via `organizations.contract_template_id`, **sem coluna discriminadora** (`kind`/`type`) — se `contract_template_id` for corrompido/limpo, o contrato padrão pode aparecer inesperadamente na lista de "Modelos".

## 6. Notas de mobile

- Tabs sem tratamento mobile específico, mas funcional com 3 labels curtos.
- Editor Tiptap (reaproveitado do módulo de e-mail) tem toolbar que quebra em linhas extras em telas estreitas (razoável), mas a área editável mantém `min-h-[300px]` fixo — mesmo padding/altura mínima no mobile e desktop, empurrando conteúdo pra baixo da dobra combinado com o header sticky.
- `DocumentTemplatesView` é a única peça do módulo com padrão mobile real: lista/editor alternados via `hidden md:block`/`hidden md:flex` + seta de voltar.
- Views de impressão sem layout mobile — sempre largura A4, exige zoom/scroll no celular.

## Lista de problemas concretos

1. **Código morto**: `listGeneratedDocuments`/`deleteGeneratedDocument` sem importadores em lugar nenhum.
2. **[Segurança]** Gap de permissão nas leituras — só mutações checam `documentos`.
3. `document_templates` sem coluna discriminadora entre "Modelos" e "Contrato padrão" — risco de vazamento visual se `contract_template_id` for corrompido.
4. Grid mobile do `DocumentTemplatesView` depende de colapso implícito do grid, não de `grid-cols-1` explícito.
5. Coluna de lista fixa em 380px não escala pra tablet; botão "Imprimir" sempre com texto, sem modo ícone-só.
6. `AttachmentTemplateView` — linha de ação sem wrap/stack em telas muito estreitas.
7. `DocumentPrintView`/impressão de contrato — sem layout mobile, só A4 fixo.
8. Conteúdo legal (MEDIF/FREMEC) hardcoded no componente — mudança de norma exige deploy.
9. **[Histórico/arquitetura]** MEDIF teve uma feature de registro estruturado criada e removida em migrações consecutivas — o escopo atual (upload de PDF + texto estático) é bem menor do que "gestão de MEDIF" sugere.
10. Snapshot de documento gerado é imutável (por design, comentado no código) mas sem indicação visual pro usuário de que pode divergir do template atual.
