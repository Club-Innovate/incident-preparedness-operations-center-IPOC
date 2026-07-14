param(
	[Parameter(Mandatory = $false)]
	[string]$LedgerPath = "security-compliance/controls/endpoint-minimum-necessary-reviews.csv",

	[Parameter(Mandatory = $false)]
	[string]$EvidenceRegisterPath = "security-compliance/evidence/evidence-register.csv",

	[Parameter(Mandatory = $false)]
	[string]$ReadySummaryPath = "security-compliance/controls/endpoint-ready-to-close-summary.md",

	[Parameter(Mandatory = $false)]
	[string]$SlaSummaryPath = "security-compliance/controls/endpoint-remediation-sla-summary.md",

	[Parameter(Mandatory = $false)]
	[string]$OutputPath = "security-compliance/controls/endpoint-compliance-executive-summary.md"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $LedgerPath)) {
	throw "Ledger not found: $LedgerPath"
}

$rows = Import-Csv -LiteralPath $LedgerPath
$total = $rows.Count
$closed = ($rows | Where-Object { $_.Decision -eq 'Closed' -or $_.RemediationStatus -eq 'Closed' }).Count
$requiresChanges = ($rows | Where-Object { $_.Decision -eq 'Requires Changes' }).Count
$inReview = ($rows | Where-Object { $_.Decision -eq 'In Review' }).Count
$pending = ($rows | Where-Object { $_.Decision -eq 'Pending' }).Count

$progressPct = if ($total -gt 0) { [math]::Round(($closed / $total) * 100, 1) } else { 0 }

$evidenceStatusSummary = 'N/A'
if (Test-Path -LiteralPath $EvidenceRegisterPath) {
	$evidence = Import-Csv -LiteralPath $EvidenceRegisterPath
	$statusCounts = $evidence | Group-Object Status | Sort-Object Name | ForEach-Object { "{0}: {1}" -f $_.Name, $_.Count }
	$evidenceStatusSummary = if ($statusCounts.Count -gt 0) { $statusCounts -join '; ' } else { 'None' }
}

$evidenceGapCount = 'N/A'
$gapPath = 'security-compliance/controls/endpoint-evidence-completion-gaps.csv'
if (Test-Path -LiteralPath $gapPath) {
	$evidenceGapCount = (@(Import-Csv -LiteralPath $gapPath)).Count
}

$readyLine = '- Ready-to-close summary unavailable'
if (Test-Path -LiteralPath $ReadySummaryPath) {
	$readyContent = Get-Content -LiteralPath $ReadySummaryPath
	$match = $readyContent | Where-Object { $_ -match '^- Ready to close:' } | Select-Object -First 1
	if ($match) { $readyLine = $match }
}

$slaOverdueLine = '- SLA summary unavailable'
if (Test-Path -LiteralPath $SlaSummaryPath) {
	$slaContent = Get-Content -LiteralPath $SlaSummaryPath
	$match = $slaContent | Where-Object { $_ -match '^- Overdue items:' } | Select-Object -First 1
	if ($match) { $slaOverdueLine = $match }
}

$lines = @(
	'# Endpoint Compliance Executive Summary',
	'',
	"Generated: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))",
	'',
	'## Backlog Health',
	"- Total endpoints: **$total**",
	"- Closed: **$closed** ($progressPct%)",
	"- Requires Changes: **$requiresChanges**",
	"- In Review: **$inReview**",
	"- Pending: **$pending**",
	'',
	'## Readiness & SLA',
	$readyLine,
	$slaOverdueLine,
	'',
	'## Evidence Register Status',
	"- $evidenceStatusSummary",
	"- Open evidence gaps: **$evidenceGapCount**",
	'',
	'## Source Artifacts',
	"- Ledger: $LedgerPath",
	"- KPI: security-compliance/controls/endpoint-remediation-kpi.md",
	"- Ready summary: $ReadySummaryPath",
	"- SLA summary: $SlaSummaryPath",
	"- Evidence gaps: $gapPath"
)

$targetDir = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $targetDir)) {
	New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

$lines | Set-Content -LiteralPath $OutputPath -Encoding UTF8

Write-Host "Executive summary generated: $OutputPath"
