/**
 * Client-safe antispam constants — no server imports.
 * Import from here in 'use client' components instead of antispam.ts.
 */

// Browsers and bots both submit by name. We use a plausible-sounding name
// (not "honeypot") to defeat heuristics that strip obvious traps.
export const HONEYPOT_FIELD_NAME = '__hp_company_email'

// Minimum time (ms) between form mount and submit.
export const MIN_FILL_TIME_MS = 2000
