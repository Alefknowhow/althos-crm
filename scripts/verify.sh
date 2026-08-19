#!/usr/bin/env bash
# scripts/verify.sh — Verification Engine do Althos Harness
#
# Roda só o que existe de verdade no projeto (confirmado em package.json).
# Não inventa comando pra suíte que não existe — reporta NOT CONFIGURED.
# Nunca mascara falha: qualquer passo que reprovar marca o script inteiro
# como FAIL no final, mas os passos seguintes ainda rodam (pra dar o
# quadro completo numa única execução, em vez de parar no primeiro erro).

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

OVERALL_STATUS="PASS"
declare -a RESULTS=()

record() {
  # record <nome> <PASS|FAIL|NOT CONFIGURED>
  RESULTS+=("$1: $2")
  if [ "$2" = "FAIL" ]; then
    OVERALL_STATUS="FAIL"
  fi
}

section() {
  echo ""
  echo "── $1 ──────────────────────────────────────────────"
}

# ── 1. Environment check ─────────────────────────────────────────────────
section "1. Environment check"
if command -v node >/dev/null 2>&1; then
  NODE_VERSION="$(node -v)"
  echo "node: $NODE_VERSION"
  record "environment (node)" "PASS"
else
  echo "node não encontrado no PATH"
  record "environment (node)" "FAIL"
fi

if command -v npm >/dev/null 2>&1; then
  echo "npm: $(npm -v)"
  record "environment (npm)" "PASS"
else
  echo "npm não encontrado no PATH"
  record "environment (npm)" "FAIL"
fi

# ── 2. Dependency integrity ──────────────────────────────────────────────
section "2. Dependency integrity"
if [ -d node_modules ] && [ -f package-lock.json ]; then
  echo "node_modules presente, package-lock.json presente."
  record "dependency integrity" "PASS"
else
  echo "node_modules ou package-lock.json ausente — rode 'npm ci'."
  record "dependency integrity" "FAIL"
fi

# ── 3. Typecheck ──────────────────────────────────────────────────────────
section "3. Typecheck (tsc --noEmit)"
if npx tsc --noEmit; then
  record "typecheck" "PASS"
else
  record "typecheck" "FAIL"
fi

# ── 4. Lint ───────────────────────────────────────────────────────────────
section "4. Lint (next lint)"
if npm run lint; then
  record "lint" "PASS"
else
  record "lint" "FAIL"
fi

# ── 5. Unit tests ─────────────────────────────────────────────────────────
section "5. Unit tests (vitest)"
if npm test; then
  record "unit tests" "PASS"
else
  record "unit tests" "FAIL"
fi

# ── 6. Integration tests ─────────────────────────────────────────────────
section "6. Integration tests"
echo "Não há suíte de integração configurada neste projeto (sem script em package.json)."
record "integration tests" "NOT CONFIGURED"

# ── 7. Security tests ─────────────────────────────────────────────────────
section "7. Security tests"
echo "Não há suíte de segurança dedicada. tests/unit/antispam.test.ts e"
echo "tests/unit/webhook.test.ts cobrem lógica security-adjacent, mas não"
echo "substituem uma suíte de segurança (IDOR, RLS, autorização) real."
record "security tests" "NOT CONFIGURED"

# ── 8. E2E ────────────────────────────────────────────────────────────────
section "8. E2E"
echo "Sem Playwright/Cypress configurado neste projeto."
record "E2E" "NOT CONFIGURED"

# ── 9. Production build ──────────────────────────────────────────────────
section "9. Production build (npm run build)"
echo "Aviso: o build real precisa das env vars de Supabase (ver .github/workflows/ci.yml)."
echo "Rodando mesmo assim — pode falhar por env ausente em vez de erro de código."
if npm run build; then
  record "production build" "PASS"
else
  record "production build" "FAIL"
fi

# ── 10. Git status ───────────────────────────────────────────────────────
section "10. Git status"
git status --short || true
record "git status" "PASS"

# ── 11. Git diff summary ─────────────────────────────────────────────────
section "11. Git diff summary"
git diff --stat || true
record "git diff summary" "PASS"

# ── Summary ───────────────────────────────────────────────────────────────
section "SUMMARY"
for r in "${RESULTS[@]}"; do
  echo "  - $r"
done

echo ""
echo "RESULT: $OVERALL_STATUS"

if [ "$OVERALL_STATUS" = "FAIL" ]; then
  exit 1
fi
exit 0
