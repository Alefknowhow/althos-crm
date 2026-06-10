import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Vitest config for unit tests of pure logic (no DB / no network).
 *
 * Scope: deterministic functions only — plan gating, billing math, webhook
 * signature verification, slug normalization. Server actions and RLS-bound
 * code are NOT covered here (they need a Supabase test instance).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
})
