$ErrorActionPreference = "Stop"

$taskRepo = Split-Path -Parent $PSScriptRoot
$taskContainer = "mypersonas-creative-library-test"
$taskCreated = $false

$taskExisting = @(& docker ps -a --format "{{.Names}}")
if ($LASTEXITCODE -ne 0) { throw "Docker is required for the creative library SQL runtime test." }
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
    "tests/sql/creative-library-seed.sql",
    "supabase/migrations/20261013155606_private_creative_media_library.sql",
    "supabase/migrations/20261013155606_private_creative_media_library.sql",
    "tests/sql/creative-library-runtime.sql"
  )
  foreach ($taskRelative in $taskFiles) {
    $taskPath = Join-Path $taskRepo $taskRelative
    Get-Content -LiteralPath $taskPath -Raw | & docker exec -i $taskContainer psql --set=ON_ERROR_STOP=1 -U postgres -d postgres
    if ($LASTEXITCODE -ne 0) { throw "SQL verification failed while applying $taskRelative" }
  }
  Write-Output "Creative library migration applied and reapplied; owner isolation, AAL2, immutable paths and foreign persona/version assertions passed."
}
finally {
  if ($taskCreated) { & docker rm --force $taskContainer | Out-Null }
}
