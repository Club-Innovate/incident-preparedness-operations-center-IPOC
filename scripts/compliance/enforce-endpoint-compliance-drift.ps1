param(
	[Parameter(Mandatory = $false)]
	[string]$LedgerPath = "security-compliance/controls/endpoint-minimum-necessary-reviews.csv",

	[Parameter(Mandatory = $false)]
	[string]$EvidenceGapCsvPath = "security-compliance/controls/endpoint-evidence-completion-gaps.csv",

	[Parameter(Mandatory = $false)]
	[string]$SlaSummaryPath = "security-compliance/controls/endpoint-remediation-sla-summary.md"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $LedgerPath)) {
	throw "Ledger not found: $LedgerPath"
}

$rows = Import-Csv -LiteralPath $LedgerPath
$total = $rows.Count
$closed = ($rows | Where-Object { $_.Decision -eq 'Closed' -or $_.RemediationStatus -eq 'Closed' }).Count

$gaps = 0
if (Test-Path -LiteralPath $EvidenceGapCsvPath) {
	$gaps = (@(Import-Csv -LiteralPath $EvidenceGapCsvPath)).Count
}

$overdue = 0
if (Test-Path -LiteralPath $SlaSummaryPath) {
	$overdueLine = (Get-Content -LiteralPath $SlaSummaryPath | Where-Object { $_ -match '^- Overdue items:' } | Select-Object -First 1)
	if ($overdueLine) {
		$m = [regex]::Match($overdueLine, '\*\*(\d+)\*\*')
		if ($m.Success) { $overdue = [int]$m.Groups[1].Value }
	}
}

$violations = New-Object System.Collections.Generic.List[string]

if ($total -eq 0) {
	$violations.Add('Ledger is empty; cannot evaluate compliance baseline.')
}

if ($closed -lt $total) {
	$violations.Add("Closed endpoints check failed: Closed=$closed Total=$total")
}

if ($gaps -gt 0) {
	$violations.Add("Evidence gaps check failed: EvidenceGaps=$gaps")
}

if ($overdue -gt 0) {
	$violations.Add("SLA overdue check failed: Overdue=$overdue")
}

if ($violations.Count -gt 0) {
	Write-Host 'Compliance drift detected:'
	foreach ($v in $violations) {
		Write-Host "- $v"
	}
	exit 1
}

Write-Host "Compliance drift gate passed. Closed=$closed Total=$total EvidenceGaps=$gaps Overdue=$overdue"
