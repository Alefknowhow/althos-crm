// Fast lint tier. Everything here runs without type information, which is
// what keeps it quick enough for a pre-commit hook. The rules that need the
// type checker live in eslint.typed.config.mjs and run on their own script.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

import quality from "./eslint-rules/index.cjs";

// eslint-config-next@14.2.3 (pinned to this project's Next 14) has a hard
// peer dependency on eslint ^7||^8 and cannot be loaded under ESLint 9, even
// through FlatCompat -- its own nested plugins (eslint-plugin-react-hooks,
// eslint-plugin-jsx-a11y) fail to install against eslint@9. Bridging it back
// in is a Next 15 upgrade, which is out of scope here. See the report for
// the fallout: files with `eslint-disable` comments naming next/react-hooks/
// jsx-a11y rules now fail with "Definition for rule ... was not found".
export default defineConfig([
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
      // Next.js App Router files run in both the Node server runtime and the
      // browser depending on "use client" — union of both globals covers
      // both without per-file split.
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.strict,

  {
    files: ["**/*.{js,jsx,ts,tsx,mjs,cjs}"],
    plugins: { quality },
    rules: {
      // Zero violations -- stay "error". The seven rules below were at
      // "warn" with a measured baseline; the 2026-09-04 burndown (option B:
      // fix the mechanical majority, track no-explicit-any as debt instead
      // of chasing it) took each of them to zero, so they're promoted back.
      // Do not raise a count here by hand -- rerun the linter.
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-var": "error",
      "prefer-const": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-dynamic-delete": "error",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-unused-expressions": "error",
      "@typescript-eslint/no-invalid-void-type": "error",
      "no-irregular-whitespace": "error",
      // Tracked debt (option B at the burndown decision gate): 1542
      // violations across 360 files, ~51% of the warning count at the time.
      // Deliberately NOT pursued occurrence-by-occurrence -- each one is a
      // real type to work out, not a mechanical fix, and many sit at
      // genuinely hard-to-type boundaries (webhook payloads, third-party API
      // responses). Left at "warn" until a separate, scoped pass.
      "@typescript-eslint/no-explicit-any": "warn",
      // Not part of this burndown -- each needs its own scoped decision
      // (no-non-null-assertion: case-by-case null-safety review;
      // no-direct-console: no logger exists yet, needs one chosen first;
      // no-direct-data-access: needs a repository/service layer per file).
      "@typescript-eslint/no-non-null-assertion": "warn", // baseline: 156
      // The size and complexity budget is all "warn" on purpose. These
      // numbers are a conversation starter about factoring, not a gate --
      // promote one to "error" once the count for it reaches zero.
      complexity: ["warn", 12],
      "max-depth": ["warn", 4],
      "max-statements": ["warn", 20],
      "max-params": ["warn", 4],
      "max-lines-per-function": [
        "warn",
        { max: 150, skipBlankLines: true, skipComments: true },
      ],
      "max-nested-callbacks": ["warn", 3],
      // baseline: 90 files over budget -- too many for the `ignore` escape
      // hatch to mean anything, so it starts at "warn" like every other
      // measured rule. See docs/eslint-baseline.md for the full file list.
      "quality/max-lines": ["warn", { max: 350 }],
      "quality/no-direct-console": [
        "warn", // baseline: 184
        { logger: "the project logging helper" },
      ],
      "quality/no-direct-data-access": [
        "warn", // baseline: 56
        {
          modules: ["@/lib/supabase/server", "@/lib/supabase/client"],
          bindings: ["createClient", "createAdminClient"],
          layers: ["/app/", "/components/"],
          extensions: [".tsx"],
        },
      ],
    },
  },
  {
    // The same file budget for test files, at "warn". Placed after the
    // "error" block above for ordering reasons: for a file matched by both,
    // flat config applies the later block's rules last, so a "warn" placed
    // earlier would be silently overridden by the "error" that follows it.
    files: [
      "**/*.test.{ts,tsx}",
      "**/{__tests__,__mocks__,fixtures,mocks}/**/*.{ts,tsx}",
    ],
    plugins: { quality },
    rules: {
      "quality/max-lines": ["warn", { max: 350, includeTests: true }],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      // These three fire heavily on describe/it nesting and on long arrange
      // sections without pointing at a real problem. complexity, max-depth
      // and max-params stay on for tests -- they were not part of the noise.
      "max-statements": "off",
      "max-lines-per-function": "off",
      "max-nested-callbacks": "off",
    },
  },
  {
    files: ["eslint-rules/**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { module: "readonly", require: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  globalIgnores([
    ".harness/**",
    ".github/**",
    "node_modules/**",
    ".next/**",
    "dist/**",
    "build/**",
    "coverage/**",
    "**/*.tsbuildinfo",
    "package-lock.json",
    "scratch/**",
    "public/**",
  ]),
]);
