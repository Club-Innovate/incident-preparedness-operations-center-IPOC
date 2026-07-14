param(
	[Parameter(Mandatory = $false)]
	[string]$GapCsvPath = "security-compliance/controls/endpoint-evidence-completion-gaps.csv",

	[Parameter(Mandatory = $false)]
	[string]$LedgerPath = "security-compliance/controls/endpoint-minimum-necessary-reviews.csv",

	[Parameter(Mandatory = $false)]
	[string]$OutputDirectory = "security-compliance/controls"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $GapCsvPath)) {
	throw "Evidence gap CSV not found: $GapCsvPath"
}

if (-not (Test-Path -LiteralPath $LedgerPath)) {
	throw "Ledger not found: $LedgerPath"
}

$gaps = Import-Csv -LiteralPath $GapCsvPath
$ledger = Import-Csv -LiteralPath $LedgerPath

$dueByEvidence = @{}
foreach ($row in $ledger) {
	if (-not [string]::IsNullOrWhiteSpace($row.EvidenceRef)) {
		$dueByEvidence[$row.EvidenceRef] = $row.DueDateUtc
	}
}

$testGaps = $gaps | Where-Object { $_.MissingItems -match 'Test evidence' }

$queueRows = foreach ($g in $testGaps) {
	[PSCustomObject]@{
		Owner = $g.Owner
		Decision = $g.Decision
		RiskTier = $g.RiskTier
		RiskScore = [int]$g.RiskScore
		DueDateUtc = if ($dueByEvidence.ContainsKey($g.EvidenceRef)) { $dueByEvidence[$g.EvidenceRef] } else { '' }
		Endpoint = $g.Endpoint
		Method = $g.Method
		EvidenceRef = $g.EvidenceRef
		EvidencePath = $g.EvidencePath
		MissingItems = $g.MissingItems
	}
}

$sorted = $queueRows | Sort-Object @{Expression='RiskScore';Descending=$true}, DueDateUtc, Owner, Endpoint

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
	New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

$csvPath = Join-Path $OutputDirectory 'endpoint-test-evidence-queue.csv'
$mdPath = Join-Path $OutputDirectory 'endpoint-test-evidence-queue-summary.md'

$sorted | Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding UTF8

$ownerLines = $sorted | Group-Object Owner | Sort-Object Count -Descending | ForEach-Object { "- **$($_.Name)**: $($_.Count)" }
$decisionLines = $sorted | Group-Object Decision | Sort-Object Name | ForEach-Object { "- **$($_.Name)**: $($_.Count)" }

$lines = @(
	'# Endpoint Test Evidence Queue Summary',
	'',
	"Generated: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))",
	'',
	"- Queue rows: **$($sorted.Count)**",
	"- CSV export: $csvPath",
	''
)

$lines += '## Queue by Owner'
if ($ownerLines.Count -eq 0) { $lines += '- None' } else { $lines += $ownerLines }

$lines += ''
$lines += '## Queue by Decision'
if ($decisionLines.Count -eq 0) { $lines += '- None' } else { $lines += $decisionLines }

$lines += ''
$lines += '## Top 10 Priority Rows'
if ($sorted.Count -eq 0) {
	$lines += '- None'
}
else {
	foreach ($item in ($sorted | Select-Object -First 10)) {
		$lines += "- [$($item.Decision)] $($item.Method) $($item.Endpoint) | Owner=$($item.Owner) | Risk=$($item.RiskTier)/$($item.RiskScore) | Due=$($item.DueDateUtc) | EvidenceRef=$($item.EvidenceRef)"
	}
}

$lines | Set-Content -LiteralPath $mdPath -Encoding UTF8

Write-Host "Test evidence queue summary written: $mdPath"
Write-Host "Test evidence queue CSV written: $csvPath"
Write-Host "Queue rows: $($sorted.Count)"
