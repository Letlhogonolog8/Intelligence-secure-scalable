<#
Apply Supabase SQL migrations for the AEGIS project.

Usage:
  - Dry run (show commands):
      .\scripts\apply-supabase-migrations.ps1

  - Attempt to run using Supabase CLI (requires `supabase` installed and logged in):
      .\scripts\apply-supabase-migrations.ps1 -UseSupabase

  - Attempt to run using psql (requires `PG_CONN` env var or `PGHOST/PGUSER/PGPASSWORD/PGDATABASE`):
      $env:PG_CONN = 'postgres://user:pass@host:5432/postgres'
      .\scripts\apply-supabase-migrations.ps1 -UsePsql

Notes:
  - Prefer running migrations from a staging environment (Supabase project dashboard or CI).
  - This script will not attempt destructive DROP CONSTRAINTs in production without confirmation.
#>

param(
  [switch]$UseSupabase,
  [switch]$UsePsql
)

Set-StrictMode -Version Latest

$migrationsPath = Join-Path $PSScriptRoot '..\supabase\migrations'
if (-not (Test-Path $migrationsPath)) {
  Write-Error "Migrations folder not found: $migrationsPath"
  exit 1
}

$files = Get-ChildItem -Path $migrationsPath -Filter *.sql | Sort-Object Name
if ($files.Count -eq 0) {
  Write-Host "No .sql files found in $migrationsPath"
  exit 0
}

Write-Host "Found $($files.Count) migration files:" -ForegroundColor Cyan
$files | ForEach-Object { Write-Host " - $($_.Name)" }

if (-not $UseSupabase -and -not $UsePsql) {
  Write-Host "\nDry run: commands to run shown below. To actually run, re-run with -UseSupabase or -UsePsql." -ForegroundColor Yellow
}

foreach ($file in $files) {
  $full = $file.FullName
  Write-Host "\n--- $($file.Name) ---" -ForegroundColor Green
  if ($UseSupabase) {
    if (Get-Command supabase -ErrorAction SilentlyContinue) {
      Write-Host "Running with Supabase CLI: supabase db query --file '$full'"
      supabase db query --file "$full" 2>&1 | Write-Host
      if ($LASTEXITCODE -ne 0) { Write-Error "Supabase CLI returned exit code $LASTEXITCODE"; exit $LASTEXITCODE }
    } else {
      Write-Error "Supabase CLI not found in PATH. Install it from https://supabase.com/docs/guides/cli"
      exit 1
    }
  } elseif ($UsePsql) {
    if ($env:PG_CONN) {
      Write-Host "Running with psql using PG_CONN: psql $env:PG_CONN -f '$full'"
      psql $env:PG_CONN -f "$full"
      if ($LASTEXITCODE -ne 0) { Write-Error "psql returned exit code $LASTEXITCODE"; exit $LASTEXITCODE }
    } else {
      Write-Host "psql command (requires PG_CONN env var or psql in PATH + env credentials)." -ForegroundColor Yellow
      Write-Host "Command: psql '<connection-string>' -f '$full'"
    }
  } else {
    Write-Host "supabase db query --file '$full'" -ForegroundColor Gray
    Write-Host "psql '<connection-string>' -f '$full'" -ForegroundColor Gray
  }
}

Write-Host "\nDone." -ForegroundColor Cyan
