#!/bin/bash

# ============================================================================
# AEGIS-AI Docker Build Script
# Builds and optionally pushes Docker images to registry
# ============================================================================

set -e

# Configuration
REGISTRY=${REGISTRY:-"docker.io"}
NAMESPACE=${NAMESPACE:-"aegis-ai"}
VERSION=${VERSION:-"1.0.0"}
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
GIT_COMMIT=$(git rev-parse --short HEAD)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

usage() {
  cat << EOF
Usage: $0 [OPTIONS]

Options:
  -h, --help              Show this help message
  -v, --version VERSION   Docker image version (default: 1.0.0)
  -r, --registry REGISTRY Docker registry (default: docker.io)
  -n, --namespace NS      Docker namespace (default: aegis-ai)
  -p, --push              Push images to registry
  -f, --frontend          Build only frontend image
  -b, --backend           Build only backend image
  --frontend-nginx        Build frontend with nginx variant
  --scan                  Run security scanning (requires Trivy)

Examples:
  # Build both images locally
  $0

  # Build and push with custom version
  $0 --version 1.2.3 --push

  # Build only backend
  $0 --backend

  # Build with security scanning
  $0 --scan --push

EOF
  exit 0
}

# Parse arguments
BUILD_FRONTEND=true
BUILD_BACKEND=true
PUSH=false
SCAN=false
FRONTEND_NGINX=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      usage
      ;;
    -v|--version)
      VERSION="$2"
      shift 2
      ;;
    -r|--registry)
      REGISTRY="$2"
      shift 2
      ;;
    -n|--namespace)
      NAMESPACE="$2"
      shift 2
      ;;
    -p|--push)
      PUSH=true
      shift
      ;;
    -f|--frontend)
      BUILD_FRONTEND=true
      BUILD_BACKEND=false
      shift
      ;;
    -b|--backend)
      BUILD_FRONTEND=false
      BUILD_BACKEND=true
      shift
      ;;
    --frontend-nginx)
      FRONTEND_NGINX=true
      shift
      ;;
    --scan)
      SCAN=true
      shift
      ;;
    *)
      log_error "Unknown option: $1"
      usage
      ;;
  esac
done

# Display configuration
log_info "Docker Build Configuration"
echo "  Registry: $REGISTRY"
echo "  Namespace: $NAMESPACE"
echo "  Version: $VERSION"
echo "  Build Date: $BUILD_DATE"
echo "  Git Commit: $GIT_COMMIT"
echo "  Git Branch: $GIT_BRANCH"
echo "  Push to Registry: $PUSH"
echo "  Security Scan: $SCAN"
echo ""

# Check prerequisites
check_prerequisites() {
  if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    exit 1
  fi

  if [ "$SCAN" = true ]; then
    if ! command -v trivy &> /dev/null; then
      log_warning "Trivy is not installed. Skipping security scanning."
      log_info "Install with: https://github.com/aquasecurity/trivy"
      SCAN=false
    fi
  fi

  log_success "Prerequisites check passed"
}

# Build frontend image
build_frontend() {
  log_info "Building frontend image..."

  local DOCKERFILE="Dockerfile.frontend"
  if [ "$FRONTEND_NGINX" = true ]; then
    DOCKERFILE="Dockerfile.frontend.nginx"
  fi

  local IMAGE_TAG="$REGISTRY/$NAMESPACE/frontend:$VERSION"
  local LATEST_TAG="$REGISTRY/$NAMESPACE/frontend:latest"

  docker build \
    -f "$DOCKERFILE" \
    -t "$IMAGE_TAG" \
    -t "$LATEST_TAG" \
    --build-arg BUILD_DATE="$BUILD_DATE" \
    --build-arg VERSION="$VERSION" \
    --build-arg VCS_REF="$GIT_COMMIT" \
    --label "git.branch=$GIT_BRANCH" \
    --label "git.commit=$GIT_COMMIT" \
    --label "build.date=$BUILD_DATE" \
    .

  log_success "Frontend image built: $IMAGE_TAG"

  # Run security scan if enabled
  if [ "$SCAN" = true ]; then
    log_info "Scanning frontend image for vulnerabilities..."
    trivy image --severity HIGH,CRITICAL "$IMAGE_TAG" || log_warning "Vulnerabilities found in frontend image"
  fi
}

# Build backend image
build_backend() {
  log_info "Building backend image..."

  local IMAGE_TAG="$REGISTRY/$NAMESPACE/backend:$VERSION"
  local LATEST_TAG="$REGISTRY/$NAMESPACE/backend:latest"

  docker build \
    -f Dockerfile.backend \
    -t "$IMAGE_TAG" \
    -t "$LATEST_TAG" \
    --build-arg BUILD_DATE="$BUILD_DATE" \
    --build-arg VERSION="$VERSION" \
    --build-arg VCS_REF="$GIT_COMMIT" \
    --label "git.branch=$GIT_BRANCH" \
    --label "git.commit=$GIT_COMMIT" \
    --label "build.date=$BUILD_DATE" \
    .

  log_success "Backend image built: $IMAGE_TAG"

  # Run security scan if enabled
  if [ "$SCAN" = true ]; then
    log_info "Scanning backend image for vulnerabilities..."
    trivy image --severity HIGH,CRITICAL "$IMAGE_TAG" || log_warning "Vulnerabilities found in backend image"
  fi
}

# Push images to registry
push_images() {
  if [ "$PUSH" != true ]; then
    return
  fi

  log_info "Pushing images to registry..."

  if [ "$BUILD_FRONTEND" = true ]; then
    log_info "Pushing frontend images..."
    docker push "$REGISTRY/$NAMESPACE/frontend:$VERSION"
    docker push "$REGISTRY/$NAMESPACE/frontend:latest"
    log_success "Frontend images pushed"
  fi

  if [ "$BUILD_BACKEND" = true ]; then
    log_info "Pushing backend images..."
    docker push "$REGISTRY/$NAMESPACE/backend:$VERSION"
    docker push "$REGISTRY/$NAMESPACE/backend:latest"
    log_success "Backend images pushed"
  fi
}

# Display summary
display_summary() {
  echo ""
  log_success "Build completed successfully!"
  echo ""
  echo "Image Summary:"
  
  if [ "$BUILD_FRONTEND" = true ]; then
    echo "  Frontend: $REGISTRY/$NAMESPACE/frontend:$VERSION"
  fi
  
  if [ "$BUILD_BACKEND" = true ]; then
    echo "  Backend: $REGISTRY/$NAMESPACE/backend:$VERSION"
  fi

  if [ "$PUSH" = true ]; then
    echo ""
    echo "Images have been pushed to the registry."
  else
    echo ""
    echo "Images are available locally. To push to registry, use:"
    echo "  $0 --version $VERSION --push"
  fi
}

# Main execution
main() {
  check_prerequisites

  if [ "$BUILD_FRONTEND" = true ]; then
    build_frontend
  fi

  if [ "$BUILD_BACKEND" = true ]; then
    build_backend
  fi

  push_images
  display_summary
}

# Run main function
main
