/**
 * Organization actions -- barrel. Split across four files (each carries its
 * own 'use server'; this file only re-exports, so it doesn't need one):
 *   - organization-setup.ts: unique slug, create org, AI qualifier config,
 *     onboarding completion
 *   - organization-general.ts: name/niche, appearance, company data,
 *     monthly revenue goal
 *   - organization-accounts.ts: account-level org management (list/rename/
 *     update company by org id)
 *   - organization-meta.ts: Meta/Facebook integration config, org deletion
 */

export * from './organization-setup'
export * from './organization-general'
export * from './organization-accounts'
export * from './organization-meta'
