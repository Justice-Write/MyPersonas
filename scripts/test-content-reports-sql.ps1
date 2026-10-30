$ErrorActionPreference = "Stop"

# Runs scripts/test-content-reports-sql.sh inside a disposable postgres:16
# container, so Windows and Linux use the same checks. The repository is
# mounted read-only; nothing persists after the run.
$taskRepo = Split-Path -Parent $PSScriptRoot

& docker version --format "{{.Server.Version}}" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Docker is required for the content report SQL runtime test." }

& docker run --rm --user postgres --volume "${taskRepo}:/repo:ro" --entrypoint bash postgres:16 /repo/scripts/test-content-reports-sql.sh
if ($LASTEXITCODE -ne 0) { throw "Content report SQL verification failed." }
Write-Output "Content report migration 080 applied and reapplied; reporting, block rules, staff AAL2, recusal, races and the 081 holds draft passed."
