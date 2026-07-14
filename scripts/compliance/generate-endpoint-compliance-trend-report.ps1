param(
	[Parameter(Mandatory = $false)]
	[string]$HistoryCsvPath = "security-compliance/controls/endpoint-compliance-history.csv",

	[Parameter(Mandatory = $false)]
	[string]$OutputPath = "security-compliance/controls/endpoint-compliance-trend.md"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $HistoryCsvPath)) {
	throw "History CSV not found: $HistoryCsvPath"
}

$history = @(Import-Csv -LiteralPath $HistoryCsvPath)
if ($history.Count -eq 0) {
	throw "History CSV is empty: $HistoryCsvPath"
}

$current = $history[-1]
$previous = if ($history.Count -gt 1) { $history[-2] } else { $null }

function Get-DeltaText([string]$name, [object]$currentValue, [object]$previousValue) {
	if ($null -eq $previousValue -or [string]::IsNullOrWhiteSpace([string]$previousValue)) {
		return "- ${name}: **$currentValue** (baseline)"
	}

	$curr = [int]$currentValue
	$prev = [int]$previousValue
	$delta = $curr - $prev
	$sign = if ($delta -ge 0) { '+' } else { '' }
	return "- ${name}: **$curr** ($sign$delta)"
}

$lines = @(
	'# Endpoint Compliance Trend Report',
	'',
	"Generated: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))",
	"Source history: $HistoryCsvPath",
	'',
	'## Current Snapshot',
	"- TimestampUtc: $($current.TimestampUtc)",
	"- TotalEndpoints: **$($current.TotalEndpoints)**",
	"- Closed: **$($current.Closed)**",
	"- RequiresChanges: **$($current.RequiresChanges)**",
	"- InReview: **$($current.InReview)**",
	"- Pending: **$($current.Pending)**",
	"- ReadyToClose: **$($current.ReadyToClose)**",
	"- Overdue: **$($current.Overdue)**",
	"- EvidenceInProgress: **$($current.EvidenceInProgress)**",
	"- EvidenceApproved: **$($current.EvidenceApproved)**",
	"- EvidenceGaps: **$($current.EvidenceGaps)**",
	''
)

$lines += '## Change Since Previous Snapshot'
$prevClosed = if ($null -ne $previous) { $previous.Closed } else { $null }
$prevRequiresChanges = if ($null -ne $previous) { $previous.RequiresChanges } else { $null }
$prevInReview = if ($null -ne $previous) { $previous.InReview } else { $null }
$prevPending = if ($null -ne $previous) { $previous.Pending } else { $null }
$prevReadyToClose = if ($null -ne $previous) { $previous.ReadyToClose } else { $null }
$prevOverdue = if ($null -ne $previous) { $previous.Overdue } else { $null }
$prevEvidenceApproved = if ($null -ne $previous) { $previous.EvidenceApproved } else { $null }
$prevEvidenceGaps = if ($null -ne $previous) { $previous.EvidenceGaps } else { $null }

$lines += (Get-DeltaText -name 'Closed' -currentValue $current.Closed -previousValue $prevClosed)
$lines += (Get-DeltaText -name 'RequiresChanges' -currentValue $current.RequiresChanges -previousValue $prevRequiresChanges)
$lines += (Get-DeltaText -name 'InReview' -currentValue $current.InReview -previousValue $prevInReview)
$lines += (Get-DeltaText -name 'Pending' -currentValue $current.Pending -previousValue $prevPending)
$lines += (Get-DeltaText -name 'ReadyToClose' -currentValue $current.ReadyToClose -previousValue $prevReadyToClose)
$lines += (Get-DeltaText -name 'Overdue' -currentValue $current.Overdue -previousValue $prevOverdue)
$lines += (Get-DeltaText -name 'EvidenceApproved' -currentValue $current.EvidenceApproved -previousValue $prevEvidenceApproved)
$lines += (Get-DeltaText -name 'EvidenceGaps' -currentValue $current.EvidenceGaps -previousValue $prevEvidenceGaps)

$targetDir = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $targetDir)) {
	New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

$lines | Set-Content -LiteralPath $OutputPath -Encoding UTF8

Write-Host "Trend report generated: $OutputPath"
