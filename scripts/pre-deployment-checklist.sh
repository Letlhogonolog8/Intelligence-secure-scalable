#!/bin/bash

# ============================================================================
# AEGIS-AI Pre-Deployment Checklist
# Validates environment and prerequisites before deployment
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
check_pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASSED++))
}

check_fail() {
  echo -e "${RED}✗${NC} $1"
  ((FAILED++))
}

check_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARNINGS++))
}

section() {
  echo ""
  echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
}

# ============================================================================
# SECTION 1: Code Quality
# ============================================================================
section "1. CODE QUALITY CHECKS"

# Check TypeScript strict mode
if grep -q '"strict": true' tsconfig.app.json; then
  check_pass "TypeScript strict mode enabled"
else
  check_fail "TypeScript strict mode NOT enabled"
fi

# Check ESLint configuration
if [ -f eslint.config.js ]; then
  check_pass "ESLint configuration found"
else
  check_fail "ESLint configuration missing"
fi

# Check .gitignore for secrets
if grep -q "\.env" .gitignore; then
  check_pass ".env files ignored in Git"
else
  check_fail ".env files NOT ignored"
fi

# Check for exposed secrets in git history
if git log -p --all | grep -i "VITE_SUPABASE_KEY" > /dev/null 2>&1; then
  check_fail "EXPOSED SECRETS found in Git history! Run: git clean -fd"
else
  check_pass "No secrets found in Git history"
fi

# ============================================================================
# SECTION 2: Dependencies
# ============================================================================
section "2. DEPENDENCIES"

# Check Node.js
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v)
  if [[ "$NODE_VERSION" == v20* ]]; then
    check_pass "Node.js $NODE_VERSION installed"
  else
    check_warn "Node.js $NODE_VERSION installed (recommend v20+)"
  fi
else
  check_fail "Node.js not installed"
fi

# Check npm
if command -v npm &> /dev/null; then
  NPM_VERSION=$(npm -v)
  check_pass "npm $NPM_VERSION installed"
else
  check_fail "npm not installed"
fi

# Check Docker
if command -v docker &> /dev/null; then
  DOCKER_VERSION=$(docker --version)
  check_pass "$DOCKER_VERSION"
else
  check_fail "Docker not installed"
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
  DC_VERSION=$(docker-compose --version)
  check_pass "$DC_VERSION"
else
  check_warn "docker-compose not installed (use 'docker compose' instead)"
fi

# Check kubectl (for K8s)
if command -v kubectl &> /dev/null; then
  KUBECTL_VERSION=$(kubectl version --client --short 2>/dev/null | head -1)
  check_pass "kubectl installed"
else
  check_warn "kubectl not installed (required for Kubernetes deployment)"
fi

# ============================================================================
# SECTION 3: Build Artifacts
# ============================================================================
section "3. BUILD ARTIFACTS"

# Check Dockerfile.frontend
if [ -f Dockerfile.frontend ]; then
  check_pass "Dockerfile.frontend exists"
else
  check_fail "Dockerfile.frontend missing"
fi

# Check Dockerfile.backend
if [ -f Dockerfile.backend ]; then
  check_pass "Dockerfile.backend exists"
else
  check_fail "Dockerfile.backend missing"
fi

# Check docker-compose files
if [ -f docker-compose.yml ]; then
  check_pass "docker-compose.yml exists"
else
  check_fail "docker-compose.yml missing"
fi

if [ -f docker-compose.prod.yml ]; then
  check_pass "docker-compose.prod.yml exists"
else
  check_fail "docker-compose.prod.yml missing"
fi

# Check nginx config
if [ -f nginx.conf ]; then
  check_pass "nginx.conf exists"
else
  check_fail "nginx.conf missing"
fi

# ============================================================================
# SECTION 4: Configuration
# ============================================================================
section "4. CONFIGURATION"

# Check .env exists
if [ -f .env ]; then
  check_pass ".env file exists"
  
  # Check for VITE_SUPABASE_URL
  if grep -q "VITE_SUPABASE_URL" .env; then
    check_pass "VITE_SUPABASE_URL configured"
  else
    check_fail "VITE_SUPABASE_URL not configured"
  fi
  
  # Check for VITE_SUPABASE_KEY
  if grep -q "VITE_SUPABASE_KEY" .env; then
    check_pass "VITE_SUPABASE_KEY configured"
  else
    check_fail "VITE_SUPABASE_KEY not configured"
  fi
else
  check_fail ".env file not found"
fi

# Check for .env.example
if [ -f .env.example ]; then
  check_pass ".env.example found (safe template)"
else
  check_warn ".env.example not found (create template for team)"
fi

# Check for .env.production
if [ -f .env.production ]; then
  check_warn ".env.production exists (should be git-ignored)"
