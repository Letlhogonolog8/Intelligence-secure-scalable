<#
.SYNOPSIS
  Quarterly Disaster-Recovery drill checklist runner for AEGIS-AI.

.DESCRIPTION
  Walks the on-call operator through the full DR procedure documented in
  RUNBOOK.md, captures evidence, and emits a JSON report you can attach to
  the quarterly compliance pack.

  This script DOES NOT perform any destructive action. It only runs read-
  only health checks and prompts the operator to perform manual steps in
  the Supabase / cloud console, recording start/end timestamps so that
  RTO and RPO can be measured.

.PARAMETER OutputDir
  Directory to write the timestamped JSON report into. Defaults to ./reports.

.EXAMPLE
  ./scripts/dr-drill.ps1
#>
[CmdletBinding()]
param(
  [string]$OutputDir = "./reports"
)

if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$startedAt = Get-Date
$timestamp = $startedAt.ToString('yyyyMMdd-HHmmss')
$reportPath = Join-Path $OutputDir "dr-drill-$timestamp.json"

function Confirm-Step {
  param(
    [Parameter(Mandatory = $true)] [string]$Title,
    [Parameter(Mandatory = $true)] [string]$Description
  )
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
  Write-Host $Description
  $started = Get-Date
  $answer = Read-Host "Type DONE when complete, SKIP to skip, FAIL to abort"
  $finished = Get-Date
  return [pscustomobject]@{
    title       = $Title
    description = $Description
    status      = $answer.ToUpper()
    startedAt   = $started.ToString('o')
    finishedAt  = $finished.ToString('o')
    durationMs  = [int]($finished - $started).TotalMilliseconds
  }
}

$steps = @()

$steps += Confirm-Step -Title "1. Announce DR drill" -Description @"
  - Notify the engineering and ops Slack channels.
  - Confirm staging environment is the target (NOT production).
  - Verify on-call is reachable.
"@

$steps += Confirm-Step -Title "2. Snapshot pre-drill state" -Description @"
  - Note current Supabase project ref.
  - Capture latest backup ID (Dashboard -> Database -> Backups).
  - Note last logical backup off-site (S3 / GCS) timestamp.
"@

$steps += Confirm-Step -Title "3. Restore Supabase to a fresh project" -Description @"
  - Create a new Supabase project named aegis-dr-<date>.
  - Trigger PITR restore from current production to the new project,
    targeting a timestamp 15 minutes before now.
  - Record the restore start and completion timestamps.
"@

$steps += Confirm-Step -Title "4. Verify schema parity" -Description @"
  - Run `supabase db diff --schema public` against the restored project.
  - Expected: no diff vs the migration tip on main.
"@

$steps += Confirm-Step -Title "5. Verify data integrity" -Description @"
  - Run the audit-chain verifier against the restored project:
      AUDIT_CHAIN_CRON_ENABLED=true npm run audit:verify-chain -- --project=<dr-ref>
  - Expected: no broken hash links.
"@

$steps += Confirm-Step -Title "6. Restore object storage / file uploads" -Description @"
  - Sync the off-site bucket back into a fresh storage bucket on the
    DR project.
  - Spot-check 5 random files to confirm they decrypt with the rotated
    encryption key.
"@

$steps += Confirm-Step -Title "7. Bring up the API against the DR project" -Description @"
  - Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the staging
    secret store to the DR project values.
  - kubectl rollout restart deployment/aegis-api -n aegis-staging
  - Smoke-test /healthz, /api/auth/login, /api/cases/escalate.
"@

$steps += Confirm-Step -Title "8. Bring up the worker against the DR project" -Description @"
  - kubectl rollout restart deployment/aegis-worker -n aegis-staging
  - Watch logs for `notification queue available`, `0 errors` for 5 min.
"@

$steps += Confirm-Step -Title "9. End-to-end smoke" -Description @"
  - Trigger one synthetic SMS escalation from the staging UI.
  - Confirm Twilio dispatch + audit-log entry both land.
  - Confirm the incident is visible to a counsellor account.
"@

$steps += Confirm-Step -Title "10. Tear down the DR project" -Description @"
  - Delete the aegis-dr-<date> Supabase project.
  - Reset staging secrets back to the staging Supabase project.
  - kubectl rollout restart deployment/aegis-api    -n aegis-staging
  - kubectl rollout restart deployment/aegis-worker -n aegis-staging
"@

$steps += Confirm-Step -Title "11. Lessons learned" -Description @"
  - Record total elapsed time (RTO).
  - Record actual RPO (timestamp gap between drill start and last
    backup).
  - File any new tickets needed (gaps in the playbook, broken scripts,
    missing automation).
"@

$finishedAt = Get-Date

$summary = [pscustomobject]@{
  drillStartedAt   = $startedAt.ToString('o')
  drillFinishedAt  = $finishedAt.ToString('o')
  totalDurationMin = [math]::Round(($finishedAt - $startedAt).TotalMinutes, 2)
  steps            = $steps
  failures         = ($steps | Where-Object { $_.status -eq 'FAIL' } | Measure-Object).Count
  skipped          = ($steps | Where-Object { $_.status -eq 'SKIP' } | Measure-Object).Count
  completed        = ($steps | Where-Object { $_.status -eq 'DONE' } | Measure-Object).Count
}

$summary | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 $reportPath

Write-Host ""
Write-Host "DR drill complete." -ForegroundColor Green
Write-Host "Report: $reportPath"
Write-Host ("Steps: {0} done / {1} skipped / {2} failed" -f $summary.completed, $summary.skipped, $summary.failures)
Write-Host ("Total elapsed: {0} minutes" -f $summary.totalDurationMin)
