<#
.SYNOPSIS
  Generates cryptographically secure secrets for AEGIS-AI deployment.

.DESCRIPTION
  Produces six secrets required by the platform:
    - ENCRYPTION_KEY            (32 bytes, hex)
    - CHAT_ENCRYPTION_KEY       (32 bytes, hex)
    - JWT_SECRET                (32 bytes, hex)
    - REFRESH_TOKEN_SECRET      (32 bytes, hex)
    - METRICS_TOKEN             (32 bytes, hex)
    - TELKOM_WEBHOOK_SECRET     (32 bytes, hex)
    - SCAN_PRECOMMIT_TOKEN      (16 bytes, hex)  (optional helper)

  Output formats:
    - PowerShell SetEnv block (default)
    - .env line block (use -EnvFile)
    - JSON object (use -Json) - safe to pipe into a secret manager

.EXAMPLE
  ./scripts/generate-keys.ps1 -EnvFile | Out-File -Encoding utf8 .env.local

.EXAMPLE
  ./scripts/generate-keys.ps1 -Json | aws secretsmanager put-secret-value `
    --secret-id aegis-prod --secret-string file:///dev/stdin
#>
[CmdletBinding()]
param(
  [switch]$EnvFile,
  [switch]$Json,
  [switch]$Quiet
)

function New-SecretHex {
  param([int]$Bytes = 32)
  $buffer = New-Object byte[] $Bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($buffer) } finally { $rng.Dispose() }
  -join ($buffer | ForEach-Object { '{0:x2}' -f $_ })
}

$secrets = [ordered]@{
  ENCRYPTION_KEY        = New-SecretHex -Bytes 32
  CHAT_ENCRYPTION_KEY   = New-SecretHex -Bytes 32
  JWT_SECRET            = New-SecretHex -Bytes 32
  REFRESH_TOKEN_SECRET  = New-SecretHex -Bytes 32
  METRICS_TOKEN         = New-SecretHex -Bytes 32
  TELKOM_WEBHOOK_SECRET = New-SecretHex -Bytes 32
  SCAN_PRECOMMIT_TOKEN  = New-SecretHex -Bytes 16
}

if ($Json) {
  $secrets | ConvertTo-Json
  return
}

if ($EnvFile) {
  foreach ($k in $secrets.Keys) {
    "${k}=$($secrets[$k])"
  }
  return
}

if (-not $Quiet) {
  Write-Host ""
  Write-Host "AEGIS-AI cryptographic secrets" -ForegroundColor Cyan
  Write-Host "==============================" -ForegroundColor Cyan
  Write-Host "Treat these as production credentials. Do NOT paste them into chat, email, or commit them."
  Write-Host ""
}

foreach ($k in $secrets.Keys) {
  "{0,-22} = {1}" -f $k, $secrets[$k]
}

if (-not $Quiet) {
  Write-Host ""
  Write-Host "Next steps:" -ForegroundColor Yellow
  Write-Host "  1. Paste each value into your platform's secret store (Render env group, K8s Secret, etc.)."
  Write-Host "  2. NEVER reuse values across staging/production/dev."
  Write-Host "  3. Document the rotation date in SECURITY.md (Rotation cadence section)."
  Write-Host ""
}
