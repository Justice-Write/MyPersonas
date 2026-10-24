# deploy-nooyouniverse.ps1 — compare or publish nooyouniverse.com
#
# Preview is the default and is read-only:
#   & .\_ops\deploy-nooyouniverse.ps1 `
#     -SourceDirectory .\nooyouniverse.com `
#     -DeployRepository "$HOME\Documents\GitHub\nooyouniverse"
#
# Publishing is intentionally strict. It requires -Publish, an explicit commit
# message, and the exact current commit of both repositories. The deploy push is
# last because it may trigger an external Cloudflare build. A push is never
# treated as proof of deployment; verify the Cloudflare deployment and live site.

[CmdletBinding()]
param(
  [string]$Message,
  [string]$SourceDirectory,
  [string]$DeployRepository,
  [string]$ExpectedSourceRef,
  [string]$ExpectedDeployRef,
  [switch]$Publish,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
if ($Publish -and $DryRun) {
  throw "Choose either -Publish or -DryRun, not both."
}

$sourceRepo = Split-Path -Parent $PSScriptRoot
$src = if ($SourceDirectory) {
  $SourceDirectory
} else {
  Join-Path $sourceRepo "nooyouniverse.com"
}
$deploy = if ($DeployRepository) {
  $DeployRepository
} else {
  Join-Path (Split-Path -Parent $sourceRepo) "nooyouniverse"
}

if (-not (Test-Path -LiteralPath $src -PathType Container)) {
  throw "Source directory not found: $src"
}
if (-not (Test-Path -LiteralPath $deploy -PathType Container)) {
  throw "Deploy repository not found: $deploy"
}

$src = (Resolve-Path -LiteralPath $src).Path.TrimEnd('\')
$deploy = (Resolve-Path -LiteralPath $deploy).Path.TrimEnd('\')
$pub = Join-Path $deploy "public"
if (-not (Test-Path -LiteralPath $pub -PathType Container)) {
  throw "Deploy public directory not found: $pub"
}
$pub = (Resolve-Path -LiteralPath $pub).Path.TrimEnd('\')

function Get-GitValue([string]$Repository, [string[]]$Arguments) {
  $value = & git -C $Repository @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git failed in ${Repository}: git $($Arguments -join ' ')"
  }
  return ($value | Out-String).Trim()
}

function Assert-ChildPath([string]$Path, [string]$Parent) {
  $fullPath = [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
  $fullParent = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\')
  if (-not $fullPath.StartsWith($fullParent + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing path outside the verified root '$fullParent': $fullPath"
  }
}

function Get-Sha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}

function Assert-NoReparsePoints([string]$Root) {
  foreach ($item in Get-ChildItem -LiteralPath $Root -Recurse -Force) {
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Publish trees cannot contain symbolic links or reparse points: $($item.FullName)"
    }
  }
}

function Add-ManifestFile([hashtable]$Manifest, [string]$Root, [string]$Path) {
  Assert-ChildPath $Path $Root
  $item = Get-Item -LiteralPath $Path -Force
  if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Publish files cannot be symbolic links or reparse points: $Path"
  }
  $relative = $Path.Substring($Root.Length + 1).Replace('\', '/')
  if ($Manifest.ContainsKey($relative)) {
    throw "Duplicate publish path: $relative"
  }
  $Manifest[$relative] = [pscustomobject]@{
    RelativePath = $relative
    FullPath = $Path
    Hash = Get-Sha256 $Path
  }
}

function Get-SourceManifest([string]$Root) {
  Assert-NoReparsePoints $Root
  $manifest = @{}
  $requiredFiles = @(
    "index.html",
    "log.html",
    "sources.html",
    "corrections.html",
    "404.html",
    "robots.txt",
    "sitemap.xml",
    "CNAME",
    "_headers",
    "manifest.webmanifest",
    "sw.js",
    "offline.html"
  )

  foreach ($relative in $requiredFiles) {
    $path = Join-Path $Root $relative
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
      throw "Required publish file is missing: $relative"
    }
    Add-ManifestFile $manifest $Root $path
  }

  $assets = Join-Path $Root "assets"
  if (-not (Test-Path -LiteralPath $assets -PathType Container)) {
    throw "Required publish directory is missing: assets"
  }
  foreach ($file in Get-ChildItem -LiteralPath $assets -Recurse -Force -File) {
    Add-ManifestFile $manifest $Root $file.FullName
  }

  # SITE-ROADMAP.md is deliberately source-only. Every other file below the
  # canonical source directory must be part of the explicit publish manifest,
  # so a held page such as education.html cannot be silently ignored.
  foreach ($file in Get-ChildItem -LiteralPath $Root -Recurse -Force -File) {
    $relative = $file.FullName.Substring($Root.Length + 1).Replace('\', '/')
    if ($relative -eq "SITE-ROADMAP.md") { continue }
    if (-not $manifest.ContainsKey($relative)) {
      throw "Unexpected source file is not publish-allowlisted: $relative"
    }
  }
  return $manifest
}

function Get-DeployManifest([string]$Root) {
  Assert-NoReparsePoints $Root
  $manifest = @{}
  foreach ($file in Get-ChildItem -LiteralPath $Root -Recurse -Force -File) {
    Add-ManifestFile $manifest $Root $file.FullName
  }
  return $manifest
}

function Compare-Manifests([hashtable]$Source, [hashtable]$Target) {
  $changes = @()
  $unchanged = 0
  $keys = @($Source.Keys) + @($Target.Keys) | Sort-Object -Unique
  foreach ($relative in $keys) {
    $inSource = $Source.ContainsKey($relative)
    $inTarget = $Target.ContainsKey($relative)
    if ($inSource -and -not $inTarget) {
      $changes += [pscustomobject]@{ Action = "ADD"; RelativePath = $relative }
    } elseif (-not $inSource -and $inTarget) {
      $changes += [pscustomobject]@{ Action = "DELETE"; RelativePath = $relative }
    } elseif ($Source[$relative].Hash -ne $Target[$relative].Hash) {
      $changes += [pscustomobject]@{ Action = "CHANGE"; RelativePath = $relative }
    } else {
      $unchanged++
    }
  }
  return [pscustomobject]@{
    Changes = $changes
    Unchanged = $unchanged
    SourceCount = $Source.Count
    TargetCount = $Target.Count
  }
}

function Write-Comparison($Comparison) {
  foreach ($change in $Comparison.Changes) {
    Write-Host ("  [{0}] {1}" -f $change.Action, $change.RelativePath)
  }
  Write-Host ("  source {0} file(s); deploy {1} file(s); unchanged {2}; differences {3}" -f `
    $Comparison.SourceCount, $Comparison.TargetCount, $Comparison.Unchanged, $Comparison.Changes.Count)
}

function Assert-ExactRef([string]$Repository, [string]$Expected, [string]$Label) {
  if ([string]::IsNullOrWhiteSpace($Expected)) {
    throw "-$Label is required with -Publish. Read the exact commit with: git -C '$Repository' rev-parse HEAD"
  }
  $head = Get-GitValue $Repository @("rev-parse", "HEAD")
  if ($head -ne $Expected) {
    throw "$Label mismatch. Expected $Expected but found $head. Re-review before publishing."
  }
  $branch = Get-GitValue $Repository @("rev-parse", "--abbrev-ref", "HEAD")
  if ($branch -ne "main") {
    throw "Publishing requires the reviewed main branch in $Repository; found '$branch'."
  }
  $upstream = Get-GitValue $Repository @("rev-parse", "--verify", "@{u}")
  if ($head -ne $upstream) {
    throw "Publishing requires HEAD to equal its upstream before release in $Repository."
  }
}

function Assert-ExpectedRemote([string]$Repository, [string]$RepositoryName) {
  $remote = Get-GitValue $Repository @("remote", "get-url", "origin")
  $pattern = "(?i)(?:github\.com[/:])(?:Justice-Write|castleism)/$([regex]::Escape($RepositoryName))(?:\.git)?$"
  if ($remote -notmatch $pattern) {
    throw "Unexpected origin for $RepositoryName in ${Repository}: $remote"
  }
}

function Assert-NoUnrelatedChanges([string]$Repository, [string[]]$AllowedPrefixes) {
  $paths = @()
  $paths += @(Get-GitValue $Repository @("diff", "--name-only")) -split "`r?`n"
  $paths += @(Get-GitValue $Repository @("diff", "--cached", "--name-only")) -split "`r?`n"
  $paths += @(Get-GitValue $Repository @("ls-files", "--others", "--exclude-standard")) -split "`r?`n"
  foreach ($path in $paths | Where-Object { $_ } | Sort-Object -Unique) {
    $normalized = $path.Replace('\', '/')
    $allowed = $false
    foreach ($prefix in $AllowedPrefixes) {
      if ($normalized -eq $prefix -or $normalized.StartsWith($prefix, [System.StringComparison]::Ordinal)) {
        $allowed = $true
        break
      }
    }
    if (-not $allowed) {
      throw "Unrelated working-tree change blocks publishing in ${Repository}: $normalized"
    }
  }
}

function Commit-Paths([string]$Repository, [string]$CommitMessage, [string[]]$Paths) {
  & git -C $Repository add -- @Paths
  if ($LASTEXITCODE -ne 0) { throw "git add failed in $Repository" }
  & git -C $Repository diff --cached --quiet -- @Paths
  $diffExit = $LASTEXITCODE
  if ($diffExit -eq 0) {
    Write-Host "  (nothing to commit in $Repository)" -ForegroundColor DarkGray
    return
  }
  if ($diffExit -ne 1) { throw "git diff --cached failed in $Repository" }
  & git -C $Repository commit -m $CommitMessage -- @Paths
  if ($LASTEXITCODE -ne 0) { throw "git commit failed in $Repository" }
}

$sourceManifest = Get-SourceManifest $src
$deployManifest = Get-DeployManifest $pub
$comparison = Compare-Manifests $sourceManifest $deployManifest

Write-Host "== Noo YouNiverse source/deploy comparison ==" -ForegroundColor Cyan
Write-Comparison $comparison

if (-not $Publish) {
  Write-Host ""
  Write-Host "Preview complete. No files copied, deleted, staged, committed, pushed, or deployed." -ForegroundColor Green
  if ($comparison.Changes.Count -eq 0) {
    Write-Host "Source and deploy public trees are byte-for-byte identical for all published files." -ForegroundColor Green
  } else {
    Write-Host "Review every ADD, CHANGE, and DELETE before any authorized publish run." -ForegroundColor Yellow
  }
  return
}

if ([string]::IsNullOrWhiteSpace($Message)) {
  throw "-Message is required with -Publish."
}

$sourceRepo = Get-GitValue $src @("rev-parse", "--show-toplevel")
$deployRepo = Get-GitValue $deploy @("rev-parse", "--show-toplevel")
if ($sourceRepo -eq $deployRepo) {
  throw "Source and deploy must be separate repositories."
}
Assert-ExpectedRemote $sourceRepo "MyPersonas"
Assert-ExpectedRemote $deployRepo "nooyouniverse"
Assert-ExactRef $sourceRepo $ExpectedSourceRef "ExpectedSourceRef"
Assert-ExactRef $deployRepo $ExpectedDeployRef "ExpectedDeployRef"
Assert-NoUnrelatedChanges $sourceRepo @("nooyouniverse.com/", "_ops/deploy-nooyouniverse.ps1")
Assert-NoUnrelatedChanges $deployRepo @("public/")

foreach ($change in $comparison.Changes | Where-Object { $_.Action -eq "DELETE" }) {
  $target = Join-Path $pub $change.RelativePath
  Assert-ChildPath $target $pub
  Remove-Item -LiteralPath $target -Force
}
foreach ($entry in $sourceManifest.Values) {
  $target = Join-Path $pub $entry.RelativePath
  Assert-ChildPath $target $pub
  $parent = Split-Path -Parent $target
  if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
  Copy-Item -LiteralPath $entry.FullPath -Destination $target -Force
}

$after = Compare-Manifests (Get-SourceManifest $src) (Get-DeployManifest $pub)
if ($after.Changes.Count -ne 0) {
  Write-Comparison $after
  throw "Post-copy parity check failed; nothing has been pushed."
}

# Preserve the canonical source remotely before the deploy push can publish.
Commit-Paths $sourceRepo $Message @("nooyouniverse.com", "_ops/deploy-nooyouniverse.ps1")
Commit-Paths $deployRepo $Message @("public")

& git -C $sourceRepo push origin HEAD:main
if ($LASTEXITCODE -ne 0) { throw "Source push failed; deploy was not pushed." }
& git -C $deployRepo push origin HEAD:main
if ($LASTEXITCODE -ne 0) { throw "Deploy push failed. Inspect remote state before retrying." }

Write-Host ""
Write-Host "Both reviewed commits were pushed. A Git-connected build may have started; that is not deployment proof." -ForegroundColor Yellow
Write-Host "Confirm the exact Cloudflare deployment, then read back the live routes, service worker, manifest, and security headers." -ForegroundColor Yellow
