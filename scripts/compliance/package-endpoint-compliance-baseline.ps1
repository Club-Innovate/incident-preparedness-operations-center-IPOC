param(
	[Parameter(Mandatory = $false)]
	[string]$OutputRoot = "security-compliance/releases"
)

$ErrorActionPreference = "Stop"

$requiredFiles = @(
	"security-compliance/controls/endpoint-minimum-necessary-reviews.csv",
	"security-compliance/evidence/evidence-register.csv",
	"security-compliance/controls/endpoint-remediation-kpi.md",
	"security-compliance/controls/endpoint-ready-to-close-summary.md",
	"security-compliance/controls/endpoint-remediation-sla-summary.md",
	"security-compliance/controls/endpoint-evidence-completion-gaps-summary.md",
	"security-compliance/controls/endpoint-compliance-executive-summary.md",
	"security-compliance/controls/endpoint-compliance-trend.md",
	"security-compliance/controls/IPOC_HIPAA_HITRUST_Applicability.md"
)

foreach ($file in $requiredFiles) {
	if (-not (Test-Path -LiteralPath $file)) {
		throw "Required artifact not found: $file"
	}
}

if (-not (Test-Path -LiteralPath $OutputRoot)) {
	New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$packageDir = Join-Path $OutputRoot "endpoint-compliance-baseline-$stamp"
$artifactsDir = Join-Path $packageDir "artifacts"
New-Item -ItemType Directory -Path $artifactsDir -Force | Out-Null

foreach ($file in $requiredFiles) {
	$relative = $file
	$destination = Join-Path $artifactsDir $relative
	$destDir = Split-Path -Parent $destination
	if (-not (Test-Path -LiteralPath $destDir)) {
		New-Item -ItemType Directory -Path $destDir -Force | Out-Null
	}

	Copy-Item -LiteralPath $file -Destination $destination -Force
}

$manifestPath = Join-Path $packageDir 'manifest.md'
$manifest = New-Object System.Collections.Generic.List[string]
$manifest.Add('# Endpoint Compliance Baseline Package')
$manifest.Add('')
$manifest.Add("Generated: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))")
$manifest.Add('')
$manifest.Add('## Included Artifacts')

foreach ($file in $requiredFiles) {
	$copiedPath = Join-Path $artifactsDir $file
	$hash = (Get-FileHash -LiteralPath $copiedPath -Algorithm SHA256).Hash
	$manifest.Add("- $file")
	$manifest.Add("  - SHA256: $hash")
}

$manifest | Set-Content -LiteralPath $manifestPath -Encoding UTF8

$zipPath = "$packageDir.zip"
if (Test-Path -LiteralPath $zipPath) {
	Remove-Item -LiteralPath $zipPath -Force
}
Compress-Archive -Path $packageDir -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "Baseline package directory: $packageDir"
Write-Host "Baseline package zip: $zipPath"
Write-Host "Manifest: $manifestPath"