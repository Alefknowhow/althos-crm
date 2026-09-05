/**
 * Contatos — entidade única de contato. "cliente" é apenas um status
 * (lead | cliente | inativo). Os dados antes em customer_profiles agora
 * são colunas de contatos; documentos referenciam contato_id.
 *
 * This file is a barrel: the actions themselves live in the
 * actions/contatos-{leads,pipeline,bulk,customers,contactpoints,avatar,deals,
 * documents}.ts modules (split out because this file had grown past the
 * project's per-file size budget). No 'use server' directive is needed
 * here — it only re-exports async functions defined in files that each
 * carry their own 'use server'.
 *
 * contatos-shared.ts is deliberately NOT re-exported here: it has no 'use
 * server' of its own (it exports FROZEN_ERROR, a plain string constant,
 * which a 'use server' file can't do) and is meant to be imported directly
 * by other action files, not through this client-facing barrel — routing it
 * through `export *` here used to drag next/headers into the client bundle
 * of anything importing from '@/actions/contatos' (e.g. LeadCard.tsx).
 */

export * from './contatos-leads'
export * from './contatos-pipeline'
export * from './contatos-bulk'
export * from './contatos-customers'
export * from './contatos-contactpoints'
export * from './contatos-avatar'
export * from './contatos-deals'
export * from './contatos-documents'
