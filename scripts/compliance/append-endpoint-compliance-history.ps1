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
	[string]$EvidenceGapCsvPath = "security-compliance/controls/endpoint-evidence-completion-gaps.csv",

	[Parameter(Mandatory = $false)]
	[string]$HistoryCsvPath = "security-compliance/controls/endpoint-compliance-history.csv"
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

$readyToClose = 0
if (Test-Path -LiteralPath $ReadySummaryPath) {
	$readyLine = (Get-Content -LiteralPath $ReadySummaryPath | Where-Object { $_ -match '^- Ready to close:' } | Select-Object -First 1)
	if ($readyLine) {
		$m = [regex]::Match($readyLine, '\*\*(\d+)\*\*')
		if ($m.Success) { $readyToClose = [int]$m.Groups[1].Value }
	}
}

$overdue = 0
if (Test-Path -LiteralPath $SlaSummaryPath) {
	$overdueLine = (Get-Content -LiteralPath $SlaSummaryPath | Where-Object { $_ -match '^- Overdue items:' } | Select-Object -First 1)
	if ($overdueLine) {
		$m = [regex]::Match($overdueLine, '\*\*(\d+)\*\*')
		if ($m.Success) { $overdue = [int]$m.Groups[1].Value }
	}
}

$evidenceTotal = 0
$evidenceInProgress = 0
$evidenceApproved = 0
if (Test-Path -LiteralPath $EvidenceRegisterPath) {
	$evidence = Import-Csv -LiteralPath $EvidenceRegisterPath
	$evidenceTotal = $evidence.Count
	$evidenceInProgress = ($evidence | Where-Object { $_.Status -eq 'In Progress' }).Count
	$evidenceApproved = ($evidence | Where-Object { $_.Status -eq 'Approved' }).Count
}

$evidenceGaps = 0
if (Test-Path -LiteralPath $EvidenceGapCsvPath) {
	$gapRows = @(Import-Csv -LiteralPath $EvidenceGapCsvPath)
	$evidenceGaps = $gapRows.Count
}

$timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
$historyColumns = @(
	'TimestampUtc',
	'TotalEndpoints',
	'Closed',
	'RequiresChanges',
	'InReview',
	'Pending',
	'ReadyToClose',
	'Overdue',
	'EvidenceTotal',
	'EvidenceInProgress',
	'EvidenceApproved',
	'EvidenceGaps'
)

$entry = [PSCustomObject]@{
	TimestampUtc = $timestamp
	TotalEndpoints = $total
	Closed = $closed
	RequiresChanges = $requiresChanges
	InReview = $inReview
	Pending = $pending
	ReadyToClose = $readyToClose
	Overdue = $overdue
	EvidenceTotal = $evidenceTotal
	EvidenceInProgress = $evidenceInProgress
	EvidenceApproved = $evidenceApproved
	EvidenceGaps = $evidenceGaps
}

$history = @()
if (Test-Path -LiteralPath $HistoryCsvPath) {
	$history = @(Import-Csv -LiteralPath $HistoryCsvPath | ForEach-Object {
		[PSCustomObject]@{
			TimestampUtc = $_.TimestampUtc
			TotalEndpoints = $_.TotalEndpoints
			Closed = $_.Closed
			RequiresChanges = $_.RequiresChanges
			InReview = $_.InReview
			Pending = $_.Pending
			ReadyToClose = $_.ReadyToClose
			Overdue = $_.Overdue
			EvidenceTotal = $_.EvidenceTotal
			EvidenceInProgress = $_.EvidenceInProgress
			EvidenceApproved = $_.EvidenceApproved
			EvidenceGaps = if ([string]::IsNullOrWhiteSpace($_.EvidenceGaps)) { 0 } else { $_.EvidenceGaps }
		}
	})
}

$history += $entry

$targetDir = Split-Path -Parent $HistoryCsvPath
if (-not (Test-Path -LiteralPath $targetDir)) {
	New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

$history | Select-Object $historyColumns | Export-Csv -LiteralPath $HistoryCsvPath -NoTypeInformation -Encoding UTF8

Write-Host "Compliance history appended: $HistoryCsvPath"
Write-Host "Rows in history: $($history.Count)"
