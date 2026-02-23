$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "Building backend Docker image..."
docker build -f Dockerfile.backend -t ghcr.io/your-org/aegis-api:latest . -q
Write-Host "Backend build complete!"
Write-Host ""
Write-Host "Building frontend Docker image..."
docker build -f Dockerfile.frontend -t ghcr.io/your-org/aegis-frontend:latest . -q
Write-Host "Frontend build complete!"
