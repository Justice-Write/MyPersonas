# deploy-nooyouniverse.ps1 - preview or publish nooyouniverse.com
#
# Run from the canonical MyPersonas main checkout:
#   & "$HOME\Documents\GitHub\MyPersonas\_ops\deploy-nooyouniverse.ps1"
#
# The default is a read-only preview. Publishing is permitted only after the
# exact source change has been reviewed and merged to origin/main:
#   & "$HOME\Documents\GitHub\MyPersonas\_ops\deploy-nooyouniverse.ps1" -Publish -Message "nooyouniverse.com: approved release"
#
# Publish order:
#   1. Fail unless both repositories are clean main checkouts at origin/main.
#   2. Mirror the explicit public manifest and assets from canonical source.
#   3. Remove deploy-only public artifacts so retired files cannot remain live.
#   4. Commit and push only the deploy repository.
#   5. Require Cloudflare build and live-route/header readback; the Git hook is
#      configured but has previously failed to trigger.
#
# This helper never commits or pushes MyPersonas. Use its protected pull-request
# workflow first. Architecture and gates: nooyouniverse.com\SITE-ROADMAP.md

param(
  [string]$Message,
  [string]$DeployRepo,
  [switch]$Publish,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$Preview = -not $Publish
if ($Publish -and $DryRun) { throw "Choose either -Publish or -DryRun, not both." }
if ($DryRun) { $Preview = $true }
if ($Publish -and [string]::IsNullOrWhiteSpace($Message)) {
  throw "Publishing requires an explicit -Message describing the approved release."
}

$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "nooyouniverse.com"
$defaultDeploy = Join-Path (Split-Path -Parent $root) "nooyouniverse"
$deploy = if ([string]::IsNullOrWhiteSpace($DeployRepo)) {
  $defaultDeploy
} else {
  [System.IO.Path]::GetFullPath($DeployRepo)
}
$pub = Join-Path $deploy "public"

$pages = @(
  "index.html",
  "log.html",
  "sources.html",
  "corrections.html",
  "404.html",
  "robots.txt",
  "sitemap.xml",
  "CNAME",
  "_headers"
)

function Invoke-Git {
  param(
    [Parameter(Mandatory)][string]$Repo,
    [Parameter(Mandatory)][string[]]$Arguments
  )

  $output = & git -C $Repo @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    $details = $output -join [Environment]::NewLine
    throw ("Git failed in " + $Repo + " (" + ($Arguments -join " ") + ")" + [Environment]::NewLine + $details)
  }
  return @($output)
}

