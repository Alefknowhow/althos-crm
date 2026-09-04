/**
 * Contatos — entidade única de contato. "cliente" é apenas um status
 * (lead | cliente | inativo). Os dados antes em customer_profiles agora
 * são colunas de contatos; documentos referenciam contato_id.
 *
 * This file is a barrel: the actions themselves live in the
 * actions/contatos-{shared,leads,pipeline,bulk,customers,contactpoints,
 * avatar,deals,documents}.ts modules (split out because this file had grown
 * past the project's per-file size budget). No 'use server' directive is
 * needed here — it only re-exports async functions defined in files that
 * each carry their own 'use server'.
 */

export * from './contatos-shared'
export * from './contatos-leads'
export * from './contatos-pipeline'
export * from './contatos-bulk'
export * from './contatos-customers'
export * from './contatos-contactpoints'
export * from './contatos-avatar'
export * from './contatos-deals'
export * from './contatos-documents'
