#Requires -RunAsAdministrator
# Installs the local fleet gateway on this Windows machine as a logon task.
# Run from this folder in an elevated PowerShell:  .\install-sophia.ps1
# It does NOT install cloudflared or create the Cloudflare Access app — see README.md.
$ErrorActionPreference = "Stop"
$node = (Get-Command node -ErrorAction Stop).Source
$ver = [version]((& $node --version).TrimStart('v'))
if ($ver -lt [version]"20.6.0") { throw "Node 20.6+ required (found $ver) for --env-file." }

$dataDir = Join-Path $env:ProgramData "AliaSpaces"
$envFile = Join-Path $dataDir "local-gateway.env"
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

if (-not (Test-Path $envFile)) {
  $bytes = New-Object byte[] 36
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $token = [Convert]::ToBase64String($bytes).Replace('+','-').Replace('/','_').TrimEnd('=')
  (Get-Content (Join-Path $PSScriptRoot "local-gateway.env.example")) `
    -replace '^LOCAL_GATEWAY_TOKEN=.*$', "LOCAL_GATEWAY_TOKEN=$token" | Set-Content -Encoding ascii $envFile
  Write-Host "Created $envFile with a fresh token."
  Write-Host "Set the same value as the Supabase secret LOCAL_GATEWAY_TOKEN (shown once):"
  Write-Host $token -ForegroundColor Yellow
} else {
  Write-Host "Keeping existing $envFile."
}
# Owner + SYSTEM only.
icacls $envFile /inheritance:r /grant:r "$($env:USERNAME):(R,W)" "SYSTEM:(R)" | Out-Null

$gateway = Join-Path $PSScriptRoot "gateway.mjs"
$action = New-ScheduledTaskAction -Execute $node -Argument "--env-file=`"$envFile`" `"$gateway`"" -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries
Register-ScheduledTask -TaskName "AliaSpaces Local Gateway" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName "AliaSpaces Local Gateway"
Start-Sleep -Seconds 2
try { $h = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8787/healthz -TimeoutSec 5; Write-Host "Gateway health: $($h.Content)" }
catch { Write-Warning "Gateway did not answer on 127.0.0.1:8787 yet. Check Task Scheduler > AliaSpaces Local Gateway." }
