$ErrorActionPreference = "Stop"

$taskRepo = Split-Path -Parent $PSScriptRoot
$taskContainer = "mypersonas-backend-edit-078-test"
$taskCreated = $false

$taskExisting = @(& docker ps -a --format "{{.Names}}")
if ($LASTEXITCODE -ne 0) { throw "Docker is required for the backend URL edit SQL runtime test." }
if ($taskExisting -contains $taskContainer) {
  throw "Container '$taskContainer' already exists. Remove or rename it before running this disposable test."
}

try {
  & docker run --detach --name $taskContainer --env POSTGRES_PASSWORD=postgres postgres:16 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not start the disposable PostgreSQL container." }
  $taskCreated = $true
  $taskReady = $false
  for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt += 1) {
    & docker exec $taskContainer pg_isready -U postgres | Out-Null
    if ($LASTEXITCODE -eq 0) { $taskReady = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $taskReady) { throw "Disposable PostgreSQL did not become ready." }

  $taskFiles = @(
    "tests/sql/078-ai-backend-edit-seed.sql",
    "MyPersonas.Online_v0/sql-updates/078-edit-ai-backend-base-url.sql",
    "MyPersonas.Online_v0/sql-updates/078-edit-ai-backend-base-url.sql",
    "tests/sql/078-ai-backend-edit-runtime.sql"
  )
  foreach ($taskRelative in $taskFiles) {
    $taskPath = Join-Path $taskRepo $taskRelative
    Get-Content -LiteralPath $taskPath -Raw | & docker exec -i $taskContainer psql --set=ON_ERROR_STOP=1 -U postgres -d postgres
    if ($LASTEXITCODE -ne 0) { throw "SQL verification failed while applying $taskRelative" }
  }
  Write-Output "Migration 078 applied and reapplied; owner, foreign-owner, AAL2 and key-preservation assertions passed in the disposable fixture."
}
finally {
  if ($taskCreated) { & docker rm --force $taskContainer | Out-Null }
}
