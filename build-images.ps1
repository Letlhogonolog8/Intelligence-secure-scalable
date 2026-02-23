$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "================================================"
Write-Host "Building AEGIS-AI Docker Images"
Write-Host "================================================"
Write-Host ""

Write-Host "[1/2] Building backend API image..."
Write-Host "Tag: ghcr.io/your-org/aegis-api:latest"
docker build -f Dockerfile.backend -t ghcr.io/your-org/aegis-api:latest . 2>&1 | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Backend build successful!" -ForegroundColor Green
Write-Host ""

Write-Host "[2/2] Building frontend image..."
Write-Host "Tag: ghcr.io/your-org/aegis-frontend:latest"
docker build -f Dockerfile.frontend -t ghcr.io/your-org/aegis-frontend:latest . 2>&1 | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Frontend build successful!" -ForegroundColor Green
Write-Host ""

Write-Host "================================================"
Write-Host "Verifying built images..."
Write-Host "================================================"
docker images | grep aegis

Write-Host ""
Write-Host "✅ All builds completed successfully!"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Push images: docker push ghcr.io/your-org/aegis-api:latest"
Write-Host "  2. Deploy: kubectl apply -f kubernetes/"
