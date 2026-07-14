param(
	[Parameter(Mandatory = $false)]
	[string]$LedgerPath = "security-compliance/controls/endpoint-minimum-necessary-reviews.csv",

	[Parameter(Mandatory = $false)]
	[string]$EvidenceRegisterPath = "security-compliance/evidence/evidence-register.csv",

	[Parameter(Mandatory = $false)]
	[string]$OutputPath = "security-compliance/controls/endpoint-remediation-kpi.md"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $LedgerPath)) {
	throw "Ledger not found: $LedgerPath"
}

$rows = Import-Csv -LiteralPath $LedgerPath
$now = Get-Date

$total = $rows.Count

$decisionCounts = @{}
foreach ($d in @('Requires Changes', 'In Review', 'Pending', 'Closed')) {
	$decisionCounts[$d] = ($rows | Where-Object { $_.Decision -eq $d }).Count
}

$statusCounts = @{}
foreach ($s in @('Open-Remediation', 'Open-Review', 'Open-Queued', 'Closed')) {
	$statusCounts[$s] = ($rows | Where-Object { $_.RemediationStatus -eq $s }).Count
}

$riskCounts = @{}
foreach ($r in @('High', 'Medium', 'Low')) {
	$riskCounts[$r] = ($rows | Where-Object { $_.RiskTier -eq $r }).Count
}

$ownerSummary = $rows | Group-Object Owner | Sort-Object Name
$ownerLines = $ownerSummary | ForEach-Object { "- **$($_.Name)**: $($_.Count) endpoint(s)" }

$evidenceCoverage = "N/A"
if (Test-Path -LiteralPath $EvidenceRegisterPath) {
	$evidence = Import-Csv -LiteralPath $EvidenceRegisterPath
	$withEvidence = ($rows | Where-Object { -not [string]::IsNullOrWhiteSpace($_.EvidenceRef) -and $_.EvidenceRef -ne '<EV-ID>' }).Count
	$coveragePct = if ($total -gt 0) { [math]::Round(($withEvidence / $total) * 100, 1) } else { 0 }
	$evidenceCoverage = "$withEvidence / $total ($coveragePct%)"
}

$content = @(
	'# Endpoint Remediation KPI Snapshot',
	'',
	"Generated: $($now.ToString('yyyy-MM-dd HH:mm:ss'))",
	'',
	'## Backlog',
	"- Total endpoints: **$total**",
	"- Requires Changes: **$($decisionCounts['Requires Changes'])**",
	"- In Review: **$($decisionCounts['In Review'])**",
	"- Pending: **$($decisionCounts['Pending'])**",
	"- Closed: **$($decisionCounts['Closed'])**",
	'',
	'## Remediation Status',
	"- Open-Remediation: **$($statusCounts['Open-Remediation'])**",
	"- Open-Review: **$($statusCounts['Open-Review'])**",
	"- Open-Queued: **$($statusCounts['Open-Queued'])**",
	"- Closed: **$($statusCounts['Closed'])**",
	'',
	'## Risk Distribution',
	"- High: **$($riskCounts['High'])**",
	"- Medium: **$($riskCounts['Medium'])**",
	"- Low: **$($riskCounts['Low'])**",
	'',
	'## Evidence Coverage',
	"- Ledger rows with EvidenceRef: **$evidenceCoverage**",
	'',
	'## Owner Distribution'
)
$content += $ownerLines

$targetDir = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $targetDir)) {
	New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

$content | Set-Content -LiteralPath $OutputPath -Encoding UTF8

Write-Host "KPI snapshot refreshed: $OutputPath"
