param(
	[Parameter(Mandatory = $false)]
	[string]$LedgerPath = "security-compliance/controls/endpoint-minimum-necessary-reviews.csv",

	[Parameter(Mandatory = $false)]
	[string]$OutputDirectory = "security-compliance/controls"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $LedgerPath)) {
	throw "Ledger not found: $LedgerPath"
}

$rows = Import-Csv -LiteralPath $LedgerPath
$today = (Get-Date).Date

$open = $rows | Where-Object { $_.Decision -ne 'Closed' -and $_.RemediationStatus -ne 'Closed' }
$overdue = $open | Where-Object {
	if ([string]::IsNullOrWhiteSpace($_.DueDateUtc)) {
		return $false
	}

	try {
		$due = [datetime]::Parse($_.DueDateUtc)
		return $due.Date -lt $today
	}
	catch {
		return $false
	}
}

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
	New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

$csvPath = Join-Path $OutputDirectory 'endpoint-remediation-overdue.csv'
$mdPath = Join-Path $OutputDirectory 'endpoint-remediation-sla-summary.md'

$overdue |
	Sort-Object @{Expression='RiskScore';Descending=$true}, DueDateUtc, Owner, Endpoint |
	Select-Object Endpoint, Method, Owner, Decision, RemediationStatus, RiskTier, RiskScore, DueDateUtc, EvidenceRef |
	Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding UTF8

$byOwner = $overdue | Group-Object Owner | Sort-Object Count -Descending
$byRisk = $overdue | Group-Object RiskTier | Sort-Object Name

$lines = @(
	'# Endpoint Remediation SLA Summary',
	'',
	"Generated: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))",
	'',
	"- Open items: **$($open.Count)**",
	"- Overdue items: **$($overdue.Count)**",
	"- Overdue export: $csvPath",
	''
)

$lines += '## Overdue by Owner'
if ($byOwner.Count -eq 0) {
	$lines += '- None'
}
else {
	$lines += ($byOwner | ForEach-Object { "- **$($_.Name)**: $($_.Count)" })
}

$lines += ''
$lines += '## Overdue by RiskTier'
if ($byRisk.Count -eq 0) {
	$lines += '- None'
}
else {
	$lines += ($byRisk | ForEach-Object { "- **$($_.Name)**: $($_.Count)" })
}

$lines | Set-Content -LiteralPath $mdPath -Encoding UTF8

Write-Host "SLA report written: $mdPath"
Write-Host "Overdue export written: $csvPath"
Write-Host "Totals => Open=$($open.Count); Overdue=$($overdue.Count)"
