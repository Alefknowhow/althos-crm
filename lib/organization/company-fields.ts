/**
 * Plain constant shared by organization-general.ts and
 * organization-accounts.ts. Moved out of organization-general.ts because a
 * 'use server' file can only export async functions -- an array literal
 * (COMPANY_FIELDS) isn't one, even though it isn't a function-shaped
 * problem you'd normally think to look for.
 */
export const COMPANY_FIELDS = [
  'cnpj', 'cadastur', 'contact_phone', 'contact_email', 'instagram', 'website',
  'address_street', 'address_city', 'address_state', 'address_zip',
] as const

export type OrgCompanyData = Record<(typeof COMPANY_FIELDS)[number], string>