function Assert-ExpectedOrigin {
  param(
    [Parameter(Mandatory)][string]$Repo,
    [Parameter(Mandatory)][string]$ExpectedSlug,
    [Parameter(Mandatory)][string]$Label
  )

  $originUrl = (Invoke-Git $Repo @("remote", "get-url", "origin") | Select-Object -First 1).Trim()
  $normalized = $originUrl.Replace("\", "/").TrimEnd("/")
  if ($normalized.EndsWith(".git", [System.StringComparison]::OrdinalIgnoreCase)) {
    $normalized = $normalized.Substring(0, $normalized.Length - 4)
  }
  $allowedOrigins = @(
    "https://github.com/$ExpectedSlug",
    "git@github.com:$ExpectedSlug",
    "ssh://git@github.com/$ExpectedSlug"
  )
  $originMatches = $false
  foreach ($allowedOrigin in $allowedOrigins) {
    if ($normalized.Equals($allowedOrigin, [System.StringComparison]::OrdinalIgnoreCase)) {
      $originMatches = $true
      break
    }
  }
  if (-not $originMatches) {
    throw "$Label origin is unexpected: $originUrl"
  }
}

function Assert-CleanMainAtOrigin {
  param(
    [Parameter(Mandatory)][string]$Repo,
    [Parameter(Mandatory)][string]$Label
  )

  if (-not (Test-Path -LiteralPath (Join-Path $Repo ".git"))) {
    throw "$Label is not a Git checkout: $Repo"
  }

  Invoke-Git $Repo @("fetch", "--quiet", "origin", "main") | Out-Null
  $branch = (Invoke-Git $Repo @("branch", "--show-current") | Select-Object -First 1).Trim()
  if ($branch -ne "main") {
    throw "$Label must be on main before publication; current branch is '$branch'."
  }

  $status = @(Invoke-Git $Repo @("status", "--porcelain"))
  if ($status.Count -gt 0 -and ($status -join "").Trim().Length -gt 0) {
    throw "$Label must be clean before publication. Review or preserve its local changes first."
  }

  $head = (Invoke-Git $Repo @("rev-parse", "HEAD") | Select-Object -First 1).Trim()
  $originMain = (Invoke-Git $Repo @("rev-parse", "origin/main") | Select-Object -First 1).Trim()
  if ($head -ne $originMain) {
    throw "$Label must exactly match origin/main before publication. Local HEAD: $head; origin/main: $originMain"
  }
}

function Get-FileHashOrMissing {
  param([Parameter(Mandatory)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return "MISSING" }
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash
}

function Get-FilteredGitBlobOrMissing {
  param(
    [Parameter(Mandatory)][string]$Repo,
    [Parameter(Mandatory)][string]$RepositoryPath,
    [Parameter(Mandatory)][string]$FilePath
  )
  if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) { return "MISSING" }
  return (Invoke-Git $Repo @("hash-object", "--path=$RepositoryPath", $FilePath) | Select-Object -First 1).Trim()
}

function Get-RelativeFiles {
  param([Parameter(Mandatory)][string]$Root)
  if (-not (Test-Path -LiteralPath $Root -PathType Container)) { return @() }
  $rootPath = [System.IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
  $rootUri = New-Object System.Uri($rootPath)
  return @(
    Get-ChildItem -LiteralPath $Root -Force -Recurse -File |
      ForEach-Object {
        $fileUri = New-Object System.Uri([System.IO.Path]::GetFullPath($_.FullName))
        [System.Uri]::UnescapeDataString($rootUri.MakeRelativeUri($fileUri).ToString()).Replace('/', '\')
      } |
      Sort-Object
  )
}

function Assert-ChildPath {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Parent
  )

  $fullPath = [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
  $fullParent = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\')
  if (-not $fullPath.StartsWith($fullParent + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to modify a path outside the public directory: $fullPath"
  }
}

if (-not (Test-Path -LiteralPath $src -PathType Container)) {
  throw "Source directory not found: $src"
}
if (-not (Test-Path -LiteralPath $deploy -PathType Container)) {
  throw "Deploy repository not found: $deploy"
}
if (-not (Test-Path -LiteralPath $pub -PathType Container)) {
  throw "Deploy public directory is missing: $pub"
}

$resolvedDeploy = (Resolve-Path -LiteralPath $deploy).Path.TrimEnd('\')
$resolvedPub = (Resolve-Path -LiteralPath $pub).Path.TrimEnd('\')
if (-not $resolvedPub.StartsWith($resolvedDeploy + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to sync outside the deploy repository: $resolvedPub"
}

$srcAssets = Join-Path $src "assets"
$pubAssets = Join-Path $pub "assets"
if (-not (Test-Path -LiteralPath $srcAssets -PathType Container)) {
  throw "Source assets directory not found: $srcAssets"
}

foreach ($file in $pages) {
  $sourceFile = Join-Path $src $file
  if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) {
    throw "Required public file is missing from source: $sourceFile"
  }
}

$allowedTopLevel = @($pages + "assets")
$staleTopLevel = @(
  Get-ChildItem -LiteralPath $pub -Force |
    Where-Object { $allowedTopLevel -cnotcontains $_.Name } |
    Sort-Object Name
)

$sourceAssetFiles = Get-RelativeFiles $srcAssets
$deployAssetFiles = Get-RelativeFiles $pubAssets
$staleAssetFiles = @($deployAssetFiles | Where-Object { $sourceAssetFiles -cnotcontains $_ })
$changedAssetFiles = @(
  $sourceAssetFiles | Where-Object {
    $gitRelative = $_.Replace('\', '/')
    ($deployAssetFiles -cnotcontains $_) -or
      ((Get-FilteredGitBlobOrMissing $root "nooyouniverse.com/assets/$gitRelative" (Join-Path $srcAssets $_)) -ne
        (Get-FilteredGitBlobOrMissing $deploy "public/assets/$gitRelative" (Join-Path $pubAssets $_)))
  }
)

Write-Host "== Repository targets ==" -ForegroundColor Cyan
Write-Host "  Source: $root"
Invoke-Git $root @("status", "--short", "--branch") | ForEach-Object { Write-Host "    $_" }
Write-Host "  Deploy: $deploy"
Invoke-Git $deploy @("status", "--short", "--branch") | ForEach-Object { Write-Host "    $_" }

Write-Host "== Exact source -> deploy comparison ==" -ForegroundColor Cyan
foreach ($file in $pages) {
  $sourceFile = Join-Path $src $file
  $deployFile = Join-Path $pub $file
  $gitFile = $file.Replace('\', '/')
  $sourceBlob = Get-FilteredGitBlobOrMissing $root "nooyouniverse.com/$gitFile" $sourceFile
  $deployBlob = Get-FilteredGitBlobOrMissing $deploy "public/$gitFile" $deployFile
  $state = if ($sourceBlob -eq $deployBlob) {
    "unchanged"
  } else {
    "would sync"
  }
  Write-Host "  [$state] $file"
}

Write-Host "  [preview] assets\ - source $($sourceAssetFiles.Count) file(s), $($changedAssetFiles.Count) new/changed, $($staleAssetFiles.Count) stale"
foreach ($relative in $changedAssetFiles) {
  Write-Host "  [would sync asset] assets\$relative"
}
foreach ($relative in $staleAssetFiles) {
  Write-Host "  [would remove stale asset] assets\$relative" -ForegroundColor Yellow
}
foreach ($item in $staleTopLevel) {
  Write-Host "  [would remove deploy-only] $($item.Name)" -ForegroundColor Yellow
}

if ($Preview) {
  Write-Host ""
  Write-Host "Preview complete. No files copied, removed, staged, committed, pushed, or deployed." -ForegroundColor Green
  Write-Host "Merge the exact source change to MyPersonas main first. Then rerun from clean, current main checkouts with -Publish and an explicit -Message." -ForegroundColor Yellow
  exit 0
}

$canonicalRoot = [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $root) "MyPersonas")).TrimEnd('\')
$canonicalDeploy = [System.IO.Path]::GetFullPath($defaultDeploy).TrimEnd('\')
$resolvedRoot = (Resolve-Path -LiteralPath $root).Path.TrimEnd('\')
if (-not $resolvedRoot.Equals($canonicalRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Publish must run from the canonical MyPersonas checkout, not a worktree: $resolvedRoot"
}
if (-not $resolvedDeploy.Equals($canonicalDeploy, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Publish must use the canonical Noo YouNiverse deploy checkout, not a worktree: $resolvedDeploy"
}
if (-not (Test-Path -LiteralPath (Join-Path $resolvedRoot ".git") -PathType Container)) {
  throw "Publish requires the primary MyPersonas checkout with its own Git directory: $resolvedRoot"
}
if (-not (Test-Path -LiteralPath (Join-Path $resolvedDeploy ".git") -PathType Container)) {
  throw "Publish requires the primary Noo YouNiverse deploy checkout with its own Git directory: $resolvedDeploy"
}

Assert-ExpectedOrigin $root "castleism/MyPersonas" "MyPersonas source repository"
Assert-ExpectedOrigin $deploy "castleism/nooyouniverse" "Noo YouNiverse deploy repository"
Assert-CleanMainAtOrigin $root "MyPersonas source repository"
Assert-CleanMainAtOrigin $deploy "Noo YouNiverse deploy repository"

# Remove stale names before copying. On Windows this is required for a
# case-only rename: copying foo.png over Foo.png does not reliably change the
# on-disk name, while Cloudflare asset paths are case-sensitive.
foreach ($relative in $staleAssetFiles) {
  $target = Join-Path $pubAssets $relative
  Assert-ChildPath $target $pub
  Remove-Item -LiteralPath $target -Force
}
foreach ($item in $staleTopLevel) {
  Assert-ChildPath $item.FullName $pub
  Remove-Item -LiteralPath $item.FullName -Recurse -Force
}

if (Test-Path -LiteralPath $pubAssets -PathType Container) {
  Get-ChildItem -LiteralPath $pubAssets -Force -Recurse -Directory |
    Sort-Object { $_.FullName.Length } -Descending |
    ForEach-Object {
      if (-not (Get-ChildItem -LiteralPath $_.FullName -Force)) {
        Assert-ChildPath $_.FullName $pub
        Remove-Item -LiteralPath $_.FullName -Force
      }
    }
}

foreach ($file in $pages) {
  Copy-Item -LiteralPath (Join-Path $src $file) -Destination (Join-Path $pub $file) -Force
}

if (-not (Test-Path -LiteralPath $pubAssets -PathType Container)) {
  New-Item -ItemType Directory -Path $pubAssets -Force | Out-Null
}
foreach ($relative in $sourceAssetFiles) {
  $sourceFile = Join-Path $srcAssets $relative
  $deployFile = Join-Path $pubAssets $relative
  $deployParent = Split-Path -Parent $deployFile
  Assert-ChildPath $deployParent $pub
  New-Item -ItemType Directory -Path $deployParent -Force | Out-Null
  Copy-Item -LiteralPath $sourceFile -Destination $deployFile -Force
}

# Re-read every published byte and file set before staging.
foreach ($file in $pages) {
  $sourceFile = Join-Path $src $file
  $deployFile = Join-Path $pub $file
  if ((Get-FileHashOrMissing $sourceFile) -ne (Get-FileHashOrMissing $deployFile)) {
    throw "Post-sync parity failed for required file: $file"
  }
}
$postSyncAssets = Get-RelativeFiles $pubAssets
$assetSetDrift = @(
  Compare-Object -ReferenceObject $sourceAssetFiles -DifferenceObject $postSyncAssets -CaseSensitive
)
if ($assetSetDrift.Count -gt 0) {
  throw "Post-sync asset file set does not exactly match canonical source."
}
foreach ($relative in $sourceAssetFiles) {
  if ((Get-FileHashOrMissing (Join-Path $srcAssets $relative)) -ne
      (Get-FileHashOrMissing (Join-Path $pubAssets $relative))) {
    throw "Post-sync asset hash mismatch: $relative"
  }
}
$remainingDeployOnly = @(
  Get-ChildItem -LiteralPath $pub -Force |
    Where-Object { $allowedTopLevel -cnotcontains $_.Name }
)
if ($remainingDeployOnly.Count -gt 0) {
  throw "Post-sync deploy-only public artifacts remain: $($remainingDeployOnly.Name -join ', ')"
}

Invoke-Git $deploy @("add", "-A", "--", "public") | Out-Null

# Compare the exact Git blobs that would be committed, not only working-tree
# bytes. This catches line-ending filters and any other staging transform.
foreach ($file in $pages) {
  $gitFile = $file.Replace('\', '/')
  $sourceBlob = (Invoke-Git $root @("rev-parse", "HEAD:nooyouniverse.com/$gitFile") | Select-Object -First 1).Trim()
  $deployBlob = (Invoke-Git $deploy @("rev-parse", ":public/$gitFile") | Select-Object -First 1).Trim()
  if ($sourceBlob -ne $deployBlob) {
    throw "Staged deploy blob does not match merged source: $file"
  }
}
foreach ($relative in $sourceAssetFiles) {
  $gitRelative = $relative.Replace('\', '/')
  $sourceBlob = (Invoke-Git $root @("rev-parse", "HEAD:nooyouniverse.com/assets/$gitRelative") | Select-Object -First 1).Trim()
  $deployBlob = (Invoke-Git $deploy @("rev-parse", ":public/assets/$gitRelative") | Select-Object -First 1).Trim()
  if ($sourceBlob -ne $deployBlob) {
    throw "Staged deploy asset blob does not match merged source: $relative"
  }
}

& git -C $deploy diff --cached --quiet -- public
if ($LASTEXITCODE -eq 0) {
  Write-Host "No public artifact changed; nothing was committed or pushed." -ForegroundColor Green
  exit 0
}
if ($LASTEXITCODE -ne 1) {
  throw "Could not inspect the staged deploy diff."
}

Invoke-Git $deploy @("commit", "-m", $Message, "--", "public") | Out-Null
Invoke-Git $deploy @("push", "origin", "main") | Out-Null
$deployedCommit = (Invoke-Git $deploy @("rev-parse", "HEAD") | Select-Object -First 1).Trim()

Write-Host ""
Write-Host "Deploy source pushed: $deployedCommit" -ForegroundColor Green
Write-Host "The Cloudflare Git integration may build this commit; a prior hook failed." -ForegroundColor Yellow
Write-Host "Verify the exact build/deployment, then read back routes, headers, content, assets, canonical URLs, and the custom 404 before marking the release live."
Write-Host "For a CSP change, use an owner-approved test address to check the browser console and waitlist submission, verify the exact Supabase row, then clean up only that row."
Write-Host "Cloudflare deployments:"
Write-Host "  https://dash.cloudflare.com/?to=/:account/workers/services/view/nooyouniverse/production/deployments"
Write-Host "Public checks:"
Write-Host "  https://nooyouniverse.com  /log  /sources  /corrections"