else
  check_pass ".env.production not committed (good)"
fi

# ============================================================================
# SECTION 5: Database
# ============================================================================
section "5. DATABASE SETUP"

# Check for database migrations
if [ -d "supabase/migrations" ]; then
  MIGRATIONS=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l)
  if [ "$MIGRATIONS" -gt 0 ]; then
    check_pass "Database migrations found ($MIGRATIONS files)"
  else
    check_fail "No database migrations found"
  fi
else
  check_fail "supabase/migrations directory not found"
fi

# ============================================================================
# SECTION 6: Testing
# ============================================================================
section "6. TESTING"

# Check test files
if [ -d "src/__tests__" ] || [ -d "src/components/__tests__" ]; then
  TEST_FILES=$(find src -name "*.test.ts*" -o -name "*.spec.ts*" | wc -l)
  if [ "$TEST_FILES" -gt 0 ]; then
    check_pass "Test files found ($TEST_FILES)"
  else
    check_warn "No test files found (add unit tests)"
  fi
else
  check_warn "No test directory found"
fi

# Check for vitest config
if [ -f vitest.config.ts ]; then
  check_pass "vitest.config.ts configured"
else
  check_warn "vitest.config.ts not found"
fi

# ============================================================================
# SECTION 7: Security
# ============================================================================
section "7. SECURITY"

# Check for encryption keys
if grep -q "ENCRYPTION_KEY" .env; then
  check_pass "ENCRYPTION_KEY configured"
else
  check_fail "ENCRYPTION_KEY not configured"
fi

if grep -q "CHAT_ENCRYPTION_KEY" .env; then
  check_pass "CHAT_ENCRYPTION_KEY configured"
else
  check_fail "CHAT_ENCRYPTION_KEY not configured"
fi

# Check for security utilities
if grep -q "enterpriseSecurity" src/lib/*.ts; then
  check_pass "Enterprise security utilities imported"
else
  check_warn "Security utilities not being used"
fi

# Check .dockerignore
if [ -f .dockerignore ]; then
  check_pass ".dockerignore configured (reduces build context)"
else
  check_warn ".dockerignore not found"
fi

# ============================================================================
# SECTION 8: Documentation
# ============================================================================
section "8. DOCUMENTATION"

if [ -f DEPLOYMENT.md ]; then
  check_pass "DEPLOYMENT.md exists"
else
  check_fail "DEPLOYMENT.md missing"
fi

if [ -f RUNBOOK.md ]; then
  check_pass "RUNBOOK.md exists"
else
  check_warn "RUNBOOK.md not found"
fi

if [ -f OPERATOR_PLAYBOOK.md ]; then
  check_pass "OPERATOR_PLAYBOOK.md exists"
else
  check_warn "OPERATOR_PLAYBOOK.md not found"
fi

if [ -f SECURITY.md ]; then
  check_pass "SECURITY.md exists"
else
  check_warn "SECURITY.md not found"
fi

# ============================================================================
# SECTION 9: Scripts
# ============================================================================
section "9. DEPLOYMENT SCRIPTS"

# Check for build script
if [ -f scripts/docker-build.sh ]; then
  check_pass "docker-build.sh exists"
  if [ -x scripts/docker-build.sh ]; then
    check_pass "docker-build.sh is executable"
  else
    check_warn "docker-build.sh needs chmod +x"
  fi
else
  check_fail "docker-build.sh missing"
fi

# ============================================================================
# SECTION 10: Environment Setup
# ============================================================================
section "10. ENVIRONMENT SETUP"

# Check if running in development mode
if [ "$NODE_ENV" == "production" ]; then
  check_warn "NODE_ENV is set to production (development recommended for initial setup)"
elif [ -z "$NODE_ENV" ]; then
  check_pass "NODE_ENV not set (defaults to development)"
else
  check_pass "NODE_ENV set to $NODE_ENV"
fi

# ============================================================================
# SUMMARY
# ============================================================================
section "SUMMARY"

TOTAL=$((PASSED + FAILED + WARNINGS))
PASS_PCT=$((PASSED * 100 / TOTAL))

echo ""
echo "Total Checks: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}Failed: $FAILED${NC}"
fi
if [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
fi
echo ""
echo "Pass Rate: $PASS_PCT%"
echo ""

# Recommendations
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All critical checks passed!${NC}"
  echo ""
  echo "Next Steps:"
  echo "1. Run tests: npm run test"
  echo "2. Build Docker images: ./scripts/docker-build.sh"
  echo "3. Deploy locally: docker-compose up --build"
  echo "4. Run security scan: ./scripts/docker-build.sh --scan"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Some checks failed. Please fix issues above before proceeding.${NC}"
  echo ""
  exit 1
fi
